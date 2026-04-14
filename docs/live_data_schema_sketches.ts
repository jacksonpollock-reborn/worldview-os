/**
 * Live Data Schema Sketches
 *
 * Design reference for the first live-data pilot.
 * NOT runtime code. Interface contracts for implementation reference.
 *
 * Pilot domain: Crypto (BTC only)
 * Pilot source: CoinGecko Free API
 */

// ── Source Contract ──────────────────────────────

export type SourceType = "quantitative" | "qualitative" | "event" | "mixed";
export type TrustTier = "primary" | "secondary" | "supplementary";
export type FailureMode = "degrade" | "block";

export type SourceRegistration = {
  source_id: string;
  source_name: string;
  source_type: SourceType;
  supported_domains: string[];
  refresh_cadence: string;
  trust_tier: TrustTier;
  max_staleness_seconds: number;
  failure_mode: FailureMode;
};

export type SourceStatus = "ok" | "stale" | "error" | "unavailable";

export type SourceResponse = {
  source_id: string;
  status: SourceStatus;
  retrieved_at: string;
  data_timestamp: string | null;
  staleness_seconds: number;
  data: unknown;
  error_message: string | null;
};

// ── Evidence Model ──────────────────────────────

export type EvidenceType = "observed" | "derived" | "inferred";
export type Freshness = "live" | "recent" | "stale" | "unavailable";

export type EvidenceItem = {
  evidence_id: string;
  source_id: string;
  claim: string;
  evidence_type: EvidenceType;
  freshness: Freshness;
  data_timestamp: string | null;
  retrieved_at: string;
  confidence: "high" | "medium" | "low";
  supported_sections: string[];
  raw_value: unknown;
};

// ── Source Summary (persisted with analysis) ────

export type SourceSummary = {
  source_id: string;
  source_name: string;
  status: SourceStatus;
  retrieved_at: string;
  data_timestamp: string | null;
  freshness: Freshness;
};

// ── CoinGecko Response Shapes ───────────────────

export type CoinGeckoSimplePriceResponse = {
  bitcoin: {
    usd: number;
    usd_24h_change: number;
  };
};

export type CoinGeckoMarketDataResponse = {
  market_data: {
    current_price: { usd: number };
    market_cap: { usd: number };
    total_volume: { usd: number };
    circulating_supply: number;
    ath: { usd: number };
    ath_date: { usd: string };
    price_change_percentage_7d: number;
    price_change_percentage_14d: number;
    price_change_percentage_30d: number;
  };
};

// ── Freshness Classification ────────────────────

/**
 * function classifyFreshness(
 *   retrieved_at: Date,
 *   data_timestamp: Date | null,
 *   max_staleness_seconds: number,
 * ): Freshness {
 *   if (!data_timestamp) return "unavailable";
 *   const age = (retrieved_at.getTime() - data_timestamp.getTime()) / 1000;
 *   if (age <= 300) return "live";
 *   if (age <= 3600) return "recent";
 *   if (age <= max_staleness_seconds) return "recent";
 *   return "stale";
 * }
 */

// ── Prisma Schema Additions ─────────────────────

/**
 * Analysis model additions:
 *   evidenceSnapshotJson  String?
 *   evidenceSourcesJson   String?
 *
 * AppSettings model addition:
 *   liveDataEnabled       Boolean  @default(false)
 */

// ── CoinGecko → EvidenceItem Example ────────────

/**
 * Input:  { bitcoin: { usd: 67400, usd_24h_change: -2.31 } }
 * Output:
 * [
 *   {
 *     evidence_id: "coingecko-btc-simple-price-<timestamp>",
 *     source_id: "coingecko-btc-simple",
 *     claim: "BTC/USD spot price is $67,400",
 *     evidence_type: "observed",
 *     freshness: "live",
 *     confidence: "high",
 *     supported_sections: ["current_read", "scenarios", "watchlist", "bottom_line"],
 *     raw_value: 67400,
 *   },
 *   {
 *     evidence_id: "coingecko-btc-simple-24h-<timestamp>",
 *     source_id: "coingecko-btc-simple",
 *     claim: "BTC 24h price change is -2.3%",
 *     evidence_type: "observed",
 *     freshness: "live",
 *     confidence: "high",
 *     supported_sections: ["current_read", "scenarios"],
 *     raw_value: -2.31,
 *   },
 * ]
 */
