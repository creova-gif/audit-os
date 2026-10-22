import { useState } from "react";
import { useListFindings, useCreateFinding, useListEngagements } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter, 
  DialogDescription,
  DialogTrigger 
} from "@/components/ui/dialog";
import { Plus, Search, Filter, AlertTriangle, ArrowRight, FileText } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

export default function FindingsPage() {
  const queryClient = useQueryClient();
  const { data: findings, isLoading } = useListFindings();
  const { data: engagements } = useListEngagements();
  const createFindingMutation = useCreateFinding();

  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Create Modal State
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [engagementId, setEngagementId] = useState<number>(1);
  const [riskLevel, setRiskLevel] = useState("high");
  const [isaReference, setIsaReference] = useState("ISA 240 / ISA 315");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    try {
      await createFindingMutation.mutateAsync({
        data: {
          engagementId,
          title,
          description,
          riskLevel,
          isaReference,
        },
      });
      setIsOpen(false);
      setTitle("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: [`/api/findings`] });
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = findings?.filter(f => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = f.title.toLowerCase().includes(q);
      const matchRef = f.findingRef.toLowerCase().includes(q);
      if (!matchTitle && !matchRef) return false;
    }
    if (riskFilter !== "all" && f.riskLevel !== riskFilter) return false;
    if (statusFilter !== "all" && f.status !== statusFilter) return false;
    return true;
  }) || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <FileText className="w-8 h-8 text-primary" />
            Audit Findings & Deficiencies
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Control deficiencies, material misstatements, and audit committee reporting schedules.
          </p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 bg-primary text-primary-foreground">
              <Plus className="w-4 h-4" />
              Raise Finding
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Raise Audit Finding</DialogTitle>
                <DialogDescription>
                  Formally document a control deficiency or accounting non-compliance.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-3">
                <div>
                  <label className="text-xs font-medium block mb-1">Engagement</label>
                  <select
                    value={engagementId}
                    onChange={(e) => setEngagementId(Number(e.target.value))}
                    className="w-full text-xs px-2.5 py-2 rounded border bg-background"
                  >
                    {engagements?.map(eng => (
                      <option key={eng.id} value={eng.id}>
                        {eng.engagementName} ({eng.client?.name || "Corporate"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium block mb-1">Finding Title</label>
                  <Input
                    required
                    placeholder="e.g. Inadequate Segregation of Duties in Wire Transfers"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">Risk Severity</label>
                    <select
                      value={riskLevel}
                      onChange={(e) => setRiskLevel(e.target.value)}
                      className="w-full text-xs px-2.5 py-2 rounded border bg-background"
                    >
                      <option value="critical">Critical Defect</option>
                      <option value="high">High Risk</option>
                      <option value="medium">Medium Risk</option>
                      <option value="low">Low Risk</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Standard / ISA Ref</label>
                    <Input
                      placeholder="e.g. ISA 315 / ISA 240"
                      value={isaReference}
                      onChange={(e) => setIsaReference(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium block mb-1">Condition & Root Cause</label>
                  <Textarea
                    rows={4}
                    placeholder="Describe the identified exception, criteria, cause, financial impact, and audit recommendation..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createFindingMutation.isPending}>
                  {createFindingMutation.isPending ? "Recording..." : "Record Finding"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 bg-card border rounded-lg">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search reference or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9"
            />
          </div>

          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded border bg-background"
          >
            <option value="all">All Risks</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded border bg-background capitalize"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="under_review">Under Review</option>
            <option value="remediated">Remediated</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div className="text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{filtered.length}</span> findings
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden bg-card">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 border-b font-medium text-muted-foreground">
              <tr>
                <th className="p-3 w-28">Reference</th>
                <th className="p-3">Title & Standard</th>
                <th className="p-3 w-32">Risk Level</th>
                <th className="p-3 w-32">Status</th>
                <th className="p-3 w-28 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(finding => (
                <tr key={finding.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-mono font-bold text-foreground">
                    {finding.findingRef}
                  </td>
                  <td className="p-3">
                    <div className="font-semibold text-foreground text-sm">{finding.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {finding.isaReference || "ISA 240 / AU-C 240"}
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge 
                      variant={finding.riskLevel === "critical" || finding.riskLevel === "high" ? "destructive" : "secondary"}
                      className="capitalize text-[10px]"
                    >
                      {finding.riskLevel}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className="capitalize text-[10px]">
                      {finding.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <Link href={`/findings/${finding.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                        View <ArrowRight className="w-3 h-3" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="p-12 text-center text-muted-foreground space-y-2">
              <FileText className="w-8 h-8 mx-auto text-muted-foreground/50" />
              <p className="text-sm font-medium">No matching audit findings</p>
              <p className="text-xs">Adjust your search or filter criteria.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
