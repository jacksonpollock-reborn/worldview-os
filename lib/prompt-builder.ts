import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildEvidencePromptBlock } from "@/lib/evidence-prompt";
import { resolveDomainPromptPack, resolveObjectivePromptPack } from "@/lib/prompt-packs";
import type { AnalysisInput, AppSettingsValues } from "@/types/analysis";
import type { StructuredAnalysis } from "@/types/analysis";
import type { EvidenceItem } from "@/lib/sources/types";

const PROMPTS_DIR = join(process.cwd(), "prompts");

const STANDARD_ANALYSIS_SCHEMA_INSTRUCTION = `Return a single JSON object with this exact structure:
{
  "title": "short analysis title",
  "original_question": "string",
  "reframed_question": "string",
  "time_horizon": "string",
  "objective": "string",
  "definitions": [{"term": "string", "definition": "string"}],
  "domains": ["string"],
  "key_drivers": ["string"],
  "lenses": [
    {
      "name": "string",
      "why_it_matters": "string",
      "key_drivers": ["string"],
      "bull_case": "string",
      "bear_case": "string",
      "base_case": "string",
      "wildcard_case": "string",
      "evidence_for": ["string"],
      "evidence_against": ["string"],
      "leading_indicators": ["string"],
      "disconfirming_signals": ["string"]
    }
  ],
  "scenarios": [
    {
      "name": "string",
      "description": "string",
      "probability": 0,
      "impact": "low|medium|high",
      "time_horizon": "string",
      "confidence": "low|medium|high",
      "leading_indicators": ["string"]
    }
  ],
  "hidden_variables": ["string"],
  "change_my_mind_conditions": ["string"],
  "bottom_line": "string",
  "watchlist": ["string"]
}

Rules:
- Keep the analysis specific to the question; avoid generic boilerplate.
- Make the reframed question sharper and more decision-useful than the original.
- Make the reframed question one short sentence, thesis-like, and usually under 24 words.
- The reframed question must preserve specific names, candidates, options, assets, tickers, organizations, and values that appear in the original question. If the user asked "Magyar or Orbán", the reframed question must still name both. If the user asked about "AAPL", do not replace it with "tech stocks". Specificity wins over template language.
- Avoid scaffolding phrases such as "what are the critical factors that determine whether" unless absolutely necessary.
- Keep the output compact and high-signal; do not pad fields.
- Return 2 to 4 definitions.
- Use 4 to 6 domains unless the question clearly demands fewer.
- Return 4 to 6 key drivers.
- Prefer 3 lenses unless a 4th materially improves the analysis, and make them non-overlapping.
- Each lens must contribute a distinct causal mechanism.
- Do not repeat the same key driver phrase across multiple lenses.
- Prefer 3 scenarios unless a 4th materially improves the analysis, and make their probabilities sum to 100.
- Give scenarios causal names, not just "bull", "base", or "bear".
- Each scenario must differ by causal path, trigger pattern, and evidence signature.
- If an Evidence block is present, any evidence_for or evidence_against item not directly supported by that block must begin with "Structural reasoning only:" and must not read like a sourced current observation.
- Hidden variables must be genuinely underappreciated factors that would change scenario rankings if they moved, not mainstream talking points or recycled key drivers.
- Hidden variables cannot restate domains, key drivers, lens names, or watchlist items. If a news headline has discussed it, it is not hidden.
- Prefer hidden variables from: second-order effects, timing dependencies, measurement gaps, cross-domain spillovers, or structural fragilities not yet in the consensus view.
- Change-my-mind conditions must be observable and material, not vague.
- The View label in the bottom line must state a single directional call, not a both-sides summary. The Reason label must name the single strongest driver. Downgrade if and Upgrade if must state specific observable thresholds.
- The bottom line must be a single compact block with these exact labels in order: View:, Reason:, Risk:, Downgrade if:, Upgrade if:.
- Watchlist items must be concrete signals or events a user can monitor.
- Keep each hidden variable, change-my-mind condition, and watchlist item short and specific.
- Keep each scenario description and each lens case to 1 or 2 sentences.
- Avoid generic catchalls such as "unexpected shocks", "regulatory changes", "technological breakthroughs", or "public opinion shifts" unless made specific to this exact case.
- Use whole-number percentages for scenario probability.
- Always return at least 3 scenarios.
- Keep every field populated with a string or array. Do not return null.
- If an Evidence block is present, use only that block for source-backed current-state facts, with attribution and freshness discipline.
- If an Evidence block is absent or insufficient, fall back to structural reasoning without implying live or current data.
- When evidence is insufficient, avoid freshness-sensitive wording such as recent, ongoing, latest, today, now, or currently unless it is explicitly sourced.
- If objective is monitor, append Review: to the bottom line and use Ignore: only when there is a concrete noise pattern worth screening out.
- Do not wrap the JSON in markdown fences.
- Do not answer as a chatbot or essay.
`;

const MONITOR_ANALYSIS_SCHEMA_INSTRUCTION = `Return a single JSON object with this exact structure:
{
  "title": "short monitor title",
  "original_question": "string",
  "reframed_question": "string",
  "time_horizon": "string",
  "objective": "monitor",
  "definitions": [{"term": "string", "definition": "string"}],
  "domains": ["string"],
  "key_drivers": ["string"],
  "current_stance": "short current operating view",
  "monitoring_signals": [
    {
      "name": "signal name",
      "why_it_matters": "why this signal matters now",
      "current_read": "qualitative stance based on structural reasoning, not live data",
      "bullish_threshold": "observable threshold or trigger",
      "neutral_threshold": "observable threshold or range",
      "bearish_threshold": "observable threshold or trigger"
    }
  ],
  "review_cadence": "string",
  "confirm_current_view": ["string"],
  "disconfirm_current_view": ["string"],
  "what_to_ignore": ["string"],
  "lenses": [],
  "scenarios": [],
  "hidden_variables": ["string"],
  "change_my_mind_conditions": ["string"],
  "bottom_line": "string",
  "watchlist": ["string"]
}

Rules:
- Monitor mode is an operational surveillance surface, not a forecast.
- The reframed question must preserve specific names, candidates, options, assets, tickers, organizations, and values that appear in the original question. Do not abstract specific entities into generic categories. Specificity wins over template language.
- current_stance should be one short operating view, not a paragraph.
- Return 3 to 5 monitoring_signals. Choose signals that are leading (move before the outcome), not lagging or coincident.
- Every monitoring_signals threshold must be observable and grounded in historical context or structural breakpoints, not arbitrary round numbers.
- If an Evidence block provides source-backed current readings, current_read may use those values with source attribution and timestamp discipline. Otherwise current_read should stay qualitative or say "Unavailable - to be checked manually."
- review_cadence should be concrete, such as weekly, twice weekly, or monthly.
- confirm_current_view should state 2 to 4 observations that reinforce the current stance.
- disconfirm_current_view should state 2 to 4 observations that weaken the current stance.
- what_to_ignore should name specific, recurring noise patterns for this domain, not generic volatility disclaimers.
- If an Evidence block is present, any reasoning item that is not directly supported by that block must begin with "Structural reasoning only:" instead of reading like a sourced current observation.
- Hidden variables must be genuinely underappreciated factors that would change the monitoring stance if they moved, not mainstream talking points or items already in the watchlist.
- Prefer hidden variables from: second-order effects, timing dependencies, measurement gaps, cross-domain spillovers, or structural fragilities not yet in the consensus view.
- change_my_mind_conditions must use this exact format: IF [observable condition] -> [thesis or assumption fails].
- Keep change_my_mind_conditions to 2 to 4 items and make them sharper than the watchlist.
- The View label in the bottom line must state a single directional call, not a both-sides summary. The Reason label must name the single strongest driver.
- The bottom line must be a single compact block with these exact labels in order: View:, Reason:, Risk:, Downgrade if:, Upgrade if:, Review:. Add Ignore: only when there is a real noise pattern worth screening out.
- Watchlist items must be short, threshold-driven, and operational.
- Keep every string short and high-signal.
- If an Evidence block is present, use only that block for source-backed current-state facts, with attribution and freshness discipline.
- If an Evidence block is absent or insufficient, fall back to structural reasoning without implying live or current data.
- When evidence is insufficient, avoid freshness-sensitive wording such as recent, ongoing, latest, today, now, or currently unless it is explicitly sourced.
- Do not add lens blocks or scenario blocks in monitor mode.
- Do not wrap the JSON in markdown fences.
- Do not answer as a chatbot or essay.
`;

const RED_TEAM_SCHEMA_INSTRUCTION = `Return a single JSON object with this exact structure:
{
  "weakest_claims": ["string"],
  "revised_change_my_mind_conditions": ["string"],
  "revised_watchlist": ["string"],
  "revised_bottom_line": "string"
}

Rules:
- weakest_claims must name the 2 or 3 most fragile claims or assumptions in the current analysis.
- revised_change_my_mind_conditions must contain 2 to 4 concrete observations that use this exact format: IF [observable condition] -> [thesis or assumption fails].
- revised_watchlist must contain 4 to 5 items and be sharper and more trackable than the current watchlist.
- revised_bottom_line must keep the core call if still warranted, preserve the View/Reason/Risk/Downgrade if/Upgrade if structure, and explicitly name the weakest assumption behind it. The View label must be a directional call, not a both-sides hedge.
- Keep every string short and high-signal.
- Keep the output concise and high-signal.
- If any current hidden variables are mainstream talking points, recycled key drivers, or already in the watchlist, flag them in weakest_claims.
- Return valid JSON only.
`;

function formatInstructionBlock(title: string, items: string[]) {
  return `${title}:\n${items.map((item) => `- ${item}`).join("\n")}`;
}

function buildAnalysisSchemaInstruction(objective: string | undefined) {
  return (objective || "").trim().toLowerCase() === "monitor"
    ? MONITOR_ANALYSIS_SCHEMA_INSTRUCTION
    : STANDARD_ANALYSIS_SCHEMA_INSTRUCTION;
}

function buildObjectiveOutputDirective(objective: string | undefined) {
  switch ((objective || "").trim().toLowerCase()) {
    case "monitor":
      return formatInstructionBlock("Output-shaping rules for Monitor", [
        'Reframe the question in indicator-first language. Prefer forms like "Which indicators..." or "Which thresholds..." over general outlook wording.',
        "Use current_stance plus monitoring_signals as the operating surface instead of forecast-style lens and scenario blocks.",
        "Make change-my-mind conditions use the exact format IF [observable condition] -> [thesis or assumption fails].",
        "Use 4 to 6 watchlist items. Each item should read like indicator or event, threshold, and implication.",
        "The bottom line must include View, Reason, Risk, Downgrade if, Upgrade if, and Review. Add Ignore only when there is obvious noise worth filtering out.",
      ]);
    case "forecast":
      return formatInstructionBlock("Output-shaping rules for Forecast", [
        'When the original question does not name specific options, prefer path-language reframings like "What path is most likely..." or "Which path dominates..."',
        'When the original question names specific options (candidates, assets, tickers, organizations), keep those names in the reframed question. Do not abstract them into "candidates" or "options" or "the path".',
        "Make scenarios probabilistic first and narrative second.",
        "The bottom line must still use View, Reason, Risk, Downgrade if, and Upgrade if while naming the clearest probability-reversal trigger.",
      ]);
    case "invest":
      return formatInstructionBlock("Output-shaping rules for Invest", [
        'Reframe the question in exposure language. Prefer forms like "What is the risk-reward..." or "Which path justifies exposure..."',
        "Bias change-my-mind conditions and watchlist items toward invalidation and sizing decisions.",
        "The bottom line must still use View, Reason, Risk, Downgrade if, and Upgrade if, and it should imply posture rather than only describe conditions.",
      ]);
    case "understand":
      return formatInstructionBlock("Output-shaping rules for Understand", [
        'Reframe the question in mechanism language. Prefer forms like "Which forces..." or "What mechanism..."',
        "Bias the analysis toward causal explanation and tradeoffs rather than recommendation framing.",
        "The bottom line must still use View, Reason, Risk, Downgrade if, and Upgrade if while naming the dominant mechanism behind the current view.",
      ]);
    default:
      return "";
  }
}

async function loadPromptFile(fileName: string) {
  return readFile(join(PROMPTS_DIR, fileName), "utf8");
}

export async function buildPrompts(
  input: AnalysisInput,
  settings: AppSettingsValues,
  evidence: EvidenceItem[] = [],
) {
  const [systemPromptTemplate, analysisPromptTemplate] = await Promise.all([
    loadPromptFile("system.txt"),
    loadPromptFile("worldview-analysis.txt"),
  ]);

  const systemPrompt =
    settings.systemPromptOverride?.trim() || systemPromptTemplate.trim();
  const domainPack = resolveDomainPromptPack(input);
  const objectivePack = resolveObjectivePromptPack(input);
  const objectiveDirective = buildObjectiveOutputDirective(input.objective);
  const isMonitorObjective = (input.objective || "").trim().toLowerCase() === "monitor";
  const calibrationInstruction =
    isMonitorObjective
      ? "- For each monitoring signal, tie the threshold to a real observable condition and the stance update it should drive."
      : "- For each scenario description, explicitly mention the reference class or base-rate logic and what evidence moved the prior.";
  const probabilityInstruction = isMonitorObjective
    ? "- Do not include scenario probabilities or forecast-style middle blocks in monitor mode."
    : "- Keep probabilities calibrated rather than rounded to narrative convenience.";
  const evidenceBlock = buildEvidencePromptBlock(evidence);

  const baseUserPrompt = analysisPromptTemplate
    .replace("{{question}}", input.question)
    .replace("{{domain}}", input.domain || "Infer the relevant domains.")
    .replace("{{time_horizon}}", input.timeHorizon || "Infer an appropriate time horizon.")
    .replace("{{objective}}", input.objective || "Infer the likely analytical objective.")
    .replace(
      "{{schema_instruction}}",
      `${buildAnalysisSchemaInstruction(input.objective)}

${formatInstructionBlock(`Domain pack: ${domainPack.label}`, domainPack.instructions)}

${formatInstructionBlock(`Objective mode: ${objectivePack.label}`, objectivePack.instructions)}

${objectiveDirective}

${calibrationInstruction}
${probabilityInstruction}`,
    );
  const userPrompt = evidenceBlock
    ? `${baseUserPrompt}\n\n${evidenceBlock}`
    : baseUserPrompt;

  return {
    systemPrompt,
    userPrompt,
  };
}

export function buildRedTeamPrompts(
  input: AnalysisInput,
  analysis: StructuredAnalysis,
  evidence: EvidenceItem[] = [],
) {
  const domainPack = resolveDomainPromptPack(input);
  const objectivePack = resolveObjectivePromptPack(input);
  const objectiveDirective = buildObjectiveOutputDirective(input.objective);
  const evidenceBlock = buildEvidencePromptBlock(evidence);

  return {
    systemPrompt:
      "You are the Worldview OS red-team pass. Audit the current structured analysis for weak claims, weak disconfirmation logic, and vague watchlist items. Return JSON only.",
    userPrompt: [
      "Review the current structured analysis and tighten only the weakest reasoning surfaces.",
      "",
      `Question: ${input.question}`,
      `Objective: ${input.objective || "infer"}`,
      `Domain hint: ${input.domain || "infer"}`,
      "",
      formatInstructionBlock(`Domain pack: ${domainPack.label}`, domainPack.instructions),
      "",
      formatInstructionBlock(`Objective mode: ${objectivePack.label}`, objectivePack.instructions),
      objectiveDirective,
      "",
      ...(evidenceBlock ? [evidenceBlock, ""] : []),
      "Evidence integrity rules:",
      "- Do not introduce source-backed current facts that are not present in the Evidence block.",
      "- If the Evidence block marks a source as stale or unavailable, preserve that limitation rather than smoothing it over.",
      "- Flag any unsupported freshness language such as recent, ongoing, latest, today, now, or currently when it is not grounded in the Evidence block.",
      "- When tightening wording, keep factual freshness and attribution constraints intact.",
      "",
      "Tasks:",
      "- Identify the weakest claims or assumptions in the current analysis.",
      "- Rewrite change-my-mind conditions so each item clearly disconfirms a weak claim using the exact format IF [observable condition] -> [thesis or assumption fails].",
      "- Rewrite the watchlist so each item is concrete, trackable, and tied to a scenario update.",
      "- Tighten the bottom line so it preserves the labeled structure and names the leading path plus the weakest assumption behind it.",
      "- Do not add coverage. Only sharpen weak claims, disconfirmation logic, and watchlist precision.",
      "- Do not change the title, definitions, domains, key drivers, current_stance, monitoring_signals, lenses, or scenarios.",
      "",
      "Current analysis JSON:",
      JSON.stringify(analysis),
      "",
      RED_TEAM_SCHEMA_INSTRUCTION,
    ].join("\n"),
  };
}
