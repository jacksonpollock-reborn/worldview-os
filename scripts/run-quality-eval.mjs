import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import OpenAI from "openai";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const VERSION_LINEAGE = JSON.parse(
  await readFile(path.join(process.cwd(), "config", "version-lineage.json"), "utf8"),
);

const ANALYSIS_CASES = [
  {
    id: "01-taiwan-forecast",
    category: "politics/geopolitics",
    question:
      "What is the serious 12-month outlook for cross-strait tensions around Taiwan, and what would materially increase or decrease escalation risk?",
    domain: "geopolitics",
    timeHorizon: "next 12 months",
    objective: "forecast",
  },
  {
    id: "02-us-policy-monitor",
    category: "politics/geopolitics",
    question:
      "How durable is the current US policy and legislative momentum, and what signals would show that the governing coalition is strengthening or fracturing?",
    domain: "politics",
    timeHorizon: "next 9 months",
    objective: "monitor",
  },
  {
    id: "03-inflation-forecast",
    category: "macro/markets",
    question:
      "What is the serious outlook for US inflation and rate cuts over the next 12 months?",
    domain: "macro",
    timeHorizon: "next 12 months",
    objective: "forecast",
  },
  {
    id: "04-recession-monitor",
    category: "macro/markets",
    question:
      "How should a premium consumer brand monitor recession risk over the next 12 months, and what would matter most for pricing power and inventory decisions?",
    domain: "markets",
    timeHorizon: "next 12 months",
    objective: "monitor",
  },
  {
    id: "05-bitcoin-understand",
    category: "crypto",
    question:
      "What is the serious 12-month outlook for Bitcoin?",
    domain: "crypto",
    timeHorizon: "next 12 months",
    objective: "understand",
  },
  {
    id: "06-bitcoin-invest",
    category: "crypto",
    question:
      "What is the serious 12-month outlook for Bitcoin?",
    domain: "crypto",
    timeHorizon: "next 12 months",
    objective: "invest",
  },
  {
    id: "07-bitcoin-forecast",
    category: "crypto",
    question:
      "What is the serious 12-month outlook for Bitcoin?",
    domain: "crypto",
    timeHorizon: "next 12 months",
    objective: "forecast",
  },
  {
    id: "08-bitcoin-monitor",
    category: "crypto",
    question:
      "What is the serious 12-month outlook for Bitcoin?",
    domain: "crypto",
    timeHorizon: "next 12 months",
    objective: "monitor",
  },
  {
    id: "09-lakers-forecast",
    category: "sports",
    question:
      "Are the Lakers a real title contender this season, and what would materially improve or weaken that case?",
    domain: "sports",
    timeHorizon: "this season",
    objective: "forecast",
  },
  {
    id: "10-f1-understand",
    category: "sports",
    question:
      "What is really driving Formula 1's long-term audience growth, and which growth drivers are most fragile?",
    domain: "sports",
    timeHorizon: "next 3 years",
    objective: "understand",
  },
  {
    id: "11-ai-strategy-understand",
    category: "open-ended strategy",
    question:
      "Should a solo founder build an AI workflow product for hedge funds over the next 12 months, and what would make this attractive or unattractive?",
    domain: "strategy",
    timeHorizon: "next 12 months",
    objective: "understand",
  },
  {
    id: "12-media-monitor",
    category: "open-ended strategy",
    question:
      "How should a niche media brand think about growth over the next 18 months, and what signals would show that the current strategy is working or failing?",
    domain: "strategy",
    timeHorizon: "next 18 months",
    objective: "monitor",
  },
  {
    id: "13-btc-live-monitor",
    category: "crypto/source-aware",
    question:
      "What is Bitcoin's current risk posture and what should I monitor over the next 30 days?",
    domain: "crypto",
    timeHorizon: "next 30 days",
    objective: "monitor",
    liveDataEnabled: true,
    sourceAware: true,
    comparisonGroup: "btc-monitor-live-vs-control",
  },
  {
    id: "14-btc-live-invest",
    category: "crypto/source-aware",
    question:
      "Given the live BTC price, volume, and momentum readings, what is the 12-month risk-reward profile for Bitcoin exposure?",
    domain: "crypto",
    timeHorizon: "next 12 months",
    objective: "invest",
    liveDataEnabled: true,
    sourceAware: true,
  },
  {
    id: "15-btc-control-monitor",
    category: "crypto/source-aware",
    question:
      "What is Bitcoin's current risk posture and what should I monitor over the next 30 days?",
    domain: "crypto",
    timeHorizon: "next 30 days",
    objective: "monitor",
    liveDataEnabled: false,
    sourceAware: true,
    comparisonGroup: "btc-monitor-live-vs-control",
  },
];

const QUALITY_RUBRIC = {
  scale: {
    1: "Poor: generic, weak, or not useful.",
    2: "Weak: some relevant material but substantial drift or vagueness.",
    3: "Adequate: mostly correct and usable, but still generic or uneven.",
    4: "Strong: specific, differentiated, and decision-useful.",
    5: "Excellent: sharp, distinct, well-calibrated, and highly useful.",
  },
  dimensions: [
    "reframed_question_quality",
    "domain_relevance",
    "lens_distinctness",
    "scenario_differentiation",
    "hidden_variable_usefulness",
    "change_my_mind_specificity",
    "bottom_line_decisiveness",
    "watchlist_action_usefulness",
    "objective_alignment",
  ],
};

const SOURCE_AWARE_RUBRIC = {
  dimensions: [
    "evidence_grounding",
    "freshness_honesty",
    "source_attribution_usefulness",
  ],
};

function isBtcLivePilotCase(testCase) {
  return Boolean(testCase.liveDataEnabled) && testCase.domain === "crypto";
}

function expectedPromptVersionForCase(testCase) {
  return isBtcLivePilotCase(testCase)
    ? VERSION_LINEAGE.analysisLiveBtcPilotPromptVersion
    : VERSION_LINEAGE.analysisBaselinePromptVersion;
}

function getConnectionConfig() {
  const apiKey =
    process.env.LLM_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.KIMI_API_KEY ||
    "";
  const baseURL =
    process.env.LLM_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    (process.env.KIMI_API_KEY
      ? process.env.KIMI_BASE_URL || "https://api.moonshot.ai/v1"
      : undefined);
  const providerUsed = process.env.LLM_PROVIDER_NAME || (process.env.KIMI_API_KEY ? "Kimi" : "OpenAI");

  if (!apiKey) {
    throw new Error("Set LLM_API_KEY, OPENAI_API_KEY, or KIMI_API_KEY before running eval:quality.");
  }

  return { apiKey, baseURL, providerUsed };
}

function average(values) {
  if (values.length === 0) {
    return 0;
  }

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function countBy(values) {
  return values.reduce((counts, value) => {
    const key = value || "unknown";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function extractJson(text) {
  const trimmed = text.trim();

  if (trimmed.startsWith("{")) {
    return trimmed;
  }

  const withoutFences = trimmed.replace(/^```json\s*/i, "").replace(/```$/i, "");
  if (withoutFences.startsWith("{")) {
    return withoutFences;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function parseStoredRawResponse(rawResponseJson) {
  const parsed = JSON.parse(rawResponseJson);
  const meta =
    parsed && typeof parsed === "object" && parsed.meta && typeof parsed.meta === "object"
      ? parsed.meta
      : null;
  const redTeamStatus =
    typeof meta?.redTeamStatus === "string"
      ? meta.redTeamStatus
      : parsed?.redTeam
        ? "completed"
        : "failed";

  return {
    primary: typeof parsed?.primary === "string" ? parsed.primary : JSON.stringify(parsed),
    redTeam: typeof parsed?.redTeam === "string" ? parsed.redTeam : "",
    redTeamStatus,
    redTeamError: typeof meta?.redTeamError === "string" ? meta.redTeamError : "",
  };
}

async function waitForServer(baseUrl) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/settings`);
      if (response.ok) {
        return;
      }
    } catch {
      // ignore while server starts
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Server at ${baseUrl} did not become ready in time.`);
}

async function requestJson(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || `Request to ${pathname} failed with status ${response.status}.`);
  }

  return payload;
}

async function requestJsonWithRetry(baseUrl, pathname, options = {}, attempts = 2) {
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await requestJson(baseUrl, pathname, options);
    } catch (error) {
      lastError = error;

      if (attempt === attempts - 1) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }

  throw lastError;
}

function buildQualityJudgePrompt(testCase, analysis) {
  return `Score this structured analysis using the rubric below.

Question: ${testCase.question}
Selected domain: ${testCase.domain}
Selected objective: ${testCase.objective}
Time horizon: ${testCase.timeHorizon}

Rubric:
- reframed_question_quality: Is the reframed question sharper, more operational, and more decision-useful than the original?
- domain_relevance: Are the chosen domains genuinely causal and relevant?
- lens_distinctness: For non-monitor outputs, are the lenses materially distinct rather than repetitive? For monitor outputs, lenses are intentionally empty — score the distinctness and causal coverage of the monitoring_signals array instead. Do NOT penalize monitor outputs for having no lenses.
- scenario_differentiation: For non-monitor outputs, are the scenarios causally distinct and useful? For monitor outputs, scenarios are intentionally empty — score whether the confirm/disconfirm/threshold structure provides genuinely distinct operational signals rather than restating the same risk in different words. Do NOT penalize monitor outputs for having no scenarios.
- hidden_variable_usefulness: Are hidden variables non-obvious and worth tracking?
- change_my_mind_specificity: Are change-my-mind conditions observable, materially disconfirming, and written as sharp IF -> thesis fails triggers?
- bottom_line_decisiveness: Does the bottom line make a real call and state what could overturn it?
- watchlist_action_usefulness: Are the watchlist items concrete, trackable, and operationally useful?
- objective_alignment: Does the output clearly adapt to the selected objective?

Scoring scale:
1 = poor
2 = weak
3 = adequate
4 = strong
5 = excellent

Calibration rules:
- Start from 3, not 5.
- Only give 4 when the analysis is clearly above a typical competent LLM output on that dimension.
- Only give 5 when the dimension is unusually sharp and there is effectively no meaningful weakness.
- If you notice generic phrasing, repetitive lenses, weak scenario separation, obvious hidden variables, vague disconfirmation logic, or soft watchlist items, cap the relevant dimension at 3.
- If the objective is monitor, reward explicit thresholds, review cadence, current_read honesty, what-to-ignore discipline, and signal cards that are clearly operational rather than forecast-like. Monitor outputs intentionally omit lenses and scenarios; do not treat their absence as a weakness.
- Do not leave notable_weaknesses empty unless the analysis is exceptionally strong and you can justify that standard.

Return JSON with this shape:
{
  "scores": {
    "reframed_question_quality": 0,
    "domain_relevance": 0,
    "lens_distinctness": 0,
    "scenario_differentiation": 0,
    "hidden_variable_usefulness": 0,
    "change_my_mind_specificity": 0,
    "bottom_line_decisiveness": 0,
    "watchlist_action_usefulness": 0,
    "objective_alignment": 0
  },
  "notable_strengths": ["max 3 concise points"],
  "notable_weaknesses": ["max 3 concise points"],
  "summary": "2-4 sentences"
}

Analysis JSON:
${JSON.stringify(analysis)}`;
}

function buildSourceAwareJudgePrompt(
  testCase,
  analysis,
  evidenceSnapshot,
  evidenceSources,
  groundingValidation,
) {
  return `Score this BTC pilot analysis for source-aware trustworthiness.

Question: ${testCase.question}
Selected domain: ${testCase.domain}
Selected objective: ${testCase.objective}
Time horizon: ${testCase.timeHorizon}
liveDataEnabled: ${Boolean(testCase.liveDataEnabled)}

Source-aware rubric:
- evidence_grounding: If evidence is available, does the analysis use only supported facts from the evidence snapshot? If evidence is unavailable, does the analysis avoid pretending to be source-backed?
- freshness_honesty: Does the analysis avoid overstating freshness, handle stale/unavailable coverage honestly, and avoid unsupported current/live claims?
- source_attribution_usefulness: When source-backed facts are used, are attribution and timestamps useful enough to tell observed fact from structural reasoning? If no evidence is available, does the analysis clearly signal that limitation?

Scoring scale:
1 = poor
2 = weak
3 = adequate
4 = strong
5 = excellent

Calibration rules:
- Start from 3.
- Give 5 only when the output is both grounded and unusually disciplined about freshness and attribution.
- If the output uses unsourced current/live language, unsupported numbers, or blurs structural reasoning with observed fact, cap the relevant dimension at 2.
- If evidence is unavailable and the analysis clearly says it is using structural reasoning only, freshness_honesty can still score well.
- Use the grounding validator as a guardrail signal, not as a substitute for reading the analysis itself.

Return JSON with this shape:
{
  "scores": {
    "evidence_grounding": 0,
    "freshness_honesty": 0,
    "source_attribution_usefulness": 0
  },
  "notable_strengths": ["max 3 concise points"],
  "notable_weaknesses": ["max 3 concise points"],
  "summary": "2-4 sentences"
}

Persisted evidence snapshot:
${JSON.stringify(evidenceSnapshot)}

Persisted source summaries:
${JSON.stringify(evidenceSources)}

Grounding validator:
${JSON.stringify(groundingValidation)}

Analysis JSON:
${JSON.stringify(analysis)}`;
}

function buildRedTeamJudgePrompt(testCase, primaryAnalysis, finalAnalysis) {
  return `Compare the primary structured analysis against the final analysis after a red-team pass.

Question: ${testCase.question}
Selected objective: ${testCase.objective}

Score only the improvement made by the final analysis relative to the primary analysis on this scale:
0 = no improvement or worse
1 = small improvement
2 = clear material improvement

Return JSON with this shape:
{
  "improvement_scores": {
    "weak_claims": 0,
    "disconfirmation_logic": 0,
    "watchlist_specificity": 0,
    "bottom_line_sharpness": 0
  },
  "summary": "2-4 sentences",
  "best_red_team_change": "string",
  "remaining_gap": "string"
}

Primary analysis JSON:
${JSON.stringify(primaryAnalysis)}

Final analysis JSON:
${JSON.stringify(finalAnalysis)}`;
}

function buildObjectiveComparisonPrompt(runs) {
  const payload = Object.fromEntries(
    runs.map((run) => [
      run.selectedObjective,
      {
        bottom_line: run.analysis.bottom_line,
        watchlist: run.analysis.watchlist,
        change_my_mind_conditions: run.analysis.change_my_mind_conditions,
        reframed_question: run.analysis.reframed_question,
        current_stance: run.analysis.current_stance || null,
        review_cadence: run.analysis.review_cadence || null,
        monitoring_signals: run.analysis.monitoring_signals || [],
      },
    ]),
  );

  return `Assess whether objective-aware shaping is materially different across understand, invest, forecast, and monitor for the same underlying question.

Question: ${runs[0].question}

Return JSON with this shape:
{
  "material_difference_score": 0,
  "objective_alignment_scores": {
    "understand": 0,
    "invest": 0,
    "forecast": 0,
    "monitor": 0
  },
  "distinctive_traits": {
    "understand": "string",
    "invest": "string",
    "forecast": "string",
    "monitor": "string"
  },
  "overlap_or_genericity": "string",
  "summary": "2-4 sentences"
}

Scale:
1 = barely differentiated
3 = partially differentiated
5 = clearly and materially differentiated

Outputs:
${JSON.stringify(payload)}`;
}

async function judgeJson(client, model, prompt, maxTokens = 1400) {
  const response = await client.chat.completions.create({
    model,
    temperature: 0.1,
    max_completion_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a strict evaluator for structured analyses. Use the full scale, default to 3, avoid score inflation, and return JSON only. Be terse, concrete, and unsentimental.",
      },
      { role: "user", content: prompt },
    ],
  });

  const text = response.choices[0]?.message?.content;

  if (!text) {
    throw new Error("Judge output was empty.");
  }

  return JSON.parse(extractJson(text));
}

function computeDimensionAverages(results) {
  return Object.fromEntries(
    QUALITY_RUBRIC.dimensions.map((dimension) => [
      dimension,
      average(results.map((result) => result.quality.scores[dimension])),
    ]),
  );
}

function computeCategoryAverages(results) {
  const categories = [...new Set(results.map((result) => result.category))];

  return Object.fromEntries(
    categories.map((category) => {
      const scoped = results.filter((result) => result.category === category);
      return [
        category,
        {
          average_score: average(scoped.map((result) => result.quality.average_score)),
          objective_alignment: average(scoped.map((result) => result.quality.scores.objective_alignment)),
        },
      ];
    }),
  );
}

function computeSourceAwareDimensionAverages(results) {
  return Object.fromEntries(
    SOURCE_AWARE_RUBRIC.dimensions.map((dimension) => [
      dimension,
      average(
        results
          .filter((result) => result.sourceAwareQuality)
          .map((result) => result.sourceAwareQuality.scores[dimension]),
      ),
    ]),
  );
}

function computeSourceAwareComparisons(results) {
  const comparisonGroups = [
    ...new Set(
      results
        .map((result) => result.comparisonGroup)
        .filter((group) => typeof group === "string" && group.length > 0),
    ),
  ];

  return Object.fromEntries(
    comparisonGroups.map((group) => {
      const scoped = results.filter((result) => result.comparisonGroup === group);
      const liveRun = scoped.find((result) => result.liveDataEnabled);
      const controlRun = scoped.find((result) => !result.liveDataEnabled);

      if (!liveRun || !controlRun || !liveRun.sourceAwareQuality || !controlRun.sourceAwareQuality) {
        return [group, null];
      }

      return [
        group,
        {
          live_case_id: liveRun.id,
          control_case_id: controlRun.id,
          deltas: {
            evidence_grounding: Number(
              (
                liveRun.sourceAwareQuality.scores.evidence_grounding -
                controlRun.sourceAwareQuality.scores.evidence_grounding
              ).toFixed(2),
            ),
            freshness_honesty: Number(
              (
                liveRun.sourceAwareQuality.scores.freshness_honesty -
                controlRun.sourceAwareQuality.scores.freshness_honesty
              ).toFixed(2),
            ),
            source_attribution_usefulness: Number(
              (
                liveRun.sourceAwareQuality.scores.source_attribution_usefulness -
                controlRun.sourceAwareQuality.scores.source_attribution_usefulness
              ).toFixed(2),
            ),
          },
        },
      ];
    }),
  );
}

function withQualityAverage(result) {
  const scoreValues = QUALITY_RUBRIC.dimensions.map(
    (dimension) => result.quality.scores[dimension],
  );

  return {
    ...result,
    quality: {
      ...result.quality,
      average_score: average(scoreValues),
    },
  };
}

async function main() {
  const baseUrl = process.env.EVAL_BASE_URL || "http://127.0.0.1:3000";
  const evalDate = new Date().toISOString().slice(0, 10);
  const evalTag = process.env.EVAL_TAG?.trim();
  const defaultEvalTag = `${slugify(VERSION_LINEAGE.analysisBaselinePromptVersion)}-quality-eval`;
  const outputDir = path.join(
    process.cwd(),
    "artifacts",
    "quality-eval",
    evalTag ? `${evalDate}-${evalTag}` : `${evalDate}-${defaultEvalTag}`,
  );
  const reuseExisting = process.env.EVAL_REUSE_EXISTING === "true";
  const resumePartial = process.env.EVAL_RESUME_PARTIAL !== "false";
  const { apiKey, baseURL, providerUsed } = getConnectionConfig();
  const client = new OpenAI({
    apiKey,
    baseURL,
  });
  const analysisModel = process.env.EVAL_MODEL || "gpt-4.1-mini";
  const judgeModel =
    process.env.EVAL_JUDGE_MODEL ||
    (analysisModel.includes("mini") ? "gpt-4.1" : analysisModel);

  await mkdir(outputDir, { recursive: true });
  await waitForServer(baseUrl);

  await requestJson(baseUrl, "/api/settings", {
    method: "PUT",
    body: JSON.stringify({
      model: analysisModel,
      temperature: 0.3,
      maxTokens: 4800,
      schemaMode: "strict-json-repair",
      systemPromptOverride: null,
      liveDataEnabled: false,
    }),
  });

  const results = [];

  for (const testCase of ANALYSIS_CASES) {
    const existingPath = path.join(outputDir, `${testCase.id}.json`);
    let durationMs = 0;
    let analysisId = "";
    let modelUsed = analysisModel;
    let promptVersion = "";
    const expectedPromptVersion = expectedPromptVersionForCase(testCase);
    let redTeamRan = false;
    let redTeamStatus = "unknown";
    let redTeamError = "";
    let evidenceSnapshot = [];
    let evidenceSources = [];
    let groundingValidation = null;
    let sourceAwareQuality = null;
    let finalAnalysis;
    let primaryAnalysis;

    if (reuseExisting || (resumePartial && await readFile(existingPath, "utf8").then(() => true).catch(() => false))) {
      const existing = JSON.parse(await readFile(existingPath, "utf8"));
      durationMs = existing.durationMs || 0;
      analysisId = existing.analysisId || "";
      modelUsed = existing.modelUsed || analysisModel;
      promptVersion = existing.promptVersion || "";
      redTeamRan = Boolean(existing.redTeamRan);
      redTeamStatus = existing.redTeamStatus || (redTeamRan ? "completed" : "unknown");
      redTeamError = existing.redTeamError || "";
      evidenceSnapshot = Array.isArray(existing.evidenceSnapshot) ? existing.evidenceSnapshot : [];
      evidenceSources = Array.isArray(existing.evidenceSources) ? existing.evidenceSources : [];
      groundingValidation = existing.groundingValidation || null;
      sourceAwareQuality = existing.sourceAwareQuality || null;
      finalAnalysis = existing.analysis;
      primaryAnalysis = existing.primaryAnalysis;
    } else {
      await requestJson(baseUrl, "/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          model: analysisModel,
          temperature: 0.3,
          maxTokens: 4800,
          schemaMode: "strict-json-repair",
          systemPromptOverride: null,
          liveDataEnabled: Boolean(testCase.liveDataEnabled),
        }),
      });

      const startedAt = Date.now();
      const runResponse = await requestJsonWithRetry(baseUrl, "/api/analyze", {
        method: "POST",
        body: JSON.stringify({
          question: testCase.question,
          domain: testCase.domain,
          timeHorizon: testCase.timeHorizon,
          objective: testCase.objective,
        }),
      }, 2);
      durationMs = Date.now() - startedAt;
      const record = await prisma.analysis.findUnique({
        where: { id: runResponse.id },
        select: {
          id: true,
          rawResponseJson: true,
          modelUsed: true,
          promptVersion: true,
          evidenceSnapshotJson: true,
          evidenceSourcesJson: true,
          groundingValidationJson: true,
          createdAt: true,
        },
      });

      if (!record) {
        throw new Error(`Saved analysis ${runResponse.id} was not found in the database.`);
      }

      const rawResponse = parseStoredRawResponse(record.rawResponseJson);
      redTeamStatus = rawResponse.redTeamStatus;
      redTeamError = rawResponse.redTeamError;
      redTeamRan = redTeamStatus === "completed";
      primaryAnalysis = JSON.parse(extractJson(rawResponse.primary));
      finalAnalysis = runResponse.analysis;
      analysisId = record.id;
      modelUsed = record.modelUsed || analysisModel;
      promptVersion = record.promptVersion;
      evidenceSnapshot = record.evidenceSnapshotJson
        ? JSON.parse(record.evidenceSnapshotJson)
        : [];
      evidenceSources = record.evidenceSourcesJson
        ? JSON.parse(record.evidenceSourcesJson)
        : [];
      groundingValidation = record.groundingValidationJson
        ? JSON.parse(record.groundingValidationJson)
        : null;
    }

    if (promptVersion !== expectedPromptVersion) {
      throw new Error(
        `Prompt lineage mismatch for ${testCase.id}: expected ${expectedPromptVersion}, got ${promptVersion || "<empty>"}.`,
      );
    }

    const quality = await judgeJson(
      client,
      judgeModel,
      buildQualityJudgePrompt(testCase, finalAnalysis),
    );
    const redTeamComparison = await judgeJson(
      client,
      judgeModel,
      buildRedTeamJudgePrompt(testCase, primaryAnalysis, finalAnalysis),
      1000,
    );
    if (testCase.sourceAware) {
      sourceAwareQuality = await judgeJson(
        client,
        judgeModel,
        buildSourceAwareJudgePrompt(
          testCase,
          finalAnalysis,
          evidenceSnapshot,
          evidenceSources,
          groundingValidation,
        ),
        1000,
      );
    }

    const result = withQualityAverage({
      id: testCase.id,
      category: testCase.category,
      question: testCase.question,
      selectedDomain: testCase.domain,
      selectedObjective: testCase.objective,
      liveDataEnabled: Boolean(testCase.liveDataEnabled),
      comparisonGroup: testCase.comparisonGroup || null,
      providerUsed,
      modelUsed,
      promptVersion,
      expectedPromptVersion,
      analysisId,
      redTeamRan,
      redTeamStatus,
      redTeamError,
      durationMs,
      analysis: finalAnalysis,
      primaryAnalysis,
      evidenceSnapshot,
      evidenceSources,
      groundingValidation,
      quality,
      sourceAwareQuality,
      redTeamComparison,
    });

    results.push(result);

    await writeFile(
      path.join(outputDir, `${testCase.id}.json`),
      JSON.stringify(result, null, 2),
      "utf8",
    );
  }

  const objectiveRuns = results.filter((result) =>
    result.id.startsWith("05-bitcoin-") ||
    result.id.startsWith("06-bitcoin-") ||
    result.id.startsWith("07-bitcoin-") ||
    result.id.startsWith("08-bitcoin-"),
  );
  const objectiveComparison = await judgeJson(
    client,
    judgeModel,
    buildObjectiveComparisonPrompt(objectiveRuns),
    1200,
  );

  const summary = {
    generated_at: new Date().toISOString(),
    version_lineage: VERSION_LINEAGE,
    harness: {
      total_case_ids: ANALYSIS_CASES.map((testCase) => testCase.id),
      source_aware_case_ids: ANALYSIS_CASES.filter((testCase) => testCase.sourceAware).map(
        (testCase) => testCase.id,
      ),
      live_pilot_case_ids: ANALYSIS_CASES.filter(isBtcLivePilotCase).map(
        (testCase) => testCase.id,
      ),
      comparison_groups: Array.from(
        new Set(
          ANALYSIS_CASES.map((testCase) => testCase.comparisonGroup).filter(Boolean),
        ),
      ),
    },
    provider_used: providerUsed,
    analysis_model: analysisModel,
    judge_model: judgeModel,
    run_count: results.length,
    rubric: QUALITY_RUBRIC,
    source_aware_rubric: SOURCE_AWARE_RUBRIC,
    averages: {
      overall_score: average(results.map((result) => result.quality.average_score)),
      dimensions: computeDimensionAverages(results),
      categories: computeCategoryAverages(results),
      source_aware_dimensions: computeSourceAwareDimensionAverages(results),
      red_team_improvement: {
        weak_claims: average(results.map((result) => result.redTeamComparison.improvement_scores.weak_claims)),
        disconfirmation_logic: average(
          results.map((result) => result.redTeamComparison.improvement_scores.disconfirmation_logic),
        ),
        watchlist_specificity: average(
          results.map((result) => result.redTeamComparison.improvement_scores.watchlist_specificity),
        ),
        bottom_line_sharpness: average(
          results.map((result) => result.redTeamComparison.improvement_scores.bottom_line_sharpness),
        ),
      },
      red_team_status_counts: countBy(results.map((result) => result.redTeamStatus)),
      prompt_version_counts: countBy(results.map((result) => result.promptVersion)),
    },
    source_aware_comparisons: computeSourceAwareComparisons(results),
    objective_comparison: objectiveComparison,
    results: results.map((result) => ({
      id: result.id,
      category: result.category,
      question: result.question,
      selectedDomain: result.selectedDomain,
      selectedObjective: result.selectedObjective,
      liveDataEnabled: result.liveDataEnabled,
      comparisonGroup: result.comparisonGroup,
      providerUsed: result.providerUsed,
      promptVersion: result.promptVersion,
      expectedPromptVersion: result.expectedPromptVersion,
      redTeamRan: result.redTeamRan,
      redTeamStatus: result.redTeamStatus,
      redTeamError: result.redTeamError,
      durationMs: result.durationMs,
      quality: result.quality,
      sourceAwareQuality: result.sourceAwareQuality,
      notableStrengths: result.quality.notable_strengths,
      notableWeaknesses: result.quality.notable_weaknesses,
      redTeamComparison: result.redTeamComparison,
      groundingValidation: result.groundingValidation,
      analysisId: result.analysisId,
    })),
  };

  await writeFile(path.join(outputDir, "report.json"), JSON.stringify(summary, null, 2), "utf8");

  console.info(
    JSON.stringify(
      {
        outputDir,
        runCount: results.length,
        overallScore: summary.averages.overall_score,
        objectiveComparison: summary.objective_comparison,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
