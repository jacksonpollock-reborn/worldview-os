"use client";

import { parseBottomLineSegments } from "@/lib/bottom-line";
import { splitChangeMindCondition } from "@/lib/change-my-mind";
import type {
  MonitorStructuredAnalysis,
  StandardStructuredAnalysis,
  StructuredAnalysis,
} from "@/types/analysis";

type AnalysisViewProps = {
  title: string;
  analysis: StructuredAnalysis;
};

type SectionDefinition = {
  id: string;
  label: string;
  content: React.ReactNode;
};

function isMonitorAnalysis(analysis: StructuredAnalysis): analysis is MonitorStructuredAnalysis {
  return analysis.objective.trim().toLowerCase() === "monitor" && "monitoring_signals" in analysis;
}

function SectionCard({
  id,
  step,
  title,
  children,
}: {
  id: string;
  step: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          {step}
        </span>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 text-sm text-foreground">{value}</p>
    </div>
  );
}

function ListCard({
  title,
  items,
  variant = "default",
}: {
  title: string;
  items: string[];
  variant?: "default" | "success" | "danger";
}) {
  const variantClass =
    variant === "success"
      ? "bg-success-soft"
      : variant === "danger"
        ? "bg-danger-soft"
        : "border border-border bg-surface-muted";

  return (
    <div className={`rounded-2xl p-4 ${variantClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{title}</p>
      <ul className="mt-3 space-y-2 text-sm text-foreground">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="leading-6">
            • {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function renderSharedIntroSections(analysis: StructuredAnalysis): SectionDefinition[] {
  return [
    {
      id: "reframed-question",
      label: "Reframed Question",
      content: (
        <SectionCard id="reframed-question" step="01" title="Reframed Question">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface-muted p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Original question
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {analysis.original_question}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Reframed question
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {analysis.reframed_question}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <MetaChip
              label="Time horizon"
              value={analysis.time_horizon || "Not specified"}
            />
            <MetaChip label="Objective" value={analysis.objective || "Auto-detected"} />
          </div>
        </SectionCard>
      ),
    },
    {
      id: "definitions",
      label: "Definitions",
      content: (
        <SectionCard id="definitions" step="02" title="Definitions">
          <div className="space-y-3">
            {analysis.definitions.map((definition, index) => (
              <div
                key={`definition-${index}`}
                className="rounded-2xl border border-border bg-white p-4"
              >
                <h3 className="text-sm font-semibold text-foreground">{definition.term}</h3>
                <p className="mt-1 text-sm leading-6 text-muted">{definition.definition}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      ),
    },
    {
      id: "domains",
      label: "Domains",
      content: (
        <SectionCard id="domains" step="03" title="Domains">
          <div className="flex flex-wrap gap-2">
            {analysis.domains.map((domain, index) => (
              <span
                key={`domain-${index}`}
                className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent"
              >
                {domain}
              </span>
            ))}
          </div>
        </SectionCard>
      ),
    },
    {
      id: "key-drivers",
      label: "Key Drivers",
      content: (
        <SectionCard id="key-drivers" step="04" title="Key Drivers">
          <div className="space-y-3">
            {analysis.key_drivers.map((driver, index) => (
              <div
                key={`driver-${index}`}
                className="flex items-start gap-4 rounded-2xl border border-border bg-white px-4 py-3"
              >
                <span className="mt-0.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="text-sm leading-6 text-foreground">{driver}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      ),
    },
  ];
}

function renderStandardSections(analysis: StandardStructuredAnalysis): SectionDefinition[] {
  const bottomLineSegments = parseBottomLineSegments(analysis.bottom_line);

  return [
    ...renderSharedIntroSections(analysis),
    {
      id: "lenses",
      label: "Lenses",
      content: (
        <SectionCard id="lenses" step="05" title="Lenses">
          <div className="space-y-4">
            {analysis.lenses.map((lens, lensIndex) => (
              <article
                key={`lens-${lensIndex}`}
                className="rounded-2xl border border-border bg-white p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{lens.name}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      {lens.why_it_matters}
                    </p>
                  </div>
                  <span className="rounded-full bg-surface-muted px-3 py-1 text-xs text-muted">
                    {lens.key_drivers.length} drivers
                  </span>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <ListCard title="Key drivers" items={lens.key_drivers} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["Bull case", lens.bull_case],
                      ["Base case", lens.base_case],
                      ["Bear case", lens.bear_case],
                      ["Wildcard", lens.wildcard_case],
                    ].map(([label, value], caseIndex) => (
                      <div
                        key={`lens-case-${lensIndex}-${caseIndex}`}
                        className="rounded-2xl border border-border bg-surface-muted p-4"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                          {label}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  <ListCard title="Evidence for" items={lens.evidence_for} variant="success" />
                  <ListCard
                    title="Evidence against"
                    items={lens.evidence_against}
                    variant="danger"
                  />
                  <ListCard title="Leading indicators" items={lens.leading_indicators} />
                  <ListCard
                    title="Disconfirming signals"
                    items={lens.disconfirming_signals}
                  />
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      ),
    },
    {
      id: "scenario-matrix",
      label: "Scenario Matrix",
      content: (
        <SectionCard id="scenario-matrix" step="06" title="Scenario Matrix">
          <div className="grid gap-4 lg:grid-cols-2">
            {analysis.scenarios.map((scenario, scenarioIndex) => (
              <article
                key={`scenario-${scenarioIndex}`}
                className="rounded-2xl border border-border bg-white p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{scenario.name}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      {scenario.description}
                    </p>
                  </div>
                  <div className="min-w-[100px] rounded-2xl bg-accent-soft px-3 py-2 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                      Probability
                    </p>
                    <p className="mt-1 text-xl font-semibold text-accent">
                      {scenario.probability}%
                    </p>
                  </div>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${scenario.probability}%` }}
                  />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <MetaChip label="Impact" value={scenario.impact} />
                  <MetaChip label="Confidence" value={scenario.confidence} />
                  <MetaChip label="Horizon" value={scenario.time_horizon} />
                </div>

                <div className="mt-4">
                  <ListCard title="Leading indicators" items={scenario.leading_indicators} />
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      ),
    },
    {
      id: "hidden-variables",
      label: "Hidden Variables",
      content: (
        <SectionCard id="hidden-variables" step="07" title="Hidden Variables">
          <div className="space-y-3">
            {analysis.hidden_variables.map((item, index) => (
              <div
                key={`hidden-variable-${index}`}
                className="rounded-2xl border border-border bg-white px-4 py-3 text-sm leading-6 text-foreground"
              >
                {item}
              </div>
            ))}
          </div>
        </SectionCard>
      ),
    },
    {
      id: "change-my-mind",
      label: "Change My Mind",
      content: (
        <SectionCard
          id="change-my-mind"
          step="08"
          title="What Would Change My Mind"
        >
          <div className="space-y-3">
            {analysis.change_my_mind_conditions.map((item, index) => {
              const condition = splitChangeMindCondition(item);

              return (
                <div
                  key={`change-condition-${index}`}
                  className="rounded-2xl border border-border bg-white p-4"
                >
                  {condition ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl bg-surface-muted p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                          If
                        </p>
                        <p className="mt-2 text-sm leading-6 text-foreground">
                          {condition.trigger}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-danger-soft p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                          Thesis fails
                        </p>
                        <p className="mt-2 text-sm leading-6 text-foreground">
                          {condition.failure}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm leading-6 text-foreground">{item}</p>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      ),
    },
    {
      id: "bottom-line",
      label: "Bottom Line",
      content: (
        <SectionCard id="bottom-line" step="09" title="Bottom Line">
          <div className="rounded-2xl border border-border bg-white p-4">
            {bottomLineSegments.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {bottomLineSegments.map((segment, index) => (
                  <div
                    key={`bottom-line-${index}`}
                    className="rounded-2xl border border-border bg-surface-muted p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      {segment.label}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-foreground">{segment.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-7 text-foreground">{analysis.bottom_line}</p>
            )}
          </div>
        </SectionCard>
      ),
    },
    {
      id: "watchlist",
      label: "Watchlist",
      content: (
        <SectionCard id="watchlist" step="10" title="Watchlist">
          <div className="space-y-3">
            {analysis.watchlist.map((item, index) => (
              <div
                key={`watchlist-${index}`}
                className="flex items-start gap-4 rounded-2xl border border-border bg-white px-4 py-3"
              >
                <span className="mt-0.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="text-sm leading-6 text-foreground">{item}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      ),
    },
  ];
}

function renderMonitorSections(analysis: MonitorStructuredAnalysis): SectionDefinition[] {
  const bottomLineSegments = parseBottomLineSegments(analysis.bottom_line);

  return [
    ...renderSharedIntroSections(analysis),
    {
      id: "current-stance",
      label: "Current Stance",
      content: (
        <SectionCard id="current-stance" step="05" title="Current Stance">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
            <div className="rounded-2xl border border-border bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Current operating view
              </p>
              <p className="mt-3 text-sm leading-7 text-foreground">{analysis.current_stance}</p>
            </div>
            <div className="grid gap-4">
              <MetaChip label="Review cadence" value={analysis.review_cadence} />
              {analysis.what_to_ignore.length > 0 ? (
                <ListCard title="What to ignore" items={analysis.what_to_ignore} />
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-surface-muted p-4 text-sm leading-6 text-muted">
                  No noise filters were needed for this monitor.
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      ),
    },
    {
      id: "monitoring-signals",
      label: "Monitoring Signals",
      content: (
        <SectionCard id="monitoring-signals" step="06" title="Monitoring Signals">
          <div className="grid gap-4 xl:grid-cols-2">
            {analysis.monitoring_signals.map((signal, signalIndex) => (
              <article
                key={`monitor-signal-${signalIndex}`}
                className="rounded-2xl border border-border bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{signal.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {signal.why_it_matters}
                    </p>
                  </div>
                  <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
                    Signal {signalIndex + 1}
                  </span>
                </div>

                {signal.current_read ? (
                  <div className="mt-3 rounded-2xl border border-border bg-surface-muted p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      Current read
                    </p>
                    <p className="mt-1 text-sm leading-6 text-foreground">
                      {signal.current_read}
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl bg-success-soft p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      Bullish threshold
                    </p>
                    <p className="mt-2 text-sm leading-6 text-foreground">
                      {signal.bullish_threshold}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-surface-muted p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      Neutral threshold
                    </p>
                    <p className="mt-2 text-sm leading-6 text-foreground">
                      {signal.neutral_threshold}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-danger-soft p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      Bearish threshold
                    </p>
                    <p className="mt-2 text-sm leading-6 text-foreground">
                      {signal.bearish_threshold}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      ),
    },
    {
      id: "confirm-disconfirm",
      label: "Confirm / Disconfirm",
      content: (
        <SectionCard id="confirm-disconfirm" step="07" title="Confirm / Disconfirm">
          <div className="grid gap-4 xl:grid-cols-2">
            <ListCard
              title="What confirms the current view"
              items={analysis.confirm_current_view}
              variant="success"
            />
            <ListCard
              title="What disconfirms the current view"
              items={analysis.disconfirm_current_view}
              variant="danger"
            />
          </div>
        </SectionCard>
      ),
    },
    {
      id: "hidden-variables",
      label: "Hidden Variables",
      content: (
        <SectionCard id="hidden-variables" step="08" title="Hidden Variables">
          <div className="space-y-3">
            {analysis.hidden_variables.map((item, index) => (
              <div
                key={`hidden-variable-${index}`}
                className="rounded-2xl border border-border bg-white px-4 py-3 text-sm leading-6 text-foreground"
              >
                {item}
              </div>
            ))}
          </div>
        </SectionCard>
      ),
    },
    {
      id: "change-my-mind",
      label: "Change My Mind",
      content: (
        <SectionCard id="change-my-mind" step="09" title="What Would Change My Mind">
          <div className="space-y-3">
            {analysis.change_my_mind_conditions.map((item, index) => {
              const condition = splitChangeMindCondition(item);

              return (
                <div
                  key={`change-condition-${index}`}
                  className="rounded-2xl border border-border bg-white p-4"
                >
                  {condition ? (
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                      <div className="rounded-2xl bg-surface-muted p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                          If
                        </p>
                        <p className="mt-2 text-sm leading-6 text-foreground">
                          {condition.trigger}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-danger-soft p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                          Thesis fails
                        </p>
                        <p className="mt-2 text-sm leading-6 text-foreground">
                          {condition.failure}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm leading-6 text-foreground">{item}</p>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      ),
    },
    {
      id: "bottom-line",
      label: "Bottom Line",
      content: (
        <SectionCard id="bottom-line" step="10" title="Bottom Line">
          <div className="rounded-2xl border border-border bg-white p-4">
            {bottomLineSegments.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {bottomLineSegments.map((segment, index) => (
                  <div
                    key={`bottom-line-${index}`}
                    className="rounded-2xl border border-border bg-surface-muted p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      {segment.label}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-foreground">{segment.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-7 text-foreground">{analysis.bottom_line}</p>
            )}
          </div>
        </SectionCard>
      ),
    },
    {
      id: "watchlist",
      label: "Watchlist",
      content: (
        <SectionCard id="watchlist" step="11" title="Operational Watchlist">
          <div className="space-y-3">
            {analysis.watchlist.map((item, index) => (
              <div
                key={`watchlist-${index}`}
                className="flex items-start gap-4 rounded-2xl border border-border bg-white px-4 py-3"
              >
                <span className="mt-0.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="text-sm leading-6 text-foreground">{item}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      ),
    },
  ];
}

export function AnalysisView({ title, analysis }: AnalysisViewProps) {
  const sections = isMonitorAnalysis(analysis)
    ? renderMonitorSections(analysis)
    : renderStandardSections(analysis as StandardStructuredAnalysis);

  return (
    <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Active analysis
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-2 text-sm leading-6 text-muted">{analysis.reframed_question}</p>
        </div>
        <nav className="rounded-2xl border border-border bg-surface p-3 shadow-sm">
          <ul className="space-y-1.5">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-surface-muted hover:text-foreground"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="space-y-6">{sections.map((section) => section.content)}</div>
    </div>
  );
}
