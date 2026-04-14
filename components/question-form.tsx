"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DemoQuestion } from "@/lib/demo-content";

type QuestionFormProps = {
  demoQuestions: DemoQuestion[];
  mockModeActive: boolean;
  apiKeyConfigured: boolean;
  providerName: string;
};

const OBJECTIVES = [
  "Understand",
  "Forecast",
  "Monitor",
  "Decide",
  "Write",
  "Debate",
  "Invest",
];

export function QuestionForm({
  demoQuestions,
  mockModeActive,
  apiKeyConfigured,
  providerName,
}: QuestionFormProps) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [domain, setDomain] = useState("");
  const [timeHorizon, setTimeHorizon] = useState("");
  const [objective, setObjective] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isPending) {
      setElapsedSeconds(0);
      return;
    }

    const interval = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isPending]);

  function handleDemoClick(demoQuestion: DemoQuestion) {
    setQuestion(demoQuestion.question);
    setDomain(demoQuestion.domain);
    setTimeHorizon(demoQuestion.timeHorizon);
    setObjective(demoQuestion.objective);
    setError("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsPending(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          domain,
          timeHorizon,
          objective,
        }),
      });

      const data = (await response.json()) as { id?: string; error?: string };

      if (!response.ok || !data.id) {
        throw new Error(data.error || "Analysis request failed.");
      }

      router.push(`/analysis/${data.id}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to analyze the question.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Ask a question</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Keep the ask natural. The system will reframe it, expand the analytical surface, and auto-save the result to history.
          </p>
        </div>
        <div className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
          MVP
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-border bg-surface-muted p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Runtime mode
        </p>
        <p className="mt-2 text-sm font-medium text-foreground">
          {mockModeActive
            ? "Mock analysis is active."
            : `Live ${providerName} analysis is active.`}
        </p>
        <p className="mt-1 text-sm leading-6 text-muted">
          {mockModeActive
            ? apiKeyConfigured
              ? "A realistic sample payload will be used even though an API key is present."
              : "No API key is configured, so the app will use a realistic sample payload for local testing."
            : `Requests will go to the configured ${providerName} model and return structured JSON.`}
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="question">
            Question
          </label>
          <textarea
            id="question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What are the serious angles, scenarios, and watchpoints behind this question?"
            className="min-h-40 w-full rounded-2xl border border-border bg-white px-4 py-3 text-base text-foreground outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/10"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="domain">
              Domain hint
            </label>
            <input
              id="domain"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              placeholder="Optional"
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/10"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="timeHorizon">
              Time horizon
            </label>
            <input
              id="timeHorizon"
              value={timeHorizon}
              onChange={(event) => setTimeHorizon(event.target.value)}
              placeholder="e.g. next 12 months"
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/10"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="objective">
              Objective
            </label>
            <select
              id="objective"
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10"
            >
              <option value="">Auto-detect</option>
              {OBJECTIVES.map((item) => (
                <option key={item} value={item.toLowerCase()}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isPending ? (
          <div className="rounded-2xl border border-border bg-surface-muted p-4">
            <p className="text-sm font-medium text-foreground">
              Generating the full structured analysis now.
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">
              This waits for the model to finish and for the JSON to validate before anything is
              saved to history.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full bg-white px-3 py-1 text-foreground">
                Elapsed: {elapsedSeconds}s
              </span>
              <span className="text-muted">Typical live runs can take 20-60 seconds.</span>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-danger-soft px-4 py-3 text-sm text-red-700">
            <p>{error}</p>
            {!mockModeActive ? (
              <p className="mt-2 text-red-700/80">
                If you want local testing without a live API key, enable mock mode with{" "}
                <code className="rounded bg-white px-1 py-0.5">MOCK_ANALYSIS_MODE=true</code>.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted">
            Output order: reframed question, definitions, domains, drivers, lenses, scenarios, hidden variables, change-my-mind, bottom line, watchlist.
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Analyzing..." : "Analyze Question"}
          </button>
        </div>
      </form>

      <div className="mt-6 border-t border-border pt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Demo questions
            </p>
            <p className="mt-1 text-sm text-muted">
              One-click first-use seeds aligned to the MVP scope.
            </p>
          </div>
          {mockModeActive ? (
            <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
              Works in mock mode
            </span>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {demoQuestions.map((demoQuestion) => (
            <button
              key={demoQuestion.id}
              type="button"
              onClick={() => handleDemoClick(demoQuestion)}
              className="rounded-2xl border border-border bg-surface-muted p-4 text-left transition hover:bg-white"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
                  {demoQuestion.label}
                </span>
                <span className="text-xs text-muted">{demoQuestion.timeHorizon}</span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-foreground">
                {demoQuestion.question}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted">
                {demoQuestion.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
