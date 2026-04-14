import type { AnalysisInput } from "@/types/analysis";

type PromptPack = {
  id: string;
  label: string;
  instructions: string[];
};

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function includesAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

const DOMAIN_PROMPT_PACKS: PromptPack[] = [
  {
    id: "politics-geopolitics",
    label: "Politics / Geopolitics",
    instructions: [
      "Prioritize actor incentives, coalition math, institutional veto points, and state capacity.",
      "Distinguish domestic political constraints from international bargaining or deterrence dynamics.",
      "Make scenarios hinge on concrete escalation or de-escalation pathways, not generic instability.",
      "Use watchlist items such as elections, elite splits, military posture, alliance commitments, legal rulings, or sanctions shifts.",
    ],
  },
  {
    id: "macro-markets",
    label: "Macro / Markets",
    instructions: [
      "Separate growth, inflation, liquidity, and policy reaction function from market positioning and valuation.",
      "Anchor probabilities in reference classes such as soft landing, late-cycle slowdown, inflation re-acceleration, or credit tightening.",
      "Make the scenario description state what evidence moved the prior away from the base rate.",
      "Use watchlist items such as policy meetings, labor and inflation prints, earnings, credit spreads, balance-sheet data, and flow positioning.",
    ],
  },
  {
    id: "crypto",
    label: "Crypto",
    instructions: [
      "Separate macro liquidity, market structure and leverage, adoption and utility, and regulation or policy.",
      "Anchor probabilities in crypto-specific base rates such as reflexive rallies, leverage wipes, and post-catalyst consolidation.",
      "Make the scenario description state what current evidence moved the prior, such as flows, funding, basis, onchain activity, or policy posture.",
      "Use watchlist items such as ETF flows, stablecoin growth, exchange balances, funding rates, basis, network activity, and specific regulatory actions.",
    ],
  },
  {
    id: "sports-general",
    label: "Sports / General Competitive",
    instructions: [
      "Ground the analysis in talent quality, health or availability, coaching or tactical execution, and competitive environment.",
      "Use sports or competitive reference classes rather than generic business language where applicable.",
      "Keep scenarios tied to observable shifts such as injuries, roster changes, tactical adaptation, schedule strength, or rival deterioration.",
      "Use watchlist items such as underlying performance metrics, availability reports, trade or transfer moves, rotation stability, and opponent strength.",
    ],
  },
  {
    id: "general-strategy",
    label: "General Strategy",
    instructions: [
      "Emphasize customer pain, distribution, unit economics, competitive response, and execution constraints.",
      "Make the bottom line decisive about where scarce resources should go first.",
      "Use scenarios tied to product-market fit, channel efficiency, pricing power, or platform dependence rather than vague innovation narratives.",
      "Use watchlist items such as acquisition cost, retention, conversion, pricing realization, sales-cycle length, and competitor launches.",
    ],
  },
];

const OBJECTIVE_PROMPT_PACKS: Record<string, PromptPack> = {
  understand: {
    id: "understand",
    label: "Understand",
    instructions: [
      "Prioritize structure, causal drivers, and tradeoffs over recommendation language.",
      "Make the reframed question a crisp framing statement rather than a monitoring checklist or investment memo.",
      "Make the bottom line clarify the dominant mechanism, not just the likely outcome.",
    ],
  },
  invest: {
    id: "invest",
    label: "Invest",
    instructions: [
      "Emphasize asymmetry, downside path, invalidation, and the evidence that would justify changing exposure.",
      "Make scenarios decision-useful for allocation rather than descriptive only.",
      "Bias the watchlist toward market signals, flows, and invalidation thresholds that could justify sizing up, sizing down, or standing aside.",
    ],
  },
  forecast: {
    id: "forecast",
    label: "Forecast",
    instructions: [
      "Emphasize calibrated probabilities, time horizon, reference class, and what evidence moved the prior.",
      "Make change-my-mind conditions tightly connected to probability updates.",
      "Ensure scenarios differ by causal path, trigger pattern, and evidence signature rather than intensity alone.",
    ],
  },
  monitor: {
    id: "monitor",
    label: "Monitor",
    instructions: [
      "Select monitoring signals that are leading indicators — they should move before the outcome, not confirm what already happened.",
      "Ground signal thresholds in historical context or structural breakpoints, not convenient round numbers.",
      "Make the watchlist the most operational part of the output. Each item should imply what has changed if the threshold is crossed.",
      "what_to_ignore should name specific, recurring noise patterns for this question's domain, not generic volatility disclaimers.",
      "Compress narrative forecasting. The change-my-mind conditions and watchlist must carry the operational weight.",
      "State a review cadence and, where useful, what noise or routine volatility to ignore.",
    ],
  },
  decide: {
    id: "decide",
    label: "Decide",
    instructions: [
      "Make the bottom line choose a path under the stated constraints and identify the main regret risk.",
      "Keep scenarios tied to practical decision branches rather than abstract possibilities.",
    ],
  },
  write: {
    id: "write",
    label: "Write",
    instructions: [
      "Sharpen framing and definitions so the output can be reused as a structured brief.",
      "Prefer crisp synthesis over exhaustive enumeration.",
    ],
  },
  debate: {
    id: "debate",
    label: "Debate",
    instructions: [
      "Surface the strongest opposing case and the evidence that would make it win.",
      "Avoid one-sided framing and make the change-my-mind conditions especially sharp.",
    ],
  },
};

export function resolveDomainPromptPack(input: AnalysisInput) {
  const haystack = normalizeText(`${input.domain} ${input.question}`);

  if (
    includesAny(haystack, [
      "politic",
      "geopolit",
      "election",
      "administration",
      "government",
      "policy",
      "taiwan",
      "china",
      "war",
      "diplomac",
      "sanction",
    ])
  ) {
    return DOMAIN_PROMPT_PACKS[0];
  }

  if (
    includesAny(haystack, [
      "macro",
      "market",
      "inflation",
      "rates",
      "recession",
      "yield",
      "equity",
      "credit",
      "brand hedge",
      "consumer brand",
    ])
  ) {
    return DOMAIN_PROMPT_PACKS[1];
  }

  if (
    includesAny(haystack, [
      "crypto",
      "bitcoin",
      "ethereum",
      "blockchain",
      "defi",
      "token",
      "stablecoin",
      "etf",
    ])
  ) {
    return DOMAIN_PROMPT_PACKS[2];
  }

  if (
    includesAny(haystack, [
      "sport",
      "nba",
      "nfl",
      "mlb",
      "nhl",
      "f1",
      "formula 1",
      "team",
      "player",
      "title contention",
    ])
  ) {
    return DOMAIN_PROMPT_PACKS[3];
  }

  return DOMAIN_PROMPT_PACKS[4];
}

export function resolveObjectivePromptPack(input: AnalysisInput) {
  const objective = normalizeText(input.objective || "understand");
  return OBJECTIVE_PROMPT_PACKS[objective] || OBJECTIVE_PROMPT_PACKS.understand;
}
