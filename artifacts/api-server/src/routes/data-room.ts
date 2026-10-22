import { Router } from "express";
import { db } from "@workspace/db";
import { dataRoomTable, conversations, messages } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { CreateDataRoomItemBody, UpdateDataRoomItemBody } from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  const conditions = [];
  if (req.query.engagementId) {
    conditions.push(eq(dataRoomTable.engagementId, parseInt(req.query.engagementId as string, 10)));
  }
  const rows = await db.select().from(dataRoomTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(dataRoomTable.category, dataRoomTable.itemName);
  res.json(rows);
});

router.post("/", async (req, res) => {
  const parsed = CreateDataRoomItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(dataRoomTable).values(parsed.data).returning();
  res.status(201).json(row);
});

router.patch("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const parsed = UpdateDataRoomItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.update(dataRoomTable).set(parsed.data).where(eq(dataRoomTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [deleted] = await db.delete(dataRoomTable).where(eq(dataRoomTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ success: true, deletedId: id });
});

// GET /api/data-room/:id/messages — Get message thread for auditor
router.get("/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.dataRoomItemId, id));

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

// POST /api/data-room/:id/messages — Post auditor message in PBC thread
router.post("/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { content, authorName } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Message content cannot be empty" });
    }

    const [item] = await db.select().from(dataRoomTable).where(eq(dataRoomTable.id, id));
    if (!item) {
      return res.status(404).json({ error: "PBC Item not found" });
    }

    let [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.dataRoomItemId, id));

    if (!conv) {
      [conv] = await db
        .insert(conversations)
        .values({
          title: `Discussion on PBC #${id}: ${item.itemName}`,
          engagementId: item.engagementId,
          dataRoomItemId: id,
          isInternalOnly: false,
        })
        .returning();
    }

    const [newMsg] = await db
      .insert(messages)
      .values({
        conversationId: conv.id,
        role: "user",
        content: content.trim(),
        authorType: "auditor",
        authorName: authorName || "Audit Team",
      })
      .returning();

    return res.status(201).json(newMsg);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
