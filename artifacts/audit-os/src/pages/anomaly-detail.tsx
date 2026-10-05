import { useParams } from "wouter";
import { useGetAnomaly, useAnalyzeAnomaly } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function AnomalyDetailPage() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const queryClient = useQueryClient();
  
  const { data: anomaly, isLoading } = useGetAnomaly(id);
  const analyzeMutation = useAnalyzeAnomaly();

  if (isLoading) {
    return <Skeleton className="w-full h-96" />;
  }

  if (!anomaly) return <div>Not found</div>;

  const handleAnalyze = () => {
    analyzeMutation.mutate(
      { id },
      {
        onSuccess: (data) => {
          queryClient.setQueryData([`/api/anomalies/${id}`], (old: any) => 
            old ? { ...old, aiExplanation: data.updatedExplanation } : old
          );
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            Anomaly {anomaly.journalRef}
            <Badge variant={anomaly.riskLevel === "high" || anomaly.riskLevel === "critical" ? "destructive" : "outline"}>
              {anomaly.riskLevel} Risk
            </Badge>
          </h1>
          <p className="text-muted-foreground mt-1">Type: {anomaly.anomalyType}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Account</span>
              <span className="font-medium">{anomaly.accountCode} - {anomaly.accountName}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{anomaly.transactionDate}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium tabular-nums">${anomaly.amount?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="secondary">{anomaly.auditorStatus}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              AI Analysis
            </CardTitle>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleAnalyze}
              disabled={analyzeMutation.isPending}
            >
              {analyzeMutation.isPending ? "Analyzing..." : "Deep Dive"}
            </Button>
          </CardHeader>
          <CardContent>
            {analyzeMutation.isError ? (
              <p className="text-sm text-destructive mb-3">{analyzeMutation.error.message}</p>
            ) : null}
            {anomaly.aiExplanation ? (
              <div className="prose prose-sm dark:prose-invert">
                <p>{anomaly.aiExplanation}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <AlertTriangle className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No AI analysis available.</p>
                <p className="text-xs mt-1">Click Deep Dive to run analysis.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
