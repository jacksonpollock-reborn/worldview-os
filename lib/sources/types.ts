export type SourceType = "quantitative" | "qualitative" | "event" | "mixed";
export type TrustTier = "primary" | "secondary" | "supplementary";
export type FailureMode = "degrade" | "block";
export type SourceStatus = "ok" | "stale" | "error" | "unavailable";
export type EvidenceType = "observed" | "derived" | "inferred";
export type Freshness = "live" | "recent" | "stale" | "unavailable";

export type SupportedEvidenceSection =
  | "current_read"
  | "watchlist"
  | "scenarios"
  | "bottom_line";

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

export type SourceResponse<TData = unknown> = {
  source_id: string;
  status: SourceStatus;
  retrieved_at: string;
  data_timestamp: string | null;
  staleness_seconds: number;
  data: TData | null;
  error_message: string | null;
  served_from_cache?: boolean;
  raw_debug_payload?: unknown;
};

export type SourceFetchOptions = {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  debugRawRetention?: boolean;
  retryAttempts?: number;
  cacheTtlMs?: number;
  bypassCache?: boolean;
};

export type SourceAdapter<TData = unknown> = {
  registration: SourceRegistration;
  fetch: (options?: SourceFetchOptions) => Promise<SourceResponse<TData>>;
};

export type EvidenceItem = {
  evidence_id: string;
  source_id: string;
  claim: string;
  evidence_type: EvidenceType;
  freshness: Freshness;
  data_timestamp: string | null;
  retrieved_at: string;
  confidence: "high" | "medium" | "low";
  supported_sections: SupportedEvidenceSection[];
  raw_value: unknown;
};

export type SourceSummary = {
  source_id: string;
  source_name: string;
  status: SourceStatus;
  retrieved_at: string;
  data_timestamp: string | null;
  freshness: Freshness;
  staleness_seconds: number;
  error_message: string | null;
  served_from_cache: boolean;
};

export type CoinGeckoSimplePriceResponse = {
  bitcoin?: {
    usd?: number;
    usd_24h_change?: number;
    last_updated_at?: number;
  };
};

export type CoinGeckoMarketDataResponse = {
  market_data?: {
    current_price?: { usd?: number };
    market_cap?: { usd?: number };
    total_volume?: { usd?: number };
    circulating_supply?: number;
    ath?: { usd?: number };
    ath_date?: { usd?: string };
    price_change_percentage_7d?: number;
    price_change_percentage_14d?: number;
    price_change_percentage_30d?: number;
  };
  last_updated?: string;
};

export type CoinGeckoBtcSimplePriceData = {
  asset: "BTC";
  currency: "USD";
  price_usd: number;
  price_change_24h_pct: number | null;
};

export type CoinGeckoBtcMarketData = {
  asset: "BTC";
  currency: "USD";
  current_price_usd: number | null;
  market_cap_usd: number | null;
  total_volume_usd: number | null;
  circulating_supply: number | null;
  ath_usd: number | null;
  ath_date: string | null;
  price_change_7d_pct: number | null;
  price_change_14d_pct: number | null;
  price_change_30d_pct: number | null;
};
