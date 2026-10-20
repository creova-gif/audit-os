import { Request, Response, NextFunction } from "express";
import { db, portalAccessTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";

export interface PortalSession {
  engagementId: number;
  clientEmail: string;
}

declare global {
  namespace Express {
    interface Request {
      portalSession?: PortalSession;
    }
  }
}

/**
 * Middleware ensuring incoming requests have a valid client portal session token.
 */
export async function requireClientPortalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const rawToken =
      (req.headers["x-portal-token"] as string) ||
      (req.cookies && req.cookies["audit_portal_token"]) ||
      (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")
        ? req.headers.authorization.substring(7)
        : null);

    if (!rawToken) {
      return res.status(401).json({ error: "Missing client portal authentication token" });
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const [record] = await db
      .select()
      .from(portalAccessTokensTable)
      .where(eq(portalAccessTokensTable.tokenHash, tokenHash));

    if (!record) {
      return res.status(401).json({ error: "Invalid portal session token" });
    }

    // Check expiration
    if (new Date() > new Date(record.expiresAt)) {
      return res.status(401).json({ error: "Portal session token has expired" });
    }

    req.portalSession = {
      engagementId: record.engagementId,
      clientEmail: record.clientEmail,
    };

    return next();
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
}
