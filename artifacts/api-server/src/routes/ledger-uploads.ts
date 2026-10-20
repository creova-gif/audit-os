import { Router, Request, Response } from "express";
import { db, ledgerIngestionJobsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { processLedgerJob } from "../lib/fieldwork-engine";

const router = Router();

// POST /api/engagements/:id/ledger-uploads
router.post("/engagements/:id/ledger-uploads", async (req: Request, res: Response) => {
  try {
    const engagementId = parseInt(String(req.params.id), 10);
    if (isNaN(engagementId)) {
      return res.status(400).json({ error: "Invalid engagement ID" });
    }

    let fileContent: Buffer;
    let fileName = (req.headers["x-file-name"] as string) || "ledger.csv";

    if (Buffer.isBuffer(req.body)) {
      fileContent = req.body;
    } else if (typeof req.body === "string") {
      fileContent = Buffer.from(req.body, "utf-8");
    } else if (req.body && typeof req.body === "object" && req.body.content) {
      fileContent = Buffer.from(req.body.content, "utf-8");
      if (req.body.fileName) fileName = req.body.fileName;
    } else {
      return res.status(400).json({ error: "No file content provided in request body" });
    }

    if (fileContent.length === 0) {
      return res.status(400).json({ error: "File content cannot be empty" });
    }

    if (fileContent.length > 100 * 1024 * 1024) {
      return res.status(413).json({ error: "File size exceeds 100MB limit" });
    }

    // Insert new pending job
    const [job] = await db
      .insert(ledgerIngestionJobsTable)
      .values({
        engagementId,
        fileName,
        fileSizeBytes: fileContent.length,
        status: "pending",
      })
      .returning();

    // Trigger asynchronous execution without blocking response
    setImmediate(() => {
      processLedgerJob(job.id, fileContent).catch((err) => {
        console.error(`Background processing failed for job #${job.id}:`, err);
      });
    });

    return res.status(202).json({
      message: "Ledger upload accepted for processing",
      jobId: job.id,
      status: job.status,
      fileName: job.fileName,
      fileSizeBytes: job.fileSizeBytes,
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/engagements/:id/ledger-jobs
router.get("/engagements/:id/ledger-jobs", async (req: Request, res: Response) => {
  try {
    const engagementId = parseInt(String(req.params.id), 10);
    if (isNaN(engagementId)) {
      return res.status(400).json({ error: "Invalid engagement ID" });
    }

    const jobs = await db
      .select()
      .from(ledgerIngestionJobsTable)
      .where(eq(ledgerIngestionJobsTable.engagementId, engagementId))
      .orderBy(desc(ledgerIngestionJobsTable.createdAt));

    return res.json(jobs);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/engagements/:id/ledger-jobs/:jobId
router.get("/engagements/:id/ledger-jobs/:jobId", async (req: Request, res: Response) => {
  try {
    const jobId = parseInt(String(req.params.jobId), 10);
    if (isNaN(jobId)) {
      return res.status(400).json({ error: "Invalid job ID" });
    }

    const [job] = await db
      .select()
      .from(ledgerIngestionJobsTable)
      .where(eq(ledgerIngestionJobsTable.id, jobId));

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    return res.json(job);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
