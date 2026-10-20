import { Router, Request, Response } from "express";
import { db, workingPapersTable, engagementsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import crypto from "node:crypto";
import { compileAuditBinder } from "../lib/binder-compiler";

const router = Router();

// GET /api/engagements/:id/audit-binder — Downloads compiled PDF audit binder
router.get("/engagements/:id/audit-binder", async (req: Request, res: Response) => {
  try {
    const engagementId = parseInt(String(req.params.id), 10);
    if (isNaN(engagementId)) {
      return res.status(400).json({ error: "Invalid engagement ID" });
    }

    const [engagement] = await db
      .select()
      .from(engagementsTable)
      .where(eq(engagementsTable.id, engagementId));

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const pdfBytes = await compileAuditBinder(engagementId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="audit-binder-engagement-${engagementId}.pdf"`
    );
    res.setHeader("Content-Length", pdfBytes.length);

    return res.end(Buffer.from(pdfBytes));
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/engagements/:id/working-papers/:wpId/sign-off — Partner sign-off lock
router.post("/engagements/:id/working-papers/:wpId/sign-off", async (req: Request, res: Response) => {
  try {
    const engagementId = parseInt(String(req.params.id), 10);
    const wpId = parseInt(String(req.params.wpId), 10);

    if (isNaN(engagementId) || isNaN(wpId)) {
      return res.status(400).json({ error: "Invalid engagement or working paper ID" });
    }

    const [wp] = await db
      .select()
      .from(workingPapersTable)
      .where(and(eq(workingPapersTable.id, wpId), eq(workingPapersTable.engagementId, engagementId)));

    if (!wp) {
      return res.status(404).json({ error: "Working paper not found" });
    }

    if (wp.status === "signed_off") {
      return res.status(403).json({ error: "Working paper is already locked and signed off" });
    }

    const signedOffBy = req.body.partnerId || 1;
    const signedOffAt = new Date().toISOString();

    // Compute immutable SHA-256 hash of paper content and metadata
    const hashPayload = `${wp.wpRef}|${wp.title}|${wp.contentText || ""}|${signedOffBy}|${signedOffAt}`;
    const signedOffHash = crypto.createHash("sha256").update(hashPayload).digest("hex");

    const [signed] = await db
      .update(workingPapersTable)
      .set({
        status: "signed_off",
        signedOffBy,
        signedOffAt,
        signedOffHash,
      })
      .where(eq(workingPapersTable.id, wpId))
      .returning();

    return res.json({
      message: "Working paper signed off and locked successfully",
      workingPaper: signed,
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
