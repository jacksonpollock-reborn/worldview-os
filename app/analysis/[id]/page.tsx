import Link from "next/link";
import { notFound } from "next/navigation";
import { AnalysisView } from "@/components/analysis-view";
import { AppShell } from "@/components/app-shell";
import { FollowUpPanel } from "@/components/follow-up-panel";
import { LocalDateTime } from "@/components/local-date-time";
import { MarkdownCopyButton } from "@/components/markdown-copy-button";
import { NotesEditor } from "@/components/notes-editor";
import { RegenerateButton } from "@/components/regenerate-button";
import { ReviewPanel } from "@/components/review-panel";
import { TitleEditor } from "@/components/title-editor";
import { getAnalysisById } from "@/lib/data";
import { buildAnalysisMarkdown } from "@/lib/markdown";
import { formatOutcomeLabel } from "@/lib/review-format";

export const dynamic = "force-dynamic";

export default async function AnalysisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const analysisRecord = await getAnalysisById(id);

  if (!analysisRecord) {
    notFound();
  }

  const markdown = buildAnalysisMarkdown(analysisRecord);
  const redTeamStatusLabel =
    analysisRecord.redTeamStatus === "completed"
      ? "Red-team pass applied"
      : analysisRecord.redTeamStatus === "failed"
        ? "Red-team pass failed"
        : analysisRecord.redTeamStatus === "skipped"
          ? "Red-team pass skipped"
          : "Red-team status unavailable";
  const redTeamStatusTone =
    analysisRecord.redTeamStatus === "completed"
      ? "bg-success-soft text-foreground"
      : analysisRecord.redTeamStatus === "failed"
        ? "bg-danger-soft text-red-700"
        : "bg-surface-muted text-muted";

  return (
    <AppShell
      active="analysis"
      eyebrow="Analysis Record"
      title={analysisRecord.title}
      description="A fixed section order keeps the output readable and comparable across runs."
      compactHeader
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted">
                Created <LocalDateTime value={analysisRecord.createdAt} />
              </p>
              <TitleEditor analysisId={analysisRecord.id} initialTitle={analysisRecord.title} />
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-medium text-foreground">
                  Saved to history
                </span>
                {analysisRecord.modelUsed?.startsWith("mock:") ? (
                  <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
                    Mock analysis
                  </span>
                ) : null}
                {analysisRecord.analysis.domains.map((domain, index) => (
                  <span
                    key={`${analysisRecord.id}-domain-${index}`}
                    className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent"
                  >
                    {domain}
                  </span>
                ))}
                {analysisRecord.analysis.time_horizon ? (
                  <span className="rounded-full bg-surface-muted px-3 py-1 text-xs text-muted">
                    Horizon: {analysisRecord.analysis.time_horizon}
                  </span>
                ) : null}
                {analysisRecord.analysis.objective ? (
                  <span className="rounded-full bg-surface-muted px-3 py-1 text-xs text-muted">
                    Objective: {analysisRecord.analysis.objective}
                  </span>
                ) : null}
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${redTeamStatusTone}`}
                >
                  {redTeamStatusLabel}
                </span>
                {analysisRecord.review ? (
                  <a
                    href="#outcome-review"
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      analysisRecord.review.outcomeLabel === "mostly_right"
                        ? "bg-success-soft text-foreground"
                        : analysisRecord.review.outcomeLabel === "wrong"
                          ? "bg-danger-soft text-red-700"
                          : "bg-surface-muted text-foreground"
                    }`}
                    title={`Reviewed ${analysisRecord.review.reviewedAt}`}
                  >
                    Reviewed
                    {analysisRecord.review.outcomeLabel
                      ? ` · ${formatOutcomeLabel(analysisRecord.review.outcomeLabel)}`
                      : ""}
                  </a>
                ) : (
                  <a
                    href="#outcome-review"
                    className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-muted"
                  >
                    Unresolved
                  </a>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <MarkdownCopyButton markdown={markdown} />
              <RegenerateButton analysisId={analysisRecord.id} />
              <Link
                href="/"
                className="rounded-xl border border-border bg-surface-muted px-4 py-2 text-sm font-medium text-foreground transition hover:bg-white"
              >
                Ask Another Question
              </Link>
              <Link
                href="/history"
                className="rounded-xl border border-border bg-surface-muted px-4 py-2 text-sm font-medium text-foreground transition hover:bg-white"
              >
                View History
              </Link>
            </div>
          </div>
          {analysisRecord.redTeamStatus !== "completed" ? (
            <div className="mt-4 rounded-2xl border border-border bg-surface-muted p-4">
              <p className="text-sm font-medium text-foreground">
                This record is showing the primary analysis without a completed red-team refinement.
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">
                {analysisRecord.redTeamStatus === "failed"
                  ? analysisRecord.redTeamError || "The weak-claim pass failed during generation."
                  : analysisRecord.redTeamStatus === "skipped"
                    ? analysisRecord.redTeamError || "Mock mode does not run the live red-team pass."
                    : "This record predates explicit red-team status tracking."}
              </p>
            </div>
          ) : null}
        </div>

        <AnalysisView analysis={analysisRecord.analysis} title={analysisRecord.title} />

        <ReviewPanel
          analysisId={analysisRecord.id}
          analysis={analysisRecord.analysis}
          initialReview={analysisRecord.review}
        />

        <FollowUpPanel
          analysisId={analysisRecord.id}
          initialFollowUps={analysisRecord.followUps}
        />

        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Notes</h2>
          <p className="mt-1 text-sm text-muted">
            Optional working notes attached to this saved analysis.
          </p>
          <div className="mt-4">
            <NotesEditor analysisId={analysisRecord.id} initialNotes={analysisRecord.notes} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
