import { Router } from "express";
import { db } from "@workspace/db";
import { workingPapersTable, engagementsTable, clientsTable, staffTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { CreateWorkingPaperBody, UpdateWorkingPaperBody } from "@workspace/api-zod";
import {
  AiLimitError,
  assertAiAllowance,
  canAcceptDraft,
  readAiUser,
  requireAiUser,
  routeId,
} from "../lib/ai-guard";
import {
  assertPatchLeavesContentUntouched,
  assertsAuditEvidence,
  DraftIntegrityError,
  handleWorkingPaperDraft,
  type ModelClient,
  workingPaperAcceptPatch,
} from "../lib/working-paper-draft";

const heldModel: ModelClient = {
  async create() {
    throw new Error("Working-paper model draft is held");
  },
};

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
  const [row] = await db.update(workingPapersTable).set(parsed.data).where(eq(workingPapersTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.post("/:id/draft", requireAiUser, async (req, res) => {
  const user = readAiUser(res);
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const id = routeId(req.params.id);
  const [wp] = await db.select().from(workingPapersTable).where(eq(workingPapersTable.id, id));
  if (!wp) { res.status(404).json({ error: "Not found" }); return; }

  try {
    assertAiAllowance(user.staffId, 0);
  } catch (err) {
    if (err instanceof AiLimitError) {
      res.status(429).json({ error: err.message });
      return;
    }
    throw err;
  }

  const [engagement] = wp.engagementId
    ? await db
        .select({ name: engagementsTable.engagementName, type: engagementsTable.engagementType, clientName: clientsTable.name })
        .from(engagementsTable)
        .leftJoin(clientsTable, eq(engagementsTable.clientId, clientsTable.id))
        .where(eq(engagementsTable.id, wp.engagementId))
    : [null];

  try {
    const draft = await handleWorkingPaperDraft({
      paper: wp,
      engagementName: engagement?.name || "Unknown",
      clientName: engagement?.clientName || "Unknown",
      model: heldModel,
    });
    assertPatchLeavesContentUntouched(draft.patch);
    const [updated] = await db.update(workingPapersTable)
      .set(draft.patch)
      .where(eq(workingPapersTable.id, id))
      .returning();
    res.json({
      content: draft.aiDraftText,
      aiDraftText: draft.aiDraftText,
      aiDraftStatus: draft.aiDraftStatus,
      requiresReviewerAcceptance: true,
      updatedPaper: updated,
    });
  } catch (err) {
    if (err instanceof DraftIntegrityError) {
      res.status(422).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.post("/:id/draft/accept", requireAiUser, async (req, res) => {
  const user = readAiUser(res);
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const id = routeId(req.params.id);
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, user.staffId));
  if (!staff || !canAcceptDraft(staff.role, staff.isActive)) {
    res.status(403).json({ error: "Reviewer acceptance requires an active partner or manager" });
    return;
  }

  const [wp] = await db.select().from(workingPapersTable).where(eq(workingPapersTable.id, id));
  if (!wp) { res.status(404).json({ error: "Not found" }); return; }
  if (!wp.aiDraftText) {
    res.status(409).json({ error: "No draft to accept" });
    return;
  }
  if (assertsAuditEvidence(wp.aiDraftText)) {
    res.status(422).json({ error: "Draft asserts evidence and cannot be accepted" });
    return;
  }
  if (wp.aiDraftStatus === "accepted") {
    res.json(wp);
    return;
  }

  const patch = workingPaperAcceptPatch(staff.id, new Date().toISOString().slice(0, 10));
  assertPatchLeavesContentUntouched(patch);
  const [updated] = await db.update(workingPapersTable)
    .set(patch)
    .where(eq(workingPapersTable.id, id))
    .returning();
  res.json(updated);
});

export default router;
