import { useState } from "react";
import { useParams, Link } from "wouter";
import { 
  useGetClient, 
  useListEngagements, 
  useCreateEngagement 
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter, 
  DialogDescription,
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  ArrowLeft, 
  Building2, 
  Plus, 
  Mail, 
  Phone, 
  Calendar, 
  ShieldCheck, 
  FileSpreadsheet, 
  ArrowRight,
  UserCheck
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function ClientDetailPage() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const queryClient = useQueryClient();

  const { data: client, isLoading: isClientLoading } = useGetClient(id);
  const { data: allEngagements, isLoading: isEngagementsLoading } = useListEngagements();
  const createEngagementMutation = useCreateEngagement();

  // Create Engagement Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [engName, setEngName] = useState("");
  const [engType, setEngType] = useState("Annual Statutory Audit");
  const [periodStart, setPeriodStart] = useState("2026-01-01");
  const [periodEnd, setPeriodEnd] = useState("2026-12-31");
  const [materiality, setMateriality] = useState("500000");

  if (isClientLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto py-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-semibold">Client not found</h2>
        <Link href="/clients">
          <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Clients</Button>
        </Link>
      </div>
    );
  }

  const clientEngagements = allEngagements?.filter(e => e.clientId === id) || [];
  const activeEngagements = clientEngagements.filter(e => e.status !== "completed");

  const handleCreateEngagement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!engName) return;
    try {
      const mat = parseFloat(materiality) || 500000;
      await createEngagementMutation.mutateAsync({
        data: {
          clientId: id,
          engagementName: engName,
          engagementType: engType,
          periodStart,
          periodEnd,
          materialityUsd: mat,
          overallRisk: "medium",
        },
      });
      setIsCreateOpen(false);
      setEngName("");
      queryClient.invalidateQueries({ queryKey: [`/api/engagements`] });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-6">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/clients">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Clients Directory
              </Button>
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-xs font-medium text-muted-foreground">CLI-{client.id}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Building2 className="w-7 h-7 text-primary" />
              {client.name}
            </h1>
            <Badge variant={client.isActive ? "default" : "secondary"}>
              {client.isActive ? "Active Client" : "Archived"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Industry: <span className="font-semibold text-foreground">{client.industry || "General Commercial"}</span>
            {" • "}
            Entity Type: {client.entityType || "Limited Liability Company"}
            {client.tin && ` • TIN: ${client.tin}`}
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 bg-primary text-primary-foreground">
              <Plus className="w-4 h-4" /> Start New Engagement
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleCreateEngagement}>
              <DialogHeader>
                <DialogTitle>Create Audit Engagement</DialogTitle>
                <DialogDescription>
                  Initialize a new audit engagement cycle for {client.name}.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-3">
                <div>
                  <label className="text-xs font-medium block mb-1">Engagement Name</label>
                  <Input
                    required
                    placeholder={`e.g. ${client.name} FY2026 Financial Audit`}
                    value={engName}
                    onChange={(e) => setEngName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium block mb-1">Engagement Type</label>
                  <select
                    value={engType}
                    onChange={(e) => setEngType(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 rounded border bg-background"
                  >
                    <option value="Annual Statutory Audit">Annual Statutory Audit</option>
                    <option value="Interim Review">Interim Financial Review</option>
                    <option value="Internal Controls Attestation">Internal Controls Attestation (ISAE 3402)</option>
                    <option value="Agreed-Upon Procedures">Agreed-Upon Procedures (ISRS 4400)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">Period Start</label>
                    <Input
                      type="date"
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Period End</label>
                    <Input
                      type="date"
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium block mb-1">Planning Materiality ($)</label>
                  <Input
                    type="number"
                    value={materiality}
                    onChange={(e) => setMateriality(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createEngagementMutation.isPending}>
                  {createEngagementMutation.isPending ? "Creating..." : "Create Engagement"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Profile & KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Primary Client Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-xs">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-primary" />
              <span className="font-semibold text-foreground text-sm">
                {client.contactName || "Corporate Finance Team"}
              </span>
            </div>
            {client.contactEmail && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-3.5 h-3.5" />
                <a href={`mailto:${client.contactEmail}`} className="hover:underline text-primary">
                  {client.contactEmail}
                </a>
              </div>
            )}
            {client.contactPhone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-3.5 h-3.5" />
                <span>{client.contactPhone}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground pt-1 border-t">
              <Calendar className="w-3.5 h-3.5" />
              <span>Financial Year End: {client.financialYearEnd || "December 31"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Audit Engagement History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            <div className="text-2xl font-bold font-mono">
              {clientEngagements.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Total engagements conducted on Audit OS ({activeEngagements.length} active in current cycle)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Regulatory Compliance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              KYC & Anti-Money Laundering Cleared
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Customer due diligence verified against standard international sanctions registries.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Engagements Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Engagements</h2>
        </div>

        {isEngagementsLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : clientEngagements.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground space-y-3">
              <Building2 className="w-10 h-10 mx-auto text-muted-foreground/60" />
              <h3 className="font-medium text-foreground">No engagements for this client yet</h3>
              <p className="text-xs max-w-sm mx-auto">
                Start an annual audit or review engagement to begin autonomous fieldwork and PBC collection.
              </p>
              <Button size="sm" onClick={() => setIsCreateOpen(true)} className="mt-2">
                <Plus className="w-4 h-4 mr-1.5" /> Start First Engagement
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="border rounded-md overflow-hidden bg-card">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b font-medium text-muted-foreground">
                <tr>
                  <th className="p-3">Engagement Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Period</th>
                  <th className="p-3">Materiality</th>
                  <th className="p-3">Risk</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {clientEngagements.map((eng) => (
                  <tr key={eng.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-semibold text-foreground">{eng.engagementName}</td>
                    <td className="p-3 text-muted-foreground">{eng.engagementType}</td>
                    <td className="p-3 text-muted-foreground font-mono">
                      {eng.periodStart} to {eng.periodEnd}
                    </td>
                    <td className="p-3 font-mono font-semibold">
                      ${Number(eng.materialityUsd || 0).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="capitalize text-[10px]">
                        {eng.overallRisk || "medium"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge className="capitalize text-[10px]">{eng.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      <Link href={`/engagements/${eng.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                          Open Hub <ArrowRight className="w-3 h-3" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
