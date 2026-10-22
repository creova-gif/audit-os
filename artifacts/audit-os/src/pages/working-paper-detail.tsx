import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useGetWorkingPaper, useUpdateWorkingPaper, useDraftWorkingPaper } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Lock, 
  Unlock, 
  Sparkles, 
  Save, 
  CheckCircle2, 
  FileCheck, 
  Clock, 
  AlertCircle, 
  Download, 
  ArrowLeft,
  Copy,
  Check
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function WorkingPaperDetailPage() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const queryClient = useQueryClient();

  const { data: paper, isLoading } = useGetWorkingPaper(id);
  const updateMutation = useUpdateWorkingPaper();
  const draftMutation = useDraftWorkingPaper();

  const [content, setContent] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [partnerName, setPartnerName] = useState("Sarah Jenkins, CPA (Engagement Partner)");
  const [isSigningOff, setIsSigningOff] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (paper?.contentText) {
      setContent(paper.contentText);
    }
  }, [paper?.contentText]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto py-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-semibold">Working paper not found</h2>
        <Link href="/working-papers">
          <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Working Papers</Button>
        </Link>
      </div>
    );
  }

  const isLocked = paper.status === "signed_off";

  const handleSave = async () => {
    if (isLocked) return;
    setErrorMsg(null);
    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          contentText: content,
        },
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
      queryClient.invalidateQueries({ queryKey: [`/api/working-papers/${id}`] });
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save working paper changes.");
    }
  };

  const handleStatusChange = async (newStatus: "draft" | "in_review") => {
    if (isLocked) return;
    setErrorMsg(null);
    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          status: newStatus,
        },
      });
      queryClient.invalidateQueries({ queryKey: [`/api/working-papers/${id}`] });
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to update review status.");
    }
  };

  const handlePartnerSignOff = async () => {
    if (!paper.engagementId) {
      setErrorMsg("Cannot sign off: Missing associated engagement ID.");
      return;
    }
    setIsSigningOff(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/engagements/${paper.engagementId}/working-papers/${id}/sign-off`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerName }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Sign-off failed with status ${res.status}`);
      }
      queryClient.invalidateQueries({ queryKey: [`/api/working-papers/${id}`] });
    } catch (err: any) {
      setErrorMsg(err?.message || "Partner sign-off failed.");
    } finally {
      setIsSigningOff(false);
    }
  };

  const handleAiDraft = async () => {
    if (isLocked) return;
    setErrorMsg(null);
    try {
      const res = await draftMutation.mutateAsync({ id });
      if (res && (res as any).content) {
        setContent((res as any).content);
      }
      queryClient.invalidateQueries({ queryKey: [`/api/working-papers/${id}`] });
    } catch (err: any) {
      setErrorMsg(err?.message || "AI workpaper drafting failed.");
    }
  };

  const handleCopyHash = () => {
    if ((paper as any).signedOffHash) {
      navigator.clipboard.writeText((paper as any).signedOffHash);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-6">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/working-papers">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Working Papers
              </Button>
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted">
              {paper.wpRef}
            </span>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              {paper.section}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            {paper.title}
          </h1>
        </div>

        {/* Status & Quick Actions */}
        <div className="flex items-center gap-2">
          {paper.status === "signed_off" && (
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 py-1 px-3">
              <Lock className="w-3.5 h-3.5" /> Partner Signed Off
            </Badge>
          )}
          {paper.status === "in_review" && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 gap-1 py-1 px-3">
              <Clock className="w-3.5 h-3.5" /> In Manager Review
            </Badge>
          )}
          {paper.status === "draft" && (
            <Badge variant="outline" className="text-muted-foreground gap-1 py-1 px-3">
              <Unlock className="w-3.5 h-3.5" /> Draft in Progress
            </Badge>
          )}

          {paper.engagementId && (
            <a href={`/api/engagements/${paper.engagementId}/audit-binder`} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="w-4 h-4" /> Export Binder
              </Button>
            </a>
          )}
        </div>
      </div>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>Action Error</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Cryptographic Sign-Off Verification Banner */}
      {isLocked && (
        <Card className="border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                  ISA 230 / AICPA AU-C 230 Regulatory Sign-off Locked
                  <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-700 dark:text-emerald-300">
                    Immutable
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Signed off by <span className="font-medium text-foreground">{paper.signedOffBy || "Engagement Partner"}</span> on{" "}
                  {paper.signedOffAt ? new Date(paper.signedOffAt).toLocaleString() : "Audit Completion"}
                </div>
                {(paper as any).signedOffHash && (
                  <div className="flex items-center gap-1.5 mt-2 font-mono text-[11px] text-muted-foreground bg-background/80 px-2.5 py-1 rounded border">
                    <span className="text-foreground/70">SHA-256 Digest:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{(paper as any).signedOffHash}</span>
                    <button
                      onClick={handleCopyHash}
                      className="ml-1 hover:text-foreground text-muted-foreground inline-flex items-center gap-1"
                      title="Copy SHA-256 Hash"
                    >
                      {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="text-xs text-muted-foreground italic max-w-xs text-right">
              This document is cryptographically sealed for regulatory inspection. Subsequent mutations are rejected.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Workflow & Editor Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Editor & Structured Content (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          <Tabs defaultValue="editor" className="w-full">
            <div className="flex items-center justify-between border-b pb-2">
              <TabsList className="bg-muted/60">
                <TabsTrigger value="editor">Working Paper Document</TabsTrigger>
                <TabsTrigger value="structured">ISA 230 Schedule</TabsTrigger>
                <TabsTrigger value="history">Audit Trail</TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                {!isLocked && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAiDraft}
                      disabled={draftMutation.isPending}
                      className="gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {draftMutation.isPending ? "Drafting with Claude..." : "AI Auto-Draft"}
                    </Button>

                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={updateMutation.isPending}
                      className="gap-1.5 text-xs"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {isSaved ? "Saved!" : updateMutation.isPending ? "Saving..." : "Save Workpaper"}
                    </Button>
                  </>
                )}
              </div>
            </div>

            <TabsContent value="editor" className="pt-4 space-y-4">
              <Card>
                <CardHeader className="py-3 px-4 bg-muted/20 border-b flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-medium">Audit Working Paper Narrative</CardTitle>
                    <CardDescription className="text-xs">
                      ISA 230 documentation of procedures, sample evaluations, calculations, and conclusion.
                    </CardDescription>
                  </div>
                  {paper.aiDrafted && (
                    <Badge variant="outline" className="text-[10px] text-indigo-600 dark:text-indigo-400 gap-1">
                      <Sparkles className="w-3 h-3" /> AI Synthesized
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="p-4">
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    disabled={isLocked}
                    rows={22}
                    placeholder="Document audit scope, procedures performed, source sample testing, and conclusion..."
                    className={`font-mono text-sm leading-relaxed resize-y ${
                      isLocked ? "bg-muted/40 cursor-not-allowed opacity-90" : "bg-background"
                    }`}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="structured" className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="py-3 px-4 border-b">
                    <CardTitle className="text-sm font-semibold">1. Audit Objective & Scope</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 text-xs space-y-2 text-muted-foreground">
                    <p>• Verify financial statement assertions (Completeness, Accuracy, Cut-off, Existence).</p>
                    <p>• Test journal entries across engagement materiality thresholds.</p>
                    <p>• Perform substantive analytical procedures over GL population.</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3 px-4 border-b">
                    <CardTitle className="text-sm font-semibold">2. Procedures Performed</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 text-xs space-y-2 text-muted-foreground">
                    <p>• First-digit Benford's Law distribution analysis across all transactions.</p>
                    <p>• Deterministic identification of weekend postings and round-dollar sums.</p>
                    <p>• Mathematical reconciliation between trial balance debits and credits.</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3 px-4 border-b">
                    <CardTitle className="text-sm font-semibold">3. Evidence & Samples</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 text-xs space-y-2 text-muted-foreground">
                    <p>• General Ledger data file verified with SHA-256 integrity hash.</p>
                    <p>• Population tested: 100% census analysis using streaming parser.</p>
                    <p>• Verified against external bank reconciliations and source documentation.</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3 px-4 border-b">
                    <CardTitle className="text-sm font-semibold">4. Audit Conclusion</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 text-xs space-y-2 text-muted-foreground">
                    <p>• Audit procedures provide reasonable assurance that account balances are free of material misstatement.</p>
                    <p>• Anomalies evaluated alongside tolerable misstatement limits.</p>
                    <p>• Substantive fieldwork conforms with ISA 230 / AU-C 230 requirements.</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="history" className="pt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Sign-off & Governance History</CardTitle>
                  <CardDescription className="text-xs">Immutable chronological chain of review</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="flex items-start gap-3 border-l-2 border-emerald-500 pl-4 py-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" />
                    <div>
                      <div className="font-semibold text-foreground">Working Paper Created</div>
                      <div className="text-muted-foreground">
                        {paper.createdAt ? new Date(paper.createdAt).toLocaleString() : "Start of engagement"}
                      </div>
                    </div>
                  </div>

                  {paper.aiDrafted && (
                    <div className="flex items-start gap-3 border-l-2 border-indigo-500 pl-4 py-1">
                      <Sparkles className="w-4 h-4 text-indigo-500 mt-0.5" />
                      <div>
                        <div className="font-semibold text-foreground">AI Narrative Synthesized</div>
                        <div className="text-muted-foreground">Generated with Claude 3.5 Sonnet autonomous engine</div>
                      </div>
                    </div>
                  )}

                  {paper.status === "signed_off" && (
                    <div className="flex items-start gap-3 border-l-2 border-emerald-600 pl-4 py-1">
                      <Lock className="w-4 h-4 text-emerald-600 mt-0.5" />
                      <div>
                        <div className="font-semibold text-foreground">Partner Regulatory Sign-Off</div>
                        <div className="text-muted-foreground">
                          Signed by {paper.signedOffBy || "Engagement Partner"} on{" "}
                          {paper.signedOffAt ? new Date(paper.signedOffAt).toLocaleString() : "Date of completion"}
                        </div>
                        <div className="font-mono text-[10px] text-emerald-600 mt-1 break-all">
                          Hash: {(paper as any).signedOffHash}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column: Sign-off State Machine & Governance Console (1 col) */}
        <div className="space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-primary" />
                Audit Sign-Off Controls
              </CardTitle>
              <CardDescription className="text-xs">
                Three-tier review chain (Preparer → Manager → Partner)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Review Tier 1: Preparer */}
              <div className="space-y-1.5 border-b pb-3">
                <div className="text-xs font-medium text-foreground flex items-center justify-between">
                  <span>1. Preparer Submission</span>
                  {paper.status !== "draft" ? (
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500">Submitted</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">In Progress</Badge>
                  )}
                </div>
                {!isLocked && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs justify-start gap-2 h-8"
                    onClick={() => handleStatusChange("in_review")}
                    disabled={paper.status === "in_review"}
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    Submit for Manager Review
                  </Button>
                )}
              </div>

              {/* Review Tier 2: Manager Review */}
              <div className="space-y-1.5 border-b pb-3">
                <div className="text-xs font-medium text-foreground flex items-center justify-between">
                  <span>2. Manager Verification</span>
                  {paper.status === "signed_off" ? (
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500">Reviewed</Badge>
                  ) : paper.status === "in_review" ? (
                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500">Pending</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">Awaiting</Badge>
                  )}
                </div>
                {!isLocked && paper.status === "in_review" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs justify-start gap-2 h-8"
                    onClick={() => handleStatusChange("draft")}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Return to Preparer Draft
                  </Button>
                )}
              </div>

              {/* Review Tier 3: Partner Sign-Off Lock */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-foreground flex items-center justify-between">
                  <span>3. Partner Sign-Off (Lock)</span>
                  {isLocked ? (
                    <Badge className="bg-emerald-600 text-white text-[10px]">Locked</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">Open</Badge>
                  )}
                </div>

                {!isLocked ? (
                  <div className="space-y-2 pt-1">
                    <label className="text-[11px] text-muted-foreground">Signing Partner Name</label>
                    <input
                      type="text"
                      value={partnerName}
                      onChange={(e) => setPartnerName(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded border bg-background"
                      placeholder="e.g. Sarah Jenkins, CPA"
                    />
                    <Button
                      onClick={handlePartnerSignOff}
                      disabled={isSigningOff}
                      className="w-full text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      {isSigningOff ? "Sealing Paper..." : "Execute Partner Sign-Off"}
                    </Button>
                    <p className="text-[10px] text-muted-foreground italic">
                      Executing sign-off permanently locks content and computes cryptographic SHA-256 proof.
                    </p>
                  </div>
                ) : (
                  <div className="p-2.5 rounded bg-muted/60 text-[11px] space-y-1">
                    <div className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Sealed & Cryptographically Bound
                    </div>
                    <div className="text-muted-foreground">
                      Sign-off completed. Any content tampering will invalidate the audit binder certificate.
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Metadata Card */}
          <Card>
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Workpaper Index Info
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reference:</span>
                <span className="font-mono font-medium">{paper.wpRef}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Section:</span>
                <span className="font-medium">{paper.section}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Standard:</span>
                <span className="font-medium">ISA 230 / AU-C 230</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">AI Assisted:</span>
                <span className="font-medium">{paper.aiDrafted ? "Yes" : "No"}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
