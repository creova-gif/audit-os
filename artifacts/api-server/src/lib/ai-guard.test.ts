import assert from "node:assert/strict";
import { createServer } from "node:http";
import { afterEach, describe, it } from "node:test";
import express from "express";
import {
  AiLimitError,
  assertAiAllowance,
  canAcceptDraft,
  isOriginAllowed,
  parseCorsAllowlist,
  readAiUser,
  reconcileAiTokens,
  releaseAiTokens,
  requireAiUser,
  resetAiBudgets,
  signAiAccessToken,
  verifyAiAccessToken,
  withAiBudget,
} from "./ai-guard";

const SECRET = "test-only-session-secret";

afterEach(() => {
  delete process.env.SESSION_SECRET;
  delete process.env.AI_MAX_REQUESTS_PER_HOUR;
  delete process.env.AI_MAX_TOKENS_PER_HOUR;
  resetAiBudgets();
});

describe("AI access tokens", () => {
  it("rejects a missing bearer token", async () => {
    process.env.SESSION_SECRET = SECRET;
    const app = express();
    app.post("/draft", requireAiUser, (_req, res) => {
      res.json({ staffId: readAiUser(res)?.staffId });
    });
    const base = await listen(app);
    try {
      const response = await fetch(`${base.url}/draft`, { method: "POST" });
      assert.equal(response.status, 401);
    } finally {
      await base.close();
    }
  });

  it("accepts a signed token and rejects a tampered one", async () => {
    process.env.SESSION_SECRET = SECRET;
    const app = express();
    app.post("/draft", requireAiUser, (_req, res) => {
      res.json({ staffId: readAiUser(res)?.staffId });
    });
    const base = await listen(app);
    try {
      const token = signAiAccessToken(42);
      const ok = await fetch(`${base.url}/draft`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(ok.status, 200);
      assert.deepEqual(await ok.json(), { staffId: 42 });

      const forged = token.replace("v1.42.", "v1.7.");
      const denied = await fetch(`${base.url}/draft`, {
        method: "POST",
        headers: { authorization: `Bearer ${forged}` },
      });
      assert.equal(denied.status, 401);
      assert.equal(verifyAiAccessToken("not-a-token"), null);
    } finally {
      await base.close();
    }
  });

  it("rejects expired tokens and a missing secret", () => {
    process.env.SESSION_SECRET = SECRET;
    const token = signAiAccessToken(4, 1_000);
    assert.equal(verifyAiAccessToken(token, 1_000 + 9 * 60 * 60 * 1000), null);
    delete process.env.SESSION_SECRET;
    assert.equal(verifyAiAccessToken(token), null);
  });
});

describe("per-user rate limit and token budget", () => {
  it("limits requests and tokens separately for each user", () => {
    process.env.AI_MAX_REQUESTS_PER_HOUR = "2";
    process.env.AI_MAX_TOKENS_PER_HOUR = "100";
    assertAiAllowance(1, 40, 0);
    assertAiAllowance(1, 40, 1_000);
    assert.throws(() => assertAiAllowance(1, 0, 2_000), AiLimitError);
    assertAiAllowance(2, 80, 2_000);
    assert.throws(() => assertAiAllowance(2, 30, 3_000), (err: unknown) => {
      assert.ok(err instanceof AiLimitError);
      assert.equal(err.reason, "budget");
      return true;
    });
  });

  it("reconciles a reservation and opens a new window", () => {
    process.env.AI_MAX_REQUESTS_PER_HOUR = "1";
    process.env.AI_MAX_TOKENS_PER_HOUR = "1000";
    assertAiAllowance(3, 800, 0);
    reconcileAiTokens(3, 800, 100, 500);
    assert.throws(() => assertAiAllowance(3, 0, 500), AiLimitError);
    assertAiAllowance(3, 900, 60 * 60 * 1000);
  });

  it("keeps the reservation when the model reports no usage", async () => {
    process.env.AI_MAX_REQUESTS_PER_HOUR = "5";
    process.env.AI_MAX_TOKENS_PER_HOUR = "100";
    await withAiBudget(4, 80, async () => ({ value: "ok", inputTokens: 0, outputTokens: 0 }));
    assert.throws(() => assertAiAllowance(4, 30, 0), (err: unknown) => {
      assert.ok(err instanceof AiLimitError);
      assert.equal(err.reason, "budget");
      return true;
    });
  });

  it("releases the reservation when the model call fails", async () => {
    process.env.AI_MAX_REQUESTS_PER_HOUR = "5";
    process.env.AI_MAX_TOKENS_PER_HOUR = "100";
    await assert.rejects(
      withAiBudget(9, 80, async () => {
        throw new Error("model down");
      }),
      /model down/,
    );
    assertAiAllowance(9, 80, 0);
    releaseAiTokens(9, 80, 0);
  });
});

describe("CORS allowlist", () => {
  it("fails closed in production and ignores a wildcard", () => {
    assert.deepEqual(parseCorsAllowlist(undefined, "production"), []);
    assert.equal(isOriginAllowed("https://evil.example", []), false);
    assert.equal(isOriginAllowed(undefined, []), true);
    assert.deepEqual(parseCorsAllowlist("*", "production"), []);
    assert.deepEqual(parseCorsAllowlist("https://app.example, *", "production"), ["https://app.example"]);
    const allowlist = parseCorsAllowlist("https://app.example", "production");
    assert.equal(isOriginAllowed("https://app.example", allowlist), true);
    assert.equal(isOriginAllowed("https://evil.example", allowlist), false);
  });

  it("allows the local frontend only outside production when unset", () => {
    const allowlist = parseCorsAllowlist(undefined, "development");
    assert.equal(isOriginAllowed("http://localhost:22337", allowlist), true);
    assert.equal(isOriginAllowed("https://evil.example", allowlist), false);
  });
});

describe("reviewer acceptance", () => {
  it("allows an active partner or manager only", () => {
    assert.equal(canAcceptDraft("partner", true), true);
    assert.equal(canAcceptDraft("manager", true), true);
    assert.equal(canAcceptDraft("senior", true), false);
    assert.equal(canAcceptDraft("partner", false), false);
  });
});

async function listen(app: express.Express): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("expected a TCP address");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
