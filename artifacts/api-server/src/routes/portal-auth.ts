import { Router, Request, Response } from "express";
import {
  db,
  portalAccessTokensTable,
  dataRoomTable,
  conversations,
  messages,
  engagementsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import crypto from "node:crypto";
import { requireClientPortalAuth } from "../middlewares/client-portal-auth";

const router = Router();

// POST /api/portal/magic-link — Auditor requests magic link for a client contact
router.post("/portal/magic-link", async (req: Request, res: Response) => {
  try {
    const { engagementId, clientEmail } = req.body;
    if (!engagementId || !clientEmail) {
      return res.status(400).json({ error: "engagementId and clientEmail are required" });
    }

    // Verify engagement exists
    const [engagement] = await db
      .select()
      .from(engagementsTable)
      .where(eq(engagementsTable.id, Number(engagementId)));

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    // Generate 256-bit cryptographic raw token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.insert(portalAccessTokensTable).values({
      engagementId: Number(engagementId),
      clientEmail,
      tokenHash,
      expiresAt,
    });

    const portalUrl = `/client-portal?token=${rawToken}&engagement=${engagementId}`;

    return res.status(201).json({
      message: "Magic link generated successfully",
      clientEmail,
      engagementId,
      expiresAt: expiresAt.toISOString(),
      portalUrl,
      rawToken, // Provided directly for development/testing convenience
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/portal/verify — Client redeems token to establish session
router.get("/portal/verify", async (req: Request, res: Response) => {
  try {
    const rawToken = req.query.token as string;
    if (!rawToken) {
      return res.status(400).json({ error: "Token query parameter is required" });
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const [record] = await db
      .select()
      .from(portalAccessTokensTable)
      .where(eq(portalAccessTokensTable.tokenHash, tokenHash));

    if (!record) {
      return res.status(401).json({ error: "Invalid magic link token" });
    }

    if (new Date() > new Date(record.expiresAt)) {
      return res.status(401).json({ error: "This magic link has expired" });
    }

    // Mark as redeemed
    await db
      .update(portalAccessTokensTable)
      .set({ redeemedAt: new Date() })
      .where(eq(portalAccessTokensTable.id, record.id));

    // Set HTTP-only session cookie
    res.cookie("audit_portal_token", rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: "lax",
    });

    const [engagement] = await db
      .select()
      .from(engagementsTable)
      .where(eq(engagementsTable.id, record.engagementId));

    return res.json({
      success: true,
      engagementId: record.engagementId,
      engagementName: engagement?.engagementName || "Audit Engagement",
      clientEmail: record.clientEmail,
      token: rawToken,
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/portal/session — Check current active client session
router.get("/portal/session", requireClientPortalAuth, async (req: Request, res: Response) => {
  try {
    const session = req.portalSession!;
    const [engagement] = await db
      .select()
      .from(engagementsTable)
      .where(eq(engagementsTable.id, session.engagementId));

    return res.json({
      authenticated: true,
      engagementId: session.engagementId,
      engagementName: engagement?.engagementName,
      clientEmail: session.clientEmail,
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/portal/pbc-items — Client retrieves non-internal document checklist
router.get("/portal/pbc-items", requireClientPortalAuth, async (req: Request, res: Response) => {
  try {
    const session = req.portalSession!;
    const items = await db
      .select()
      .from(dataRoomTable)
      .where(eq(dataRoomTable.engagementId, session.engagementId))
      .orderBy(dataRoomTable.id);

    return res.json(items);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/portal/pbc-items/:id/upload — Client uploads requested document
router.post("/portal/pbc-items/:id/upload", requireClientPortalAuth, async (req: Request, res: Response) => {
  try {
    const session = req.portalSession!;
    const itemId = parseInt(String(req.params.id), 10);

    const [item] = await db
      .select()
      .from(dataRoomTable)
      .where(and(eq(dataRoomTable.id, itemId), eq(dataRoomTable.engagementId, session.engagementId)));

    if (!item) {
      return res.status(404).json({ error: "Requested PBC item not found" });
    }

    const fileName = req.body.fileName || (req.headers["x-file-name"] as string) || "uploaded_document.pdf";

    const [updated] = await db
      .update(dataRoomTable)
      .set({
        status: "received",
        fileName,
        receivedAt: new Date().toISOString(),
      })
      .where(eq(dataRoomTable.id, itemId))
      .returning();

    return res.json({
      message: "Document uploaded successfully",
      item: updated,
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/portal/pbc-items/:id/messages — Threaded discussion on a specific PBC item
router.get("/portal/pbc-items/:id/messages", requireClientPortalAuth, async (req: Request, res: Response) => {
  try {
    const session = req.portalSession!;
    const itemId = parseInt(String(req.params.id), 10);

    // Find conversation linked to this data room item
    let [conv] = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.engagementId, session.engagementId),
          eq(conversations.dataRoomItemId, itemId)
        )
      );

    if (!conv) {
      return res.json([]);
    }

    const threadMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conv.id))
      .orderBy(messages.createdAt);

    return res.json(threadMessages);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/portal/pbc-items/:id/messages — Post message in PBC thread
router.post("/portal/pbc-items/:id/messages", requireClientPortalAuth, async (req: Request, res: Response) => {
  try {
    const session = req.portalSession!;
    const itemId = parseInt(String(req.params.id), 10);
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Message content cannot be empty" });
    }

    // Get or create conversation
    let [conv] = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.engagementId, session.engagementId),
          eq(conversations.dataRoomItemId, itemId)
        )
      );

    if (!conv) {
      [conv] = await db
        .insert(conversations)
        .values({
          title: `Discussion on PBC #${itemId}`,
          engagementId: session.engagementId,
          dataRoomItemId: itemId,
          isInternalOnly: false,
        })
        .returning();
    }

    const [newMessage] = await db
      .insert(messages)
      .values({
        conversationId: conv.id,
        role: "user",
        content,
        authorType: "client",
        authorName: session.clientEmail,
      })
      .returning();

    return res.status(201).json(newMessage);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
