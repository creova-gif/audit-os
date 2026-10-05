import { Router } from "express";
import { db } from "@workspace/db";
import { anomaliesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { CreateAnomalyBody, UpdateAnomalyBody } from "@workspace/api-zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { AiLimitError, readAiUser, requireAiUser, routeId, withAiBudget } from "../lib/ai-guard";

const router = Router();

router.get("/", async (req, res) => {
  const conditions = [];
  if (req.query.engagementId) {
    conditions.push(eq(anomaliesTable.engagementId, parseInt(req.query.engagementId as string, 10)));
  }
  if (req.query.riskLevel) {
    conditions.push(eq(anomaliesTable.riskLevel, req.query.riskLevel as string));
  }
  if (req.query.status) {
    conditions.push(eq(anomaliesTable.auditorStatus, req.query.status as string));
  }
  const rows = await db.select().from(anomaliesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(anomaliesTable.createdAt);
  res.json(rows);
});

router.post("/", async (req, res) => {
  const parsed = CreateAnomalyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(anomaliesTable).values(parsed.data).returning();
  res.status(201).json(row);
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [row] = await db.select().from(anomaliesTable).where(eq(anomaliesTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.patch("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const parsed = UpdateAnomalyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.update(anomaliesTable).set(parsed.data).where(eq(anomaliesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.post("/:id/analyze", requireAiUser, async (req, res) => {
  const user = readAiUser(res);
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const id = routeId(req.params.id);
  const [anomaly] = await db.select().from(anomaliesTable).where(eq(anomaliesTable.id, id));
  if (!anomaly) { res.status(404).json({ error: "Not found" }); return; }

  const prompt = `You are an experienced audit partner reviewing a GL anomaly flagged by automated analysis.

Anomaly details:
- Type: ${anomaly.anomalyType}
- Risk Level: ${anomaly.riskLevel}
- Account: ${anomaly.accountCode} — ${anomaly.accountName}
- Journal Ref: ${anomaly.journalRef}
- Transaction Date: ${anomaly.transactionDate}
- Amount: USD ${anomaly.amount}
- Description: ${anomaly.description}
- Initial AI Explanation: ${anomaly.aiExplanation || "None"}
- Auditor Notes: ${anomaly.auditorNotes || "None"}

Provide a concise, professional deep-dive analysis covering:
1. Why this anomaly pattern is audit-significant
2. Specific audit procedures to investigate
3. ISA references applicable to this risk area
4. Recommended auditor status (investigated/cleared/finding) and rationale

Be direct and actionable. Use audit terminology consistent with ISA 315 and ISA 240.`;

  let analysis: string;
  try {
    analysis = await withAiBudget(user.staffId, 2048, async () => {
      const message = await anthropic.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });
      const text = message.content[0].type === "text" ? message.content[0].text : "";
      return {
        value: text,
        inputTokens: message.usage?.input_tokens ?? 0,
        outputTokens: message.usage?.output_tokens ?? 0,
      };
    });
  } catch (err) {
    if (err instanceof AiLimitError) {
      res.status(429).json({ error: err.message });
      return;
    }
    throw err;
  }

  const updatedExplanation = anomaly.aiExplanation
    ? `${anomaly.aiExplanation}\n\n---\n\nDeep-dive Analysis:\n${analysis}`
    : analysis;

  const [updated] = await db.update(anomaliesTable)
    .set({ aiExplanation: updatedExplanation })
    .where(eq(anomaliesTable.id, id))
    .returning();

  res.json({ analysis, updatedExplanation: updated.aiExplanation });
});

export default router;
