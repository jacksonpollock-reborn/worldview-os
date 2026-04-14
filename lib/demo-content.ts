import {
  AnalysisOutputSchema,
  MonitorAnalysisOutputSchema,
  StandardAnalysisOutputSchema,
} from "@/schemas/analysis";
import type { AnalysisInput, StructuredAnalysis } from "@/types/analysis";

export type DemoQuestion = {
  id: string;
  label: string;
  question: string;
  domain: string;
  timeHorizon: string;
  objective: string;
  description: string;
};

export const DEMO_QUESTIONS: DemoQuestion[] = [
  {
    id: "policy",
    label: "Politics",
    question:
      "What are the serious pathways for the current U.S. administration to lose policy momentum by 2027?",
    domain: "politics",
    timeHorizon: "through 2027",
    objective: "forecast",
    description: "Institutional, legal, macro, coalition, and narrative breakdown.",
  },
  {
    id: "bitcoin",
    label: "Crypto",
    question:
      "What are the real bull, base, and bear cases for Bitcoin over the next 12 months?",
    domain: "crypto",
    timeHorizon: "next 12 months",
    objective: "invest",
    description: "Liquidity, regulation, positioning, reflexivity, and catalyst watchpoints.",
  },
  {
    id: "gaming",
    label: "Gaming",
    question:
      "Will a major racing game retain players six months after launch, and what would change that view?",
    domain: "gaming",
    timeHorizon: "six months after launch",
    objective: "monitor",
    description: "Retention, content cadence, monetization, community, and execution risk.",
  },
  {
    id: "relocation",
    label: "Generalist",
    question:
      "What are the serious angles to evaluate a country relocation decision for the next three years?",
    domain: "mixed-domain",
    timeHorizon: "next three years",
    objective: "understand",
    description: "Economic, legal, safety, career, lifestyle, and second-order effects.",
  },
];

function withInputOverrides(
  analysis: StructuredAnalysis,
  input: AnalysisInput,
): StructuredAnalysis {
  const title = input.question.length > 90 ? `${input.question.slice(0, 87)}...` : input.question;

  const candidate = {
    ...analysis,
    title: analysis.title || title,
    original_question: input.question,
    time_horizon: input.timeHorizon || analysis.time_horizon,
    objective: input.objective || analysis.objective,
    domains: input.domain ? [input.domain, ...analysis.domains.filter((item) => item !== input.domain)] : analysis.domains,
  };

  if ((candidate.objective || "").trim().toLowerCase() === "monitor") {
    return candidate as StructuredAnalysis;
  }

  return StandardAnalysisOutputSchema.parse(candidate);
}

function toIfCondition(value: string, fallbackLabel: string) {
  if (/^IF\s+.+\s+->\s+.+$/i.test(value.trim())) {
    return value.trim();
  }

  return `IF ${value.trim()} -> ${fallbackLabel} fails`;
}

function toMonitorAnalysis(
  analysis: StructuredAnalysis,
  input: AnalysisInput,
): StructuredAnalysis {
  const baseSignals = analysis.watchlist.slice(0, 4);
  const reviewCadence =
    (input.timeHorizon || analysis.time_horizon || "").toLowerCase().includes("day")
      ? "Review daily and escalate immediately on clean threshold breaks."
      : "Review weekly and escalate immediately on clean threshold breaks.";
  const monitoringSignals = baseSignals.map((item, index) => ({
    name: item,
    why_it_matters:
      analysis.key_drivers[index] ||
      analysis.hidden_variables[index] ||
      "This signal changes the operating view faster than lagging narrative commentary.",
    bullish_threshold: `Improves for 2 to 4 consecutive review periods: ${item}.`,
    neutral_threshold: `Stays mixed or range-bound without follow-through: ${item}.`,
    bearish_threshold: `Deteriorates for 2 consecutive review periods or breaks an obvious threshold: ${item}.`,
  }));

  return MonitorAnalysisOutputSchema.parse({
    ...analysis,
    objective: "monitor",
    current_stance: `Current stance: monitor the base case while treating the first clean threshold break as the update trigger, not narrative noise.`,
    monitoring_signals: monitoringSignals,
    review_cadence: reviewCadence,
    confirm_current_view: analysis.watchlist.slice(0, 3),
    disconfirm_current_view: analysis.change_my_mind_conditions
      .slice(0, 3)
      .map((item, index) => toIfCondition(item, analysis.key_drivers[index] || "the current view")),
    what_to_ignore: [
      "Single-cycle headline volatility without confirmation from the core indicators.",
      "Narrative overreaction that does not move the monitored thresholds.",
    ],
    lenses: [],
    scenarios: [],
    change_my_mind_conditions: analysis.change_my_mind_conditions
      .slice(0, 3)
      .map((item, index) => toIfCondition(item, analysis.key_drivers[index] || "the current view")),
    watchlist: analysis.watchlist.slice(0, 5),
  });
}

const POLICY_ANALYSIS = AnalysisOutputSchema.parse({
  title: "U.S. Policy Momentum Through 2027",
  original_question:
    "What are the serious pathways for the current U.S. administration to lose policy momentum by 2027?",
  reframed_question:
    "Through 2027, what are the highest-probability pathways by which the current U.S. administration could lose the capacity to advance or defend its policy agenda?",
  time_horizon: "through 2027",
  objective: "forecast",
  definitions: [
    {
      term: "Policy momentum",
      definition:
        "The administration’s practical ability to pass, implement, defend, and sustain its preferred agenda.",
    },
    {
      term: "Lose momentum",
      definition:
        "A material decline in coalition control, institutional leverage, execution capacity, or public legitimacy.",
    },
    {
      term: "Pathway",
      definition:
        "A causal chain, not a single headline event, that shifts the balance of political power.",
    },
  ],
  domains: ["politics", "law", "macroeconomics", "social dynamics", "narrative"],
  key_drivers: [
    "Legislative coalition cohesion",
    "Court and agency constraints",
    "Inflation, growth, and labor-market conditions",
    "Public-perception shocks and narrative control",
    "Execution quality inside the bureaucracy",
  ],
  lenses: [
    {
      name: "Institutional leverage",
      why_it_matters:
        "Policy success depends on whether the administration can still convert preferences into durable government action.",
      key_drivers: [
        "Congressional margin management",
        "Agency implementation capacity",
        "Court vulnerability of key initiatives",
      ],
      bull_case:
        "The administration keeps enough coalition discipline to move targeted priorities and absorbs court setbacks selectively.",
      bear_case:
        "Fragmentation, procedural defeats, and court losses turn policy into a defensive posture.",
      base_case:
        "Incremental action remains possible, but only on narrower issues with lower political heat.",
      wildcard_case:
        "A sudden external shock creates bipartisan cover for a temporary burst of policy throughput.",
      evidence_for: [
        "Leadership still controls the agenda on select issues",
        "Executive agencies retain room for narrower rulemaking",
      ],
      evidence_against: [
        "Thin margins increase veto power for small factions",
        "Courts can slow or reverse ambitious regulatory moves",
      ],
      leading_indicators: [
        "Whip-count stability",
        "Agency implementation milestones",
        "Major court-calendar events",
      ],
      disconfirming_signals: [
        "Repeated clean passage of contested priorities",
        "Unexpected bipartisan legislative wins",
      ],
    },
    {
      name: "Macro and voter pain",
      why_it_matters:
        "Economic frustration can degrade public tolerance even when policy content remains popular on paper.",
      key_drivers: [
        "Inflation trend",
        "Real wage improvement",
        "Labor-market softness",
      ],
      bull_case:
        "Disinflation continues while growth stays resilient, muting backlash and preserving governing legitimacy.",
      bear_case:
        "Sticky prices or labor weakness convert macro frustration into broad anti-incumbent energy.",
      base_case:
        "Mixed macro signals keep public opinion unstable and selective rather than catastrophic.",
      wildcard_case:
        "A supply shock or fiscal accident re-orders the political agenda around crisis management.",
      evidence_for: [
        "Improving real wages can stabilize perceptions over time",
        "Macro relief gives the administration message discipline",
      ],
      evidence_against: [
        "Voters often react to level effects, not just trend improvement",
        "Economic narratives can sour faster than the data improves",
      ],
      leading_indicators: [
        "Inflation expectations",
        "Consumer-sentiment gaps by party and income cohort",
        "Payroll revision direction",
      ],
      disconfirming_signals: [
        "Sustained sentiment recovery despite mediocre growth",
        "Policy polling that decouples from macro dissatisfaction",
      ],
    },
    {
      name: "Narrative and coalition durability",
      why_it_matters:
        "Governing power erodes quickly when the administration loses the ability to define events and keep its coalition aligned.",
      key_drivers: [
        "Media agenda-setting",
        "Coalition issue splits",
        "Elite defections or donor pressure",
      ],
      bull_case:
        "The coalition absorbs internal disagreements without allowing them to become identity-level fractures.",
      bear_case:
        "Narrative chaos and coalition fragmentation make every event look like proof of drift and incompetence.",
      base_case:
        "Narrative control weakens episodically but does not fully collapse into an open coalition break.",
      wildcard_case:
        "A single symbolic event sharply compresses confidence among swing constituencies and elite allies.",
      evidence_for: [
        "The administration still has issue areas where coalition language remains coordinated",
        "Opposition overreach can restore temporary cohesion",
      ],
      evidence_against: [
        "Media cycles reward conflict amplification",
        "Coalitions under stress tend to reveal latent fractures all at once",
      ],
      leading_indicators: [
        "Elite and surrogate message divergence",
        "Issue-salience shifts among independents",
        "Donor and activist pressure points",
      ],
      disconfirming_signals: [
        "High-profile dissent resolves without measurable polling damage",
        "Coalition subgroups converge on a shared priorities list",
      ],
    },
  ],
  scenarios: [
    {
      name: "Base case: narrower governability",
      description:
        "The administration keeps functional control but loses ambition. Policy throughput narrows to incremental, lower-heat priorities while contested items stall or get diluted.",
      probability: 45,
      impact: "medium",
      time_horizon: "through 2027",
      confidence: "medium",
      leading_indicators: [
        "More reliance on small-bore executive actions",
        "Declining success rate on contested legislative priorities",
        "Mixed but not catastrophic macro sentiment",
      ],
    },
    {
      name: "Bear case: visible loss of policy momentum",
      description:
        "A mix of macro frustration, court setbacks, and coalition slippage turns the administration into a reactive operator with little agenda-setting capacity.",
      probability: 30,
      impact: "high",
      time_horizon: "through 2027",
      confidence: "medium",
      leading_indicators: [
        "Factional public defections",
        "Back-to-back legal reversals",
        "Persistent anti-incumbent macro polling",
      ],
    },
    {
      name: "Bull case: selective policy resilience",
      description:
        "Better macro conditions and disciplined prioritization preserve enough legitimacy to keep moving a narrower but real agenda.",
      probability: 20,
      impact: "medium",
      time_horizon: "through 2027",
      confidence: "low",
      leading_indicators: [
        "Improved real-income data",
        "Clean passage of targeted priorities",
        "Reduced coalition message divergence",
      ],
    },
    {
      name: "Wildcard: shock-driven reset",
      description:
        "An external event or opposition error unexpectedly resets the political field and gives the administration a temporary governing burst.",
      probability: 5,
      impact: "high",
      time_horizon: "12 to 18 months",
      confidence: "low",
      leading_indicators: [
        "Rapid issue-salience shifts",
        "Temporary bipartisan bargaining windows",
      ],
    },
  ],
  hidden_variables: [
    "Whether coalition tensions are tactical disagreements or deeper value-level fractures",
    "How much court timing, not just court ideology, alters policy sequencing",
    "Whether macro improvement is felt broadly enough to matter politically",
  ],
  change_my_mind_conditions: [
    "A sustained improvement in public economic perceptions without a corresponding rise in anti-incumbent sentiment",
    "Repeated evidence that contested priorities can still clear Congress or survive courts",
    "A major coalition dispute resolving with no measurable damage to trust or message cohesion",
  ],
  bottom_line:
    "The most likely outcome is not full collapse but narrowing governability: fewer clean wins, more defensive sequencing, and a greater dependence on external conditions to preserve momentum.",
  watchlist: [
    "Factional whip-count leakage on priority votes",
    "Court timing around flagship initiatives",
    "Inflation expectations and real wage trend",
    "Independent-voter issue salience",
    "High-profile coalition message divergence",
  ],
});

const BITCOIN_ANALYSIS = AnalysisOutputSchema.parse({
  title: "Bitcoin: 12-Month Bull, Base, and Bear Cases",
  original_question:
    "What are the real bull, base, and bear cases for Bitcoin over the next 12 months?",
  reframed_question:
    "Over the next 12 months, what mix of macro liquidity, ETF flows, regulatory posture, positioning, and reflexive narrative dynamics is most likely to drive Bitcoin’s price path?",
  time_horizon: "next 12 months",
  objective: "invest",
  definitions: [
    {
      term: "Bull case",
      definition:
        "A path where capital inflows, narrative strength, and market structure reinforce higher prices materially.",
    },
    {
      term: "Base case",
      definition:
        "The central scenario balancing upside catalysts against volatility, policy friction, and position crowding.",
    },
    {
      term: "Bear case",
      definition:
        "A path where liquidity, regulation, or positioning dynamics unwind the current thesis.",
    },
  ],
  domains: ["crypto", "macro", "markets", "regulation", "behavioral"],
  key_drivers: [
    "Global liquidity and real-rate direction",
    "ETF and institutional flow persistence",
    "Regulatory tone toward crypto market structure",
    "Leverage and positioning crowding",
    "Narrative reflexivity and retail re-engagement",
  ],
  lenses: [
    {
      name: "Liquidity and macro",
      why_it_matters:
        "Bitcoin tends to perform best when liquidity is easing, real rates are contained, and risk appetite broadens.",
      key_drivers: [
        "Dollar direction",
        "Real-yield trend",
        "Liquidity expansion versus tightening",
      ],
      bull_case:
        "Easier macro conditions re-open risk appetite and support continued digital-asset bid depth.",
      bear_case:
        "Tighter financial conditions compress multiples and make crypto beta harder to sustain.",
      base_case:
        "Macro remains mixed, creating tradable volatility without a clean one-way trend.",
      wildcard_case:
        "A macro shock turns Bitcoin into a temporary liquidity barometer rather than a crypto-specific story.",
      evidence_for: [
        "Liquidity expansion historically improves beta assets",
        "Narratives strengthen when macro headwinds soften",
      ],
      evidence_against: [
        "Bitcoin can still sell off hard during policy surprises",
        "Macro is necessary but not sufficient when positioning is crowded",
      ],
      leading_indicators: [
        "Real-yield direction",
        "Dollar trend",
        "Broad risk-asset breadth",
      ],
      disconfirming_signals: [
        "Bitcoin underperforming despite easier liquidity",
        "Rising rates with no deterioration in crypto risk appetite",
      ],
    },
    {
      name: "Institutional flow durability",
      why_it_matters:
        "The strongest medium-term bull thesis depends on whether new access products keep converting curiosity into persistent demand.",
      key_drivers: [
        "ETF net flows",
        "Treasury and corporate allocation appetite",
        "Sell-side distribution support",
      ],
      bull_case:
        "Access vehicles continue to pull in steady institutional demand and deepen spot support.",
      bear_case:
        "Flows fade after the first allocation wave, exposing a weaker marginal-buyer base than the market expected.",
      base_case:
        "Institutional flows remain positive but episodic, limiting straight-line upside.",
      wildcard_case:
        "A major allocator publicly reframes Bitcoin as a strategic reserve-like asset and resets the narrative.",
      evidence_for: [
        "Access matters for previously constrained allocators",
        "Incremental institutional participation changes market structure",
      ],
      evidence_against: [
        "A one-time access unlock can be mistaken for durable recurring demand",
        "Flow headlines may hide weak underlying breadth",
      ],
      leading_indicators: [
        "ETF flow streak quality",
        "Block trade behavior around macro events",
        "Large-holder net accumulation",
      ],
      disconfirming_signals: [
        "Flat price despite strong headline flows",
        "Flow concentration in one venue without broader market confirmation",
      ],
    },
    {
      name: "Positioning and reflexivity",
      why_it_matters:
        "Bitcoin often overshoots in both directions because narrative, leverage, and price action feed back into one another.",
      key_drivers: [
        "Leverage build-up",
        "Retail participation",
        "Funding and basis behavior",
      ],
      bull_case:
        "Positioning stays healthy enough for narrative to attract new demand without triggering a violent unwind.",
      bear_case:
        "Crowded longs and leverage make the market fragile to even modest negative surprises.",
      base_case:
        "Reflexivity drives sharp swings, but the structure alternates between squeeze and digestion rather than breaking decisively.",
      wildcard_case:
        "A large non-crypto shock forces indiscriminate de-risking and temporarily overrides crypto-specific fundamentals.",
      evidence_for: [
        "Reflexive rallies can persist longer than fundamental models imply",
        "Narrative and access can create self-reinforcing demand loops",
      ],
      evidence_against: [
        "Leverage-heavy rallies are vulnerable to liquidation cascades",
        "Retail enthusiasm often arrives late in the cycle",
      ],
      leading_indicators: [
        "Funding-rate persistence",
        "Options skew",
        "Retail app rankings and search interest",
      ],
      disconfirming_signals: [
        "Clean breakouts without leverage expansion",
        "Retail apathy during strong upside continuation",
      ],
    },
  ],
  scenarios: [
    {
      name: "Base case: upward but unstable",
      description:
        "Bitcoin trends constructively over 12 months, but the path is volatile, with sharp drawdowns caused by leverage and macro repricing rather than thesis failure.",
      probability: 45,
      impact: "medium",
      time_horizon: "next 12 months",
      confidence: "medium",
      leading_indicators: [
        "Intermittent but positive ETF flows",
        "Mixed macro backdrop",
        "Leverage resets without structural breakdown",
      ],
    },
    {
      name: "Bull case: reflexive upside extension",
      description:
        "Institutional access stays sticky, macro loosens, and price strength attracts incremental demand fast enough to sustain a stronger upside regime.",
      probability: 30,
      impact: "high",
      time_horizon: "next 12 months",
      confidence: "medium",
      leading_indicators: [
        "Persistent positive ETF flows",
        "Dollar softness",
        "Healthy breakouts with broad market confirmation",
      ],
    },
    {
      name: "Bear case: crowded-trade unwind",
      description:
        "Macro tightening, policy friction, or fading marginal demand exposes fragile positioning and drives a deep but not necessarily thesis-ending reset.",
      probability: 20,
      impact: "high",
      time_horizon: "next 12 months",
      confidence: "medium",
      leading_indicators: [
        "Funding and basis overheating",
        "Weakening flows",
        "Risk-asset breadth deterioration",
      ],
    },
    {
      name: "Wildcard: regulatory narrative break",
      description:
        "A major regulatory or policy event unexpectedly changes how allocators treat crypto risk, creating a regime shift in either direction.",
      probability: 5,
      impact: "high",
      time_horizon: "6 to 12 months",
      confidence: "low",
      leading_indicators: [
        "Market-structure rule changes",
        "Large exchange or custody policy shocks",
      ],
    },
  ],
  hidden_variables: [
    "How much current demand is recurring allocation versus one-time access conversion",
    "Whether Bitcoin behaves more like a high-beta liquidity asset or a distinct macro hedge in the next shock",
    "How much retail re-engagement is needed to sustain the next leg higher",
  ],
  change_my_mind_conditions: [
    "Persistent ETF inflows with weak price response would weaken the bull thesis",
    "Bitcoin outperforming through tighter real rates would upgrade its resilience",
    "A deep drawdown without leverage excess would suggest a more structural demand problem",
  ],
  bottom_line:
    "The cleanest base case is constructive but unstable: Bitcoin still has upside if liquidity and access stay supportive, but the path is likely to include severe, positioning-driven air pockets.",
  watchlist: [
    "ETF flow persistence versus headline-only spikes",
    "Funding, basis, and options-skew regime",
    "Dollar and real-rate direction",
    "Retail search and app-engagement reacceleration",
    "Crypto market-structure policy developments",
  ],
});

const GAMING_ANALYSIS = AnalysisOutputSchema.parse({
  title: "Racing Game Retention After Launch",
  original_question:
    "Will a major racing game retain players six months after launch, and what would change that view?",
  reframed_question:
    "Six months after launch, what combination of gameplay depth, live-ops cadence, monetization tolerance, and community health will determine whether a major racing title retains a durable player base?",
  time_horizon: "six months after launch",
  objective: "monitor",
  definitions: [
    {
      term: "Retain players",
      definition:
        "Maintain a meaningful active player base with healthy repeat engagement rather than relying on launch-week sales alone.",
    },
    {
      term: "Durable player base",
      definition:
        "A core audience that returns frequently enough to support matchmaking, content updates, and social momentum.",
    },
    {
      term: "What would change the view",
      definition:
        "The specific operational or community signals that would upgrade or downgrade the retention thesis.",
    },
  ],
  domains: ["gaming", "product", "behavioral", "community", "monetization"],
  key_drivers: [
    "Core driving loop depth",
    "Post-launch content cadence",
    "Monetization friction versus goodwill",
    "Community and creator momentum",
    "Technical stability and patch discipline",
  ],
  lenses: [
    {
      name: "Core loop durability",
      why_it_matters:
        "If the underlying driving feel and progression loop do not create mastery or replay desire, live-ops cannot fully compensate.",
      key_drivers: [
        "Handling depth",
        "Progression pacing",
        "Mode variety and replayability",
      ],
      bull_case:
        "Players discover enough depth and identity in the driving model to keep experimenting after launch novelty fades.",
      bear_case:
        "The game feels solved quickly, turning retention into a content treadmill problem.",
      base_case:
        "The core loop supports a healthy niche audience but not broad mass stickiness on its own.",
      wildcard_case:
        "One mode or creator meta unexpectedly becomes the long-tail retention engine.",
      evidence_for: [
        "Strong moment-to-moment handling keeps communities engaged",
        "Replayability improves when progression supports experimentation",
      ],
      evidence_against: [
        "Spectacle-first racers often burn hot and cool fast",
        "A weak endgame limits creator and community depth",
      ],
      leading_indicators: [
        "Week-two repeat session rates",
        "Mode completion distribution",
        "Creator challenge uptake",
      ],
      disconfirming_signals: [
        "Stable retention despite shallow engagement-time per session",
        "High user-generated challenge activity without strong progression depth",
      ],
    },
    {
      name: "Live-ops and content cadence",
      why_it_matters:
        "A retention thesis gets stronger when the team can create reasons to return before the audience churns out.",
      key_drivers: [
        "Patch cadence",
        "New events or tracks",
        "Seasonal content quality",
      ],
      bull_case:
        "The team lands a reliable, high-signal update rhythm that keeps the game feeling alive.",
      bear_case:
        "Slow or low-quality updates make launch excitement decay into abandonment.",
      base_case:
        "Content updates help, but only enough to stabilize a smaller committed audience.",
      wildcard_case:
        "A cross-platform or esports moment creates an unexpected second adoption wave.",
      evidence_for: [
        "Racing communities respond well to competitive seasons and time-limited events",
        "Predictable updates reduce churn risk",
      ],
      evidence_against: [
        "Content cadence cannot save a weak core loop",
        "Operational misses are remembered disproportionately early in lifecycle",
      ],
      leading_indicators: [
        "Time-to-first live update",
        "Patch sentiment",
        "Return-rate spikes after new events",
      ],
      disconfirming_signals: [
        "Retention holding without meaningful content drops",
        "Poor update sentiment without churn acceleration",
      ],
    },
    {
      name: "Community and monetization tolerance",
      why_it_matters:
        "Retention is fragile when players feel the game is stingy, exploitative, or socially empty.",
      key_drivers: [
        "Fairness of monetization",
        "Creator ecosystem",
        "Multiplayer health",
      ],
      bull_case:
        "Players view monetization as tolerable, creators keep making content, and multiplayer remains socially alive.",
      bear_case:
        "The conversation shifts from gameplay to monetization resentment and content drought.",
      base_case:
        "The game avoids a backlash but does not become a major community platform.",
      wildcard_case:
        "A major controversy catalyzes negative social proof and compresses retention fast.",
      evidence_for: [
        "Fair economy design can preserve goodwill even without massive content scale",
        "Creator visibility amplifies reasons to return",
      ],
      evidence_against: [
        "Cosmetic-only monetization can still feel exhausting if progression is weak",
        "Multiplayer health can collapse abruptly once matchmaking thins",
      ],
      leading_indicators: [
        "Store sentiment",
        "Creator upload frequency",
        "Matchmaking time trend",
      ],
      disconfirming_signals: [
        "Stable concurrency despite monetization complaints",
        "Improving social momentum without major creator support",
      ],
    },
  ],
  scenarios: [
    {
      name: "Base case: healthy niche retention",
      description:
        "The game retains a committed but narrower player base because the core loop works well enough and live-ops is competent, even if it does not become a breakout evergreen platform.",
      probability: 50,
      impact: "medium",
      time_horizon: "six months after launch",
      confidence: "medium",
      leading_indicators: [
        "Solid week-four retention",
        "Consistent update cadence",
        "Matchmaking stability in core modes",
      ],
    },
    {
      name: "Bull case: durable community flywheel",
      description:
        "Gameplay depth, competitive events, and creator momentum reinforce each other and turn the game into a durable live title.",
      probability: 25,
      impact: "high",
      time_horizon: "six months after launch",
      confidence: "medium",
      leading_indicators: [
        "Strong repeat sessions",
        "Creator-led challenge adoption",
        "Positive response to early seasonal content",
      ],
    },
    {
      name: "Bear case: novelty fades fast",
      description:
        "Once launch curiosity clears, limited depth or weak post-launch execution leads to a sharp engagement drop and social thinning.",
      probability: 20,
      impact: "high",
      time_horizon: "first 12 weeks",
      confidence: "medium",
      leading_indicators: [
        "Weak return-rate trend after week two",
        "Negative patch or monetization sentiment",
        "Rising queue times",
      ],
    },
    {
      name: "Wildcard: controversy-driven churn shock",
      description:
        "A monetization, technical, or online-service controversy shifts community discussion negative and accelerates churn beyond normal decay.",
      probability: 5,
      impact: "high",
      time_horizon: "first three months",
      confidence: "low",
      leading_indicators: [
        "Sharp review-score deterioration",
        "Creator sentiment flipping negative in a compressed window",
      ],
    },
  ],
  hidden_variables: [
    "How much hidden depth exists beyond the first 10 hours",
    "Whether cross-platform social play materially improves stickiness",
    "How resilient the community is to one bad live-service beat early on",
  ],
  change_my_mind_conditions: [
    "Exceptionally strong repeat-session data despite a modest content cadence would improve the retention thesis",
    "Rising queue times or creator drop-off in the first two months would weaken the base case quickly",
    "A backlash over monetization or technical instability would shift probability toward the bear case faster than normal content misses",
  ],
  bottom_line:
    "The default view should be cautious optimism: a good racing game can keep a committed audience, but six-month durability depends heavily on early live-ops competence and whether the core loop supports genuine replay depth.",
  watchlist: [
    "Week-two and week-four repeat-session rates",
    "Time-to-first meaningful content update",
    "Matchmaking times in core playlists",
    "Creator output frequency",
    "Sentiment around monetization and patch quality",
  ],
});

const GENERIC_ANALYSIS = AnalysisOutputSchema.parse({
  title: "Cross-Domain Worldview Analysis",
  original_question:
    "What are the serious angles, scenarios, and watchpoints behind this question?",
  reframed_question:
    "What is the cleanest analytical framing of this question, which domains matter most, and which scenarios should a decision-maker monitor?",
  time_horizon: "next 12 months",
  objective: "understand",
  definitions: [
    {
      term: "Serious angle",
      definition:
        "A causal lens that could materially change the answer rather than a cosmetic talking point.",
    },
    {
      term: "Scenario",
      definition:
        "A coherent path with distinct implications, signals, and probability weight.",
    },
    {
      term: "Watchpoint",
      definition:
        "A leading indicator or disconfirming signal that should update the current view.",
    },
  ],
  domains: ["strategy", "economics", "behavioral", "institutional"],
  key_drivers: [
    "Incentive alignment",
    "Constraint intensity",
    "Timing and trigger events",
    "Narrative and perception",
    "Second-order effects",
  ],
  lenses: [
    {
      name: "Incentives and decision rights",
      why_it_matters:
        "Outcomes usually follow who has the power to decide and what they are rewarded for doing.",
      key_drivers: [
        "Who controls the key decision",
        "What trade-offs they face",
        "What failure looks like for them",
      ],
      bull_case:
        "Decision-makers are aligned with the favorable outcome and have enough room to execute.",
      bear_case:
        "The key actors are incentivized to protect themselves rather than optimize the system outcome.",
      base_case:
        "Incentives stay mixed, producing partial progress and recurring friction.",
      wildcard_case:
        "A new actor or rule change shifts who actually has leverage.",
      evidence_for: [
        "Clear ownership can improve execution speed",
        "Aligned incentives reduce internal sabotage",
      ],
      evidence_against: [
        "Formal power can differ from practical power",
        "Actors often optimize around hidden constraints",
      ],
      leading_indicators: [
        "Decision timing",
        "Resource allocation changes",
        "Message discipline from key actors",
      ],
      disconfirming_signals: [
        "Execution improves despite obviously misaligned incentives",
        "Ownership changes without outcome changes",
      ],
    },
    {
      name: "Timing and trigger events",
      why_it_matters:
        "Even the correct thesis can fail if the catalysts arrive too late or in the wrong order.",
      key_drivers: [
        "Catalyst sequencing",
        "Window of opportunity",
        "Sensitivity to shocks",
      ],
      bull_case:
        "The relevant catalysts arrive in an order that strengthens the favorable path.",
      bear_case:
        "An adverse trigger lands before the system is ready, forcing a weaker path.",
      base_case:
        "Timing stays noisy, creating volatility around a middling central outcome.",
      wildcard_case:
        "An external shock compresses multiple catalysts into a short window.",
      evidence_for: [
        "Timing often explains why good ideas still fail",
        "Sequencing can change payoff more than direction",
      ],
      evidence_against: [
        "Strong fundamentals can survive poor short-term timing",
        "Markets and institutions can front-run obvious catalysts",
      ],
      leading_indicators: [
        "Calendar risk",
        "Pre-positioning behavior",
        "Threshold events getting closer",
      ],
      disconfirming_signals: [
        "No reaction to a major trigger",
        "Outcome improves despite catalyst delay",
      ],
    },
  ],
  scenarios: [
    {
      name: "Base case",
      description:
        "The system moves in the expected direction, but more slowly and with more friction than the initial narrative suggests.",
      probability: 50,
      impact: "medium",
      time_horizon: "next 12 months",
      confidence: "medium",
      leading_indicators: [
        "Mixed but improving execution signals",
        "No decisive break in the current trend",
      ],
    },
    {
      name: "Bull case",
      description:
        "The favorable thesis compounds because incentives, timing, and perception reinforce each other.",
      probability: 25,
      impact: "high",
      time_horizon: "next 12 months",
      confidence: "low",
      leading_indicators: [
        "Catalysts arriving in the right order",
        "Positive feedback in key metrics",
      ],
    },
    {
      name: "Bear case",
      description:
        "A constraint or misaligned incentive dominates the system and pushes the outcome off the favorable path.",
      probability: 20,
      impact: "high",
      time_horizon: "next 12 months",
      confidence: "medium",
      leading_indicators: [
        "Execution slippage",
        "Resource pullback",
        "Narrative deterioration",
      ],
    },
    {
      name: "Wildcard",
      description:
        "An external shock changes the relevant decision-makers, timing, or payoff structure faster than expected.",
      probability: 5,
      impact: "high",
      time_horizon: "3 to 12 months",
      confidence: "low",
      leading_indicators: [
        "New external triggers",
        "Unexpected stakeholder behavior",
      ],
    },
  ],
  hidden_variables: [
    "Which constraint is still under-measured",
    "Whether narrative is leading reality or lagging it",
    "How much second-order behavior changes the primary thesis",
  ],
  change_my_mind_conditions: [
    "A high-quality indicator materially improves or worsens the execution path",
    "The identity of the key decision-maker or constraint changes",
    "Catalyst sequencing changes the payoff structure",
  ],
  bottom_line:
    "The right default is disciplined uncertainty: keep the base case central, but treat incentives, timing, and hidden constraints as the main levers that can reprice the question fast.",
  watchlist: [
    "Constraint intensity",
    "Decision timing",
    "Resource allocation changes",
    "Leading perception shifts",
    "Second-order effects becoming first-order",
  ],
});

export function buildMockAnalysisResult(input: AnalysisInput) {
  const haystack = `${input.question} ${input.domain}`.toLowerCase();

  let template = GENERIC_ANALYSIS;
  let key = "generic";

  if (haystack.includes("bitcoin") || haystack.includes("crypto")) {
    template = BITCOIN_ANALYSIS;
    key = "bitcoin";
  } else if (
    haystack.includes("administration") ||
    haystack.includes("policy") ||
    haystack.includes("election") ||
    haystack.includes("president")
  ) {
    template = POLICY_ANALYSIS;
    key = "policy";
  } else if (
    haystack.includes("game") ||
    haystack.includes("gaming") ||
    haystack.includes("player") ||
    haystack.includes("launch")
  ) {
    template = GAMING_ANALYSIS;
    key = "gaming";
  }

  const seededAnalysis = withInputOverrides(template, input);
  const analysis =
    (input.objective || "").trim().toLowerCase() === "monitor"
      ? toMonitorAnalysis(seededAnalysis, input)
      : AnalysisOutputSchema.parse(seededAnalysis);

  return {
    analysis,
    rawText: JSON.stringify(analysis, null, 2),
    promptVersion: `mock-${key}-v1`,
    modelUsed: `mock:${key}`,
  };
}
