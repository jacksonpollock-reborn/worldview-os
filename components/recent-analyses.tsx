import Link from "next/link";
import { LocalDateTime } from "@/components/local-date-time";
import type { AnalysisSummary } from "@/types/analysis";

type RecentAnalysesProps = {
  analyses: AnalysisSummary[];
};

export function RecentAnalyses({ analyses }: RecentAnalysesProps) {
  return (
    <aside className="rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Recent analyses</h2>
          <p className="mt-1 text-sm text-muted">
            Reopen the latest runs without leaving the ask screen.
          </p>
        </div>
        <Link href="/history" className="text-sm font-medium text-accent">
          View all
        </Link>
      </div>

      <div className="mt-5 space-y-3">
        {analyses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface-muted px-4 py-5 text-sm text-muted">
            No analyses saved yet. Your first successful run will appear here.
          </div>
        ) : (
          analyses.map((analysis) => (
            <Link
              key={analysis.id}
              href={`/analysis/${analysis.id}`}
              className="block rounded-2xl border border-border bg-surface-muted p-4 transition hover:border-accent/35 hover:bg-white"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">{analysis.title}</h3>
                  <p className="line-clamp-2 text-sm text-muted">{analysis.reframedQuestion}</p>
                </div>
                <LocalDateTime
                  value={analysis.createdAt}
                  className="whitespace-nowrap text-xs text-muted"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {analysis.domains.slice(0, 3).map((domain, index) => (
                  <span
                    key={`${analysis.id}-domain-${index}`}
                    className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent"
                  >
                    {domain}
                  </span>
                ))}
              </div>
            </Link>
          ))
        )}
      </div>
    </aside>
  );
}
