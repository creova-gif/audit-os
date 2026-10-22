import { Router } from "express";
import { db } from "@workspace/db";
import { workingPapersTable, engagementsTable, clientsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { CreateWorkingPaperBody, UpdateWorkingPaperBody } from "@workspace/api-zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router = Router();

router.get("/", async (req, res) => {
  const conditions = [];
  if (req.query.engagementId) {
    conditions.push(eq(workingPapersTable.engagementId, parseInt(req.query.engagementId as string, 10)));
  }
  const rows = await db.select().from(workingPapersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(workingPapersTable.section, workingPapersTable.wpRef);
  res.json(rows);
});

router.post("/", async (req, res) => {
  const parsed = CreateWorkingPaperBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(workingPapersTable).values(parsed.data).returning();
  res.status(201).json(row);
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [row] = await db.select().from(workingPapersTable).where(eq(workingPapersTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.patch("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const parsed = UpdateWorkingPaperBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(workingPapersTable).where(eq(workingPapersTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (existing.status === "signed_off") {
    res.status(403).json({ error: "Working paper is locked by partner sign-off." });
    return;
  }

  const [row] = await db.update(workingPapersTable).set(parsed.data).where(eq(workingPapersTable.id, id)).returning();
  res.json(row);
});

router.post("/:id/draft", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [wp] = await db.select().from(workingPapersTable).where(eq(workingPapersTable.id, id));
  if (!wp) { res.status(404).json({ error: "Not found" }); return; }

  if (wp.status === "signed_off") {
    res.status(403).json({ error: "Working paper is locked by partner sign-off." });
    return;
  }

  const [engagement] = wp.engagementId
    ? await db
        .select({ name: engagementsTable.engagementName, type: engagementsTable.engagementType, clientName: clientsTable.name })
        .from(engagementsTable)
        .leftJoin(clientsTable, eq(engagementsTable.clientId, clientsTable.id))
        .where(eq(engagementsTable.id, wp.engagementId))
    : [null];

  const prompt = `You are an experienced audit manager drafting a working paper for an external audit engagement.

Working Paper Details:
- Reference: ${wp.wpRef}
- Title: ${wp.title}
- Section: ${wp.section}
- Engagement: ${engagement?.name || "Unknown"} (${engagement?.type || ""})
- Client: ${engagement?.clientName || "Unknown"}
- Existing Content: ${wp.contentText || "None"}

Draft a professional, ISA-compliant working paper for this audit section. The paper should include:
1. Objective / Purpose
2. Audit procedures performed
3. Evidence obtained / results
4. Conclusion

Use Tanzania NBAA and IAASB standards as applicable. Be concise but thorough. Use professional audit language.`;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0].type === "text" ? message.content[0].text : "";

  const [updated] = await db.update(workingPapersTable)
    .set({ contentText: content, aiDrafted: true })
    .where(eq(workingPapersTable.id, id))
    .returning();

  res.json({ content, updatedPaper: updated });
});

export default router;
