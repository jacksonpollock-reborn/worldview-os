import type { StructuredAnalysis } from "@/types/analysis";
import type { EvidenceItem, SourceSummary } from "@/lib/sources/types";

export type GroundingValidationIssue = {
  code:
    | "unsupported_current_claim"
    | "unsupported_numeric_claim"
    | "freshness_overstatement"
    | "overconfident_stale_or_unavailable";
  severity: "error" | "warning";
  field: string;
  message: string;
  excerpt: string;
};

export type GroundingValidationReport = {
  status: "pass" | "fail" | "not_applicable";
  checked_at: string;
  issue_count: number;
  issues: GroundingValidationIssue[];
};

const FRESHNESS_TERMS_PATTERN =
  /\b(current|currently|live|latest|recent|today|now|right now)\b/i;
const LIVE_ONLY_TERMS_PATTERN = /\b(live|currently|right now|latest|today|now)\b/i;
const SOURCE_METRIC_TERMS_PATTERN =
  /\b(price|volume|market cap|market capitalization|change|spot|momentum|trading volume|btc\/usd|bitcoin)\b/i;
const STRUCTURAL_REASONING_PREFIX = "structural reasoning only:";

type NarrativeField = {
  field: string;
  value: string;
  numericStrict: boolean;
  freshnessStrict: boolean;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function collectNarrativeFields(analysis: StructuredAnalysis) {
  const fields: NarrativeField[] = [];

  fields.push({
    field: "bottom_line",
    value: analysis.bottom_line,
    numericStrict: false,
    freshnessStrict: true,
  });

  analysis.watchlist.forEach((item, index) => {
    fields.push({
      field: `watchlist[${index}]`,
      value: item,
      numericStrict: false,
      freshnessStrict: true,
    });
  });

  if ("monitoring_signals" in analysis) {
    fields.push({
      field: "current_stance",
      value: analysis.current_stance,
      numericStrict: false,
      freshnessStrict: true,
    });

    analysis.monitoring_signals.forEach((signal, index) => {
      fields.push({
        field: `monitoring_signals[${index}].current_read`,
        value: signal.current_read,
        numericStrict: true,
        freshnessStrict: true,
      });
    });

    analysis.confirm_current_view.forEach((item, index) => {
      fields.push({
        field: `confirm_current_view[${index}]`,
        value: item,
        numericStrict: false,
        freshnessStrict: true,
      });
    });

    analysis.disconfirm_current_view.forEach((item, index) => {
      fields.push({
        field: `disconfirm_current_view[${index}]`,
        value: item,
        numericStrict: false,
        freshnessStrict: true,
      });
    });
  } else {
    analysis.lenses.forEach((lens, lensIndex) => {
      lens.evidence_for.forEach((item, itemIndex) => {
        fields.push({
          field: `lenses[${lensIndex}].evidence_for[${itemIndex}]`,
          value: item,
          numericStrict: true,
          freshnessStrict: true,
        });
      });

      lens.evidence_against.forEach((item, itemIndex) => {
        fields.push({
          field: `lenses[${lensIndex}].evidence_against[${itemIndex}]`,
          value: item,
          numericStrict: true,
          freshnessStrict: true,
        });
      });
    });

    analysis.scenarios.forEach((scenario, index) => {
      fields.push({
        field: `scenarios[${index}].description`,
        value: scenario.description,
        numericStrict: false,
        freshnessStrict: true,
      });
    });
  }

  return fields.filter((field) => field.value.trim().length > 0);
}

function flattenEvidenceNumbers(value: unknown, result: number[] = []) {
  if (typeof value === "number" && Number.isFinite(value)) {
    result.push(value);
    return result;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => flattenEvidenceNumbers(item, result));
    return result;
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => flattenEvidenceNumbers(item, result));
  }

  return result;
}

function parseSignedNumericLiteral(literal: string) {
  const match = literal.trim().match(/^([+-])?([\d,.]+)([kmbt])?(%)?$/i);

  if (!match) {
    return null;
  }

  const [, sign, rawNumber, suffix, percent] = match;
  const base = Number(rawNumber.replace(/,/g, ""));

  if (Number.isNaN(base)) {
    return null;
  }

  const multiplier = (() => {
    switch ((suffix || "").toUpperCase()) {
      case "K":
        return 1_000;
      case "M":
        return 1_000_000;
      case "B":
        return 1_000_000_000;
      case "T":
        return 1_000_000_000_000;
      default:
        return 1;
    }
  })();

  const signed = (sign === "-" ? -1 : 1) * base * multiplier;

  return percent ? signed : signed;
}

function sanitizeNumericExtractionText(value: string) {
  return value
    .replace(/\b\d{4}-\d{2}-\d{2}(?:[t\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?z?)?\b/gi, " ")
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?(?:\s?[ap]m)?\b/gi, " ")
    .replace(/\b\d{1,3}-(?:hour|day|week|month|year)\b/gi, " ");
}

function extractComparableNumbers(value: string) {
  const matches =
    sanitizeNumericExtractionText(value).match(
      /[$€£]?\s*[+-]?\d[\d,.]*(?:\.\d+)?\s*(?:[KMBT])?%?/gi,
    ) || [];

  return matches
    .map((match) => match.replace(/[$€£\s]/g, ""))
    .map(parseSignedNumericLiteral)
    .filter((number): number is number => typeof number === "number" && Number.isFinite(number));
}

function numberMatchesEvidence(candidate: number, evidenceNumbers: number[]) {
  return evidenceNumbers.some((evidenceNumber) => {
    const absoluteDifference = Math.abs(candidate - evidenceNumber);
    const tolerance = Math.max(0.5, Math.abs(evidenceNumber) * 0.02);

    return absoluteDifference <= tolerance;
  });
}

function buildIssue(
  issue: Omit<GroundingValidationIssue, "excerpt"> & { excerpt: string },
): GroundingValidationIssue {
  return {
    ...issue,
    excerpt: normalizeWhitespace(issue.excerpt).slice(0, 220),
  };
}

export function validateAnalysisAgainstEvidence(input: {
  analysis: StructuredAnalysis;
  evidenceSnapshot: EvidenceItem[];
  sourceSummaries?: SourceSummary[];
}) {
  const checkedAt = new Date().toISOString();
  const evidenceSnapshot = input.evidenceSnapshot || [];
  const sourceSummaries = input.sourceSummaries || [];

  if (evidenceSnapshot.length === 0 && sourceSummaries.length === 0) {
    return {
      status: "not_applicable",
      checked_at: checkedAt,
      issue_count: 0,
      issues: [],
    } as GroundingValidationReport;
  }

  const fields = collectNarrativeFields(input.analysis);
  const evidenceNumbers = evidenceSnapshot.flatMap((item) => flattenEvidenceNumbers(item.raw_value));
  const hasLiveEvidence = evidenceSnapshot.some((item) => item.freshness === "live");
  const hasRecentEvidence = evidenceSnapshot.some((item) => item.freshness === "recent");
  const hasRecentOrLiveEvidence = hasRecentEvidence || hasLiveEvidence;
  const hasStaleOrUnavailableSource = sourceSummaries.some(
    (summary) => summary.freshness === "stale" || summary.freshness === "unavailable",
  );
  const issues: GroundingValidationIssue[] = [];

  for (const field of fields) {
    const normalizedValue = field.value.trim();
    const isStructuralOnly = normalizedValue
      .toLowerCase()
      .startsWith(STRUCTURAL_REASONING_PREFIX);
    const hasFreshnessLanguage = FRESHNESS_TERMS_PATTERN.test(normalizedValue);
    const hasLiveOnlyLanguage = LIVE_ONLY_TERMS_PATTERN.test(normalizedValue);
    const hasSourceMetricLanguage = SOURCE_METRIC_TERMS_PATTERN.test(normalizedValue);

    if (
      field.freshnessStrict &&
      hasFreshnessLanguage &&
      !isStructuralOnly &&
      ((!hasLiveEvidence && !hasRecentOrLiveEvidence) ||
        (hasLiveOnlyLanguage && !hasLiveEvidence))
    ) {
      issues.push(
        buildIssue({
          code: "unsupported_current_claim",
          severity: "error",
          field: field.field,
          message:
            "The analysis used freshness-sensitive language that is not supported by the available evidence freshness.",
          excerpt: normalizedValue,
        }),
      );
    }

    if (field.numericStrict && !isStructuralOnly && hasSourceMetricLanguage) {
      const extractedNumbers = extractComparableNumbers(normalizedValue);

      for (const extractedNumber of extractedNumbers) {
        if (!numberMatchesEvidence(extractedNumber, evidenceNumbers)) {
          issues.push(
            buildIssue({
              code: "unsupported_numeric_claim",
              severity: "error",
              field: field.field,
              message:
                "The analysis included a source-like numeric value that does not match the persisted evidence snapshot.",
              excerpt: normalizedValue,
            }),
          );
          break;
        }
      }
    }

    if (
      hasFreshnessLanguage &&
      !isStructuralOnly &&
      ((!hasRecentOrLiveEvidence && /recent/i.test(normalizedValue)) ||
        (!hasLiveEvidence && /live|currently|latest|today|now|right now/i.test(normalizedValue)))
    ) {
      issues.push(
        buildIssue({
          code: "freshness_overstatement",
          severity: "error",
          field: field.field,
          message:
            "The analysis appears to overstate freshness relative to the persisted evidence snapshot.",
          excerpt: normalizedValue,
        }),
      );
    }

    if (
      hasStaleOrUnavailableSource &&
      !isStructuralOnly &&
      hasSourceMetricLanguage &&
      /confirms|clearly|definitive|proves|certainly/i.test(normalizedValue) &&
      !hasLiveEvidence
    ) {
      issues.push(
        buildIssue({
          code: "overconfident_stale_or_unavailable",
          severity: "warning",
          field: field.field,
          message:
            "The analysis sounds too confident despite stale or unavailable source coverage.",
          excerpt: normalizedValue,
        }),
      );
    }
  }

  return {
    status: issues.some((issue) => issue.severity === "error") ? "fail" : "pass",
    checked_at: checkedAt,
    issue_count: issues.length,
    issues,
  } satisfies GroundingValidationReport;
}

export function serializeGroundingValidationReport(
  report: GroundingValidationReport | null | undefined,
) {
  return report ? JSON.stringify(report) : null;
}

export function parseGroundingValidationJson(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = JSON.parse(value) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Stored grounding validation data is invalid JSON.");
  }

  const record = parsed as Record<string, unknown>;
  const status =
    record.status === "pass" || record.status === "fail" || record.status === "not_applicable"
      ? record.status
      : null;
  const checkedAt =
    typeof record.checked_at === "string" && record.checked_at.trim()
      ? record.checked_at.trim()
      : null;
  const issues = Array.isArray(record.issues)
    ? record.issues
        .map((issue) => {
          if (!issue || typeof issue !== "object") {
            return null;
          }

          const issueRecord = issue as Record<string, unknown>;
          const code =
            issueRecord.code === "unsupported_current_claim" ||
            issueRecord.code === "unsupported_numeric_claim" ||
            issueRecord.code === "freshness_overstatement" ||
            issueRecord.code === "overconfident_stale_or_unavailable"
              ? issueRecord.code
              : null;
          const severity =
            issueRecord.severity === "error" || issueRecord.severity === "warning"
              ? issueRecord.severity
              : null;
          const field =
            typeof issueRecord.field === "string" ? issueRecord.field.trim() : "";
          const message =
            typeof issueRecord.message === "string" ? issueRecord.message.trim() : "";
          const excerpt =
            typeof issueRecord.excerpt === "string" ? issueRecord.excerpt.trim() : "";

          if (!code || !severity || !field || !message) {
            return null;
          }

          return {
            code,
            severity,
            field,
            message,
            excerpt,
          } satisfies GroundingValidationIssue;
        })
        .filter((issue): issue is GroundingValidationIssue => Boolean(issue))
    : [];

  if (!status || !checkedAt) {
    throw new Error("Stored grounding validation data is invalid JSON.");
  }

  return {
    status,
    checked_at: checkedAt,
    issue_count:
      typeof record.issue_count === "number" && Number.isFinite(record.issue_count)
        ? record.issue_count
        : issues.length,
    issues,
  } satisfies GroundingValidationReport;
}
