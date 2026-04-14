import versionLineage from "@/config/version-lineage.json";

export const ANALYSIS_BASELINE_PROMPT_VERSION =
  versionLineage.analysisBaselinePromptVersion;
export const ANALYSIS_BTC_LIVE_PILOT_PROMPT_VERSION =
  versionLineage.analysisLiveBtcPilotPromptVersion;
export const FOLLOW_UP_PROMPT_VERSION = versionLineage.followUpPromptVersion;

function normalizeDomain(domain: string | null | undefined) {
  return (domain || "").trim().toLowerCase();
}

export function isBtcLivePilotDomain(domain: string | null | undefined) {
  return normalizeDomain(domain) === "crypto";
}

export function resolveAnalysisPromptVersion(input: {
  domain: string | null | undefined;
  liveDataEnabled: boolean;
  pilotEligible: boolean;
}) {
  if (input.liveDataEnabled && input.pilotEligible && isBtcLivePilotDomain(input.domain)) {
    return ANALYSIS_BTC_LIVE_PILOT_PROMPT_VERSION;
  }

  return ANALYSIS_BASELINE_PROMPT_VERSION;
}

export function resolveAnalysisPromptVersionForLiveToggle(input: {
  domain: string | null | undefined;
  liveDataEnabled: boolean;
}) {
  return resolveAnalysisPromptVersion({
    domain: input.domain,
    liveDataEnabled: input.liveDataEnabled,
    pilotEligible: isBtcLivePilotDomain(input.domain),
  });
}
