import type { MonitorStructuredAnalysis, PersistedAnalysisRecord, StructuredAnalysis } from "@/types/analysis";

function isMonitorAnalysis(analysis: StructuredAnalysis): analysis is MonitorStructuredAnalysis {
  return analysis.objective.trim().toLowerCase() === "monitor" && "monitoring_signals" in analysis;
}

export function buildAnalysisMarkdown(record: PersistedAnalysisRecord) {
  const { analysis, followUps } = record;
  const monitorAnalysis = isMonitorAnalysis(analysis) ? analysis : null;

  return [
    `# ${record.title}`,
    "",
    `## Original Question`,
    analysis.original_question,
    "",
    `## Reframed Question`,
    analysis.reframed_question,
    "",
    `## Definitions`,
    ...analysis.definitions.map(
      (definition) => `- **${definition.term}:** ${definition.definition}`,
    ),
    "",
    `## Domains`,
    ...analysis.domains.map((domain) => `- ${domain}`),
    "",
    `## Key Drivers`,
    ...analysis.key_drivers.map((driver) => `- ${driver}`),
    "",
    ...(monitorAnalysis
      ? [
          `## Current Stance`,
          monitorAnalysis.current_stance,
          "",
          `## Monitoring Signals`,
          ...monitorAnalysis.monitoring_signals.flatMap((signal) => [
            `### ${signal.name}`,
            `- Why it matters: ${signal.why_it_matters}`,
            ...(signal.current_read ? [`- Current read: ${signal.current_read}`] : []),
            `- Bullish threshold: ${signal.bullish_threshold}`,
            `- Neutral threshold: ${signal.neutral_threshold}`,
            `- Bearish threshold: ${signal.bearish_threshold}`,
            "",
          ]),
          `## Review Cadence`,
          monitorAnalysis.review_cadence,
          "",
          `## What Confirms The Current View`,
          ...monitorAnalysis.confirm_current_view.map((item) => `- ${item}`),
          "",
          `## What Disconfirms The Current View`,
          ...monitorAnalysis.disconfirm_current_view.map((item) => `- ${item}`),
          ...(monitorAnalysis.what_to_ignore.length > 0
            ? [
                "",
                `## What To Ignore`,
                ...monitorAnalysis.what_to_ignore.map((item) => `- ${item}`),
              ]
            : []),
          "",
        ]
      : [
          `## Lenses`,
          ...analysis.lenses.flatMap((lens) => [
            `### ${lens.name}`,
            `- Why it matters: ${lens.why_it_matters}`,
            `- Bull case: ${lens.bull_case}`,
            `- Base case: ${lens.base_case}`,
            `- Bear case: ${lens.bear_case}`,
            `- Wildcard: ${lens.wildcard_case}`,
            `- Key drivers: ${lens.key_drivers.join("; ")}`,
            `- Evidence for: ${lens.evidence_for.join("; ")}`,
            `- Evidence against: ${lens.evidence_against.join("; ")}`,
            `- Leading indicators: ${lens.leading_indicators.join("; ")}`,
            `- Disconfirming signals: ${lens.disconfirming_signals.join("; ")}`,
            "",
          ]),
          `## Scenarios`,
          ...analysis.scenarios.flatMap((scenario) => [
            `### ${scenario.name}`,
            `- Probability: ${scenario.probability}%`,
            `- Impact: ${scenario.impact}`,
            `- Confidence: ${scenario.confidence}`,
            `- Horizon: ${scenario.time_horizon}`,
            `- Description: ${scenario.description}`,
            `- Leading indicators: ${scenario.leading_indicators.join("; ")}`,
            "",
          ]),
        ]),
    `## Hidden Variables`,
    ...analysis.hidden_variables.map((item) => `- ${item}`),
    "",
    `## What Would Change My Mind`,
    ...analysis.change_my_mind_conditions.map((item) => `- ${item}`),
    "",
    `## Bottom Line`,
    analysis.bottom_line,
    "",
    `## Watchlist`,
    ...analysis.watchlist.map((item) => `- ${item}`),
    ...(followUps.length > 0
      ? [
          "",
          `## Follow-Ups`,
          ...followUps.flatMap((followUp, index) => [
            `### ${index + 1}. ${followUp.title}`,
            `- Question: ${followUp.question}`,
            followUp.answer,
            ...(followUp.keyPoints.length > 0
              ? [`- Key points: ${followUp.keyPoints.join("; ")}`]
              : []),
            ...(followUp.watchouts.length > 0
              ? [`- Watchouts: ${followUp.watchouts.join("; ")}`]
              : []),
            "",
          ]),
        ]
      : []),
  ].join("\n");
}
