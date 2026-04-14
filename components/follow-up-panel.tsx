"use client";

import { startTransition, useState } from "react";
import { LocalDateTime } from "@/components/local-date-time";
import type { AnalysisFollowUpRecord } from "@/types/analysis";

type FollowUpPanelProps = {
  analysisId: string;
  initialFollowUps: AnalysisFollowUpRecord[];
};

const FOLLOW_UP_SUGGESTIONS = [
  "Expand lens 2 and explain the key trigger in more detail.",
  "What would make scenario 3 more likely?",
  "Turn this into a monitoring checklist.",
  "Challenge the bottom line more aggressively.",
] as const;

function renderParagraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function FollowUpPanel({
  analysisId,
  initialFollowUps,
}: FollowUpPanelProps) {
  const [question, setQuestion] = useState("");
  const [followUps, setFollowUps] = useState(initialFollowUps);
  const [status, setStatus] = useState("");
  const [isPending, setIsPending] = useState(false);

  function handleSuggestionClick(suggestion: string) {
    setQuestion(suggestion);
    setStatus("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!question.trim()) {
      setStatus("Ask a specific follow-up question first.");
      return;
    }

    setStatus("Generating follow-up...");
    setIsPending(true);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/history/${analysisId}/follow-ups`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        });
        const data = (await response.json()) as {
          error?: string;
          followUp?: AnalysisFollowUpRecord;
        };

        if (!response.ok || !data.followUp) {
          throw new Error(data.error || "Unable to generate this follow-up.");
        }

        setFollowUps((current) => [...current, data.followUp as AnalysisFollowUpRecord]);
        setQuestion("");
        setStatus("Follow-up saved.");
      } catch (error) {
        setStatus(
          error instanceof Error ? error.message : "Unable to generate this follow-up.",
        );
      } finally {
        setIsPending(false);
      }
    });
  }

  return (
    <section
      id="follow-up"
      className="rounded-2xl border border-border bg-surface p-5 shadow-sm"
    >
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Follow-Up</h2>
        <p className="text-sm leading-6 text-muted">
          Ask a scoped question against this saved analysis. Follow-ups use the saved
          record as context, do not fetch live data, and do not rerun the full
          worldview workflow.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {FOLLOW_UP_SUGGESTIONS.map((suggestion, index) => (
          <button
            key={`follow-up-suggestion-${index}`}
            type="button"
            onClick={() => handleSuggestionClick(suggestion)}
            className="rounded-full border border-border bg-surface-muted px-3 py-1.5 text-sm text-foreground transition hover:bg-white"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask for a drill-down, challenge, or narrower operational view."
          className="min-h-28 w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/10"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            Example: “Expand lens 2” or “What would disprove scenario 1?”
          </p>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl border border-border bg-surface-muted px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Generating..." : "Ask Follow-Up"}
          </button>
        </div>
      </form>

      {status ? <p className="mt-3 text-sm text-muted">{status}</p> : null}

      <div className="mt-6 space-y-4">
        {followUps.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface-muted px-4 py-6 text-sm text-muted">
            No follow-ups yet. Ask a targeted question to extend this analysis without regenerating it.
          </div>
        ) : (
          followUps.map((followUp) => (
            <article
              key={followUp.id}
              className="rounded-2xl border border-border bg-white p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Follow-up question
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">{followUp.question}</p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <span className="rounded-full bg-surface-muted px-3 py-1 text-xs text-muted">
                    Saved context only
                  </span>
                  <LocalDateTime value={followUp.createdAt} className="text-xs text-muted" />
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-border bg-surface-muted p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                  Response
                </p>
                <h3 className="mt-2 text-base font-semibold text-foreground">{followUp.title}</h3>
                <div className="mt-3 space-y-3 text-sm leading-6 text-foreground">
                  {renderParagraphs(followUp.answer).map((paragraph, index) => (
                    <p key={`${followUp.id}-paragraph-${index}`}>{paragraph}</p>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-border bg-surface-muted p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Key points
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-foreground">
                    {followUp.keyPoints.map((item, index) => (
                      <li key={`${followUp.id}-key-point-${index}`}>• {item}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-border bg-surface-muted p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Watchouts
                  </p>
                  {followUp.watchouts.length > 0 ? (
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-foreground">
                      {followUp.watchouts.map((item, index) => (
                        <li key={`${followUp.id}-watchout-${index}`}>• {item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-muted">
                      No additional watchouts were needed for this follow-up.
                    </p>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
