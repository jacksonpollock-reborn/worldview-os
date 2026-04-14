import type { Analysis, AnalysisReview } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import {
  parseGroundingValidationJson,
  serializeGroundingValidationReport,
  validateAnalysisAgainstEvidence,
} from "@/lib/evidence-grounding";
import { buildPrompts, buildRedTeamPrompts } from "@/lib/prompt-builder";
import { buildMockAnalysisResult } from "@/lib/demo-content";
import {
  normalizeSourceResponsesToEvidence,
  parseEvidenceSnapshotJson,
  parseSourceSummariesJson,
  serializeEvidenceSnapshot,
  serializeSourceSummaries,
  summarizeSourceResponses,
} from "@/lib/evidence";
import {
  parseAnalysisFollowUpRecord,
  type AnalysisWithFollowUpsRecord,
} from "@/lib/follow-up";
import { generateStructuredJson } from "@/lib/llm";
import { getAnalysisRuntimeMode } from "@/lib/runtime-mode";
import { fetchCoinGeckoBtcPilotSources } from "@/lib/sources/coingecko";
import { getEligibleSourcesForDomain } from "@/lib/sources/source-registry";
import {
  MonitorAnalysisOutputSchema,
  StandardAnalysisOutputSchema,
} from "@/schemas/analysis";
import { RedTeamReviewSchema } from "@/schemas/red-team";
import { logServerError } from "@/lib/server-logger";
import {
  isBtcLivePilotDomain,
  resolveAnalysisPromptVersion,
} from "@/lib/version-lineage";
import type {
  AnalysisInput,
  AnalysisReviewRecord,
  AnalysisReviewSummary,
  AnalysisSummary,
  AppSettingsValues,
  MonitorStructuredAnalysis,
  OutcomeLabel,
  PersistedAnalysisRecord,
  RedTeamStatus,
  StructuredAnalysis,
  TriggerState,
  WatchlistTriggerState,
} from "@/types/analysis";
import type { EvidenceItem } from "@/lib/sources/types";
import type { SourceSummary } from "@/lib/sources/types";

const MAX_ANALYSIS_RETRIES = 3;
const MAX_ANALYSIS_TOKENS = 7_200;
const MAX_REFRAMED_QUESTION_WORDS = 26;
const RED_TEAM_MAX_WEAK_CLAIMS = 3;
const RED_TEAM_MAX_CHANGE_CONDITIONS = 4;
const RED_TEAM_MAX_WATCHLIST_ITEMS = 5;
const MAX_ALLOWED_LENS_DRIVER_OVERLAPS = 3;
const REQUIRED_BOTTOM_LINE_LABELS = [
  "view",
  "reason",
  "risk",
  "downgrade if",
  "upgrade if",
] as const;
const CHANGE_MY_MIND_PATTERN = /^IF\s+.+\s+->\s+.+$/i;
const REQUIRED_ANALYSIS_SECTIONS = [
  "definitions",
  "domains",
  "key_drivers",
  "lenses",
  "scenarios",
  "hidden_variables",
  "change_my_mind_conditions",
  "bottom_line",
  "watchlist",
] as const;
const REQUIRED_MONITOR_SECTIONS = [
  "definitions",
  "domains",
  "key_drivers",
  "current_stance",
  "monitoring_signals",
  "review_cadence",
  "confirm_current_view",
  "disconfirm_current_view",
  "hidden_variables",
  "change_my_mind_conditions",
  "bottom_line",
  "watchlist",
] as const;

class AnalysisOutputError extends Error {
  code: string;
  retryable: boolean;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    options: {
      code: string;
      retryable?: boolean;
      details?: Record<string, unknown>;
    },
  ) {
    super(message);
    this.name = "AnalysisOutputError";
    this.code = options.code;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function normalizeChangeMyMindConditions(conditions: string[]) {
  return conditions
    .map((condition) => condition.trim())
    .filter(Boolean)
    .map((condition) => {
      if (CHANGE_MY_MIND_PATTERN.test(condition)) {
        return condition;
      }

      const trimmedCondition = condition.replace(/[.]+$/g, "").trim();
      return `IF ${trimmedCondition} -> the current view fails`;
    });
}

function isMonitorObjective(value: string | undefined) {
  return normalizeComparableText(value || "") === "monitor";
}

function isMonitorAnalysis(analysis: StructuredAnalysis): analysis is MonitorStructuredAnalysis {
  return isMonitorObjective(analysis.objective) && "monitoring_signals" in analysis;
}

function normalizeComparableText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function tokenizeComparableText(value: string) {
  return normalizeComparableText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function hasThresholdLanguage(value: string) {
  return /(\bif\b|\bwhen\b|\babove\b|\bbelow\b|\bbreach\b|\bcross\b|\bsustain\b|\bweekly\b|\bmonthly\b|%|\bbps\b|\bday\b|\bweek\b|\bmonth\b|\bquarter\b|\bmore than\b|\bless than\b|\bat least\b|\bat most\b|\bban\b|\bbans\b|\benforcement\b|\bapproval\b|\bdefault\b|\bbankruptcy\b|\bcollapse\b|\bhalt\b|\bruling\b|\bsanction\b|\bflows\b|\boutflows\b|\binflows\b)/i.test(
    value,
  );
}

function asDefinitions(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const term = asString(record.term);
      const definition = asString(record.definition);

      if (!term || !definition) {
        return null;
      }

      return { term, definition };
    })
    .filter((item): item is { term: string; definition: string } => Boolean(item));
}

function normalizeProbability(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  if (value > 0 && value <= 1) {
    return Math.round(value * 100);
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function asLenses(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const name = asString(record.name);
      const whyItMatters = asString(record.why_it_matters);

      if (!name || !whyItMatters) {
        return null;
      }

      return {
        name,
        why_it_matters: whyItMatters,
        key_drivers: asStringArray(record.key_drivers),
        bull_case: asString(record.bull_case),
        bear_case: asString(record.bear_case),
        base_case: asString(record.base_case),
        wildcard_case: asString(record.wildcard_case),
        evidence_for: asStringArray(record.evidence_for),
        evidence_against: asStringArray(record.evidence_against),
        leading_indicators: asStringArray(record.leading_indicators),
        disconfirming_signals: asStringArray(record.disconfirming_signals),
      };
    })
    .filter(Boolean);
}

function asScenarios(value: unknown, input: AnalysisInput) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const name = asString(record.name);
      const description = asString(record.description);

      if (!name || !description) {
        return null;
      }

      const impact = asString(record.impact, "medium").toLowerCase();
      const confidence = asString(record.confidence, "medium").toLowerCase();

      return {
        name,
        description,
        probability: normalizeProbability(record.probability),
        impact: ["low", "medium", "high"].includes(impact) ? impact : "medium",
        time_horizon: asString(record.time_horizon, input.timeHorizon || "12 months"),
        confidence: ["low", "medium", "high"].includes(confidence)
          ? confidence
          : "medium",
        leading_indicators: asStringArray(record.leading_indicators),
      };
    })
    .filter(Boolean);
}

function asMonitoringSignals(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const name = asString(record.name);
      const whyItMatters = asString(record.why_it_matters);
      const bullishThreshold = asString(record.bullish_threshold);
      const neutralThreshold = asString(record.neutral_threshold);
      const bearishThreshold = asString(record.bearish_threshold);

      if (
        !name ||
        !whyItMatters ||
        !bullishThreshold ||
        !neutralThreshold ||
        !bearishThreshold
      ) {
        return null;
      }

      return {
        name,
        why_it_matters: whyItMatters,
        current_read: asString(record.current_read),
        bullish_threshold: bullishThreshold,
        neutral_threshold: neutralThreshold,
        bearish_threshold: bearishThreshold,
      };
    })
    .filter(Boolean);
}

function formatZodIssues(error: ZodError) {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

function assertReframedQuestionQuality(analysis: StructuredAnalysis) {
  const reframedQuestion = analysis.reframed_question.trim();
  const normalized = normalizeComparableText(reframedQuestion);
  const wordCount = countWords(reframedQuestion);
  const verbosePrefixes = [
    "what are the critical",
    "what are the key",
    "how can ",
    "what is the most likely trajectory of",
    "what are the major",
  ];

  if (wordCount > MAX_REFRAMED_QUESTION_WORDS) {
    throw new AnalysisOutputError(
      `Reframed question was too verbose at ${wordCount} words.`,
      {
        code: "verbose-reframing",
        retryable: true,
        details: { wordCount, reframedQuestion },
      },
    );
  }

  if (verbosePrefixes.some((prefix) => normalized.startsWith(prefix))) {
    throw new AnalysisOutputError("Reframed question used verbose scaffolding.", {
      code: "verbose-reframing",
      retryable: true,
      details: { reframedQuestion },
    });
  }
}

const ENTITY_STOP_WORDS = new Set([
  "next",
  "will",
  "what",
  "how",
  "which",
  "who",
  "when",
  "where",
  "why",
  "the",
  "this",
  "that",
  "these",
  "those",
  "there",
  "here",
  "now",
  "should",
  "would",
  "could",
  "can",
  "may",
  "might",
  "must",
  "is",
  "are",
  "was",
  "were",
  "been",
  "being",
  "do",
  "does",
  "did",
  "have",
  "has",
  "had",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
  "spring",
  "summer",
  "fall",
  "autumn",
  "winter",
  "us",
  "usa",
  "uk",
  "if",
  "and",
  "or",
  "but",
  "yet",
  "so",
  "for",
  "nor",
  "in",
  "on",
  "at",
  "by",
  "to",
  "of",
  "from",
  "about",
  "against",
  "into",
  "over",
  "under",
  "before",
  "after",
  "during",
  "without",
  "within",
  "between",
  "year",
  "years",
  "month",
  "months",
  "week",
  "weeks",
  "day",
  "days",
]);

const TICKER_FALSE_POSITIVES = new Set([
  "WHO",
  "WHAT",
  "HOW",
  "WHY",
  "ALL",
  "ANY",
  "AND",
  "OR",
  "FOR",
  "NOT",
  "BUT",
  "YET",
  "ITS",
  "OUR",
  "YOU",
  "THE",
  "US",
  "USA",
  "UK",
  "EU",
  "UN",
  "AI",
  "ML",
  "GDP",
  "CPI",
  "ETF",
  "IMF",
  "OECD",
  "OPEC",
  "NATO",
]);

const ENTITY_TITLE_WORDS = new Set([
  "prime",
  "minister",
  "president",
  "vice",
  "chief",
  "ceo",
  "cfo",
  "cto",
  "coo",
  "chairman",
  "chairwoman",
  "secretary",
  "director",
  "head",
  "governor",
  "senator",
  "representative",
  "judge",
  "justice",
  "king",
  "queen",
  "pope",
  "emperor",
  "general",
  "admiral",
  "colonel",
  "captain",
  "company",
  "corporation",
  "inc",
  "ltd",
  "llc",
  "corp",
  "league",
  "association",
  "federation",
  "union",
  "office",
  "department",
  "ministry",
  "agency",
  "council",
  "committee",
  "board",
]);

const ENTITY_PREFIX_MATCH_LENGTH = 5;

function normalizeForEntityComparison(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type ExtractedEntity = {
  display: string;
  matchType: "strict" | "prefix";
};

function isWordTitleOrStop(word: string): boolean {
  const lower = word.toLowerCase();
  return ENTITY_TITLE_WORDS.has(lower) || ENTITY_STOP_WORDS.has(lower);
}

function isCommonSentenceStarter(word: string): boolean {
  const lower = word.toLowerCase();
  // Words that are commonly capitalized at sentence start but aren't proper nouns
  return (
    ENTITY_STOP_WORDS.has(lower) ||
    [
      "next",
      "will",
      "would",
      "should",
      "could",
      "can",
      "may",
      "might",
      "must",
      "is",
      "are",
      "do",
      "does",
      "did",
      "have",
      "has",
      "had",
      "what",
      "how",
      "which",
      "who",
      "when",
      "where",
      "why",
      "tell",
      "give",
      "show",
      "let",
      "the",
      "this",
      "that",
      "these",
      "those",
      "there",
      "here",
    ].includes(lower)
  );
}

function extractNamedEntitiesFromQuestion(
  question: string,
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const seenNormalized = new Set<string>();

  function addEntity(value: string, matchType: "strict" | "prefix") {
    const trimmed = value.trim();
    if (!trimmed) return;
    const normalized = normalizeForEntityComparison(trimmed);
    if (!normalized) return;
    if (seenNormalized.has(normalized)) return;
    seenNormalized.add(normalized);
    entities.push({ display: trimmed, matchType });
  }

  // STRICT — multi-word proper nouns where every word is a real proper noun
  // (no sentence starters, no titles, no stop words). These are person/org names.
  const properNounMulti = /[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+)+/g;
  for (const match of question.matchAll(properNounMulti)) {
    const phrase = match[0];
    const words = phrase.split(/\s+/);
    // Reject if any word is a sentence starter, title, or stop word
    if (words.some((w) => isCommonSentenceStarter(w) || isWordTitleOrStop(w))) {
      continue;
    }
    addEntity(phrase, "strict");
  }

  // STRICT — tickers: 2-5 uppercase letters (excluding common acronyms)
  const tickerPattern = /\b[A-Z]{2,5}\b/g;
  for (const match of question.matchAll(tickerPattern)) {
    const word = match[0];
    if (TICKER_FALSE_POSITIVES.has(word)) continue;
    addEntity(word, "strict");
  }

  // STRICT — specific years 2000-2099
  const yearPattern = /\b20\d{2}\b/g;
  for (const match of question.matchAll(yearPattern)) {
    addEntity(match[0], "strict");
  }

  // PREFIX — single-word proper nouns (lenient; allows possessive/adjective forms)
  // Skip sentence starters, titles, stop words. Skip if covered by a multi-word entity already.
  const singleNoun = /\b[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]{2,}/g;
  for (const match of question.matchAll(singleNoun)) {
    const word = match[0];
    if (isCommonSentenceStarter(word) || isWordTitleOrStop(word)) continue;
    const normalized = normalizeForEntityComparison(word);
    let coveredByMulti = false;
    for (const existing of seenNormalized) {
      if (existing !== normalized && existing.split(" ").includes(normalized)) {
        coveredByMulti = true;
        break;
      }
    }
    if (coveredByMulti) continue;
    addEntity(word, "prefix");
  }

  return entities;
}

function entityMatchesReframed(
  entity: ExtractedEntity,
  reframedNormalized: string,
): boolean {
  const normalizedEntity = normalizeForEntityComparison(entity.display);
  if (!normalizedEntity) return true;

  if (entity.matchType === "strict") {
    return reframedNormalized.includes(normalizedEntity);
  }

  // Prefix mode: pass if entity appears as substring, OR if any prefix of length
  // ENTITY_PREFIX_MATCH_LENGTH appears in the reframed (handles Hungary -> Hungarian).
  if (reframedNormalized.includes(normalizedEntity)) {
    return true;
  }
  const prefixLength = Math.min(
    ENTITY_PREFIX_MATCH_LENGTH,
    normalizedEntity.length,
  );
  if (prefixLength < 4) {
    // Too short to safely prefix-match; require the full word.
    return false;
  }
  const prefix = normalizedEntity.slice(0, prefixLength);
  return reframedNormalized.includes(prefix);
}

function assertReframedQuestionEntityPreservation(
  analysis: StructuredAnalysis,
  input: AnalysisInput,
) {
  const originalEntities = extractNamedEntitiesFromQuestion(input.question);
  if (originalEntities.length === 0) {
    return;
  }

  const reframedNormalized = normalizeForEntityComparison(
    analysis.reframed_question,
  );

  const missing: string[] = [];
  for (const entity of originalEntities) {
    if (!entityMatchesReframed(entity, reframedNormalized)) {
      missing.push(entity.display);
    }
  }

  if (missing.length === 0) {
    return;
  }

  throw new AnalysisOutputError(
    `Reframed question dropped specific named entities from the original question: ${missing.join(", ")}. The reframed question must keep these names.`,
    {
      code: "reframed-question-entity-loss",
      retryable: true,
      details: {
        missing,
        originalQuestion: input.question,
        reframedQuestion: analysis.reframed_question,
      },
    },
  );
}

function assertLensDistinctness(analysis: StructuredAnalysis) {
  const seenDrivers = new Map<string, string>();
  const duplicateDrivers: Array<{ driver: string; firstLens: string; secondLens: string }> = [];

  for (const lens of analysis.lenses) {
    for (const driver of lens.key_drivers) {
      const normalizedDriver = normalizeComparableText(driver);

      if (!normalizedDriver) {
        continue;
      }

      const firstLens = seenDrivers.get(normalizedDriver);

      if (firstLens && firstLens !== lens.name) {
        duplicateDrivers.push({
          driver,
          firstLens,
          secondLens: lens.name,
        });
        continue;
      }

      seenDrivers.set(normalizedDriver, lens.name);
    }
  }

  if (duplicateDrivers.length > MAX_ALLOWED_LENS_DRIVER_OVERLAPS) {
    throw new AnalysisOutputError(
      "Lens key drivers overlapped across multiple lenses.",
      {
        code: "lens-driver-overlap",
        retryable: true,
        details: { duplicateDrivers },
      },
    );
  }
}

function assertScenarioDifferentiation(analysis: StructuredAnalysis) {
  const duplicateScenarioNames = new Set<string>();
  const scenarioPairs: string[] = [];

  for (let index = 0; index < analysis.scenarios.length; index += 1) {
    const current = analysis.scenarios[index];
    const currentName = normalizeComparableText(current.name);
    const currentDescription = normalizeComparableText(current.description);
    const currentIndicators = current.leading_indicators.map(normalizeComparableText).filter(Boolean);

    for (let compareIndex = index + 1; compareIndex < analysis.scenarios.length; compareIndex += 1) {
      const comparison = analysis.scenarios[compareIndex];
      const comparisonName = normalizeComparableText(comparison.name);
      const comparisonDescription = normalizeComparableText(comparison.description);
      const comparisonIndicators = comparison.leading_indicators
        .map(normalizeComparableText)
        .filter(Boolean);

      if (currentName === comparisonName) {
        duplicateScenarioNames.add(current.name);
      }

      const sameDescription = currentDescription === comparisonDescription;
      const sameIndicatorSignature =
        currentIndicators.length > 1 &&
        currentIndicators.length === comparisonIndicators.length &&
        currentIndicators.every((indicator) => comparisonIndicators.includes(indicator));

      if (sameDescription || sameIndicatorSignature) {
        scenarioPairs.push(`${current.name} vs ${comparison.name}`);
      }
    }
  }

  if (duplicateScenarioNames.size > 0 || scenarioPairs.length > 0) {
    throw new AnalysisOutputError("Scenario differentiation was too weak.", {
      code: "scenario-overlap",
      retryable: true,
      details: {
        duplicateScenarioNames: [...duplicateScenarioNames],
        scenarioPairs,
      },
    });
  }
}

function assertHiddenVariableNovelty(analysis: StructuredAnalysis) {
  const comparisonPool = [
    ...analysis.domains,
    ...analysis.key_drivers,
    ...analysis.lenses.map((lens) => lens.name),
    ...analysis.watchlist,
  ].map(normalizeComparableText);

  const recycledHiddenVariables = analysis.hidden_variables.filter((hiddenVariable) => {
    const normalizedHiddenVariable = normalizeComparableText(hiddenVariable);
    const hiddenTokens = tokenizeComparableText(hiddenVariable);

    return comparisonPool.some(
      (candidate) => {
        if (candidate === normalizedHiddenVariable) {
          return true;
        }

        const candidateWordCount = countWords(candidate);
        const hiddenWordCount = countWords(normalizedHiddenVariable);

        if (candidateWordCount < 2 || hiddenWordCount < 2) {
          return false;
        }

        const candidateTokens = tokenizeComparableText(candidate);
        const shorterTokens =
          candidateTokens.length <= hiddenTokens.length ? candidateTokens : hiddenTokens;
        const longerTokens =
          candidateTokens.length <= hiddenTokens.length ? hiddenTokens : candidateTokens;

        return (
          shorterTokens.length >= 3 &&
          shorterTokens.every((token) => longerTokens.includes(token))
        );
      },
    );
  });

  if (recycledHiddenVariables.length > 0) {
    throw new AnalysisOutputError(
      "Hidden variables restated main drivers, watchlist items, or well-known factors instead of surfacing underappreciated ones.",
      {
        code: "hidden-variable-overlap",
        retryable: true,
        details: { recycledHiddenVariables },
      },
    );
  }
}

function assertChangeMyMindSpecificity(analysis: StructuredAnalysis) {
  const invalidConditions = analysis.change_my_mind_conditions.filter(
    (condition) => !CHANGE_MY_MIND_PATTERN.test(condition) || !hasThresholdLanguage(condition),
  );

  if (invalidConditions.length > 0) {
    throw new AnalysisOutputError(
      "Change-my-mind conditions were not formatted as sharp observable disconfirmation triggers.",
      {
        code: "change-my-mind-format",
        retryable: true,
        details: { invalidConditions: invalidConditions.slice(0, 4) },
      },
    );
  }
}

function assertBottomLineThresholding(analysis: StructuredAnalysis) {
  const normalizedBottomLine = normalizeComparableText(analysis.bottom_line);
  const missingLabels = REQUIRED_BOTTOM_LINE_LABELS.filter(
    (label) => !normalizedBottomLine.includes(label),
  );

  if (missingLabels.length > 0) {
    throw new AnalysisOutputError(
      "Bottom line was missing one or more required threshold labels.",
      {
        code: "bottom-line-thresholding",
        retryable: true,
        details: { missingLabels },
      },
    );
  }
}

function assertMonitorOperationality(analysis: StructuredAnalysis) {
  if (!isMonitorAnalysis(analysis)) {
    return;
  }

  const normalizedBottomLine = normalizeComparableText(analysis.bottom_line);
  const missingBottomLineLabels = ["review"].filter(
    (label) => !normalizedBottomLine.includes(label),
  );

  if (
    analysis.monitoring_signals.length < 3 ||
    analysis.watchlist.length < 4 ||
    analysis.change_my_mind_conditions.length < 2 ||
    analysis.confirm_current_view.length < 2 ||
    analysis.disconfirm_current_view.length < 2 ||
    missingBottomLineLabels.length > 0
  ) {
    throw new AnalysisOutputError(
      "Monitor-mode output was not operational enough.",
      {
        code: "monitor-operationality",
        retryable: true,
        details: {
          monitoringSignalCount: analysis.monitoring_signals.length,
          watchlistCount: analysis.watchlist.length,
          changeConditionCount: analysis.change_my_mind_conditions.length,
          confirmCount: analysis.confirm_current_view.length,
          disconfirmCount: analysis.disconfirm_current_view.length,
          missingBottomLineLabels,
        },
      },
    );
  }
}

function countBraceBalance(text: string) {
  let balance = 0;
  let isEscaped = false;
  let inString = false;

  for (const char of text) {
    if (isEscaped) {
      isEscaped = false;
      continue;
    }

    if (char === "\\") {
      isEscaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      balance += 1;
    } else if (char === "}") {
      balance -= 1;
    }
  }

  return balance;
}

function extractJson(text: string, allowRepair: boolean) {
  const trimmed = text.trim();

  if (trimmed.startsWith("{")) {
    return trimmed;
  }

  if (!allowRepair) {
    throw new AnalysisOutputError("Model output was not valid strict JSON.", {
      code: "strict-json",
      retryable: true,
    });
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

function parseModelOutput(text: string, allowRepair: boolean) {
  const jsonText = extractJson(text, allowRepair);

  try {
    return JSON.parse(jsonText) as unknown;
  } catch {
    throw new AnalysisOutputError("Model output was not valid JSON.", {
      code: "invalid-json",
      retryable: true,
    });
  }
}

function assertRequiredSections(candidate: unknown, input: AnalysisInput) {
  if (!candidate || typeof candidate !== "object") {
    throw new AnalysisOutputError("Model output was not a JSON object.", {
      code: "not-object",
      retryable: true,
    });
  }

  const record = candidate as Record<string, unknown>;
  const requiredSections = isMonitorObjective(asString(record.objective, input.objective || ""))
    ? REQUIRED_MONITOR_SECTIONS
    : REQUIRED_ANALYSIS_SECTIONS;
  const missingSections = requiredSections.filter(
    (section) => record[section] === undefined,
  );

  if (missingSections.length > 0) {
    throw new AnalysisOutputError(
      `Model output was incomplete. Missing sections: ${missingSections.join(", ")}.`,
      {
        code: "missing-sections",
        retryable: true,
        details: { missingSections },
      },
    );
  }
}

function assertOutputNotTruncated(text: string, finishReason: string | null) {
  const trimmed = text.trim();

  if (finishReason !== "length" && trimmed.endsWith("}") && countBraceBalance(trimmed) === 0) {
    return;
  }

  throw new AnalysisOutputError(
    "The model response was truncated before the structured analysis completed.",
    {
      code: "truncated-output",
      retryable: true,
      details: {
        finishReason,
        braceBalance: countBraceBalance(trimmed),
        endsWithBrace: trimmed.endsWith("}"),
      },
    },
  );
}

function validateAnalysisOutput(
  candidate: unknown,
  input: AnalysisInput,
): StructuredAnalysis {
  const record =
    candidate && typeof candidate === "object"
      ? (candidate as Record<string, unknown>)
      : {};

  const monitorObjective = isMonitorObjective(asString(record.objective, input.objective || ""));
  const baseNormalized = {
    title:
      asString(record.title) ||
      asString(record.reframed_question) ||
      input.question.slice(0, 80),
    original_question: asString(record.original_question, input.question),
    reframed_question: asString(record.reframed_question),
    time_horizon: asString(record.time_horizon, input.timeHorizon || ""),
    objective: asString(record.objective, input.objective || ""),
    definitions: asDefinitions(record.definitions),
    domains: asStringArray(record.domains),
    key_drivers: asStringArray(record.key_drivers),
    hidden_variables: asStringArray(record.hidden_variables),
    change_my_mind_conditions: normalizeChangeMyMindConditions(
      asStringArray(record.change_my_mind_conditions),
    ),
    bottom_line: asString(record.bottom_line),
    watchlist: asStringArray(record.watchlist),
  };

  try {
    if (monitorObjective) {
      return MonitorAnalysisOutputSchema.parse({
        ...baseNormalized,
        current_stance: asString(record.current_stance),
        monitoring_signals: asMonitoringSignals(record.monitoring_signals),
        review_cadence: asString(record.review_cadence),
        confirm_current_view: asStringArray(record.confirm_current_view),
        disconfirm_current_view: asStringArray(record.disconfirm_current_view),
        what_to_ignore: asStringArray(record.what_to_ignore),
        lenses: [],
        scenarios: [],
      });
    }

    return StandardAnalysisOutputSchema.parse({
      ...baseNormalized,
      lenses: asLenses(record.lenses),
      scenarios: asScenarios(record.scenarios, input),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AnalysisOutputError(
        `Structured analysis failed validation: ${formatZodIssues(error)}`,
        {
          code: "schema-validation",
          retryable: true,
          details: {
            issues: error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
        },
      );
    }

    throw error;
  }
}

function assertAnalysisQualityHeuristics(
  analysis: StructuredAnalysis,
  input: AnalysisInput,
) {
  assertReframedQuestionQuality(analysis);
  assertReframedQuestionEntityPreservation(analysis, input);
  if (!isMonitorAnalysis(analysis)) {
    assertLensDistinctness(analysis);
    assertScenarioDifferentiation(analysis);
  }
  assertHiddenVariableNovelty(analysis);
  assertChangeMyMindSpecificity(analysis);
  assertBottomLineThresholding(analysis);
  assertMonitorOperationality(analysis);
}

function parseStoredJson<T>(label: string, value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`Stored ${label} data is invalid JSON.`);
  }
}

function buildRawResponseEnvelope(input: {
  primary: string;
  redTeam: string | null;
  redTeamStatus: RedTeamStatus;
  redTeamError?: string | null;
}) {
  return JSON.stringify(
    {
      primary: input.primary,
      redTeam: input.redTeam,
      meta: {
        redTeamStatus: input.redTeamStatus,
        redTeamError: input.redTeamError || null,
      },
    },
    null,
    2,
  );
}

function isCryptoPilotDomain(domain: string | null | undefined) {
  return isBtcLivePilotDomain(domain);
}

async function collectPilotEvidence(
  input: AnalysisInput,
  settings: AppSettingsValues,
) {
  if (!settings.liveDataEnabled || !isCryptoPilotDomain(input.domain)) {
    return {
      evidenceSnapshot: [] as EvidenceItem[],
      evidenceSources: [] as SourceSummary[],
      pilotEligible: false,
    };
  }

  const eligibleSources = getEligibleSourcesForDomain({
    domain: input.domain,
    liveDataEnabled: settings.liveDataEnabled,
  });

  if (eligibleSources.length === 0) {
    return {
      evidenceSnapshot: [] as EvidenceItem[],
      evidenceSources: [] as SourceSummary[],
      pilotEligible: false,
    };
  }

  const sourceResponses = await fetchCoinGeckoBtcPilotSources({ timeoutMs: 10_000 });
  const evidence = normalizeSourceResponsesToEvidence(sourceResponses);
  const evidenceSources = summarizeSourceResponses(sourceResponses);

  for (const response of sourceResponses) {
    if (response.status === "error" || response.status === "unavailable") {
      logServerError("analysis.live_data_source_failed", new Error(response.error_message || "Live source failed."), {
        question: input.question,
        sourceId: response.source_id,
        domain: input.domain || "",
        liveDataEnabled: settings.liveDataEnabled,
      });
    }
  }

  return {
    evidenceSnapshot: evidence,
    evidenceSources,
    pilotEligible: true,
  };
}

function parseStoredRawResponse(record: Pick<Analysis, "modelUsed" | "promptVersion" | "rawResponseJson">) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(record.rawResponseJson);
  } catch {
    return {
      redTeamStatus: "unknown" as RedTeamStatus,
      redTeamError: "Stored raw response is invalid JSON.",
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      redTeamStatus: "unknown" as RedTeamStatus,
      redTeamError: null,
    };
  }

  const envelope = parsed as Record<string, unknown>;
  const meta =
    envelope.meta && typeof envelope.meta === "object"
      ? (envelope.meta as Record<string, unknown>)
      : null;
  const metaStatus = asString(meta?.redTeamStatus);
  const redTeamText = asString(envelope.redTeam);

  if (metaStatus === "completed" || metaStatus === "failed" || metaStatus === "skipped") {
    return {
      redTeamStatus: metaStatus as RedTeamStatus,
      redTeamError: asString(meta?.redTeamError) || null,
    };
  }

  if ("primary" in envelope || "redTeam" in envelope || "meta" in envelope) {
    return {
      redTeamStatus: redTeamText
        ? ("completed" as RedTeamStatus)
        : record.modelUsed?.startsWith("mock:")
          ? ("skipped" as RedTeamStatus)
          : ("failed" as RedTeamStatus),
      redTeamError: null,
    };
  }

  return {
    redTeamStatus: record.modelUsed?.startsWith("mock:")
      ? ("skipped" as RedTeamStatus)
      : ("unknown" as RedTeamStatus),
    redTeamError: null,
  };
}

function buildRetryTokenBudget(initialBudget: number, attemptIndex: number) {
  return Math.min(initialBudget + attemptIndex * 1_800, MAX_ANALYSIS_TOKENS);
}

function buildRetryDetailLines(previousError: AnalysisOutputError) {
  const detailLines: string[] = [];
  const details = previousError.details || {};

  if (previousError.code === "verbose-reframing") {
    const reframedQuestion = asString(details.reframedQuestion);
    const wordCount = typeof details.wordCount === "number" ? details.wordCount : null;

    detailLines.push("Rewrite the reframed question as one short thesis sentence.");
    if (wordCount) {
      detailLines.push(`Keep the reframed question under ${MAX_REFRAMED_QUESTION_WORDS} words, not ${wordCount}.`);
    }
    if (reframedQuestion) {
      detailLines.push(`Do not reuse this verbose phrasing: "${reframedQuestion}".`);
    }
  }

  if (previousError.code === "missing-sections") {
    const missingSections = Array.isArray(details.missingSections)
      ? details.missingSections
      : [];

    if (missingSections.length > 0) {
      detailLines.push(`Include these missing top-level sections: ${missingSections.join(", ")}.`);
    }
  }

  if (previousError.code === "change-my-mind-format") {
    const invalidConditions = Array.isArray(details.invalidConditions)
      ? details.invalidConditions
      : [];

    detailLines.push('Rewrite change-my-mind conditions in this exact format: IF [observable condition] -> [thesis or assumption fails].');
    for (const condition of invalidConditions.slice(0, 4)) {
      if (typeof condition === "string" && condition.trim()) {
        detailLines.push(`Replace this vague or malformed condition: "${condition}".`);
      }
    }
  }

  if (previousError.code === "lens-driver-overlap") {
    const duplicateDrivers = Array.isArray(details.duplicateDrivers)
      ? details.duplicateDrivers
      : [];

    for (const duplicate of duplicateDrivers.slice(0, 4)) {
      if (!duplicate || typeof duplicate !== "object") {
        continue;
      }

      const record = duplicate as Record<string, unknown>;
      const driver = asString(record.driver);
      const firstLens = asString(record.firstLens);
      const secondLens = asString(record.secondLens);

      if (driver && firstLens && secondLens) {
        detailLines.push(
          `Do not repeat driver "${driver}" across both "${firstLens}" and "${secondLens}".`,
        );
      }
    }
  }

  if (previousError.code === "scenario-overlap") {
    const scenarioPairs = Array.isArray(details.scenarioPairs) ? details.scenarioPairs : [];
    const duplicateScenarioNames = Array.isArray(details.duplicateScenarioNames)
      ? details.duplicateScenarioNames
      : [];

    if (duplicateScenarioNames.length > 0) {
      detailLines.push(
        `Rename and differentiate these duplicate scenarios: ${duplicateScenarioNames.join(", ")}.`,
      );
    }
    if (scenarioPairs.length > 0) {
      detailLines.push(
        `Separate these overlapping scenario pairs by causal path and evidence signature: ${scenarioPairs.join("; ")}.`,
      );
    }
  }

  if (previousError.code === "hidden-variable-overlap") {
    const recycledHiddenVariables = Array.isArray(details.recycledHiddenVariables)
      ? details.recycledHiddenVariables
      : [];

    if (recycledHiddenVariables.length > 0) {
      detailLines.push(
        `Replace these recycled hidden variables with underappreciated factors: ${recycledHiddenVariables.join("; ")}.`,
      );
    }
  }

  if (previousError.code === "bottom-line-thresholding") {
    const missingLabels = Array.isArray(details.missingLabels) ? details.missingLabels : [];

    if (missingLabels.length > 0) {
      detailLines.push(
        `The bottom line must include these exact labels: ${missingLabels.map((label) => `${label}:`).join(", ")}.`,
      );
    }
  }

  if (previousError.code === "monitor-operationality") {
    const monitoringSignalCount =
      typeof details.monitoringSignalCount === "number"
        ? details.monitoringSignalCount
        : null;
    const watchlistCount =
      typeof details.watchlistCount === "number" ? details.watchlistCount : null;
    const changeConditionCount =
      typeof details.changeConditionCount === "number" ? details.changeConditionCount : null;
    const confirmCount =
      typeof details.confirmCount === "number" ? details.confirmCount : null;
    const disconfirmCount =
      typeof details.disconfirmCount === "number" ? details.disconfirmCount : null;
    const missingBottomLineLabels = Array.isArray(details.missingBottomLineLabels)
      ? details.missingBottomLineLabels
      : [];

    detailLines.push("Treat monitor mode as an operational surveillance surface, not forecast-lite.");
    detailLines.push("Use current_stance, monitoring_signals, review_cadence, confirm_current_view, disconfirm_current_view, what_to_ignore, and a tight watchlist.");
    if (monitoringSignalCount !== null) {
      detailLines.push(`Return 3 to 5 monitoring signals, not ${monitoringSignalCount}.`);
    }
    if (watchlistCount !== null) {
      detailLines.push(`Return 4 to 6 watchlist items, not ${watchlistCount}.`);
    }
    if (changeConditionCount !== null) {
      detailLines.push(`Return 2 to 4 sharp change-my-mind conditions, not ${changeConditionCount}.`);
    }
    if (confirmCount !== null) {
      detailLines.push(`Return at least 2 confirm_current_view items, not ${confirmCount}.`);
    }
    if (disconfirmCount !== null) {
      detailLines.push(`Return at least 2 disconfirm_current_view items, not ${disconfirmCount}.`);
    }
    if (missingBottomLineLabels.length > 0) {
      detailLines.push(
        `Include these monitor bottom-line labels: ${missingBottomLineLabels.map((label) => `${label}:`).join(", ")}.`,
      );
    }
  }

  if (previousError.code === "schema-validation") {
    const issues = Array.isArray(details.issues) ? details.issues : [];

    for (const issue of issues.slice(0, 6)) {
      if (!issue || typeof issue !== "object") {
        continue;
      }

      const record = issue as Record<string, unknown>;
      const path = asString(record.path, "root");
      const message = asString(record.message);

      if (message) {
        detailLines.push(`Fix schema issue at ${path}: ${message}.`);
      }
    }
  }

  if (previousError.code === "evidence-grounding") {
    const issues = Array.isArray(details.issues) ? details.issues : [];

    detailLines.push("Align all source-backed current claims strictly to the Evidence block.");
    detailLines.push('If a point is not directly supported by evidence, label it "Structural reasoning only:" or remove it.');

    for (const issue of issues.slice(0, 4)) {
      if (!issue || typeof issue !== "object") {
        continue;
      }

      const record = issue as Record<string, unknown>;
      const field = asString(record.field, "unknown field");
      const message = asString(record.message);
      const excerpt = asString(record.excerpt);

      if (message) {
        detailLines.push(`Fix grounding issue at ${field}: ${message}`);
      }
      if (excerpt) {
        detailLines.push(`Problem excerpt: "${excerpt}".`);
      }
    }
  }

  if (previousError.code === "truncated-output") {
    detailLines.push("Reduce verbosity in lens cases and scenario descriptions before cutting required sections.");
    detailLines.push("Finish every array and close the final JSON object.");
  }

  return detailLines.length > 0
    ? detailLines
    : ["Fix the specific structural or quality issue and return the full schema."];
}

function buildRetryPrompt(basePrompt: string, previousError: AnalysisOutputError) {
  const detailLines = buildRetryDetailLines(previousError);

  return `${basePrompt}

Retry instructions:
- The previous attempt failed because: ${previousError.message}
- Fix these specific issues from the failed attempt:
${detailLines.map((line) => `- ${line}`).join("\n")}
- Return the complete JSON object with every required top-level field present.
- Keep the output concise, but do not omit sections to save space.
- Close every array and the final JSON object properly.`;
}

function toUserFacingAnalysisError(error: AnalysisOutputError) {
  if (error.code === "truncated-output") {
    return new Error(
      "The model response was truncated before the full structured analysis completed. Regenerate or increase the output token budget.",
    );
  }

  if (error.code === "missing-sections" || error.code === "schema-validation") {
    return new Error(
      "The model returned an incomplete structured analysis. Regenerate to try again.",
    );
  }

  return new Error(error.message);
}

async function buildAnalysisFromResponse({
  rawText,
  finishReason,
  input,
  allowRepair,
}: {
  rawText: string;
  finishReason: string | null;
  input: AnalysisInput;
  allowRepair: boolean;
}) {
  const parsedCandidate = parseModelOutput(rawText, allowRepair);
  assertRequiredSections(parsedCandidate, input);
  const analysis = validateAnalysisOutput(parsedCandidate, input);
  assertOutputNotTruncated(rawText, finishReason);
  assertAnalysisQualityHeuristics(analysis, input);
  return analysis;
}

function parseRedTeamReview(
  candidate: unknown,
  primaryAnalysis: StructuredAnalysis,
) {
  const record =
    candidate && typeof candidate === "object"
      ? (candidate as Record<string, unknown>)
      : {};

  const normalized = {
    weakest_claims: asStringArray(record.weakest_claims).slice(0, RED_TEAM_MAX_WEAK_CLAIMS),
    revised_change_my_mind_conditions: (() => {
      const candidateConditions = asStringArray(record.revised_change_my_mind_conditions).slice(
        0,
        RED_TEAM_MAX_CHANGE_CONDITIONS,
      );

      return candidateConditions.length >= 3
        ? candidateConditions
        : primaryAnalysis.change_my_mind_conditions.slice(0, RED_TEAM_MAX_CHANGE_CONDITIONS);
    })(),
    revised_watchlist: (() => {
      const candidateWatchlist = asStringArray(record.revised_watchlist).slice(
        0,
        RED_TEAM_MAX_WATCHLIST_ITEMS,
      );

      return candidateWatchlist.length >= 4
        ? candidateWatchlist
        : primaryAnalysis.watchlist.slice(0, RED_TEAM_MAX_WATCHLIST_ITEMS);
    })(),
    revised_bottom_line:
      asString(record.revised_bottom_line) || primaryAnalysis.bottom_line,
  };

  try {
    return RedTeamReviewSchema.parse(normalized);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AnalysisOutputError(
        `Red-team output failed validation: ${formatZodIssues(error)}`,
        {
          code: "red-team-validation",
          retryable: false,
          details: {
            issues: error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
        },
      );
    }

    throw error;
  }
}

async function runRedTeamPass(
  input: AnalysisInput,
  analysis: StructuredAnalysis,
  settings: AppSettingsValues,
  evidenceSnapshot: EvidenceItem[],
) {
  const { systemPrompt, userPrompt } = buildRedTeamPrompts(input, analysis, evidenceSnapshot);
  const response = await generateStructuredJson({
    model: settings.model,
    systemPrompt,
    userPrompt,
    temperature: Math.min(settings.temperature, 0.1),
    maxTokens: Math.min(Math.max(850, Math.floor(settings.maxTokens * 0.2)), 1_200),
  });
  const parsedCandidate = parseModelOutput(response.text, true);
  const review = parseRedTeamReview(parsedCandidate, analysis);

  return {
    analysis: {
      ...analysis,
      change_my_mind_conditions: review.revised_change_my_mind_conditions,
      bottom_line: review.revised_bottom_line,
      watchlist: review.revised_watchlist,
    },
    rawText: response.text,
  };
}

export async function runAnalysis(
  input: AnalysisInput,
  settings: AppSettingsValues,
): Promise<{
  analysis: StructuredAnalysis;
  rawText: string;
  promptVersion: string;
  modelUsed: string;
  evidenceSnapshot: EvidenceItem[];
  evidenceSources: SourceSummary[];
  groundingValidation: ReturnType<typeof validateAnalysisAgainstEvidence> | null;
}> {
  const runtimeMode = getAnalysisRuntimeMode();

  if (runtimeMode.mockModeActive) {
    const mockResult = buildMockAnalysisResult(input);
    const pilotEligible =
      settings.liveDataEnabled &&
      getEligibleSourcesForDomain({
        domain: input.domain,
        liveDataEnabled: settings.liveDataEnabled,
      }).length > 0;

    return {
      ...mockResult,
      promptVersion: resolveAnalysisPromptVersion({
        domain: input.domain,
        liveDataEnabled: settings.liveDataEnabled,
        pilotEligible,
      }),
      rawText: buildRawResponseEnvelope({
        primary: mockResult.rawText,
        redTeam: null,
        redTeamStatus: "skipped",
        redTeamError: "Mock mode skips the live red-team pass.",
      }),
      evidenceSnapshot: [],
      evidenceSources: [],
      groundingValidation: null,
    };
  }

  const { evidenceSnapshot, evidenceSources, pilotEligible } = await collectPilotEvidence(
    input,
    settings,
  );
  const { systemPrompt, userPrompt } = await buildPrompts(
    input,
    settings,
    evidenceSnapshot,
  );
  let lastOutputError: AnalysisOutputError | null = null;

  for (let attemptIndex = 0; attemptIndex < MAX_ANALYSIS_RETRIES; attemptIndex += 1) {
    const maxTokens = buildRetryTokenBudget(settings.maxTokens, attemptIndex);
    const attemptPrompt =
      attemptIndex === 0 || !lastOutputError
        ? userPrompt
        : buildRetryPrompt(userPrompt, lastOutputError);

    try {
      const response = await generateStructuredJson({
        model: settings.model,
        systemPrompt,
        userPrompt: attemptPrompt,
        temperature: settings.temperature,
        maxTokens,
      });
      const primaryAnalysis = await buildAnalysisFromResponse({
        rawText: response.text,
        finishReason: response.finishReason,
        input,
        allowRepair: settings.schemaMode === "strict-json-repair",
      });

      let finalAnalysis = primaryAnalysis;
      let redTeamRawText = "";
      let redTeamStatus: RedTeamStatus = "completed";
      let redTeamError: string | null = null;

      try {
        const redTeamResult = await runRedTeamPass(
          input,
          primaryAnalysis,
          settings,
          evidenceSnapshot,
        );
        finalAnalysis = redTeamResult.analysis;
        redTeamRawText = redTeamResult.rawText;
      } catch (error) {
        redTeamStatus = "failed";
        redTeamError =
          error instanceof Error ? error.message : "Red-team pass failed.";
        logServerError("analysis.red_team_failed", error, {
          model: settings.model,
          question: input.question,
        });
      }

      const groundingValidation =
        settings.liveDataEnabled && isCryptoPilotDomain(input.domain)
          ? validateAnalysisAgainstEvidence({
              analysis: finalAnalysis,
              evidenceSnapshot,
              sourceSummaries: evidenceSources,
            })
          : null;

      if (groundingValidation?.status === "fail") {
        throw new AnalysisOutputError(
          "Generated analysis failed the live-data grounding validator.",
          {
            code: "evidence-grounding",
            retryable: true,
            details: {
              issues: groundingValidation.issues,
            },
          },
        );
      }

      return {
        analysis: finalAnalysis,
        rawText: buildRawResponseEnvelope({
          primary: response.text,
          redTeam: redTeamRawText || null,
          redTeamStatus,
          redTeamError,
        }),
        promptVersion: resolveAnalysisPromptVersion({
          domain: input.domain,
          liveDataEnabled: settings.liveDataEnabled,
          pilotEligible,
        }),
        modelUsed: settings.model,
        evidenceSnapshot,
        evidenceSources,
        groundingValidation,
      };
    } catch (error) {
      if (error instanceof AnalysisOutputError) {
        lastOutputError = error;
        logServerError("analysis.attempt_failed", error, {
          attempt: attemptIndex + 1,
          maxTokens,
          model: settings.model,
          question: input.question,
          details: error.details,
        });

        if (!error.retryable || attemptIndex === MAX_ANALYSIS_RETRIES - 1) {
          throw toUserFacingAnalysisError(error);
        }

        continue;
      }

      logServerError("analysis.llm_failure", error, {
        attempt: attemptIndex + 1,
        maxTokens,
        model: settings.model,
        question: input.question,
      });
      throw error;
    }
  }

  throw new Error("Unable to complete the structured analysis.");
}

export function buildAnalysisRecordInput(
  input: AnalysisInput,
  analysis: StructuredAnalysis,
  rawText: string,
  meta: {
    modelUsed: string;
    promptVersion: string;
    evidenceSnapshot?: EvidenceItem[] | null;
    evidenceSources?: SourceSummary[] | null;
    groundingValidation?: ReturnType<typeof validateAnalysisAgainstEvidence> | null;
  },
) {
  const monitorAnalysis = isMonitorAnalysis(analysis) ? analysis : null;

  return {
    title: analysis.title,
    originalQuestion: input.question,
    reframedQuestion: analysis.reframed_question,
    timeHorizon: analysis.time_horizon || null,
    objective: analysis.objective || null,
    selectedDomain: input.domain || null,
    definitionsJson: JSON.stringify(analysis.definitions),
    domainsJson: JSON.stringify(analysis.domains),
    keyDriversJson: JSON.stringify(analysis.key_drivers),
    lensesJson: JSON.stringify(analysis.lenses),
    scenariosJson: JSON.stringify(analysis.scenarios),
    currentStance: monitorAnalysis?.current_stance || null,
    monitorSignalsJson: monitorAnalysis
      ? JSON.stringify(monitorAnalysis.monitoring_signals)
      : null,
    reviewCadence: monitorAnalysis?.review_cadence || null,
    confirmCurrentJson: monitorAnalysis
      ? JSON.stringify(monitorAnalysis.confirm_current_view)
      : null,
    disconfirmCurrentJson: monitorAnalysis
      ? JSON.stringify(monitorAnalysis.disconfirm_current_view)
      : null,
    ignoreNoiseJson: monitorAnalysis
      ? JSON.stringify(monitorAnalysis.what_to_ignore)
      : null,
    hiddenVariablesJson: JSON.stringify(analysis.hidden_variables),
    changeMyMindJson: JSON.stringify(analysis.change_my_mind_conditions),
    bottomLine: analysis.bottom_line,
    watchlistJson: JSON.stringify(analysis.watchlist),
    evidenceSnapshotJson: serializeEvidenceSnapshot(meta.evidenceSnapshot),
    evidenceSourcesJson: serializeSourceSummaries(meta.evidenceSources),
    groundingValidationJson: serializeGroundingValidationReport(meta.groundingValidation),
    rawResponseJson: rawText,
    modelUsed: meta.modelUsed,
    promptVersion: meta.promptVersion,
  };
}

export type AnalysisReviewRow = AnalysisReview;

const OUTCOME_LABELS: readonly OutcomeLabel[] = ["mostly_right", "mixed", "wrong"];
const TRIGGER_STATES: readonly TriggerState[] = ["yes", "no", "unknown"];
const WATCHLIST_TRIGGER_STATES: readonly WatchlistTriggerState[] = [
  "yes",
  "no",
  "partially",
  "unknown",
];

function coerceOutcomeLabel(value: string | null): OutcomeLabel | null {
  if (!value) return null;
  return OUTCOME_LABELS.includes(value as OutcomeLabel) ? (value as OutcomeLabel) : null;
}

function coerceTriggerState(value: string | null): TriggerState | null {
  if (!value) return null;
  return TRIGGER_STATES.includes(value as TriggerState) ? (value as TriggerState) : null;
}

function coerceWatchlistTriggerState(
  value: string | null,
): WatchlistTriggerState | null {
  if (!value) return null;
  return WATCHLIST_TRIGGER_STATES.includes(value as WatchlistTriggerState)
    ? (value as WatchlistTriggerState)
    : null;
}

export function parseAnalysisReviewRow(
  row: AnalysisReviewRow,
): AnalysisReviewRecord {
  return {
    id: row.id,
    analysisId: row.analysisId,
    outcomeLabel: coerceOutcomeLabel(row.outcomeLabel),
    realizedScenario: row.realizedScenario,
    downgradeTriggered: coerceTriggerState(row.downgradeTriggered),
    upgradeTriggered: coerceTriggerState(row.upgradeTriggered),
    watchlistTriggered: coerceWatchlistTriggerState(row.watchlistTriggered),
    reviewNotes: row.reviewNotes,
    reviewedAt: row.reviewedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function buildReviewSummary(
  row: AnalysisReviewRow | null,
): AnalysisReviewSummary {
  if (!row) {
    return {
      reviewed: false,
      outcomeLabel: null,
      realizedScenario: null,
      reviewedAt: null,
    };
  }
  return {
    reviewed: true,
    outcomeLabel: coerceOutcomeLabel(row.outcomeLabel),
    realizedScenario: row.realizedScenario,
    reviewedAt: row.reviewedAt.toISOString(),
  };
}

export function parseAnalysisSummaryRecord(
  record: Analysis & { review?: AnalysisReviewRow | null },
): AnalysisSummary {
  return {
    id: record.id,
    title: record.title,
    originalQuestion: record.originalQuestion,
    reframedQuestion: record.reframedQuestion,
    domains: parseStoredJson<string[]>("analysis domains", record.domainsJson),
    createdAt: record.createdAt.toISOString(),
    review: buildReviewSummary(record.review ?? null),
  };
}

export function parseAnalysisRecord(
  record:
    | Analysis
    | AnalysisWithFollowUpsRecord
    | (AnalysisWithFollowUpsRecord & { review?: AnalysisReviewRow | null }),
): PersistedAnalysisRecord {
  const rawResponse = parseStoredRawResponse(record);
  const followUps =
    "followUps" in record && Array.isArray(record.followUps)
      ? record.followUps.map(parseAnalysisFollowUpRecord)
      : [];
  const reviewRow =
    "review" in record && record.review ? (record.review as AnalysisReviewRow) : null;
  const review = reviewRow ? parseAnalysisReviewRow(reviewRow) : null;

  const storedMonitorSignals = record.monitorSignalsJson
    ? parseStoredJson<MonitorStructuredAnalysis["monitoring_signals"]>(
        "analysis monitoring signals",
        record.monitorSignalsJson,
      )
    : [];
  const storedConfirmCurrent = record.confirmCurrentJson
    ? parseStoredJson<string[]>("analysis confirm-current-view", record.confirmCurrentJson)
    : [];
  const storedDisconfirmCurrent = record.disconfirmCurrentJson
    ? parseStoredJson<string[]>("analysis disconfirm-current-view", record.disconfirmCurrentJson)
    : [];
  const storedIgnoreNoise = record.ignoreNoiseJson
    ? parseStoredJson<string[]>("analysis ignore-noise", record.ignoreNoiseJson)
    : [];

  return {
    id: record.id,
    title: record.title,
    notes: record.notes,
    modelUsed: record.modelUsed,
    promptVersion: record.promptVersion,
    originalQuestion: record.originalQuestion,
    selectedDomain: record.selectedDomain,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    redTeamStatus: rawResponse.redTeamStatus,
    redTeamError: rawResponse.redTeamError,
    evidenceSnapshot: parseEvidenceSnapshotJson(record.evidenceSnapshotJson),
    evidenceSources: parseSourceSummariesJson(record.evidenceSourcesJson),
    groundingValidation: parseGroundingValidationJson(record.groundingValidationJson),
    followUps,
    review,
    analysis: (() => {
      const baseAnalysis = {
        title: record.title,
        original_question: record.originalQuestion,
        reframed_question: record.reframedQuestion,
        time_horizon: record.timeHorizon || "",
        objective: record.objective || "",
        definitions: parseStoredJson("analysis definitions", record.definitionsJson),
        domains: parseStoredJson("analysis domains", record.domainsJson),
        key_drivers: parseStoredJson("analysis key drivers", record.keyDriversJson),
        hidden_variables: parseStoredJson(
          "analysis hidden variables",
          record.hiddenVariablesJson,
        ),
        change_my_mind_conditions: parseStoredJson(
          "analysis change-my-mind conditions",
          record.changeMyMindJson,
        ),
        bottom_line: record.bottomLine,
        watchlist: parseStoredJson("analysis watchlist", record.watchlistJson),
      };

      if (
        isMonitorObjective(record.objective || "") &&
        record.currentStance &&
        storedMonitorSignals.length > 0
      ) {
        return MonitorAnalysisOutputSchema.parse({
          ...baseAnalysis,
          current_stance: record.currentStance,
          monitoring_signals: storedMonitorSignals,
          review_cadence: record.reviewCadence || "",
          confirm_current_view: storedConfirmCurrent,
          disconfirm_current_view: storedDisconfirmCurrent,
          what_to_ignore: storedIgnoreNoise,
          lenses: [],
          scenarios: [],
        });
      }

      return StandardAnalysisOutputSchema.parse({
        ...baseAnalysis,
        lenses: parseStoredJson("analysis lenses", record.lensesJson),
        scenarios: parseStoredJson("analysis scenarios", record.scenariosJson),
      });
    })(),
  };
}

export function isPrismaNotFoundError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025"
  );
}

export function logDbWriteFailure(
  event: string,
  error: unknown,
  details?: Record<string, unknown>,
) {
  logServerError(event, error, details);
}

export function logDbReadFailure(
  event: string,
  error: unknown,
  details?: Record<string, unknown>,
) {
  logServerError(event, error, details);
}
