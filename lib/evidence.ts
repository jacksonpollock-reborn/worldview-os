import {
  COINGECKO_BTC_MARKET_SOURCE_ID,
  COINGECKO_BTC_SIMPLE_SOURCE_ID,
  getSourceRegistration,
} from "@/lib/sources/source-registry";
import type {
  CoinGeckoBtcMarketData,
  CoinGeckoBtcSimplePriceData,
  EvidenceItem,
  Freshness,
  SourceResponse,
  SourceSummary,
  SupportedEvidenceSection,
} from "@/lib/sources/types";

const LIVE_WINDOW_SECONDS = 300;
const RECENT_WINDOW_SECONDS = 3_600;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatPercent(value: number) {
  const absoluteValue = Math.abs(value);
  const digits = absoluteValue >= 10 ? 1 : 2;
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function buildEvidenceId(sourceId: string, metric: string, retrievedAt: string) {
  return `${sourceId}-${metric}-${retrievedAt}`;
}

function asIsoDate(value: string | null) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

export function classifyFreshness(input: {
  retrievedAt: string;
  dataTimestamp: string | null;
  maxStalenessSeconds: number;
  servedFromCache?: boolean;
}) {
  const retrievedAtMs = new Date(input.retrievedAt).getTime();
  const dataTimestampMs = input.dataTimestamp ? new Date(input.dataTimestamp).getTime() : NaN;

  if (Number.isNaN(retrievedAtMs) || Number.isNaN(dataTimestampMs)) {
    return "unavailable" as const;
  }

  const ageSeconds = Math.max(0, Math.round((retrievedAtMs - dataTimestampMs) / 1000));

  if (ageSeconds <= LIVE_WINDOW_SECONDS) {
    return input.servedFromCache ? ("recent" as const) : ("live" as const);
  }

  if (
    ageSeconds <= RECENT_WINDOW_SECONDS &&
    ageSeconds <= input.maxStalenessSeconds
  ) {
    return "recent" as const;
  }

  return "stale" as const;
}

function buildUnavailableEvidence(
  response: SourceResponse,
  supportedSections: SupportedEvidenceSection[],
) {
  const registration = getSourceRegistration(response.source_id);
  const sourceName = registration?.source_name || response.source_id;

  return [
    {
      evidence_id: buildEvidenceId(response.source_id, "availability", response.retrieved_at),
      source_id: response.source_id,
      claim: `Source ${sourceName} was unavailable at retrieval time.`,
      evidence_type: "observed" as const,
      freshness: "unavailable" as const,
      data_timestamp: null,
      retrieved_at: response.retrieved_at,
      confidence: "low" as const,
      supported_sections: supportedSections,
      raw_value: null,
    },
  ];
}

function normalizeCoinGeckoSimpleEvidence(
  response: SourceResponse<CoinGeckoBtcSimplePriceData>,
): EvidenceItem[] {
  const registration = getSourceRegistration(response.source_id);
  const sourceName = registration?.source_name || response.source_id;
  const supportedSections: SupportedEvidenceSection[] = [
    "current_read",
    "watchlist",
    "scenarios",
    "bottom_line",
  ];

  if (!registration) {
    return buildUnavailableEvidence(response, supportedSections);
  }

  if (!response.data || response.status === "error" || response.status === "unavailable") {
    return buildUnavailableEvidence(response, supportedSections);
  }

    const freshness = classifyFreshness({
      retrievedAt: response.retrieved_at,
      dataTimestamp: response.data_timestamp,
      maxStalenessSeconds: registration.max_staleness_seconds,
      servedFromCache: response.served_from_cache,
    });

  const evidence: EvidenceItem[] = [
    {
      evidence_id: buildEvidenceId(response.source_id, "spot-price", response.retrieved_at),
      source_id: response.source_id,
      claim: `BTC/USD spot price is ${formatCurrency(response.data.price_usd)} per ${sourceName}.`,
      evidence_type: "observed",
      freshness,
      data_timestamp: response.data_timestamp,
      retrieved_at: response.retrieved_at,
      confidence: "high",
      supported_sections: supportedSections,
      raw_value: response.data.price_usd,
    },
  ];

  if (typeof response.data.price_change_24h_pct === "number") {
    evidence.push({
      evidence_id: buildEvidenceId(response.source_id, "change-24h", response.retrieved_at),
      source_id: response.source_id,
      claim: `BTC 24-hour price change is ${formatPercent(response.data.price_change_24h_pct)} per ${sourceName}.`,
      evidence_type: "observed",
      freshness,
      data_timestamp: response.data_timestamp,
      retrieved_at: response.retrieved_at,
      confidence: "high",
      supported_sections: ["current_read", "watchlist", "scenarios"],
      raw_value: response.data.price_change_24h_pct,
    });
  }

  return evidence;
}

function normalizeCoinGeckoMarketEvidence(
  response: SourceResponse<CoinGeckoBtcMarketData>,
): EvidenceItem[] {
  const registration = getSourceRegistration(response.source_id);
  const sourceName = registration?.source_name || response.source_id;
  const supportedSections: SupportedEvidenceSection[] = [
    "current_read",
    "watchlist",
    "scenarios",
    "bottom_line",
  ];

  if (!registration) {
    return buildUnavailableEvidence(response, supportedSections);
  }

  if (!response.data || response.status === "error" || response.status === "unavailable") {
    return buildUnavailableEvidence(response, supportedSections);
  }

  const freshness = classifyFreshness({
    retrievedAt: response.retrieved_at,
    dataTimestamp: response.data_timestamp,
    maxStalenessSeconds: registration.max_staleness_seconds,
    servedFromCache: response.served_from_cache,
  });
  const evidence: EvidenceItem[] = [];

  if (typeof response.data.current_price_usd === "number") {
    evidence.push({
      evidence_id: buildEvidenceId(response.source_id, "current-price", response.retrieved_at),
      source_id: response.source_id,
      claim: `BTC/USD reference price is ${formatCurrency(response.data.current_price_usd)} per ${sourceName}.`,
      evidence_type: "observed",
      freshness,
      data_timestamp: response.data_timestamp,
      retrieved_at: response.retrieved_at,
      confidence: "high",
      supported_sections: supportedSections,
      raw_value: response.data.current_price_usd,
    });
  }

  if (typeof response.data.market_cap_usd === "number") {
    evidence.push({
      evidence_id: buildEvidenceId(response.source_id, "market-cap", response.retrieved_at),
      source_id: response.source_id,
      claim: `Bitcoin market capitalization is ${formatCurrency(response.data.market_cap_usd)} per ${sourceName}.`,
      evidence_type: "observed",
      freshness,
      data_timestamp: response.data_timestamp,
      retrieved_at: response.retrieved_at,
      confidence: "high",
      supported_sections: supportedSections,
      raw_value: response.data.market_cap_usd,
    });
  }

  if (typeof response.data.total_volume_usd === "number") {
    evidence.push({
      evidence_id: buildEvidenceId(response.source_id, "total-volume", response.retrieved_at),
      source_id: response.source_id,
      claim: `Bitcoin 24-hour trading volume is ${formatCurrency(response.data.total_volume_usd)} per ${sourceName}.`,
      evidence_type: "observed",
      freshness,
      data_timestamp: response.data_timestamp,
      retrieved_at: response.retrieved_at,
      confidence: "high",
      supported_sections: supportedSections,
      raw_value: response.data.total_volume_usd,
    });
  }

  if (typeof response.data.circulating_supply === "number") {
    evidence.push({
      evidence_id: buildEvidenceId(
        response.source_id,
        "circulating-supply",
        response.retrieved_at,
      ),
      source_id: response.source_id,
      claim: `Bitcoin circulating supply is ${formatNumber(response.data.circulating_supply)} BTC per ${sourceName}.`,
      evidence_type: "observed",
      freshness,
      data_timestamp: response.data_timestamp,
      retrieved_at: response.retrieved_at,
      confidence: "high",
      supported_sections: ["scenarios", "bottom_line"],
      raw_value: response.data.circulating_supply,
    });
  }

  if (typeof response.data.ath_usd === "number") {
    evidence.push({
      evidence_id: buildEvidenceId(response.source_id, "ath", response.retrieved_at),
      source_id: response.source_id,
      claim: `Bitcoin all-time high is ${formatCurrency(response.data.ath_usd)} per ${sourceName}.`,
      evidence_type: "observed",
      freshness,
      data_timestamp: response.data.ath_date || response.data_timestamp,
      retrieved_at: response.retrieved_at,
      confidence: "high",
      supported_sections: ["scenarios", "bottom_line"],
      raw_value: {
        ath_usd: response.data.ath_usd,
        ath_date: response.data.ath_date,
      },
    });
  }

  for (const metric of [
    {
      key: "price_change_7d_pct" as const,
      label: "7-day price change",
    },
    {
      key: "price_change_14d_pct" as const,
      label: "14-day price change",
    },
    {
      key: "price_change_30d_pct" as const,
      label: "30-day price change",
    },
  ]) {
    const metricValue = response.data[metric.key];

    if (typeof metricValue !== "number") {
      continue;
    }

    evidence.push({
      evidence_id: buildEvidenceId(response.source_id, metric.key, response.retrieved_at),
      source_id: response.source_id,
      claim: `Bitcoin ${metric.label} is ${formatPercent(metricValue)} per ${sourceName}.`,
      evidence_type: "observed",
      freshness,
      data_timestamp: response.data_timestamp,
      retrieved_at: response.retrieved_at,
      confidence: "high",
      supported_sections: supportedSections,
      raw_value: metricValue,
    });
  }

  return evidence.length > 0 ? evidence : buildUnavailableEvidence(response, supportedSections);
}

export function normalizeSourceResponsesToEvidence(
  responses: Array<SourceResponse<CoinGeckoBtcSimplePriceData | CoinGeckoBtcMarketData>>,
) {
  return responses.flatMap((response) => {
    if (response.source_id === COINGECKO_BTC_SIMPLE_SOURCE_ID) {
      return normalizeCoinGeckoSimpleEvidence(
        response as SourceResponse<CoinGeckoBtcSimplePriceData>,
      );
    }

    if (response.source_id === COINGECKO_BTC_MARKET_SOURCE_ID) {
      return normalizeCoinGeckoMarketEvidence(
        response as SourceResponse<CoinGeckoBtcMarketData>,
      );
    }

    const registration = getSourceRegistration(response.source_id);
    return buildUnavailableEvidence(response, registration ? ["current_read"] : ["watchlist"]);
  });
}

export function summarizeSourceResponses(
  responses: Array<SourceResponse<CoinGeckoBtcSimplePriceData | CoinGeckoBtcMarketData>>,
): SourceSummary[] {
  return responses.map((response) => {
    const registration = getSourceRegistration(response.source_id);
    const freshness: Freshness =
      !registration || response.status === "error" || response.status === "unavailable"
        ? "unavailable"
        : classifyFreshness({
            retrievedAt: response.retrieved_at,
            dataTimestamp: response.data_timestamp,
            maxStalenessSeconds: registration.max_staleness_seconds,
            servedFromCache: response.served_from_cache,
          });

    return {
      source_id: response.source_id,
      source_name: registration?.source_name || response.source_id,
      status: response.status,
      retrieved_at: response.retrieved_at,
      data_timestamp: response.data_timestamp,
      freshness,
      staleness_seconds: response.staleness_seconds,
      error_message: response.error_message,
      served_from_cache: Boolean(response.served_from_cache),
    };
  });
}

export function serializeEvidenceSnapshot(evidence: EvidenceItem[] | null | undefined) {
  if (!evidence || evidence.length === 0) {
    return null;
  }

  return JSON.stringify(evidence);
}

export function serializeSourceSummaries(summaries: SourceSummary[] | null | undefined) {
  if (!summaries || summaries.length === 0) {
    return null;
  }

  return JSON.stringify(summaries);
}

export function parseEvidenceSnapshotJson(value: string | null | undefined) {
  if (!value) {
    return [] as EvidenceItem[];
  }

  const parsed = JSON.parse(value) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Stored evidence snapshot data is invalid JSON.");
  }

  return parsed
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const evidenceId =
        typeof record.evidence_id === "string" ? record.evidence_id.trim() : "";
      const sourceId = typeof record.source_id === "string" ? record.source_id.trim() : "";
      const claim = typeof record.claim === "string" ? record.claim.trim() : "";
      const evidenceType =
        record.evidence_type === "observed" ||
        record.evidence_type === "derived" ||
        record.evidence_type === "inferred"
          ? record.evidence_type
          : null;
      const freshness =
        record.freshness === "live" ||
        record.freshness === "recent" ||
        record.freshness === "stale" ||
        record.freshness === "unavailable"
          ? record.freshness
          : null;
      const confidence =
        record.confidence === "high" ||
        record.confidence === "medium" ||
        record.confidence === "low"
          ? record.confidence
          : null;
      const supportedSections = Array.isArray(record.supported_sections)
        ? record.supported_sections.filter(
            (section): section is SupportedEvidenceSection =>
              section === "current_read" ||
              section === "watchlist" ||
              section === "scenarios" ||
              section === "bottom_line",
          )
        : [];
      const retrievedAt =
        typeof record.retrieved_at === "string"
          ? (asIsoDate(record.retrieved_at.trim()) ?? "")
          : "";

      if (
        !evidenceId ||
        !sourceId ||
        !claim ||
        !evidenceType ||
        !freshness ||
        !confidence ||
        !retrievedAt
      ) {
        return null;
      }

      return {
        evidence_id: evidenceId,
        source_id: sourceId,
        claim,
        evidence_type: evidenceType,
        freshness,
        data_timestamp:
          typeof record.data_timestamp === "string"
            ? asIsoDate(record.data_timestamp)
            : null,
        retrieved_at: retrievedAt,
        confidence,
        supported_sections: supportedSections,
        raw_value: "raw_value" in record ? record.raw_value : null,
      };
    })
    .filter((item): item is EvidenceItem => Boolean(item));
}

export function parseSourceSummariesJson(value: string | null | undefined) {
  if (!value) {
    return [] as SourceSummary[];
  }

  const parsed = JSON.parse(value) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Stored source summary data is invalid JSON.");
  }

  return parsed
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const sourceId = typeof record.source_id === "string" ? record.source_id.trim() : "";
      const sourceName =
        typeof record.source_name === "string" ? record.source_name.trim() : "";
      const status =
        record.status === "ok" ||
        record.status === "stale" ||
        record.status === "error" ||
        record.status === "unavailable"
          ? record.status
          : null;
      const freshness =
        record.freshness === "live" ||
        record.freshness === "recent" ||
        record.freshness === "stale" ||
        record.freshness === "unavailable"
          ? record.freshness
          : null;
      const retrievedAt =
        typeof record.retrieved_at === "string"
          ? (asIsoDate(record.retrieved_at.trim()) ?? "")
          : "";

      if (!sourceId || !sourceName || !status || !freshness || !retrievedAt) {
        return null;
      }

      return {
        source_id: sourceId,
        source_name: sourceName,
        status,
        retrieved_at: retrievedAt,
        data_timestamp:
          typeof record.data_timestamp === "string"
            ? asIsoDate(record.data_timestamp)
            : null,
        freshness,
        staleness_seconds:
          typeof record.staleness_seconds === "number" &&
          Number.isFinite(record.staleness_seconds)
            ? record.staleness_seconds
            : 0,
        error_message:
          typeof record.error_message === "string" ? record.error_message : null,
        served_from_cache: Boolean(record.served_from_cache),
      } satisfies SourceSummary;
    })
    .filter((item): item is SourceSummary => Boolean(item));
}
