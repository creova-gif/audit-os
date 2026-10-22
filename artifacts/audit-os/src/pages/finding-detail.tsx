import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useGetFinding, useUpdateFinding } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  ArrowLeft, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  ShieldAlert, 
  FileText, 
  Clock, 
  Calendar,
  Building2,
  Check
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function FindingDetailPage() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const queryClient = useQueryClient();

  const { data: finding, isLoading } = useGetFinding(id);
  const updateMutation = useUpdateFinding();

  const [mgmtResponse, setMgmtResponse] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("open");
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (finding) {
      setMgmtResponse(finding.managementResponse || "");
      setDueDate(finding.dueDate || "");
      setStatus(finding.status || "open");
    }
  }, [finding]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto py-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!finding) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-semibold">Audit Finding not found</h2>
        <Link href="/findings">
          <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Findings</Button>
        </Link>
      </div>
    );
  }

  const handleSave = async () => {
    setSaveError(null);
    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          managementResponse: mgmtResponse,
          dueDate,
          status,
          ...(status === "closed" || status === "remediated" ? { resolvedAt: new Date().toISOString() } : {}),
        },
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
      queryClient.invalidateQueries({ queryKey: [`/api/findings/${id}`] });
    } catch (err: any) {
      setSaveError(err?.message || "Failed to save finding updates.");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/findings">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Audit Findings
              </Button>
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted">
              {finding.findingRef}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            {finding.title}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Badge 
            variant={finding.riskLevel === "critical" || finding.riskLevel === "high" ? "destructive" : "secondary"}
            className="capitalize py-1 px-3"
          >
            {finding.riskLevel} Risk
          </Badge>

          <Badge variant="outline" className="capitalize py-1 px-3 font-semibold">
            Status: {finding.status}
          </Badge>

          {finding.engagementId && (
            <Link href={`/engagements/${finding.engagementId}`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Building2 className="w-3.5 h-3.5" /> View Engagement
              </Button>
            </Link>
          )}
        </div>
      </div>

      {saveError && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>Save Error</AlertTitle>
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Finding Detail & ISA Structure (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="py-3 px-4 border-b bg-muted/20">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-primary" />
                Audit Exception & Description
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 text-sm leading-relaxed">
              <div className="whitespace-pre-wrap text-foreground">
                {finding.description}
              </div>

              <div className="pt-4 border-t grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground block mb-0.5">Auditing Standard:</span>
                  <span className="font-mono font-medium">{finding.isaReference || "ISA 240 / AU-C 240"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Date Raised:</span>
                  <span className="font-medium">
                    {finding.createdAt ? new Date(finding.createdAt).toLocaleDateString() : "Active Engagement"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Management Response & Remediation Plan */}
          <Card>
            <CardHeader className="py-3 px-4 border-b bg-muted/20 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Management Response & Action Plan</CardTitle>
                <CardDescription className="text-xs">
                  Formal response provided by the auditee management with corrective target dates.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <Textarea
                rows={6}
                placeholder="Enter client management's formal corrective action plan, internal control remediation steps, and responsible officers..."
                value={mgmtResponse}
                onChange={(e) => setMgmtResponse(e.target.value)}
                className="text-xs leading-relaxed"
              />

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Target Remediation Date:</span>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="text-xs h-8 w-40"
                  />
                </div>

                <Button 
                  size="sm" 
                  onClick={handleSave} 
                  disabled={updateMutation.isPending}
                  className="gap-1.5 text-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSaved ? "Saved!" : updateMutation.isPending ? "Saving..." : "Save Response"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Status & Remediation Controls (1 col) */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Remediation Lifecycle
              </CardTitle>
              <CardDescription className="text-xs">
                Audit Committee tracking & closure
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1.5">Finding Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 rounded border bg-background capitalize"
                >
                  <option value="open">Open (Fieldwork)</option>
                  <option value="under_review">Under Audit Review</option>
                  <option value="remediated">Remediated by Client</option>
                  <option value="closed">Closed / Cleared by Partner</option>
                </select>
              </div>

              <div className="p-3 rounded bg-muted/50 border text-xs space-y-2">
                <div className="font-semibold text-foreground">Audit Committee Reporting</div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Findings marked <span className="font-semibold text-destructive">Critical</span> or <span className="font-semibold text-amber-600">High</span> are automatically scheduled for inclusion in the Year-End Audit Committee Executive Binder.
                </p>
              </div>

              <Button 
                onClick={handleSave} 
                disabled={updateMutation.isPending}
                className="w-full text-xs"
              >
                Update Lifecycle Status
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Finding Metadata
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reference:</span>
                <span className="font-mono font-medium">{finding.findingRef}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Engagement ID:</span>
                <span className="font-mono font-medium">ENG-{finding.engagementId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Risk Level:</span>
                <span className="capitalize font-medium">{finding.riskLevel}</span>
              </div>
              {finding.resolvedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resolved On:</span>
                  <span className="font-medium">{new Date(finding.resolvedAt).toLocaleDateString()}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
