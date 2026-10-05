export type ModelCompletion = {
  text: string;
  inputTokens: number;
  outputTokens: number;
};

export type ModelClient = {
  create(input: { model: string; maxTokens: number; prompt: string }): Promise<ModelCompletion>;
};

export type DraftPaper = {
  contentText: string | null;
  wpRef: string;
  title: string;
  section: string;
};

export type DraftContext = {
  wpRef: string;
  title: string;
  section: string;
  engagementName: string;
  clientName: string;
};

export type DraftPatch = {
  aiDraftText: string;
  aiDrafted: true;
  aiDraftStatus: "pending_review";
};

export type AcceptPatch = {
  aiDraftStatus: "accepted";
  reviewedBy: number;
  reviewedAt: string;
};

const CLAIM_PATTERNS: readonly RegExp[] = [
  /audit procedures performed/i,
  /evidence obtained/i,
  /procedures (were|was|have been|had been) performed/i,
  /\bevidence (was|were|has been|have been) (obtained|gathered|inspected|reviewed)\b/i,
  /\b(we|the auditor|the engagement team) (performed|obtained|inspected|vouched|confirmed|tested|sampled)\b/i,
];

export class DraftIntegrityError extends Error {
  readonly status = 422;

  constructor(message: string) {
    super(message);
    this.name = "DraftIntegrityError";
  }
}

export function assertsAuditEvidence(text: string): boolean {
  return CLAIM_PATTERNS.some((pattern) => pattern.test(text));
}

export function buildWorkingPaperDraftPrompt(input: DraftContext): string {
  return [
    "You are preparing a blank working-paper outline for a human reviewer.",
    "Return only empty headings and bracketed placeholders.",
    "Do not state that any work was carried out.",
    "Do not state that any document was inspected or that any result was reached.",
    "Do not write a conclusion.",
    "Do not invent facts about the client.",
    "",
    `Reference: ${input.wpRef}`,
    `Title: ${input.title}`,
    `Section: ${input.section}`,
    `Engagement: ${input.engagementName}`,
    `Client: ${input.clientName}`,
    "",
    "Headings to leave blank: Objective. Work the reviewer still has to design. Documents the reviewer still has to list. Conclusion.",
  ].join("\n");
}

export function buildWorkingPaperTemplate(input: DraftContext): string {
  return [
    "UNREVIEWED TEMPLATE — NOT AUDIT EVIDENCE. Pending reviewer acceptance. This is not the working paper.",
    "This outline does not record work carried out and does not record documents inspected.",
    "",
    `Reference: ${input.wpRef}`,
    `Title: ${input.title}`,
    `Section: ${input.section}`,
    `Engagement: ${input.engagementName}`,
    `Client: ${input.clientName}`,
    "",
    "1. Objective",
    "   [Blank. Reviewer to complete. Nothing here is asserted.]",
    "",
    "2. Work the reviewer still has to design",
    "   [Blank. This draft does not state that any work was carried out.]",
    "",
    "3. Documents the reviewer still has to list",
    "   [Blank. This draft does not state that any document was inspected.]",
    "",
    "4. Conclusion",
    "   [Blank. No conclusion is asserted.]",
  ].join("\n");
}

export function workingPaperDraftPatch(aiDraftText: string): DraftPatch {
  return {
    aiDraftText,
    aiDrafted: true,
    aiDraftStatus: "pending_review",
  };
}

export function workingPaperAcceptPatch(staffId: number, reviewedAt: string): AcceptPatch {
  return {
    aiDraftStatus: "accepted",
    reviewedBy: staffId,
    reviewedAt,
  };
}

export function assertPatchLeavesContentUntouched(patch: object): void {
  if ("contentText" in patch) {
    throw new DraftIntegrityError("Draft cannot overwrite the working paper");
  }
}

export async function handleWorkingPaperDraft(input: {
  paper: DraftPaper;
  engagementName: string;
  clientName: string;
  model: ModelClient;
}): Promise<{
  prompt: string;
  aiDraftText: string;
  aiDraftStatus: "pending_review";
  contentText: string | null;
  patch: DraftPatch;
  modelCalled: false;
}> {
  const context: DraftContext = {
    wpRef: input.paper.wpRef,
    title: input.paper.title,
    section: input.paper.section,
    engagementName: input.engagementName,
    clientName: input.clientName,
  };
  const prompt = buildWorkingPaperDraftPrompt(context);
  if (assertsAuditEvidence(prompt)) {
    throw new DraftIntegrityError("Draft prompt cannot claim or request evidence");
  }

  // D20: generative drafting is held. The supplied model client is not called.
  void input.model;

  const aiDraftText = buildWorkingPaperTemplate(context);
  if (assertsAuditEvidence(aiDraftText)) {
    throw new DraftIntegrityError("Draft output cannot claim evidence");
  }
  const patch = workingPaperDraftPatch(aiDraftText);
  assertPatchLeavesContentUntouched(patch);
  return {
    prompt,
    aiDraftText,
    aiDraftStatus: "pending_review",
    contentText: input.paper.contentText,
    patch,
    modelCalled: false,
  };
}
