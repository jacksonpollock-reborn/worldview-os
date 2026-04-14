"use client";

import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LocalDateTime } from "@/components/local-date-time";
import {
  formatOutcomeLabel,
  formatRealizedScenario,
  formatTrigger,
  formatWatchlistTrigger,
} from "@/lib/review-format";
import { NO_CLEAR_SCENARIO_MATCH } from "@/schemas/review";
import type {
  AnalysisReviewRecord,
  OutcomeLabel,
  StructuredAnalysis,
  TriggerState,
  WatchlistTriggerState,
} from "@/types/analysis";

export {
  formatOutcomeLabel,
  formatRealizedScenario,
  formatTrigger,
  formatWatchlistTrigger,
} from "@/lib/review-format";

type ReviewPanelProps = {
  analysisId: string;
  analysis: StructuredAnalysis;
  initialReview: AnalysisReviewRecord | null;
};

type FormState = {
  outcomeLabel: OutcomeLabel | "";
  realizedScenario: string;
  downgradeTriggered: TriggerState | "";
  upgradeTriggered: TriggerState | "";
  watchlistTriggered: WatchlistTriggerState | "";
  reviewNotes: string;
};

const OUTCOME_OPTIONS: { value: OutcomeLabel; label: string; tone: string }[] = [
  { value: "mostly_right", label: "Mostly right", tone: "bg-success-soft" },
  { value: "mixed", label: "Mixed", tone: "bg-surface-muted" },
  { value: "wrong", label: "Wrong", tone: "bg-danger-soft" },
];

const TRIGGER_OPTIONS: { value: TriggerState; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unknown", label: "Unknown" },
];

const WATCHLIST_TRIGGER_OPTIONS: {
  value: WatchlistTriggerState;
  label: string;
}[] = [
  { value: "yes", label: "Yes" },
  { value: "partially", label: "Partially" },
  { value: "no", label: "No" },
  { value: "unknown", label: "Unknown" },
];

function isMonitorAnalysis(analysis: StructuredAnalysis) {
  return (
    analysis.objective.trim().toLowerCase() === "monitor" &&
    "monitoring_signals" in analysis
  );
}

function emptyForm(review: AnalysisReviewRecord | null): FormState {
  return {
    outcomeLabel: review?.outcomeLabel ?? "",
    realizedScenario: review?.realizedScenario ?? "",
    downgradeTriggered: review?.downgradeTriggered ?? "",
    upgradeTriggered: review?.upgradeTriggered ?? "",
    watchlistTriggered: review?.watchlistTriggered ?? "",
    reviewNotes: review?.reviewNotes ?? "",
  };
}

export function ReviewPanel({
  analysisId,
  analysis,
  initialReview,
}: ReviewPanelProps) {
  const router = useRouter();
  const [review, setReview] = useState<AnalysisReviewRecord | null>(initialReview);
  const [editing, setEditing] = useState(!initialReview);
  const [form, setForm] = useState<FormState>(() => emptyForm(initialReview));
  const [status, setStatus] = useState("");
  const [isPending, setIsPending] = useState(false);

  const scenarioOptions = useMemo(() => {
    if (isMonitorAnalysis(analysis)) {
      // Monitor analyses don't have probabilistic scenarios, use the current stance as a proxy
      return [] as { value: string; label: string }[];
    }
    return (analysis.scenarios ?? []).map((scenario) => ({
      value: scenario.name,
      label: `${scenario.name} (${scenario.probability}%, ${scenario.impact} impact)`,
    }));
  }, [analysis]);

  const monitorMode = isMonitorAnalysis(analysis);

  function updateField<Key extends keyof FormState>(
    key: Key,
    value: FormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleStartEdit() {
    setForm(emptyForm(review));
    setEditing(true);
    setStatus("");
  }

  function handleCancelEdit() {
    setForm(emptyForm(review));
    setEditing(false);
    setStatus("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Saving review...");
    setIsPending(true);

    startTransition(async () => {
      try {
        const payload = {
          outcomeLabel: form.outcomeLabel || null,
          realizedScenario: form.realizedScenario || null,
          downgradeTriggered: form.downgradeTriggered || null,
          upgradeTriggered: form.upgradeTriggered || null,
          watchlistTriggered: form.watchlistTriggered || null,
          reviewNotes: form.reviewNotes.trim() || null,
        };

        const response = await fetch(`/api/history/${analysisId}/review`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = (await response.json()) as {
          error?: string;
          review?: AnalysisReviewRecord;
        };

        if (!response.ok || !data.review) {
          throw new Error(data.error || "Unable to save this review.");
        }

        setReview(data.review);
        setForm(emptyForm(data.review));
        setEditing(false);
        setStatus("Review saved.");
        router.refresh();
      } catch (error) {
        setStatus(
          error instanceof Error ? error.message : "Unable to save this review.",
        );
      } finally {
        setIsPending(false);
      }
    });
  }

  function handleClearReview() {
    const confirmed = window.confirm(
      "Clear this outcome review? The analysis record itself is not deleted.",
    );
    if (!confirmed) return;

    setStatus("Clearing review...");
    setIsPending(true);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/history/${analysisId}/review`, {
          method: "DELETE",
        });
        if (!response.ok) {
          throw new Error("Unable to clear this review.");
        }
        setReview(null);
        setForm(emptyForm(null));
        setEditing(true);
        setStatus("Review cleared.");
        router.refresh();
      } catch (error) {
        setStatus(
          error instanceof Error ? error.message : "Unable to clear this review.",
        );
      } finally {
        setIsPending(false);
      }
    });
  }

  return (
    <section
      id="outcome-review"
      className="rounded-2xl border border-border bg-surface p-5 shadow-sm"
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Outcome review</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Record what actually happened after this analysis. Outcome reviews are the
            product&apos;s learning layer — they stay with the saved record and show up in
            history and comparison views.
          </p>
        </div>
        {review ? (
          <div className="flex flex-wrap items-center gap-2">
            <ReviewBadge review={review} />
            <button
              type="button"
              onClick={editing ? handleCancelEdit : handleStartEdit}
              className="rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm font-medium text-foreground transition hover:bg-white"
            >
              {editing ? "Cancel edit" : "Edit review"}
            </button>
            <button
              type="button"
              onClick={handleClearReview}
              disabled={isPending}
              className="rounded-xl border border-red-200 bg-danger-soft px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear review
            </button>
          </div>
        ) : (
          <span className="self-start rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-muted">
            Unresolved
          </span>
        )}
      </div>

      {review && !editing ? (
        <ReviewSummary review={review} monitorMode={monitorMode} />
      ) : (
        <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Bottom-line outcome
            </label>
            <div className="flex flex-wrap gap-2">
              {OUTCOME_OPTIONS.map((option) => {
                const active = form.outcomeLabel === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      updateField(
                        "outcomeLabel",
                        active ? "" : option.value,
                      )
                    }
                    className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                      active
                        ? `${option.tone} border-2 border-accent text-foreground`
                        : "border border-border bg-white text-foreground hover:bg-surface-muted"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted">
              How did the bottom-line call hold up? Leave blank if you can&apos;t say yet.
            </p>
          </div>

          {!monitorMode && scenarioOptions.length > 0 ? (
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="realizedScenario"
              >
                Realized scenario
              </label>
              <select
                id="realizedScenario"
                value={form.realizedScenario}
                onChange={(event) =>
                  updateField("realizedScenario", event.target.value)
                }
                className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10"
              >
                <option value="">— Not yet marked —</option>
                {scenarioOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                <option value={NO_CLEAR_SCENARIO_MATCH}>
                  No clear scenario match
                </option>
              </select>
            </div>
          ) : null}

          {monitorMode ? (
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="realizedScenarioMonitor"
              >
                Realized stance
              </label>
              <input
                id="realizedScenarioMonitor"
                value={form.realizedScenario}
                onChange={(event) =>
                  updateField("realizedScenario", event.target.value)
                }
                placeholder="Short phrase, e.g. 'Bearish break confirmed' or 'Neutral range held'"
                className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10"
              />
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <TriggerField
              label="Downgrade triggered"
              value={form.downgradeTriggered}
              options={TRIGGER_OPTIONS}
              onChange={(value) => updateField("downgradeTriggered", value)}
            />
            <TriggerField
              label="Upgrade triggered"
              value={form.upgradeTriggered}
              options={TRIGGER_OPTIONS}
              onChange={(value) => updateField("upgradeTriggered", value)}
            />
            <TriggerField
              label="Watchlist triggered"
              value={form.watchlistTriggered}
              options={WATCHLIST_TRIGGER_OPTIONS}
              onChange={(value) =>
                updateField("watchlistTriggered", value as WatchlistTriggerState | "")
              }
            />
          </div>

          <div className="space-y-2">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor="reviewNotes"
            >
              Review notes
            </label>
            <textarea
              id="reviewNotes"
              value={form.reviewNotes}
              onChange={(event) => updateField("reviewNotes", event.target.value)}
              placeholder="What did you learn? Which assumption turned out to be load-bearing?"
              className="min-h-28 w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/10"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              All fields are optional. You can save a partial review and update later.
            </p>
            <div className="flex gap-2">
              {review ? (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="rounded-xl border border-border bg-surface-muted px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-white"
                >
                  Cancel
                </button>
              ) : null}
              <button
                type="submit"
                disabled={isPending}
                className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Saving..." : review ? "Save changes" : "Save review"}
              </button>
            </div>
          </div>
          {status ? <p className="text-sm text-muted">{status}</p> : null}
        </form>
      )}
    </section>
  );
}

function TriggerField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | "";
  options: { value: T; label: string }[];
  onChange: (value: T | "") => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(active ? "" : option.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "bg-accent text-white"
                  : "border border-border bg-white text-foreground hover:bg-surface-muted"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReviewBadge({ review }: { review: AnalysisReviewRecord }) {
  const tone =
    review.outcomeLabel === "mostly_right"
      ? "bg-success-soft text-foreground"
      : review.outcomeLabel === "wrong"
        ? "bg-danger-soft text-red-700"
        : review.outcomeLabel === "mixed"
          ? "bg-surface-muted text-foreground"
          : "bg-surface-muted text-muted";
  const label = formatOutcomeLabel(review.outcomeLabel) ?? "Reviewed";
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}
      title={`Reviewed ${review.reviewedAt}`}
    >
      {label}
    </span>
  );
}

function ReviewSummary({
  review,
  monitorMode,
}: {
  review: AnalysisReviewRecord;
  monitorMode: boolean;
}) {
  return (
    <div className="mt-5 space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <InfoRow label="Outcome" value={formatOutcomeLabel(review.outcomeLabel) ?? "—"} />
        <InfoRow
          label={monitorMode ? "Realized stance" : "Realized scenario"}
          value={formatRealizedScenario(review.realizedScenario)}
        />
        <InfoRow
          label="Downgrade triggered"
          value={formatTrigger(review.downgradeTriggered)}
        />
        <InfoRow
          label="Upgrade triggered"
          value={formatTrigger(review.upgradeTriggered)}
        />
        <InfoRow
          label="Watchlist triggered"
          value={formatWatchlistTrigger(review.watchlistTriggered)}
        />
        <InfoRow
          label="Reviewed"
          value={<LocalDateTime value={review.reviewedAt} />}
        />
      </div>
      {review.reviewNotes ? (
        <div className="rounded-2xl border border-border bg-surface-muted p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Review notes
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
            {review.reviewNotes}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </p>
      <div className="mt-1 text-sm leading-6 text-foreground">{value}</div>
    </div>
  );
}

