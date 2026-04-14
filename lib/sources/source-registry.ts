import type { SourceRegistration } from "@/lib/sources/types";

export const COINGECKO_BTC_SIMPLE_SOURCE_ID = "coingecko-btc-simple";
export const COINGECKO_BTC_MARKET_SOURCE_ID = "coingecko-btc-market";

const SOURCE_REGISTRY: SourceRegistration[] = [
  {
    source_id: COINGECKO_BTC_SIMPLE_SOURCE_ID,
    source_name: "CoinGecko BTC/USD Spot",
    source_type: "quantitative",
    supported_domains: ["crypto", "markets"],
    refresh_cadence: "5m",
    trust_tier: "primary",
    max_staleness_seconds: 300,
    failure_mode: "degrade",
  },
  {
    source_id: COINGECKO_BTC_MARKET_SOURCE_ID,
    source_name: "CoinGecko BTC Market Data",
    source_type: "quantitative",
    supported_domains: ["crypto", "markets"],
    refresh_cadence: "5m",
    trust_tier: "primary",
    max_staleness_seconds: 300,
    failure_mode: "degrade",
  },
];

const SOURCE_REGISTRY_BY_ID = new Map(
  SOURCE_REGISTRY.map((registration) => [registration.source_id, registration]),
);

function normalizeDomain(domain: string | null | undefined) {
  return (domain || "").trim().toLowerCase();
}

export function listRegisteredSources() {
  return SOURCE_REGISTRY.map((registration) => ({ ...registration }));
}

export function getSourceRegistration(sourceId: string) {
  const registration = SOURCE_REGISTRY_BY_ID.get(sourceId);
  return registration ? { ...registration } : null;
}

export function getSourcesForDomain(domain: string | null | undefined) {
  const normalizedDomain = normalizeDomain(domain);

  if (!normalizedDomain) {
    return [];
  }

  return SOURCE_REGISTRY.filter((registration) =>
    registration.supported_domains.some(
      (supportedDomain) => supportedDomain.toLowerCase() === normalizedDomain,
    ),
  ).map((registration) => ({ ...registration }));
}

export function getEligibleSourcesForDomain(input: {
  domain: string | null | undefined;
  liveDataEnabled: boolean;
}) {
  if (!input.liveDataEnabled) {
    return [];
  }

  return getSourcesForDomain(input.domain);
}
