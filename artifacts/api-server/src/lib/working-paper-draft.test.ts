import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertsAuditEvidence,
  assertPatchLeavesContentUntouched,
  buildWorkingPaperDraftPrompt,
  DraftIntegrityError,
  handleWorkingPaperDraft,
  type ModelClient,
  workingPaperAcceptPatch,
  workingPaperDraftPatch,
} from "./working-paper-draft";

const sample = {
  paper: {
    contentText: "Original human paper. Bank reconciliation prepared by the senior.",
    wpRef: "WP-C100",
    title: "Cash at bank",
    section: "substantive",
  },
  engagementName: "FY24 statutory audit",
  clientName: "Dar es Salaam Trading",
};

const historicalPrompt = `You are an experienced audit manager drafting a working paper for an external audit engagement.
Draft a professional, ISA-compliant working paper for this audit section. The paper should include:
1. Objective / Purpose
2. Audit procedures performed
3. Evidence obtained / results
4. Conclusion`;

describe("working paper draft does not claim evidence", () => {
  it("rejects the historical prompt and a fabricated model reply", () => {
    assert.equal(assertsAuditEvidence(historicalPrompt), true);
    assert.match(historicalPrompt, /audit procedures performed/i);
    assert.match(historicalPrompt, /evidence obtained/i);
    assert.equal(
      assertsAuditEvidence(
        "Audit procedures performed: circularisation. Evidence obtained: bank statement.",
      ),
      true,
    );
  });

  it("keeps the draft prompt and template free of evidence claims", async () => {
    let calls = 0;
    const model: ModelClient = {
      async create() {
        calls += 1;
        return {
          text: "Audit procedures performed: we confirmed the bank balance. Evidence obtained: statement dated 31 Dec.",
          inputTokens: 20,
          outputTokens: 40,
        };
      },
    };

    const draft = await handleWorkingPaperDraft({ ...sample, model });

    assert.equal(calls, 0);
    assert.equal(draft.modelCalled, false);
    assert.equal(assertsAuditEvidence(draft.prompt), false);
    assert.equal(assertsAuditEvidence(draft.aiDraftText), false);
    assert.doesNotMatch(draft.prompt, /audit procedures performed/i);
    assert.doesNotMatch(draft.prompt, /evidence obtained/i);
    assert.doesNotMatch(draft.aiDraftText, /audit procedures performed/i);
    assert.doesNotMatch(draft.aiDraftText, /evidence obtained/i);
    assert.match(draft.aiDraftText, /NOT AUDIT EVIDENCE/);
    assert.match(draft.aiDraftText, /Pending reviewer acceptance/);
    assert.equal(draft.contentText, sample.paper.contentText);
    assert.equal("contentText" in draft.patch, false);
    assert.equal(draft.patch.aiDraftStatus, "pending_review");
    assert.deepEqual(draft.prompt, buildWorkingPaperDraftPrompt({
      wpRef: sample.paper.wpRef,
      title: sample.paper.title,
      section: sample.paper.section,
      engagementName: sample.engagementName,
      clientName: sample.clientName,
    }));
  });

  it("does not put the working paper body in the draft or accept write", () => {
    const draftPatch = workingPaperDraftPatch("UNREVIEWED TEMPLATE — NOT AUDIT EVIDENCE.");
    const acceptPatch = workingPaperAcceptPatch(3, "2026-10-02");
    assertPatchLeavesContentUntouched(draftPatch);
    assertPatchLeavesContentUntouched(acceptPatch);
    assert.equal("contentText" in draftPatch, false);
    assert.equal("contentText" in acceptPatch, false);
    assert.throws(
      () => assertPatchLeavesContentUntouched({ contentText: "Evidence obtained: forged" }),
      DraftIntegrityError,
    );
  });
});
