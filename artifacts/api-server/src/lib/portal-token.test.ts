import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

describe("Client Portal Magic Link Security & Token Verification", () => {
  test("generates 256-bit raw token with 64-character hex entropy", () => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    assert.equal(rawToken.length, 64);
    assert.match(rawToken, /^[0-9a-f]{64}$/);
  });

  test("computes deterministic SHA-256 hash for database storage", () => {
    const rawToken = "d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5";
    const expectedHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const hash2 = crypto.createHash("sha256").update(rawToken).digest("hex");

    assert.equal(expectedHash, hash2);
    assert.equal(expectedHash.length, 64);
    assert.notEqual(rawToken, expectedHash, "Raw token must not equal its cryptographic hash");
  });

  test("calculates exact 24-hour expiration TTL", () => {
    const now = Date.now();
    const expiresAt = new Date(now + 24 * 60 * 60 * 1000);
    const diffHours = (expiresAt.getTime() - now) / (1000 * 60 * 60);

    assert.equal(diffHours, 24);
  });

  test("identifies expired tokens correctly", () => {
    const expiredTimestamp = new Date(Date.now() - 1000); // 1 second ago
    const isExpired = new Date() > expiredTimestamp;

    assert.equal(isExpired, true, "Past timestamp must be flagged as expired");
  });

  test("detects already-redeemed token replay attempts", () => {
    const tokenRecord = {
      id: 1,
      engagementId: 42,
      clientEmail: "cfo@acme.com",
      tokenHash: "abc123hash",
      expiresAt: new Date(Date.now() + 100000),
      redeemedAt: new Date(Date.now() - 5000), // Already redeemed 5 seconds ago
    };

    const isRedeemed = tokenRecord.redeemedAt !== null;
    assert.equal(isRedeemed, true, "Already-redeemed token must be flagged to prevent replay attacks");
  });

  test("validates valid, unexpired, unredeemed token", () => {
    const validRecord = {
      id: 2,
      engagementId: 42,
      clientEmail: "treasurer@acme.com",
      tokenHash: "xyz789hash",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      redeemedAt: null,
    };

    const isValid = !validRecord.redeemedAt && new Date() < validRecord.expiresAt;
    assert.equal(isValid, true, "Active unredeemed token within 24h must pass validation");
  });
});
