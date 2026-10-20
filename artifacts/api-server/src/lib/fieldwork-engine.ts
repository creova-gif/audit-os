import { Readable } from "node:stream";
import {
  db,
  ledgerIngestionJobsTable,
  anomaliesTable,
  workingPapersTable,
  engagementsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { parseLedgerStream } from "./ledger-parser";
import {
  NormalizedTransaction,
  analyzeBenfordsLaw,
  findDuplicateTransactions,
  findWeekendEntries,
  findRoundSums,
  verifyTrialBalanceBalance,
  AnomalyFinding,
} from "./anomaly-math";

/**
 * Runs the two-stage asynchronous ledger ingestion and fieldwork job.
 */
export async function processLedgerJob(jobId: number, fileBuffer: Buffer): Promise<void> {
  try {
    await db
      .update(ledgerIngestionJobsTable)
      .set({ status: "processing" })
      .where(eq(ledgerIngestionJobsTable.id, jobId));

    const [job] = await db
      .select()
      .from(ledgerIngestionJobsTable)
      .where(eq(ledgerIngestionJobsTable.id, jobId));

    if (!job) {
      throw new Error(`Job #${jobId} not found`);
    }

    const [engagement] = await db
      .select()
      .from(engagementsTable)
      .where(eq(engagementsTable.id, job.engagementId));

    const stream = Readable.from(fileBuffer);
    const allTransactions: NormalizedTransaction[] = [];

    // Stage 1: Parse and stream ledger
    const { totalRows } = await parseLedgerStream(
      stream,
      async (batch) => {
        allTransactions.push(...batch);
      },
      5000
    );

    // Verify Trial Balance equality
    const balanceResult = verifyTrialBalanceBalance(allTransactions);

    // Run deterministic analytical tests
    const benfordFindings = analyzeBenfordsLaw(allTransactions);
    const duplicateFindings = findDuplicateTransactions(allTransactions);
    const weekendFindings = findWeekendEntries(allTransactions);
    const roundSumFindings = findRoundSums(allTransactions);

    const allFindings: AnomalyFinding[] = [
      ...benfordFindings,
      ...duplicateFindings,
      ...weekendFindings,
      ...roundSumFindings,
    ];

    if (!balanceResult.isBalanced) {
      allFindings.unshift({
        anomalyType: "unbalanced_tb",
        riskLevel: "high",
        description: `Trial Balance is out of balance by $${balanceResult.variance.toFixed(2)} (Debits: $${balanceResult.totalDebits.toFixed(2)}, Credits: $${balanceResult.totalCredits.toFixed(2)}).`,
        aiExplanation: "The total debits and credits in the submitted ledger do not equal zero, indicating a fundamental data integrity or posting failure.",
      });
    }

    // Persist anomalies in batches
    if (allFindings.length > 0) {
      const recordsToInsert = allFindings.map((f) => ({
        engagementId: job.engagementId,
        anomalyType: f.anomalyType,
        riskLevel: f.riskLevel,
        accountCode: f.accountCode || null,
        accountName: f.accountName || null,
        journalRef: f.journalRef || null,
        transactionDate: f.transactionDate || null,
        amount: f.amount !== undefined ? f.amount : null,
        description: f.description,
        detectionMethod: "deterministic",
        aiExplanation: f.aiExplanation || null,
        auditorStatus: "unreviewed",
      }));

      for (let i = 0; i < recordsToInsert.length; i += 100) {
        await db.insert(anomaliesTable).values(recordsToInsert.slice(i, i + 100));
      }
    }

    // Stage 2: LLM Contextualization (Auto-draft workpaper memo if Anthropic is available)
    let aiMemoDrafted = false;
    let memoContent = "";

    try {
      if (process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY && process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL) {
        const { anthropic } = await import("@workspace/integrations-anthropic-ai");
        const topAnomalies = allFindings.slice(0, 10).map((f) => `- [${f.riskLevel.toUpperCase()}] ${f.description}`).join("\n");
        const matUsd = engagement?.materialityUsd ? `$${engagement.materialityUsd.toLocaleString()}` : "Not established";

        const prompt = `You are a Senior Audit Manager drafting a formal audit working paper memo in accordance with ISA 240, ISA 315, and ISA 520.
Engagement: ${engagement?.engagementName || "Audit Engagement"}
Planning Materiality: ${matUsd}
Population Size: ${totalRows.toLocaleString()} transactions
Total Debits: $${balanceResult.totalDebits.toLocaleString()} | Total Credits: $${balanceResult.totalCredits.toLocaleString()}
Trial Balance Balanced: ${balanceResult.isBalanced ? "YES" : `NO (Variance: $${balanceResult.variance})`}

Flagged Anomaly Summary:
- Benford's Law Deviations: ${benfordFindings.length}
- Potential Duplicate Postings: ${duplicateFindings.length}
- Weekend / Non-business Day Entries: ${weekendFindings.length}
- Round-sum Clusters ($5k+): ${roundSumFindings.length}

Top Flagged Items:
${topAnomalies}

Draft a structured Audit Working Paper in Markdown with these exact sections:
1. # OBJECTIVE & SCOPE
2. # POPULATION & RECONCILIATION SUMMARY
3. # ANALYTICAL PROCEDURES & RESULTS (detail Benford's Law, duplicates, round sums, weekend entries)
4. # SUBSTANTIVE TESTING RECOMMENDATIONS
5. # AUDIT CONCLUSION (preliminary risk assessment)`;

        const aiResponse = await anthropic.messages.create({
          model: "claude-3-5-sonnet-latest",
          max_tokens: 2048,
          messages: [{ role: "user", content: prompt }],
        });

        if (aiResponse.content[0]?.type === "text") {
          memoContent = aiResponse.content[0].text;
          aiMemoDrafted = true;

          // Insert or update auto-drafted working paper
          await db.insert(workingPapersTable).values({
            engagementId: job.engagementId,
            wpRef: "GL-100",
            section: "Fieldwork",
            title: "Automated General Ledger Analytics & Journal Entry Testing",
            aiDrafted: true,
            contentText: memoContent,
            status: "draft",
          });
        }
      }
    } catch (llmErr) {
      console.warn("LLM fieldwork memo drafting skipped/failed:", (llmErr as Error).message);
    }

    // Complete the job
    await db
      .update(ledgerIngestionJobsTable)
      .set({
        status: "completed",
        rowCount: totalRows,
        totalDebits: balanceResult.totalDebits,
        totalCredits: balanceResult.totalCredits,
        anomaliesFound: allFindings.length,
        errorMessage: balanceResult.isBalanced ? null : `Trial balance variance: $${balanceResult.variance}`,
      })
      .where(eq(ledgerIngestionJobsTable.id, jobId));
  } catch (err) {
    console.error("Ledger processing error:", err);
    await db
      .update(ledgerIngestionJobsTable)
      .set({
        status: "failed",
        errorMessage: (err as Error).message,
      })
      .where(eq(ledgerIngestionJobsTable.id, jobId));
  }
}
