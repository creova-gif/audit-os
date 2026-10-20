/**
 * Deterministic Financial Math & Audit Anomaly Detection Engine
 * Implements standard analytical procedures per ISA 240 / AICPA AU-C 240:
 * - Benford's Law first-digit distribution & Z-score analysis
 * - Exact duplicate transaction detection
 * - Temporal anomalies (weekend/holiday journal entries)
 * - Round-dollar threshold clustering
 */

export interface NormalizedTransaction {
  rowNumber: number;
  transactionDate: string; // YYYY-MM-DD or parseable date string
  accountCode: string;
  accountName: string;
  amount: number;
  debit?: number;
  credit?: number;
  journalRef: string;
  description: string;
}

export interface AnomalyFinding {
  anomalyType: "benfords_law" | "duplicate_transaction" | "weekend_entry" | "round_sum" | "unbalanced_tb";
  riskLevel: "low" | "medium" | "high";
  accountCode?: string;
  accountName?: string;
  journalRef?: string;
  transactionDate?: string;
  amount?: number;
  description: string;
  aiExplanation?: string;
}

// Benford's Law theoretical probabilities for first digits 1..9
export const BENFORD_PROBABILITIES: Record<number, number> = {
  1: 0.301,
  2: 0.176,
  3: 0.125,
  4: 0.097,
  5: 0.079,
  6: 0.067,
  7: 0.058,
  8: 0.051,
  9: 0.046,
};

/**
 * Extracts the first non-zero digit of an absolute amount.
 */
export function getLeadingDigit(amount: number): number | null {
  const abs = Math.abs(amount);
  if (abs === 0 || isNaN(abs)) return null;
  const str = abs.toString().replace(/^0+(\.0*)?/, "").replace(/\D/, "");
  if (!str.length) return null;
  const first = parseInt(str[0], 10);
  return first >= 1 && first <= 9 ? first : null;
}

/**
 * Stage 1: Benford's Law Analysis
 * Analyzes first-digit distribution across all transactions with amounts >= 10.
 */
export function analyzeBenfordsLaw(transactions: NormalizedTransaction[]): AnomalyFinding[] {
  const findings: AnomalyFinding[] = [];
  const digitCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
  let eligibleCount = 0;

  for (const tx of transactions) {
    if (Math.abs(tx.amount) >= 10) {
      const digit = getLeadingDigit(tx.amount);
      if (digit !== null) {
        digitCounts[digit]++;
        eligibleCount++;
      }
    }
  }

  // Need at least 50 transactions for statistical significance
  if (eligibleCount < 50) return findings;

  for (let d = 1; d <= 9; d++) {
    const observedCount = digitCounts[d];
    const observedFreq = observedCount / eligibleCount;
    const expectedFreq = BENFORD_PROBABILITIES[d];
    const expectedCount = expectedFreq * eligibleCount;

    // Standard deviation and Z-score calculation
    const variance = expectedFreq * (1 - expectedFreq) / eligibleCount;
    const stdDev = Math.sqrt(variance);
    const zScore = stdDev > 0 ? (observedFreq - expectedFreq) / stdDev : 0;

    // Critical Z-score for alpha = 0.01 is 2.576
    if (Math.abs(zScore) > 2.576) {
      const isExcess = observedFreq > expectedFreq;
      findings.push({
        anomalyType: "benfords_law",
        riskLevel: Math.abs(zScore) > 4.0 ? "high" : "medium",
        description: `Benford's Law deviation on leading digit ${d}: Observed ${(observedFreq * 100).toFixed(1)}% vs expected ${(expectedFreq * 100).toFixed(1)}% (Z-score: ${zScore.toFixed(2)}, Count: ${observedCount}/${eligibleCount}).`,
        aiExplanation: isExcess
          ? `Significant clustering on leading digit ${d} exceeds theoretical probability. May indicate manual intervention or threshold avoidance.`
          : `Leading digit ${d} is significantly underrepresented in the ledger population.`,
      });
    }
  }

  return findings;
}

/**
 * Stage 1: Exact Duplicate Detection
 * Flags identical amounts posted to the same account on the same date with different references.
 */
export function findDuplicateTransactions(transactions: NormalizedTransaction[]): AnomalyFinding[] {
  const findings: AnomalyFinding[] = [];
  const groups = new Map<string, NormalizedTransaction[]>();

  for (const tx of transactions) {
    if (Math.abs(tx.amount) <= 0) continue;
    // Group by accountCode + normalized amount + date
    const key = `${tx.accountCode}|${tx.amount.toFixed(2)}|${tx.transactionDate}`;
    const list = groups.get(key) || [];
    list.push(tx);
    groups.set(key, list);
  }

  for (const [_, duplicates] of groups.entries()) {
    if (duplicates.length >= 2) {
      const first = duplicates[0];
      const refs = duplicates.map(d => d.journalRef || `#${d.rowNumber}`).join(", ");
      findings.push({
        anomalyType: "duplicate_transaction",
        riskLevel: duplicates.length > 2 || Math.abs(first.amount) >= 5000 ? "high" : "medium",
        accountCode: first.accountCode,
        accountName: first.accountName,
        journalRef: refs,
        transactionDate: first.transactionDate,
        amount: first.amount,
        description: `Potential duplicate posting detected: ${duplicates.length} transactions of ${first.amount.toFixed(2)} on ${first.transactionDate} in account ${first.accountCode} (${refs}).`,
        aiExplanation: `Multiple postings of identical amounts in the same account on the same date indicate potential duplicate invoice payment or double journal entry.`,
      });
    }
  }

  return findings;
}

/**
 * Stage 1: Temporal Anomalies (Weekend entries)
 * Flags manual journal entries posted on Saturdays or Sundays.
 */
export function findWeekendEntries(transactions: NormalizedTransaction[]): AnomalyFinding[] {
  const findings: AnomalyFinding[] = [];

  for (const tx of transactions) {
    if (!tx.transactionDate) continue;
    const date = new Date(tx.transactionDate);
    if (isNaN(date.getTime())) continue;

    const day = date.getUTCDay();
    // 0 = Sunday, 6 = Saturday
    if (day === 0 || day === 6) {
      const dayName = day === 0 ? "Sunday" : "Saturday";
      findings.push({
        anomalyType: "weekend_entry",
        riskLevel: Math.abs(tx.amount) >= 10000 ? "high" : "medium",
        accountCode: tx.accountCode,
        accountName: tx.accountName,
        journalRef: tx.journalRef,
        transactionDate: tx.transactionDate,
        amount: tx.amount,
        description: `Transaction posted on ${dayName} (${tx.transactionDate}) for amount ${tx.amount.toFixed(2)} [Ref: ${tx.journalRef || "N/A"}].`,
        aiExplanation: `Non-business day entries have elevated fraud risk and bypass standard authorization controls.`,
      });
    }
  }

  return findings;
}

/**
 * Stage 1: Round Sum Clustering
 * Identifies unusually high frequency of round-number transactions (e.g. multiples of $5,000, $10,000, $50,000).
 */
export function findRoundSums(transactions: NormalizedTransaction[]): AnomalyFinding[] {
  const findings: AnomalyFinding[] = [];

  for (const tx of transactions) {
    const abs = Math.abs(tx.amount);
    if (abs >= 5000 && abs % 1000 === 0) {
      findings.push({
        anomalyType: "round_sum",
        riskLevel: abs >= 25000 ? "high" : "low",
        accountCode: tx.accountCode,
        accountName: tx.accountName,
        journalRef: tx.journalRef,
        transactionDate: tx.transactionDate,
        amount: tx.amount,
        description: `Round-dollar transaction of ${tx.amount.toFixed(2)} posted to account ${tx.accountCode} (${tx.accountName}).`,
        aiExplanation: `Round-dollar manual journal entries often represent management estimates or unauthorized adjustments without itemized supporting documentation.`,
      });
    }
  }

  return findings;
}

/**
 * Stage 1: Trial Balance Reconciliation
 * Confirms that total debits equal total credits.
 */
export function verifyTrialBalanceBalance(transactions: NormalizedTransaction[]): {
  isBalanced: boolean;
  totalDebits: number;
  totalCredits: number;
  variance: number;
} {
  let totalDebits = 0;
  let totalCredits = 0;

  for (const tx of transactions) {
    if (tx.debit !== undefined && tx.credit !== undefined) {
      totalDebits += tx.debit;
      totalCredits += tx.credit;
    } else if (tx.amount > 0) {
      totalDebits += tx.amount;
    } else {
      totalCredits += Math.abs(tx.amount);
    }
  }

  const variance = Math.abs(totalDebits - totalCredits);
  return {
    isBalanced: variance < 0.01,
    totalDebits: Math.round(totalDebits * 100) / 100,
    totalCredits: Math.round(totalCredits * 100) / 100,
    variance: Math.round(variance * 100) / 100,
  };
}
