import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export type AiUser = { staffId: number };

const TOKEN_TTL_SECONDS = 8 * 60 * 60;
const WINDOW_MS = 60 * 60 * 1000;
const MIN_SECRET_LENGTH = 16;

type BudgetWindow = { start: number; requests: number; tokens: number };

const budgets = new Map<number, BudgetWindow>();

export class AiLimitError extends Error {
  readonly status = 429;
  readonly reason: "rate" | "budget";

  constructor(reason: "rate" | "budget") {
    super(reason === "rate" ? "AI rate limit exceeded" : "AI token budget exceeded");
    this.name = "AiLimitError";
    this.reason = reason;
  }
}

function sessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) return null;
  return secret;
}

function requestLimit(): number {
  const parsed = Number(process.env.AI_MAX_REQUESTS_PER_HOUR ?? "30");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

function tokenBudget(): number {
  const parsed = Number(process.env.AI_MAX_TOKENS_PER_HOUR ?? "16000");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 16000;
}

function windowFor(staffId: number, now: number): BudgetWindow {
  const existing = budgets.get(staffId);
  if (!existing || now - existing.start >= WINDOW_MS) {
    const fresh = { start: now, requests: 0, tokens: 0 };
    budgets.set(staffId, fresh);
    return fresh;
  }
  return existing;
}

export function resetAiBudgets(): void {
  budgets.clear();
}

export function signAiAccessToken(staffId: number, now = Date.now()): string {
  const secret = sessionSecret();
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  if (!Number.isInteger(staffId) || staffId <= 0) {
    throw new Error("staffId must be a positive integer");
  }
  const exp = Math.floor(now / 1000) + TOKEN_TTL_SECONDS;
  const payload = `${staffId}.${exp}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `v1.${payload}.${sig}`;
}

export function verifyAiAccessToken(token: string, now = Date.now()): AiUser | null {
  const secret = sessionSecret();
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const staffId = Number(parts[1]);
  const exp = Number(parts[2]);
  const sig = parts[3] ?? "";
  if (!Number.isInteger(staffId) || staffId <= 0 || !Number.isInteger(exp)) return null;
  if (exp * 1000 <= now) return null;
  const expected = createHmac("sha256", secret).update(`${parts[1]}.${parts[2]}`).digest("base64url");
  const provided = Buffer.from(sig);
  const actual = Buffer.from(expected);
  if (provided.length !== actual.length || !timingSafeEqual(provided, actual)) return null;
  return { staffId };
}

export function requireAiUser(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/.exec(header);
  if (!match) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const user = verifyAiAccessToken(match[1]);
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  res.locals.aiUser = user;
  next();
}

export function routeId(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  return parseInt(raw ?? "", 10);
}

export function readAiUser(res: Response): AiUser | null {
  const user = res.locals.aiUser as AiUser | undefined;
  if (!user || !Number.isInteger(user.staffId) || user.staffId <= 0) return null;
  return user;
}

export function assertAiAllowance(staffId: number, reserveTokens: number, now = Date.now()): void {
  if (!Number.isInteger(staffId) || staffId <= 0) {
    throw new AiLimitError("rate");
  }
  if (!Number.isFinite(reserveTokens) || reserveTokens < 0) {
    throw new AiLimitError("budget");
  }
  const bucket = windowFor(staffId, now);
  if (bucket.requests + 1 > requestLimit()) {
    throw new AiLimitError("rate");
  }
  if (bucket.tokens + reserveTokens > tokenBudget()) {
    throw new AiLimitError("budget");
  }
  bucket.requests += 1;
  bucket.tokens += reserveTokens;
}

export function reconcileAiTokens(staffId: number, reserved: number, actual: number, now = Date.now()): void {
  const bucket = windowFor(staffId, now);
  bucket.tokens += actual - reserved;
  if (bucket.tokens < 0) bucket.tokens = 0;
}

export function releaseAiTokens(staffId: number, reserved: number, now = Date.now()): void {
  reconcileAiTokens(staffId, reserved, 0, now);
}

export async function withAiBudget<T>(
  staffId: number,
  reserveTokens: number,
  run: () => Promise<{ value: T; inputTokens: number; outputTokens: number }>,
): Promise<T> {
  assertAiAllowance(staffId, reserveTokens);
  try {
    const result = await run();
    const input = Number.isFinite(result.inputTokens) && result.inputTokens > 0 ? result.inputTokens : 0;
    const output = Number.isFinite(result.outputTokens) && result.outputTokens > 0 ? result.outputTokens : 0;
    const reported = input + output;
    reconcileAiTokens(staffId, reserveTokens, reported > 0 ? reported : reserveTokens);
    return result.value;
  } catch (err) {
    releaseAiTokens(staffId, reserveTokens);
    throw err;
  }
}

export function parseCorsAllowlist(
  raw: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string[] {
  const fromEnv = (raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item !== "*");
  if (fromEnv.length > 0) return fromEnv;
  if (nodeEnv === "production") return [];
  return ["http://localhost:22337", "http://127.0.0.1:22337"];
}

export function isOriginAllowed(origin: string | undefined, allowlist: readonly string[]): boolean {
  if (!origin) return true;
  return allowlist.includes(origin);
}

const REVIEWER_ROLES = new Set(["partner", "manager"]);

export function canAcceptDraft(role: string, isActive: boolean): boolean {
  return isActive && REVIEWER_ROLES.has(role);
}
