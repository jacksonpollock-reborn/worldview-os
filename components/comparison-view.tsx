"use client";

import Link from "next/link";
import { LocalDateTime } from "@/components/local-date-time";
import { splitChangeMindCondition } from "@/lib/change-my-mind";
import {
  formatOutcomeLabel,
  formatRealizedScenario,
} from "@/lib/review-format";
import {
  analysisComparability,
  comparePromptLineage,
  diffBottomLineLabels,
  diffDefinitions,
  diffMonitoringSignals,
  diffScenarios,
  diffStringArrays,
  isMonitorAnalysis,
} from "@/lib/comparison";
import type {
  MonitorStructuredAnalysis,
  PersistedAnalysisRecord,
  StandardStructuredAnalysis,
} from "@/types/analysis";

type ComparisonViewProps = {
  recordA: PersistedAnalysisRecord;
  recordB: PersistedAnalysisRecord;
};

// ── Local visual primitives ──────────────────────

function CompareCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

function SideBySide({
  left,
  right,
  changed = false,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  changed?: boolean;
}) {
  const tone = changed
    ? "border-amber-300 bg-amber-50/40"
    : "border-border bg-surface-muted";

  return (
    <div className={`grid gap-3 rounded-2xl border p-4 lg:grid-cols-2 ${tone}`}>
      <div className="rounded-xl border border-border bg-white p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Earlier
        </p>
        <div className="text-sm leading-6 text-foreground">{left}</div>
      </div>
      <div className="rounded-xl border border-border bg-white p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Later
        </p>
        <div className="text-sm leading-6 text-foreground">{right}</div>
      </div>
    </div>
  );
}

function DiffGroup({
  onlyInA,
  shared,
  onlyInB,
  emptyMessage,
}: {
  onlyInA: string[];
  shared: string[];
  onlyInB: string[];
  emptyMessage?: string;
}) {
  if (onlyInA.length === 0 && shared.length === 0 && onlyInB.length === 0) {
    return (
      <p className="text-sm text-muted">{emptyMessage ?? "Nothing to compare."}</p>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <DiffColumn
        label="Only in earlier"
        items={onlyInA}
        tone="border-l-4 border-l-rose-300"
      />
      <DiffColumn
        label="In both"
        items={shared}
        tone="border-l-4 border-l-border"
      />
      <DiffColumn
        label="Only in later"
        items={onlyInB}
        tone="border-l-4 border-l-emerald-300"
      />
    </div>
  );
}

function DiffColumn({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: string;
}) {
  return (
    <div className={`rounded-2xl bg-white p-3 ${tone}`}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        {label}{" "}
        <span className="text-muted/70">({items.length})</span>
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-muted/70">—</p>
      ) : (
        <ul className="space-y-2 text-sm leading-6 text-foreground">
          {items.map((item, index) => (
            <li key={`${label}-${index}`}>• {item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MetadataRow({
  label,
  valueA,
  valueB,
  changed,
}: {
  label: string;
  valueA: React.ReactNode;
  valueB: React.ReactNode;
  changed: boolean;
}) {
  const tone = changed ? "bg-amber-50/40" : "bg-white";
  return (
    <div className={`grid grid-cols-3 gap-3 rounded-xl border border-border p-3 ${tone}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
      <div className="text-sm text-foreground">{valueA}</div>
      <div className="text-sm text-foreground">{valueB}</div>
    </div>
  );
}

// ── Main view ────────────────────────────────────

export function ComparisonView({ recordA, recordB }: ComparisonViewProps) {
  const analysisA = recordA.analysis;
  const analysisB = recordB.analysis;
  const comparability = analysisComparability(analysisA, analysisB);
  const lineage = comparePromptLineage(recordA, recordB);

  const reframedChanged =
    analysisA.reframed_question.trim() !== analysisB.reframed_question.trim();
  const originalChanged =
    analysisA.original_question.trim() !== analysisB.original_question.trim();

  const domainsDiff = diffStringArrays(analysisA.domains, analysisB.domains);
  const driversDiff = diffStringArrays(analysisA.key_drivers, analysisB.key_drivers);
  const hiddenDiff = diffStringArrays(
    analysisA.hidden_variables,
    analysisB.hidden_variables,
  );
  const changeMyMindDiff = diffStringArrays(
    analysisA.change_my_mind_conditions,
    analysisB.change_my_mind_conditions,
  );
  const watchlistDiff = diffStringArrays(analysisA.watchlist, analysisB.watchlist);
  const definitionsDiff = diffDefinitions(analysisA.definitions, analysisB.definitions);
  const bottomLineDiff = diffBottomLineLabels(
    analysisA.bottom_line,
    analysisB.bottom_line,
  );

  return (
    <div className="space-y-6">
      {/* Header / metadata */}
      <CompareCard title="Comparing two saved analyses">
        <div className="space-y-3">
          <MetadataRow
            label=""
            valueA={
              <Link
                href={`/analysis/${recordA.id}`}
                className="font-semibold text-foreground hover:text-accent"
              >
                {recordA.title}
              </Link>
            }
            valueB={
              <Link
                href={`/analysis/${recordB.id}`}
                className="font-semibold text-foreground hover:text-accent"
              >
                {recordB.title}
              </Link>
            }
            changed={recordA.title !== recordB.title}
          />
          <MetadataRow
            label="Created"
            valueA={<LocalDateTime value={recordA.createdAt} />}
            valueB={<LocalDateTime value={recordB.createdAt} />}
            changed={false}
          />
          <MetadataRow
            label="Domain"
            valueA={recordA.selectedDomain || "—"}
            valueB={recordB.selectedDomain || "—"}
            changed={(recordA.selectedDomain ?? "") !== (recordB.selectedDomain ?? "")}
          />
          <MetadataRow
            label="Objective"
            valueA={analysisA.objective || "—"}
            valueB={analysisB.objective || "—"}
            changed={analysisA.objective !== analysisB.objective}
          />
          <MetadataRow
            label="Time horizon"
            valueA={analysisA.time_horizon || "—"}
            valueB={analysisB.time_horizon || "—"}
            changed={analysisA.time_horizon !== analysisB.time_horizon}
          />
          <MetadataRow
            label="Model"
            valueA={recordA.modelUsed ?? "—"}
            valueB={recordB.modelUsed ?? "—"}
            changed={(recordA.modelUsed ?? "") !== (recordB.modelUsed ?? "")}
          />
          <MetadataRow
            label="Prompt version"
            valueA={recordA.promptVersion}
            valueB={recordB.promptVersion}
            changed={recordA.promptVersion !== recordB.promptVersion}
          />
          <MetadataRow
            label="Red-team"
            valueA={recordA.redTeamStatus}
            valueB={recordB.redTeamStatus}
            changed={recordA.redTeamStatus !== recordB.redTeamStatus}
          />
          <MetadataRow
            label="Follow-ups"
            valueA={`${recordA.followUps.length}`}
            valueB={`${recordB.followUps.length}`}
            changed={recordA.followUps.length !== recordB.followUps.length}
          />
          <MetadataRow
            label="Review status"
            valueA={recordA.review ? "Reviewed" : "Unresolved"}
            valueB={recordB.review ? "Reviewed" : "Unresolved"}
            changed={Boolean(recordA.review) !== Boolean(recordB.review)}
          />
          <MetadataRow
            label="Outcome"
            valueA={formatOutcomeLabel(recordA.review?.outcomeLabel ?? null) ?? "—"}
            valueB={formatOutcomeLabel(recordB.review?.outcomeLabel ?? null) ?? "—"}
            changed={
              (recordA.review?.outcomeLabel ?? null) !==
              (recordB.review?.outcomeLabel ?? null)
            }
          />
          <MetadataRow
            label="Realized scenario"
            valueA={
              recordA.review
                ? formatRealizedScenario(recordA.review.realizedScenario)
                : "—"
            }
            valueB={
              recordB.review
                ? formatRealizedScenario(recordB.review.realizedScenario)
                : "—"
            }
            changed={
              (recordA.review?.realizedScenario ?? null) !==
              (recordB.review?.realizedScenario ?? null)
            }
          />
        </div>
      </CompareCard>

      {/* Honesty banners */}
      {!lineage.same ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/60 p-4">
          <p className="text-sm font-medium text-foreground">
            Prompt lineage differs between these analyses.
          </p>
          <p className="mt-1 text-sm leading-6 text-muted">
            Earlier used <code className="rounded bg-white px-1">{lineage.versionA}</code>{" "}
            with model <code className="rounded bg-white px-1">{lineage.modelA ?? "?"}</code>.
            Later used <code className="rounded bg-white px-1">{lineage.versionB}</code>{" "}
            with model <code className="rounded bg-white px-1">{lineage.modelB ?? "?"}</code>.
            Differences may reflect prompt changes, not just your view shifting.
          </p>
        </div>
      ) : null}

      {comparability.mismatchReasons.length > 0 ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/60 p-4">
          {comparability.mismatchReasons.map((reason, index) => (
            <p key={index} className="text-sm leading-6 text-foreground">
              {reason}
            </p>
          ))}
        </div>
      ) : null}

      {/* Original question */}
      <CompareCard title="Original question">
        <SideBySide
          left={analysisA.original_question}
          right={analysisB.original_question}
          changed={originalChanged}
        />
      </CompareCard>

      {/* Reframed question */}
      <CompareCard title="Reframed question">
        <SideBySide
          left={analysisA.reframed_question}
          right={analysisB.reframed_question}
          changed={reframedChanged}
        />
      </CompareCard>

      {/* Definitions */}
      <CompareCard title="Definitions" hint={`${definitionsDiff.length} terms`}>
        {definitionsDiff.length === 0 ? (
          <p className="text-sm text-muted">No definitions to compare.</p>
        ) : (
          <div className="space-y-3">
            {definitionsDiff.map((entry) => (
              <div
                key={entry.term}
                className={`rounded-xl border p-3 ${
                  entry.changed
                    ? "border-amber-300 bg-amber-50/40"
                    : "border-border bg-surface-muted"
                }`}
              >
                <p className="text-sm font-semibold text-foreground">{entry.term}</p>
                <div className="mt-2 grid gap-2 lg:grid-cols-2">
                  <div className="rounded-lg border border-border bg-white p-2 text-sm leading-6 text-foreground">
                    {entry.valueA ?? <span className="text-muted">— not present —</span>}
                  </div>
                  <div className="rounded-lg border border-border bg-white p-2 text-sm leading-6 text-foreground">
                    {entry.valueB ?? <span className="text-muted">— not present —</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CompareCard>

      {/* Domains */}
      <CompareCard title="Domains">
        <DiffGroup
          onlyInA={domainsDiff.onlyInA}
          shared={domainsDiff.shared}
          onlyInB={domainsDiff.onlyInB}
        />
      </CompareCard>

      {/* Key drivers */}
      <CompareCard title="Key drivers">
        <DiffGroup
          onlyInA={driversDiff.onlyInA}
          shared={driversDiff.shared}
          onlyInB={driversDiff.onlyInB}
        />
      </CompareCard>

      {/* Mode-specific blocks */}
      {comparability.bothStandard ? (
        <StandardModeSections
          analysisA={analysisA as StandardStructuredAnalysis}
          analysisB={analysisB as StandardStructuredAnalysis}
        />
      ) : null}

      {comparability.bothMonitor ? (
        <MonitorModeSections
          analysisA={analysisA as MonitorStructuredAnalysis}
          analysisB={analysisB as MonitorStructuredAnalysis}
        />
      ) : null}

      {!comparability.sameMode ? (
        <CompareCard
          title="Mode-specific sections"
          hint="Not directly comparable"
        >
          <p className="text-sm leading-6 text-muted">
            One analysis is a forecast/standard analysis (with lenses and scenarios) and
            the other is a monitor analysis (with monitoring signals). Mode-specific
            sections are not directly comparable. Open each analysis individually to
            review them.
          </p>
        </CompareCard>
      ) : null}

      {/* Hidden variables */}
      <CompareCard title="Hidden variables">
        <DiffGroup
          onlyInA={hiddenDiff.onlyInA}
          shared={hiddenDiff.shared}
          onlyInB={hiddenDiff.onlyInB}
        />
      </CompareCard>

      {/* Change my mind */}
      <CompareCard title="What would change my mind">
        <ChangeMindDiffGroup
          onlyInA={changeMyMindDiff.onlyInA}
          shared={changeMyMindDiff.shared}
          onlyInB={changeMyMindDiff.onlyInB}
        />
      </CompareCard>

      {/* Bottom line */}
      <CompareCard title="Bottom line">
        <div className="space-y-3">
          {bottomLineDiff.map((entry) => (
            <div
              key={entry.label}
              className={`rounded-xl border p-3 ${
                entry.changed
                  ? "border-amber-300 bg-amber-50/40"
                  : "border-border bg-surface-muted"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                {entry.label}
                {entry.changed ? (
                  <span className="ml-2 rounded-full bg-amber-200/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-900">
                    Changed
                  </span>
                ) : null}
              </p>
              <div className="mt-2 grid gap-2 lg:grid-cols-2">
                <div className="rounded-lg border border-border bg-white p-2 text-sm leading-6 text-foreground">
                  {entry.valueA || <span className="text-muted">—</span>}
                </div>
                <div className="rounded-lg border border-border bg-white p-2 text-sm leading-6 text-foreground">
                  {entry.valueB || <span className="text-muted">—</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CompareCard>

      {/* Watchlist */}
      <CompareCard title="Watchlist">
        <DiffGroup
          onlyInA={watchlistDiff.onlyInA}
          shared={watchlistDiff.shared}
          onlyInB={watchlistDiff.onlyInB}
        />
      </CompareCard>
    </div>
  );
}

// ── Standard mode sections ───────────────────────

function StandardModeSections({
  analysisA,
  analysisB,
}: {
  analysisA: StandardStructuredAnalysis;
  analysisB: StandardStructuredAnalysis;
}) {
  const lensNamesA = analysisA.lenses.map((l) => l.name);
  const lensNamesB = analysisB.lenses.map((l) => l.name);
  const lensesDiff = diffStringArrays(lensNamesA, lensNamesB);
  const scenariosDiff = diffScenarios(analysisA.scenarios, analysisB.scenarios);

  return (
    <>
      <CompareCard title="Lenses" hint="Matched by lens name">
        <DiffGroup
          onlyInA={lensesDiff.onlyInA}
          shared={lensesDiff.shared}
          onlyInB={lensesDiff.onlyInB}
        />
      </CompareCard>

      <CompareCard
        title="Scenarios"
        hint={`${scenariosDiff.matched.length} matched, ${
          scenariosDiff.onlyInA.length + scenariosDiff.onlyInB.length
        } orphans`}
      >
        <div className="space-y-4">
          {scenariosDiff.matched.length === 0 &&
          scenariosDiff.onlyInA.length === 0 &&
          scenariosDiff.onlyInB.length === 0 ? (
            <p className="text-sm text-muted">No scenarios to compare.</p>
          ) : null}

          {scenariosDiff.matched.map((entry) => {
            const probabilityChanged = entry.probabilityDelta !== 0;
            const tone = probabilityChanged || entry.descriptionChanged
              ? "border-amber-300 bg-amber-50/40"
              : "border-border bg-surface-muted";
            return (
              <div
                key={entry.name}
                className={`rounded-xl border p-3 ${tone}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">
                    {entry.name}
                  </p>
                  <p className="text-xs text-muted">
                    {entry.a.probability}% → {entry.b.probability}%
                    {probabilityChanged ? (
                      <span
                        className={`ml-1 font-semibold ${
                          entry.probabilityDelta > 0
                            ? "text-emerald-700"
                            : "text-rose-700"
                        }`}
                      >
                        ({entry.probabilityDelta > 0 ? "+" : ""}
                        {entry.probabilityDelta})
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="mt-2 grid gap-2 lg:grid-cols-2">
                  <div className="rounded-lg border border-border bg-white p-2 text-xs leading-5 text-foreground">
                    <span className="font-semibold text-muted">
                      Earlier ({entry.a.impact}/{entry.a.confidence}):
                    </span>{" "}
                    {entry.a.description}
                  </div>
                  <div className="rounded-lg border border-border bg-white p-2 text-xs leading-5 text-foreground">
                    <span className="font-semibold text-muted">
                      Later ({entry.b.impact}/{entry.b.confidence}):
                    </span>{" "}
                    {entry.b.description}
                  </div>
                </div>
              </div>
            );
          })}

          {scenariosDiff.onlyInA.length > 0 ? (
            <div className="rounded-xl border-l-4 border-l-rose-300 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Only in earlier ({scenariosDiff.onlyInA.length})
              </p>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-foreground">
                {scenariosDiff.onlyInA.map((scenario) => (
                  <li key={scenario.name}>
                    <span className="font-medium">{scenario.name}</span>{" "}
                    <span className="text-muted">
                      ({scenario.probability}%, {scenario.impact} impact)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {scenariosDiff.onlyInB.length > 0 ? (
            <div className="rounded-xl border-l-4 border-l-emerald-300 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Only in later ({scenariosDiff.onlyInB.length})
              </p>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-foreground">
                {scenariosDiff.onlyInB.map((scenario) => (
                  <li key={scenario.name}>
                    <span className="font-medium">{scenario.name}</span>{" "}
                    <span className="text-muted">
                      ({scenario.probability}%, {scenario.impact} impact)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </CompareCard>
    </>
  );
}

// ── Monitor mode sections ────────────────────────

function MonitorModeSections({
  analysisA,
  analysisB,
}: {
  analysisA: MonitorStructuredAnalysis;
  analysisB: MonitorStructuredAnalysis;
}) {
  const stanceChanged =
    analysisA.current_stance.trim() !== analysisB.current_stance.trim();
  const cadenceChanged =
    analysisA.review_cadence.trim() !== analysisB.review_cadence.trim();
  const signalsDiff = diffMonitoringSignals(
    analysisA.monitoring_signals,
    analysisB.monitoring_signals,
  );
  const confirmDiff = diffStringArrays(
    analysisA.confirm_current_view,
    analysisB.confirm_current_view,
  );
  const disconfirmDiff = diffStringArrays(
    analysisA.disconfirm_current_view,
    analysisB.disconfirm_current_view,
  );
  const ignoreDiff = diffStringArrays(
    analysisA.what_to_ignore,
    analysisB.what_to_ignore,
  );

  return (
    <>
      <CompareCard title="Current stance">
        <SideBySide
          left={analysisA.current_stance}
          right={analysisB.current_stance}
          changed={stanceChanged}
        />
      </CompareCard>

      <CompareCard title="Review cadence">
        <SideBySide
          left={analysisA.review_cadence}
          right={analysisB.review_cadence}
          changed={cadenceChanged}
        />
      </CompareCard>

      <CompareCard
        title="Monitoring signals"
        hint={`${signalsDiff.matched.length} matched, ${
          signalsDiff.onlyInA.length + signalsDiff.onlyInB.length
        } orphans`}
      >
        <div className="space-y-4">
          {signalsDiff.matched.length === 0 &&
          signalsDiff.onlyInA.length === 0 &&
          signalsDiff.onlyInB.length === 0 ? (
            <p className="text-sm text-muted">No monitoring signals to compare.</p>
          ) : null}

          {signalsDiff.matched.map((entry) => {
            const anyChanged =
              entry.bullishChanged ||
              entry.neutralChanged ||
              entry.bearishChanged ||
              entry.currentReadChanged;
            const tone = anyChanged
              ? "border-amber-300 bg-amber-50/40"
              : "border-border bg-surface-muted";
            return (
              <div key={entry.name} className={`rounded-xl border p-3 ${tone}`}>
                <p className="text-sm font-semibold text-foreground">{entry.name}</p>
                <div className="mt-2 space-y-2">
                  {entry.currentReadChanged ? (
                    <ThresholdRow
                      label="Current read"
                      valueA={entry.a.current_read || "—"}
                      valueB={entry.b.current_read || "—"}
                      changed
                    />
                  ) : null}
                  <ThresholdRow
                    label="Bullish"
                    valueA={entry.a.bullish_threshold}
                    valueB={entry.b.bullish_threshold}
                    changed={entry.bullishChanged}
                  />
                  <ThresholdRow
                    label="Neutral"
                    valueA={entry.a.neutral_threshold}
                    valueB={entry.b.neutral_threshold}
                    changed={entry.neutralChanged}
                  />
                  <ThresholdRow
                    label="Bearish"
                    valueA={entry.a.bearish_threshold}
                    valueB={entry.b.bearish_threshold}
                    changed={entry.bearishChanged}
                  />
                </div>
              </div>
            );
          })}

          {signalsDiff.onlyInA.length > 0 ? (
            <div className="rounded-xl border-l-4 border-l-rose-300 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Only in earlier ({signalsDiff.onlyInA.length})
              </p>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-foreground">
                {signalsDiff.onlyInA.map((signal) => (
                  <li key={signal.name}>{signal.name}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {signalsDiff.onlyInB.length > 0 ? (
            <div className="rounded-xl border-l-4 border-l-emerald-300 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Only in later ({signalsDiff.onlyInB.length})
              </p>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-foreground">
                {signalsDiff.onlyInB.map((signal) => (
                  <li key={signal.name}>{signal.name}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </CompareCard>

      <CompareCard title="What confirms the current view">
        <DiffGroup
          onlyInA={confirmDiff.onlyInA}
          shared={confirmDiff.shared}
          onlyInB={confirmDiff.onlyInB}
        />
      </CompareCard>

      <CompareCard title="What disconfirms the current view">
        <DiffGroup
          onlyInA={disconfirmDiff.onlyInA}
          shared={disconfirmDiff.shared}
          onlyInB={disconfirmDiff.onlyInB}
        />
      </CompareCard>

      <CompareCard title="What to ignore">
        <DiffGroup
          onlyInA={ignoreDiff.onlyInA}
          shared={ignoreDiff.shared}
          onlyInB={ignoreDiff.onlyInB}
          emptyMessage="Neither analysis declared noise to ignore."
        />
      </CompareCard>
    </>
  );
}

function ThresholdRow({
  label,
  valueA,
  valueB,
  changed,
}: {
  label: string;
  valueA: string;
  valueB: string;
  changed: boolean;
}) {
  return (
    <div
      className={`grid gap-2 rounded-lg border p-2 lg:grid-cols-[110px_1fr_1fr] ${
        changed ? "border-amber-300 bg-white" : "border-border bg-white"
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </div>
      <div className="text-xs leading-5 text-foreground">{valueA}</div>
      <div className="text-xs leading-5 text-foreground">{valueB}</div>
    </div>
  );
}

// ── Change-my-mind diff group ────────────────────

function ChangeMindDiffGroup({
  onlyInA,
  shared,
  onlyInB,
}: {
  onlyInA: string[];
  shared: string[];
  onlyInB: string[];
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <ChangeMindColumn
        label="Only in earlier"
        items={onlyInA}
        tone="border-l-4 border-l-rose-300"
      />
      <ChangeMindColumn
        label="In both"
        items={shared}
        tone="border-l-4 border-l-border"
      />
      <ChangeMindColumn
        label="Only in later"
        items={onlyInB}
        tone="border-l-4 border-l-emerald-300"
      />
    </div>
  );
}

function ChangeMindColumn({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: string;
}) {
  return (
    <div className={`rounded-2xl bg-white p-3 ${tone}`}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        {label} <span className="text-muted/70">({items.length})</span>
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-muted/70">—</p>
      ) : (
        <ul className="space-y-2 text-sm leading-6 text-foreground">
          {items.map((item, index) => {
            const parts = splitChangeMindCondition(item);
            if (parts) {
              return (
                <li key={`${label}-cm-${index}`} className="space-y-1">
                  <div>
                    <span className="text-xs font-semibold uppercase text-muted">
                      IF
                    </span>{" "}
                    {parts.trigger}
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase text-muted">
                      THEN
                    </span>{" "}
                    {parts.failure}
                  </div>
                </li>
              );
            }
            return <li key={`${label}-cm-${index}`}>• {item}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
