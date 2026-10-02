import { useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetWorkingPaperQueryKey,
  useAcceptWorkingPaperDraft,
  useDraftWorkingPaper,
  useGetWorkingPaper,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function WorkingPaperDetailPage() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const queryClient = useQueryClient();
  const { data: paper, isLoading } = useGetWorkingPaper(id);
  const draftMutation = useDraftWorkingPaper();
  const acceptMutation = useAcceptWorkingPaperDraft();

  if (isLoading) return <Skeleton className="w-full h-96" />;
  if (!paper) return <div>Not found</div>;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getGetWorkingPaperQueryKey(id) });
  };
  const accepted = paper.aiDraftStatus === "accepted";
  const actionError = draftMutation.error ?? acceptMutation.error;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{paper.title}</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Working paper</h2>
        <div className="bg-card border rounded p-4 text-sm whitespace-pre-wrap">
          {paper.contentText || "No content."}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Template draft</h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={draftMutation.isPending}
            onClick={() => {
              draftMutation.mutate({ id }, { onSuccess: refresh });
            }}
          >
            {draftMutation.isPending ? "Creating template..." : "Create template draft"}
          </Button>
        </div>

        {paper.aiDraftText ? (
          <>
            <Alert>
              <AlertTitle>
                {accepted
                  ? "AI draft — accepted by a reviewer"
                  : "AI draft — pending reviewer acceptance"}
              </AlertTitle>
              <AlertDescription>
                This template is not audit evidence and is not the working paper.
                {accepted
                  ? " Acceptance did not copy it into the working paper text above."
                  : " A partner or manager must accept it. Acceptance does not replace the working paper text."}
              </AlertDescription>
            </Alert>
            <div className="bg-muted/40 border border-dashed rounded p-4 text-sm whitespace-pre-wrap">
              {paper.aiDraftText}
            </div>
            {accepted ? null : (
              <Button
                type="button"
                size="sm"
                disabled={acceptMutation.isPending}
                onClick={() => {
                  acceptMutation.mutate({ id }, { onSuccess: refresh });
                }}
              >
                {acceptMutation.isPending ? "Accepting..." : "Accept template"}
              </Button>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No template draft. Creating one stores a blank outline for review and leaves the working paper unchanged.
          </p>
        )}

        {actionError ? (
          <p className="text-sm text-destructive">{actionError.message}</p>
        ) : null}
      </section>
    </div>
  );
}
