import {
  COINGECKO_BTC_MARKET_SOURCE_ID,
  COINGECKO_BTC_SIMPLE_SOURCE_ID,
  getSourceRegistration,
} from "@/lib/sources/source-registry";
import type {
  CoinGeckoBtcMarketData,
  CoinGeckoBtcSimplePriceData,
  CoinGeckoMarketDataResponse,
  CoinGeckoSimplePriceResponse,
  SourceFetchOptions,
  SourceResponse,
} from "@/lib/sources/types";

const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_CACHE_TTL_MS = 30_000;
const DEFAULT_RETRY_ATTEMPTS = 2;
const CACHE_FALLBACK_MAX_AGE_MS = 120_000;
const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);

type CoinGeckoCacheEntry<TPayload = unknown> = {
  payload: TPayload;
  retrievedAt: string;
  cachedAtMs: number;
};

const globalForCoinGeckoCache = globalThis as typeof globalThis & {
  __worldviewCoinGeckoCache?: Map<string, CoinGeckoCacheEntry>;
};

function buildRetrievedAtIso() {
  return new Date().toISOString();
}

function getCoinGeckoCacheStore() {
  if (!globalForCoinGeckoCache.__worldviewCoinGeckoCache) {
    globalForCoinGeckoCache.__worldviewCoinGeckoCache = new Map();
  }

  return globalForCoinGeckoCache.__worldviewCoinGeckoCache;
}

function readCoinGeckoCache<TPayload>(sourceId: string, maxAgeMs: number) {
  const entry = getCoinGeckoCacheStore().get(sourceId);

  if (!entry) {
    return null;
  }

  if (Date.now() - entry.cachedAtMs > maxAgeMs) {
    return null;
  }

  return entry as CoinGeckoCacheEntry<TPayload>;
}

function writeCoinGeckoCache<TPayload>(sourceId: string, payload: TPayload, retrievedAt: string) {
  getCoinGeckoCacheStore().set(sourceId, {
    payload,
    retrievedAt,
    cachedAtMs: Date.now(),
  });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeIsoTimestamp(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString();
  }

  if (typeof value === "string" && value.trim()) {
    const timestamp = new Date(value);

    if (!Number.isNaN(timestamp.getTime())) {
      return timestamp.toISOString();
    }
  }

  return null;
}

function calculateStalenessSeconds(
  retrievedAtIso: string,
  dataTimestampIso: string | null,
) {
  if (!dataTimestampIso) {
    return 0;
  }

  const retrievedAtMs = new Date(retrievedAtIso).getTime();
  const dataTimestampMs = new Date(dataTimestampIso).getTime();

  if (Number.isNaN(retrievedAtMs) || Number.isNaN(dataTimestampMs)) {
    return 0;
  }

  return Math.max(0, Math.round((retrievedAtMs - dataTimestampMs) / 1000));
}

function buildErrorResponse(
  sourceId: string,
  status: "error" | "unavailable",
  retrievedAt: string,
  errorMessage: string,
): SourceResponse<never> {
  return {
    source_id: sourceId,
    status,
    retrieved_at: retrievedAt,
    data_timestamp: null,
    staleness_seconds: 0,
    data: null,
    error_message: errorMessage,
  };
}

async function fetchCoinGeckoJson<TResponse>(
  input: {
    sourceId: string;
    path: string;
  },
  options?: SourceFetchOptions,
) {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const cacheTtlMs = options?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const retryAttempts = Math.max(1, options?.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS);
  const url = `${COINGECKO_BASE_URL}${input.path}`;
  const freshCache =
    !options?.bypassCache && readCoinGeckoCache<TResponse>(input.sourceId, cacheTtlMs);

  if (freshCache) {
    return {
      ok: true as const,
      payload: freshCache.payload,
      retrievedAt: freshCache.retrievedAt,
      servedFromCache: true,
      errorMessage: null,
    };
  }

  let lastErrorMessage = "CoinGecko request failed.";
  let lastFailureWasUnavailable = true;

  for (let attempt = 0; attempt < retryAttempts; attempt += 1) {
    const retrievedAt = buildRetrievedAtIso();

    try {
      const response = await fetchImpl(url, {
        headers: {
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });

      if (!response.ok) {
        lastFailureWasUnavailable = response.status === 429;
        lastErrorMessage = `CoinGecko request failed with status ${response.status}.`;

        if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < retryAttempts - 1) {
          await wait(400 * (attempt + 1));
          continue;
        }

        break;
      }

      let payload: unknown;

      try {
        payload = (await response.json()) as unknown;
      } catch {
        lastFailureWasUnavailable = false;
        lastErrorMessage = "CoinGecko returned invalid JSON.";
        break;
      }

      writeCoinGeckoCache(input.sourceId, payload as TResponse, retrievedAt);

      return {
        ok: true as const,
        payload: payload as TResponse,
        retrievedAt,
        servedFromCache: false,
        errorMessage: null,
      };
    } catch (error) {
      lastFailureWasUnavailable = true;
      lastErrorMessage =
        error instanceof Error && error.name === "TimeoutError"
          ? `CoinGecko request timed out after ${timeoutMs}ms.`
          : error instanceof Error
            ? error.message
            : "CoinGecko request failed.";

      if (attempt < retryAttempts - 1) {
        await wait(400 * (attempt + 1));
      }
    }
  }

  const fallbackCache =
    !options?.bypassCache &&
    readCoinGeckoCache<TResponse>(input.sourceId, CACHE_FALLBACK_MAX_AGE_MS);

  if (fallbackCache) {
    return {
      ok: true as const,
      payload: fallbackCache.payload,
      retrievedAt: fallbackCache.retrievedAt,
      servedFromCache: true,
      errorMessage: `Using cached CoinGecko fallback after upstream failure: ${lastErrorMessage}`,
    };
  }

  return {
    ok: false as const,
    response: buildErrorResponse(
      input.sourceId,
      lastFailureWasUnavailable ? "unavailable" : "error",
      buildRetrievedAtIso(),
      lastErrorMessage,
    ),
  };
}

export async function fetchCoinGeckoSimplePrice(
  options?: SourceFetchOptions,
): Promise<SourceResponse<CoinGeckoBtcSimplePriceData>> {
  const registration = getSourceRegistration(COINGECKO_BTC_SIMPLE_SOURCE_ID);

  if (!registration) {
    return buildErrorResponse(
      COINGECKO_BTC_SIMPLE_SOURCE_ID,
      "error",
      buildRetrievedAtIso(),
      "CoinGecko BTC simple-price source is not registered.",
    );
  }

  const result = await fetchCoinGeckoJson<CoinGeckoSimplePriceResponse>(
    {
      sourceId: registration.source_id,
      path: "/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true",
    },
    options,
  );

  if (!result.ok) {
    return result.response;
  }

  const bitcoin = result.payload.bitcoin;
  const priceUsd = bitcoin?.usd;

  if (typeof priceUsd !== "number" || Number.isNaN(priceUsd)) {
    return buildErrorResponse(
      registration.source_id,
      "error",
      result.retrievedAt,
      "CoinGecko simple-price response was missing BTC/USD price data.",
    );
  }

  const dataTimestamp = normalizeIsoTimestamp(bitcoin?.last_updated_at);
  const stalenessSeconds = calculateStalenessSeconds(result.retrievedAt, dataTimestamp);

  return {
    source_id: registration.source_id,
    status:
      dataTimestamp && stalenessSeconds > registration.max_staleness_seconds
        ? "stale"
        : "ok",
    retrieved_at: result.retrievedAt,
    data_timestamp: dataTimestamp,
    staleness_seconds: stalenessSeconds,
    data: {
      asset: "BTC",
      currency: "USD",
      price_usd: priceUsd,
      price_change_24h_pct:
        typeof bitcoin?.usd_24h_change === "number" && !Number.isNaN(bitcoin.usd_24h_change)
          ? bitcoin.usd_24h_change
          : null,
    },
    error_message: null,
    served_from_cache: result.servedFromCache,
    ...(result.errorMessage ? { error_message: result.errorMessage } : {}),
    ...(options?.debugRawRetention ? { raw_debug_payload: result.payload } : {}),
  };
}

export async function fetchCoinGeckoMarketData(
  options?: SourceFetchOptions,
): Promise<SourceResponse<CoinGeckoBtcMarketData>> {
  const registration = getSourceRegistration(COINGECKO_BTC_MARKET_SOURCE_ID);

  if (!registration) {
    return buildErrorResponse(
      COINGECKO_BTC_MARKET_SOURCE_ID,
      "error",
      buildRetrievedAtIso(),
      "CoinGecko BTC market-data source is not registered.",
    );
  }

  const result = await fetchCoinGeckoJson<CoinGeckoMarketDataResponse>(
    {
      sourceId: registration.source_id,
      path: "/coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false",
    },
    options,
  );

  if (!result.ok) {
    return result.response;
  }

  const marketData = result.payload.market_data;

  if (!marketData) {
    return buildErrorResponse(
      registration.source_id,
      "error",
      result.retrievedAt,
      "CoinGecko market-data response was missing market_data.",
    );
  }

  const dataTimestamp = normalizeIsoTimestamp(result.payload.last_updated);
  const stalenessSeconds = calculateStalenessSeconds(result.retrievedAt, dataTimestamp);

  return {
    source_id: registration.source_id,
    status:
      dataTimestamp && stalenessSeconds > registration.max_staleness_seconds
        ? "stale"
        : "ok",
    retrieved_at: result.retrievedAt,
    data_timestamp: dataTimestamp,
    staleness_seconds: stalenessSeconds,
    data: {
      asset: "BTC",
      currency: "USD",
      current_price_usd:
        typeof marketData.current_price?.usd === "number" &&
        !Number.isNaN(marketData.current_price.usd)
          ? marketData.current_price.usd
          : null,
      market_cap_usd:
        typeof marketData.market_cap?.usd === "number" &&
        !Number.isNaN(marketData.market_cap.usd)
          ? marketData.market_cap.usd
          : null,
      total_volume_usd:
        typeof marketData.total_volume?.usd === "number" &&
        !Number.isNaN(marketData.total_volume.usd)
          ? marketData.total_volume.usd
          : null,
      circulating_supply:
        typeof marketData.circulating_supply === "number" &&
        !Number.isNaN(marketData.circulating_supply)
          ? marketData.circulating_supply
          : null,
      ath_usd:
        typeof marketData.ath?.usd === "number" && !Number.isNaN(marketData.ath.usd)
          ? marketData.ath.usd
          : null,
      ath_date: normalizeIsoTimestamp(marketData.ath_date?.usd),
      price_change_7d_pct:
        typeof marketData.price_change_percentage_7d === "number" &&
        !Number.isNaN(marketData.price_change_percentage_7d)
          ? marketData.price_change_percentage_7d
          : null,
      price_change_14d_pct:
        typeof marketData.price_change_percentage_14d === "number" &&
        !Number.isNaN(marketData.price_change_percentage_14d)
          ? marketData.price_change_percentage_14d
          : null,
      price_change_30d_pct:
        typeof marketData.price_change_percentage_30d === "number" &&
        !Number.isNaN(marketData.price_change_percentage_30d)
          ? marketData.price_change_percentage_30d
          : null,
    },
    error_message: null,
    served_from_cache: result.servedFromCache,
    ...(result.errorMessage ? { error_message: result.errorMessage } : {}),
    ...(options?.debugRawRetention ? { raw_debug_payload: result.payload } : {}),
  };
}

export async function fetchCoinGeckoBtcPilotSources(options?: SourceFetchOptions) {
  return Promise.all([
    fetchCoinGeckoSimplePrice(options),
    fetchCoinGeckoMarketData(options),
  ]);
}
