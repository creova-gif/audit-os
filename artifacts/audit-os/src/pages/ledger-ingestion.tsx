import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  FileSpreadsheet, 
  Upload, 
  CheckCircle2, 
  AlertOctagon, 
  Clock, 
  Download, 
  ShieldAlert, 
  RefreshCw 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface IngestionJob {
  id: number;
  engagementId: number;
  fileName: string;
  fileSizeBytes: number;
  rowCount: number;
  status: "pending" | "processing" | "completed" | "failed";
  totalDebits: number | null;
  totalCredits: number | null;
  anomaliesFound: number;
  errorMessage: string | null;
  createdAt: string;
}

interface Engagement {
  id: number;
  engagementName: string;
  engagementType: string;
  status: string;
}

export default function LedgerIngestionPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEngagementId, setSelectedEngagementId] = useState<number>(1);
  const [uploading, setUploading] = useState(false);

  // Fetch engagements
  const { data: engagements = [] } = useQuery<Engagement[]>({
    queryKey: ["/api/engagements"],
    queryFn: async () => {
      const res = await fetch("/api/engagements");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch jobs for selected engagement
  const { data: jobs = [], refetch: refetchJobs } = useQuery<IngestionJob[]>({
    queryKey: ["/api/engagements", selectedEngagementId, "ledger-jobs"],
    queryFn: async () => {
      const res = await fetch(`/api/engagements/${selectedEngagementId}/ledger-jobs`);
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: (query) => {
      const data = query.state.data as IngestionJob[] | undefined;
      const hasActive = data?.some((j) => j.status === "pending" || j.status === "processing");
      return hasActive ? 2000 : 8000;
    },
  });

  const latestJob = jobs[0];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const text = await file.text();
      const res = await fetch(`/api/engagements/${selectedEngagementId}/ledger-uploads`, {
        method: "POST",
        headers: {
          "Content-Type": "text/csv",
          "x-file-name": file.name,
        },
        body: text,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Upload failed");
      }

      toast({
        title: "Ledger Upload Accepted",
        description: `Streaming parser & analytical math tests initiated for ${file.name}.`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/engagements", selectedEngagementId, "ledger-jobs"] });
    } catch (err) {
      toast({
        title: "Upload Failed",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const downloadAuditBinder = () => {
    window.open(`/api/engagements/${selectedEngagementId}/audit-binder`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Autonomous Ledger Fieldwork</h1>
          <p className="text-muted-foreground text-sm">
            High-throughput streaming ingestion, Benford's Law analysis, duplicate detection, and automated ISA 230 audit binder compilation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            className="border rounded-md px-3 py-2 text-sm bg-background shadow-sm"
            value={selectedEngagementId}
            onChange={(e) => setSelectedEngagementId(Number(e.target.value))}
          >
            {engagements.map((eng) => (
              <option key={eng.id} value={eng.id}>
                {eng.engagementName} (#{eng.id})
              </option>
            ))}
          </select>

          <Button onClick={downloadAuditBinder} className="gap-2 bg-slate-900 hover:bg-slate-800 text-white">
            <Download className="w-4 h-4" />
            Download Audit Binder (PDF)
          </Button>
        </div>
      </div>

      {/* Upload Dropzone */}
      <Card className="border-dashed border-2 bg-slate-50/50">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <FileSpreadsheet className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-semibold text-base mb-1">Upload General Ledger or Trial Balance</h3>
          <p className="text-xs text-muted-foreground max-w-md mb-4">
            Upload CSV/TSV dumps (up to 100MB). Normalized against canonical accounting fields with automated debit/credit reconciliation and AI workpaper drafting.
          </p>
          <label className="cursor-pointer">
            <Button disabled={uploading} asChild className="gap-2">
              <span>
                <Upload className="w-4 h-4" />
                {uploading ? "Streaming & Parsing..." : "Select Ledger File"}
              </span>
            </Button>
            <input
              type="file"
              accept=".csv,.tsv,.txt"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </CardContent>
      </Card>

      {/* Latest Analysis Results */}
      {latestJob && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Latest Ingestion Analysis: {latestJob.fileName}
                  {latestJob.status === "completed" && <Badge className="bg-emerald-500">Completed</Badge>}
                  {latestJob.status === "processing" && <Badge className="bg-blue-500">Processing Stream</Badge>}
                  {latestJob.status === "failed" && <Badge variant="destructive">Failed</Badge>}
                </CardTitle>
                <CardDescription>
                  Processed on {new Date(latestJob.createdAt).toLocaleString()}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => refetchJobs()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-slate-100/70">
                <span className="text-xs text-muted-foreground uppercase font-semibold">Population Size</span>
                <p className="text-xl font-bold mt-1">{latestJob.rowCount.toLocaleString()} rows</p>
              </div>

              <div className="p-4 rounded-lg bg-slate-100/70">
                <span className="text-xs text-muted-foreground uppercase font-semibold">Debit / Credit Balance</span>
                <p className="text-xl font-bold mt-1">
                  {latestJob.totalDebits !== null && latestJob.totalCredits !== null
                    ? Math.abs(latestJob.totalDebits - latestJob.totalCredits) < 0.01
                      ? "Balanced ✓"
                      : `Out: $${Math.abs(latestJob.totalDebits - latestJob.totalCredits).toFixed(2)}`
                    : "Calculating..."}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-slate-100/70">
                <span className="text-xs text-muted-foreground uppercase font-semibold">Flagged Anomalies</span>
                <p className="text-xl font-bold mt-1 text-amber-600">{latestJob.anomaliesFound}</p>
              </div>

              <div className="p-4 rounded-lg bg-slate-100/70">
                <span className="text-xs text-muted-foreground uppercase font-semibold">AI Workpaper Memo</span>
                <p className="text-xl font-bold mt-1 text-primary">WP GL-100</p>
              </div>
            </div>

            {latestJob.errorMessage && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Notice: {latestJob.errorMessage}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* History of Ingestion Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ledger Ingestion History</CardTitle>
          <CardDescription>Audit trail of all ledger uploads and testing runs for this engagement.</CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">No ledger files uploaded yet.</div>
          ) : (
            <div className="divide-y text-sm">
              {jobs.map((job) => (
                <div key={job.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-5 h-5 text-slate-500" />
                    <div>
                      <p className="font-medium text-slate-900">{job.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(job.createdAt).toLocaleString()} • {(job.fileSizeBytes / 1024).toFixed(1)} KB • {job.rowCount} transactions
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-xs font-semibold text-slate-600">
                      {job.anomaliesFound} anomalies flagged
                    </span>
                    <Badge variant={job.status === "completed" ? "default" : job.status === "failed" ? "destructive" : "secondary"}>
                      {job.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
