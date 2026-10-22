import { useState } from "react";
import { useParams, Link } from "wouter";
import { 
  useGetEngagement, 
  useListAnomalies, 
  useListFindings, 
  useListWorkingPapers, 
  useListDataRoomItems,
  useCreateFinding
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter, 
  DialogDescription,
  DialogTrigger 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowLeft, 
  Download, 
  FileSpreadsheet, 
  KeyRound, 
  Plus, 
  Lock, 
  AlertTriangle, 
  FileText, 
  FolderLock, 
  ExternalLink,
  Check,
  Copy,
  Sparkles,
  Calculator
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function EngagementDetailPage() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const queryClient = useQueryClient();

  const { data: engagement, isLoading: isEngagementLoading } = useGetEngagement(id);
  const { data: anomalies, isLoading: isAnomaliesLoading } = useListAnomalies({ engagementId: id });
  const { data: findings, isLoading: isFindingsLoading } = useListFindings({ engagementId: id });
  const { data: papers, isLoading: isPapersLoading } = useListWorkingPapers({ engagementId: id });
  const { data: pbcItems, isLoading: isPbcLoading } = useListDataRoomItems({ engagementId: id });

  const createFindingMutation = useCreateFinding();

  // State for Magic Link generation modal
  const [magicEmail, setMagicEmail] = useState("");
  const [magicLinkResult, setMagicLinkResult] = useState<string | null>(null);
  const [isGeneratingMagic, setIsGeneratingMagic] = useState(false);
  const [isCopiedMagic, setIsCopiedMagic] = useState(false);

  // State for Raise Finding modal
  const [isFindingDialogOpen, setIsFindingDialogOpen] = useState(false);
  const [findingTitle, setFindingTitle] = useState("");
  const [findingDesc, setFindingDesc] = useState("");
  const [findingRisk, setFindingRisk] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [findingImpact, setFindingImpact] = useState("");

  if (isEngagementLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto py-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!engagement) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-semibold">Engagement not found</h2>
        <Link href="/engagements">
          <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Engagements</Button>
        </Link>
      </div>
    );
  }

  const handleGenerateMagicLink = async () => {
    if (!magicEmail || !magicEmail.includes("@")) return;
    setIsGeneratingMagic(true);
    try {
      const res = await fetch("/api/portal/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientEmail: magicEmail,
          engagementId: id,
        }),
      });
      const data = await res.json();
      if (data.magicLinkUrl) {
        setMagicLinkResult(data.magicLinkUrl);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingMagic(false);
    }
  };

  const handleCopyMagicLink = () => {
    if (magicLinkResult) {
      navigator.clipboard.writeText(magicLinkResult);
      setIsCopiedMagic(true);
      setTimeout(() => setIsCopiedMagic(false), 2000);
    }
  };

  const handleCreateFinding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!findingTitle) return;
    try {
      await createFindingMutation.mutateAsync({
        data: {
          engagementId: id,
          title: findingTitle,
          description: findingDesc,
          riskLevel: findingRisk,
        },
      });
      setIsFindingDialogOpen(false);
      setFindingTitle("");
      setFindingDesc("");
      setFindingRisk("medium");
      setFindingImpact("");
      queryClient.invalidateQueries({ queryKey: [`/api/findings`] });
    } catch (err) {
      console.error(err);
    }
  };

  const signedOffCount = papers?.filter(p => p.status === "signed_off").length || 0;
  const totalPapers = papers?.length || 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/engagements">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Engagements
              </Button>
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-xs font-medium text-muted-foreground">ENG-{id}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {engagement.engagementName}
            </h1>
            <Badge variant="outline" className="text-xs uppercase">
              {engagement.engagementType || "Annual Audit"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Client: <span className="font-semibold text-foreground">{engagement.client?.name || "Corporate Client"}</span>
            {" • "}
            Period: {engagement.periodStart || "2026-01-01"} to {engagement.periodEnd || "2026-12-31"}
          </p>
        </div>

        {/* Global Engagement Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/ledger-ingestion?engagementId=${id}`}>
            <Button size="sm" className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white">
              <FileSpreadsheet className="w-4 h-4" /> Run Fieldwork
            </Button>
          </Link>

          {/* Magic Link Generator Dialog */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <KeyRound className="w-4 h-4 text-amber-500" /> Client Portal Magic Link
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-amber-500" /> Generate Client Magic Link
                </DialogTitle>
                <DialogDescription>
                  Issue a passwordless, 24-hour single-use redemption link for external client contacts.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Client Email Address</label>
                  <Input
                    type="email"
                    placeholder="cfo@client.com"
                    value={magicEmail}
                    onChange={(e) => setMagicEmail(e.target.value)}
                  />
                </div>

                {magicLinkResult && (
                  <div className="p-3 rounded bg-muted/60 space-y-2 border">
                    <div className="text-xs font-medium text-foreground flex items-center justify-between">
                      <span>Generated Magic Link:</span>
                      <Button variant="ghost" size="sm" onClick={handleCopyMagicLink} className="h-6 text-xs gap-1">
                        {isCopiedMagic ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        {isCopiedMagic ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    <div className="font-mono text-xs break-all p-2 rounded bg-background border text-primary">
                      {magicLinkResult}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Send this URL to the client. Upon opening, they will receive a scoped session cookie to fulfill PBC requests.
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button 
                  onClick={handleGenerateMagicLink} 
                  disabled={isGeneratingMagic || !magicEmail}
                  className="w-full sm:w-auto"
                >
                  {isGeneratingMagic ? "Generating Token..." : "Generate Magic Link"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <a href={`/api/engagements/${id}/audit-binder`} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="w-4 h-4" /> Download PDF Binder
            </Button>
          </a>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Engagement Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Badge className="capitalize text-sm font-medium">{engagement.status || "In Progress"}</Badge>
              <Badge variant="outline" className="text-xs">{engagement.overallRisk || "Medium"} Risk</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Planning Materiality
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono">
              ${engagement.materialityUsd ? Number(engagement.materialityUsd).toLocaleString() : "500,000"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Threshold for audit scope</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Performance Materiality
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono">
              ${engagement.performanceMatUsd ? Number(engagement.performanceMatUsd).toLocaleString() : "375,000"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">75% of Planning Materiality</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              ISA 230 Governance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-xl font-bold font-mono">
                {signedOffCount} / {totalPapers}
              </div>
              <Badge variant={signedOffCount === totalPapers && totalPapers > 0 ? "default" : "secondary"} className="text-xs gap-1">
                <Lock className="w-3 h-3" /> {signedOffCount === totalPapers && totalPapers > 0 ? "Complete" : "In Review"}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Partner signed-off papers</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Hub */}
      <Tabs defaultValue="anomalies" className="w-full">
        <TabsList className="grid grid-cols-4 w-full md:w-auto bg-muted/60">
          <TabsTrigger value="anomalies" className="gap-2 text-xs">
            <AlertTriangle className="w-3.5 h-3.5" />
            Anomalies ({anomalies?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="findings" className="gap-2 text-xs">
            <FileText className="w-3.5 h-3.5" />
            Findings ({findings?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="papers" className="gap-2 text-xs">
            <Lock className="w-3.5 h-3.5" />
            Working Papers ({papers?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="data-room" className="gap-2 text-xs">
            <FolderLock className="w-3.5 h-3.5" />
            Data Room ({pbcItems?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Anomalies */}
        <TabsContent value="anomalies" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Detected deviations via deterministic math testing and AI fieldwork synthesis.
            </p>
            <Link href={`/ledger-ingestion?engagementId=${id}`}>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> Ingest New Ledger File
              </Button>
            </Link>
          </div>

          {isAnomaliesLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !anomalies || anomalies.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground space-y-2">
                <AlertTriangle className="w-8 h-8 mx-auto text-muted-foreground/60" />
                <p className="text-sm font-medium">No anomalies detected for this engagement yet.</p>
                <p className="text-xs">Upload a General Ledger dump in Ledger Ingestion to execute automated fieldwork.</p>
                <Link href={`/ledger-ingestion?engagementId=${id}`}>
                  <Button size="sm" className="mt-2">Go to Ledger Ingestion</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-md overflow-hidden bg-card">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b font-medium text-muted-foreground">
                  <tr>
                    <th className="p-3">Journal Ref</th>
                    <th className="p-3">Anomaly Type</th>
                    <th className="p-3">Account</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Risk Level</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {anomalies.map((anom) => (
                    <tr key={anom.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-mono font-medium">{anom.journalRef || `JE-${anom.id}`}</td>
                      <td className="p-3 font-medium capitalize">{anom.anomalyType?.replace(/_/g, " ")}</td>
                      <td className="p-3 text-muted-foreground">{anom.accountCode} - {anom.accountName}</td>
                      <td className="p-3 font-mono font-semibold">${Number(anom.amount || 0).toLocaleString()}</td>
                      <td className="p-3">
                        {(anom as any).detectionMethod === "deterministic" ? (
                          <Badge variant="outline" className="text-[10px] gap-1 border-blue-500/30 text-blue-600 dark:text-blue-400">
                            <Calculator className="w-2.5 h-2.5" /> Deterministic
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] gap-1 border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
                            <Sparkles className="w-2.5 h-2.5" /> AI Synthesis
                          </Badge>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge 
                          variant={anom.riskLevel === "critical" || anom.riskLevel === "high" ? "destructive" : "secondary"}
                          className="text-[10px] capitalize"
                        >
                          {anom.riskLevel}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <span className="capitalize text-muted-foreground">{anom.auditorStatus || "Unreviewed"}</span>
                      </td>
                      <td className="p-3 text-right">
                        <Link href={`/anomalies/${anom.id}`}>
                          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
                            Inspect <ExternalLink className="w-3 h-3" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Findings */}
        <TabsContent value="findings" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Formal audit findings and control deficiencies to be communicated to the Audit Committee.
            </p>

            <Dialog open={isFindingDialogOpen} onOpenChange={setIsFindingDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Raise Finding
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <form onSubmit={handleCreateFinding}>
                  <DialogHeader>
                    <DialogTitle>Raise Audit Finding</DialogTitle>
                    <DialogDescription>
                      Record a control deficiency or substantive misstatement identified during fieldwork.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-3">
                    <div>
                      <label className="text-xs font-medium block mb-1">Finding Title</label>
                      <Input
                        required
                        placeholder="e.g. Unreconciled Intercompany Clearing Variance"
                        value={findingTitle}
                        onChange={(e) => setFindingTitle(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium block mb-1">Risk Severity</label>
                        <select
                          value={findingRisk}
                          onChange={(e: any) => setFindingRisk(e.target.value)}
                          className="w-full text-xs px-2.5 py-2 rounded border bg-background"
                        >
                          <option value="low">Low Risk</option>
                          <option value="medium">Medium Risk</option>
                          <option value="high">High Risk</option>
                          <option value="critical">Critical Defect</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1">Financial Impact ($)</label>
                        <Input
                          placeholder="e.g. 150000"
                          value={findingImpact}
                          onChange={(e) => setFindingImpact(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium block mb-1">Description & Audit Evidence</label>
                      <Textarea
                        rows={4}
                        placeholder="Document the condition, criteria, cause, effect, and recommended management action..."
                        value={findingDesc}
                        onChange={(e) => setFindingDesc(e.target.value)}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsFindingDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createFindingMutation.isPending}>
                      {createFindingMutation.isPending ? "Recording..." : "Raise Finding"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {isFindingsLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !findings || findings.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground space-y-2">
                <FileText className="w-8 h-8 mx-auto text-muted-foreground/60" />
                <p className="text-sm font-medium">No audit findings raised for this engagement.</p>
                <p className="text-xs">Click "Raise Finding" above if substantive fieldwork indicates a reportable condition.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-md overflow-hidden bg-card">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b font-medium text-muted-foreground">
                  <tr>
                    <th className="p-3">Ref</th>
                    <th className="p-3">Title</th>
                    <th className="p-3">Risk Level</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {findings.map((f) => (
                    <tr key={f.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-mono font-medium">{f.findingRef || `FIND-${f.id}`}</td>
                      <td className="p-3 font-semibold text-foreground">{f.title}</td>
                      <td className="p-3">
                        <Badge 
                          variant={f.riskLevel === "critical" || f.riskLevel === "high" ? "destructive" : "secondary"}
                          className="text-[10px] capitalize"
                        >
                          {f.riskLevel}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {f.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <Link href={`/findings/${f.id}`}>
                          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
                            Review <ExternalLink className="w-3 h-3" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Tab 3: Working Papers */}
        <TabsContent value="papers" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              ISA 230 compliant documentation organized by engagement lifecycle.
            </p>
            <a href={`/api/engagements/${id}/audit-binder`} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <Download className="w-3.5 h-3.5" /> Download Compiled Audit Binder
              </Button>
            </a>
          </div>

          {isPapersLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !papers || papers.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground space-y-2">
                <Lock className="w-8 h-8 mx-auto text-muted-foreground/60" />
                <p className="text-sm font-medium">No working papers created for this engagement yet.</p>
                <p className="text-xs">Ledger ingestion will automatically create WP GL-100 upon fieldwork completion.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-md overflow-hidden bg-card">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b font-medium text-muted-foreground">
                  <tr>
                    <th className="p-3">WP Ref</th>
                    <th className="p-3">Section</th>
                    <th className="p-3">Title</th>
                    <th className="p-3">Review Status</th>
                    <th className="p-3">Sign-off Proof (SHA-256)</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {papers.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-mono font-semibold">{p.wpRef}</td>
                      <td className="p-3 capitalize text-muted-foreground">{p.section}</td>
                      <td className="p-3 font-medium text-foreground">{p.title}</td>
                      <td className="p-3">
                        {p.status === "signed_off" ? (
                          <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
                            <Lock className="w-2.5 h-2.5" /> Locked & Signed
                          </Badge>
                        ) : p.status === "in_review" ? (
                          <Badge variant="secondary" className="text-[10px]">In Review</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Draft</Badge>
                        )}
                      </td>
                      <td className="p-3">
                        {(p as any).signedOffHash ? (
                          <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                            {(p as any).signedOffHash.slice(0, 16)}...
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">Unsealed</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <Link href={`/working-papers/${p.id}`}>
                          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
                            Open <ExternalLink className="w-3 h-3" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Tab 4: Data Room / PBC */}
        <TabsContent value="data-room" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Provided by Client (PBC) document intake checklist and client discussion records.
            </p>
            <Link href={`/data-room?engagementId=${id}`}>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                Manage Data Room & PBC
              </Button>
            </Link>
          </div>

          {isPbcLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !pbcItems || pbcItems.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground space-y-2">
                <FolderLock className="w-8 h-8 mx-auto text-muted-foreground/60" />
                <p className="text-sm font-medium">No PBC requests created for this engagement yet.</p>
                <p className="text-xs">Create PBC requests in the Data Room so clients can upload supporting documentation.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-md overflow-hidden bg-card">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b font-medium text-muted-foreground">
                  <tr>
                    <th className="p-3">Item Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Client Portal Visibility</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pbcItems.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-semibold text-foreground">{item.itemName}</td>
                      <td className="p-3 text-muted-foreground">{item.category}</td>
                      <td className="p-3">
                        <Badge 
                          variant={item.status === "received" ? "default" : "outline"}
                          className="text-[10px] capitalize"
                        >
                          {item.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500">
                          Active in Client Portal
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <Link href={`/data-room?engagementId=${id}`}>
                          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
                            Discuss / Upload <ExternalLink className="w-3 h-3" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
