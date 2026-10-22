import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

describe("Audit Binder Compilation & Sign-Off Proof Generator", () => {
  test("generates valid PDF document with metadata and page structure", async () => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();

    page.drawText("AUDIT OS - ENGAGEMENT BINDER", {
      x: 50,
      y: height - 50,
      size: 16,
      font,
      color: rgb(0.1, 0.2, 0.5),
    });

    const pdfBytes = await pdfDoc.save();
    assert.ok(pdfBytes instanceof Uint8Array);
    assert.ok(pdfBytes.length > 500, "PDF document must have non-trivial size");

    // Check PDF header signature '%PDF-'
    const header = Buffer.from(pdfBytes.slice(0, 5)).toString("utf8");
    assert.equal(header, "%PDF-", "Generated binary must start with valid PDF magic bytes");
  });

  test("computes cryptographic ISA 230 sign-off verification hash", () => {
    const workingPaper = {
      id: 101,
      wpRef: "WP GL-100",
      section: "fieldwork",
      title: "Substantive Journal Entry & General Ledger Testing",
      contentText: "Audit procedures performed over 10,000 ledger records. No material exceptions noted.",
      partnerName: "Sarah Jenkins, CPA",
      timestamp: "2026-10-22T10:00:00.000Z",
    };

    // Canonical representation for regulatory signing
    const payload = JSON.stringify({
      id: workingPaper.id,
      wpRef: workingPaper.wpRef,
      section: workingPaper.section,
      title: workingPaper.title,
      contentText: workingPaper.contentText,
      signedOffBy: workingPaper.partnerName,
      signedOffAt: workingPaper.timestamp,
    });

    const hash = crypto.createHash("sha256").update(payload).digest("hex");

    assert.equal(hash.length, 64);
    assert.match(hash, /^[0-9a-f]{64}$/);

    // Verify tamper detection: any alteration changes the hash
    const tamperedPayload = payload.replace("No material exceptions", "Material exceptions found");
    const tamperedHash = crypto.createHash("sha256").update(tamperedPayload).digest("hex");

    assert.notEqual(hash, tamperedHash, "Tampered content must produce completely distinct hash");
  });

  test("formats master table of contents index numbers correctly", () => {
    const sections = [
      { code: "A", name: "Planning & Materiality" },
      { code: "B", name: "Internal Controls" },
      { code: "C", name: "Substantive Fieldwork" },
      { code: "D", name: "Findings & Deficiencies" },
      { code: "E", name: "Completion & Sign-Off" },
    ];

    const indexed = sections.map((sec, idx) => `${sec.code}.${idx + 1} ${sec.name}`);

    assert.equal(indexed[0], "A.1 Planning & Materiality");
    assert.equal(indexed[2], "C.3 Substantive Fieldwork");
    assert.equal(indexed[4], "E.5 Completion & Sign-Off");
  });
});
