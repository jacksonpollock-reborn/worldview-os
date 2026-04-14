"use client";

import Link from "next/link";
import { startTransition, useDeferredValue, useState } from "react";
import { useRouter } from "next/navigation";
import { LocalDateTime } from "@/components/local-date-time";
import { formatOutcomeLabel } from "@/lib/review-format";
import type { AnalysisReviewSummary, AnalysisSummary } from "@/types/analysis";

type HistoryListProps = {
  analyses: AnalysisSummary[];
};

type SortMode = "latest" | "oldest" | "title";

const MAX_COMPARE_SELECTION = 2;

function ReviewPill({ review }: { review: AnalysisReviewSummary }) {
  if (!review.reviewed) {
    return (
      <span className="rounded-full border border-dashed border-border bg-surface-muted px-2.5 py-1 text-xs font-medium text-muted">
        Unresolved
      </span>
    );
  }

  const tone =
    review.outcomeLabel === "mostly_right"
      ? "bg-success-soft text-foreground"
      : review.outcomeLabel === "wrong"
        ? "bg-danger-soft text-red-700"
        : "bg-surface-muted text-foreground";
  const label = formatOutcomeLabel(review.outcomeLabel);

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      Reviewed{label ? ` · ${label}` : ""}
    </span>
  );
}

export function HistoryList({ analyses }: HistoryListProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [deletingId, setDeletingId] = useState("");
  const [status, setStatus] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const deferredQuery = useDeferredValue(query);

  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const filteredAnalyses = analyses
    .filter((analysis) => {
      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        analysis.title,
        analysis.originalQuestion,
        analysis.reframedQuestion,
        analysis.domains.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    })
    .toSorted((left, right) => {
      if (sortMode === "title") {
        return left.title.localeCompare(right.title);
      }

      const leftTime = new Date(left.createdAt).getTime();
      const rightTime = new Date(right.createdAt).getTime();

      return sortMode === "oldest" ? leftTime - rightTime : rightTime - leftTime;
    });

  function handleDelete(id: string) {
    const shouldDelete = window.confirm(
      "Delete this saved analysis? This cannot be undone.",
    );

    if (!shouldDelete) {
      return;
    }

    setStatus("");
    setDeletingId(id);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/history/${id}`, { method: "DELETE" });
        if (!response.ok) {
          throw new Error("Delete failed.");
        }

        setStatus("Analysis deleted.");
        router.refresh();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Delete failed.");
      } finally {
        setDeletingId("");
      }
    });
  }

  function toggleCompareMode() {
    setCompareMode((current) => {
      const next = !current;
      if (!next) {
        setSelectedIds([]);
      }
      return next;
    });
    setStatus("");
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }
      if (current.length >= MAX_COMPARE_SELECTION) {
        return [current[1], id];
      }
      return [...current, id];
    });
  }

  const canCompare = selectedIds.length === MAX_COMPARE_SELECTION;
  const compareHref = canCompare
    ? `/compare?a=${encodeURIComponent(selectedIds[0])}&b=${encodeURIComponent(selectedIds[1])}`
    : "#";

  return (
    <div className="rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title, question, or domain"
            className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/10"
          />
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10"
          >
            <option value="latest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Title</option>
          </select>
        </div>

        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="text-sm text-muted">
            {filteredAnalyses.length} saved {filteredAnalyses.length === 1 ? "analysis" : "analyses"}
          </div>
          <button
            type="button"
            onClick={toggleCompareMode}
            className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
              compareMode
                ? "border-accent bg-accent text-white"
                : "border-border bg-white text-foreground hover:bg-surface-muted"
            }`}
          >
            {compareMode ? "Cancel compare" : "Select to compare"}
          </button>
          {compareMode ? (
            canCompare ? (
              <Link
                href={compareHref}
                className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
              >
                Compare ({selectedIds.length}/{MAX_COMPARE_SELECTION})
              </Link>
            ) : (
              <span className="rounded-xl border border-dashed border-border bg-surface-muted px-3 py-2 text-sm text-muted">
                Pick {MAX_COMPARE_SELECTION - selectedIds.length} more (
                {selectedIds.length}/{MAX_COMPARE_SELECTION})
              </span>
            )
          ) : null}
        </div>
      </div>

      {compareMode ? (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-surface-muted px-4 py-3 text-sm text-muted">
          Compare mode: pick exactly two saved analyses to view side-by-side. Selecting a
          third replaces the oldest selection.
        </p>
      ) : null}

      <div className="mt-6 space-y-4">
        {status ? <p className="text-sm text-muted">{status}</p> : null}
        {filteredAnalyses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface-muted px-4 py-6 text-sm text-muted">
            No matching analyses. Try another search or create a fresh run.
          </div>
        ) : (
          filteredAnalyses.map((analysis) => {
            const isSelected = selectedIds.includes(analysis.id);
            const cardTone = isSelected
              ? "border-accent bg-white ring-2 ring-accent/20"
              : "border-border bg-surface-muted hover:bg-white";

            return (
              <div
                key={analysis.id}
                className={`rounded-2xl border p-4 transition ${cardTone}`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex flex-1 items-start gap-3">
                    {compareMode ? (
                      <button
                        type="button"
                        onClick={() => toggleSelected(analysis.id)}
                        className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                          isSelected
                            ? "border-accent bg-accent text-white"
                            : "border-border bg-white text-transparent hover:border-accent"
                        }`}
                        aria-label={isSelected ? "Deselect for compare" : "Select for compare"}
                      >
                        {isSelected ? "✓" : ""}
                      </button>
                    ) : null}
                    <div className="space-y-3">
                      <div>
                        {compareMode ? (
                          <button
                            type="button"
                            onClick={() => toggleSelected(analysis.id)}
                            className="text-left text-lg font-semibold text-foreground transition hover:text-accent"
                          >
                            {analysis.title}
                          </button>
                        ) : (
                          <Link
                            href={`/analysis/${analysis.id}`}
                            className="text-lg font-semibold text-foreground transition hover:text-accent"
                          >
                            {analysis.title}
                          </Link>
                        )}
                        <p className="mt-1 text-sm leading-6 text-muted">
                          {analysis.reframedQuestion}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {analysis.domains.map((domain, index) => (
                          <span
                            key={`${analysis.id}-domain-${index}`}
                            className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent"
                          >
                            {domain}
                          </span>
                        ))}
                        <ReviewPill review={analysis.review} />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-3 lg:items-end">
                    <LocalDateTime value={analysis.createdAt} className="text-sm text-muted" />
                    {compareMode ? null : (
                      <div className="flex gap-2">
                        <Link
                          href={`/analysis/${analysis.id}`}
                          className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium transition hover:bg-surface"
                        >
                          Open
                        </Link>
                        <button
                          type="button"
                          disabled={deletingId === analysis.id}
                          onClick={() => handleDelete(analysis.id)}
                          className="rounded-xl border border-red-200 bg-danger-soft px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingId === analysis.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
