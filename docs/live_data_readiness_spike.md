# Live Data Readiness Spike

Date: 2026-04-14
Status: Design spike — no runtime code changes
Baseline: `wv-v6.4-core` at 3.59 overall (gpt-4.1 judge)

---

## 1. Current State

Worldview OS produces structured analyses entirely from LLM pre-trained knowledge. No external data is fetched at runtime.

Working features: structured output schemas (standard + monitor), quality assertions, red-team refinement, persistent history with follow-ups, evaluation harness with 12 cases and honest cross-model judge.

Prompt tuning reached diminishing returns at the `wv-v6.4-core` baseline. The next quality jump requires grounding claims in real evidence.

## 2. Problem Statement

Three problems without live data:

1. **Staleness**: Analysis of "Bitcoin's 12-month outlook" cannot reference actual current price, funding rates, or flows.
2. **Fabrication risk**: The `current_read` field on monitoring signals sometimes produces specific-sounding qualitative stances indistinguishable from fabricated current-state claims.
3. **Watchlist inertness**: Items say "track X" but the system cannot say what X currently reads.

## 3. Goals and Non-Goals

**Goals:**
- Design a contract for how live evidence enters the pipeline
- Choose the narrowest first pilot domain and source set
- Define honesty rules so the product never fabricates freshness
- Define failure behavior for graceful degradation
- Produce a design one engineer can implement safely

**Non-goals:**
- Build integrations in this spike
- Design broad "ingest everything" architecture
- Add streaming, browser automation, web scraping
- Redesign the core analysis engine
- Add multi-agent orchestration

---

## 4. Source Contract

### A. Source Registration

```typescript
type SourceRegistration = {
  source_id: string;            // e.g. "coingecko-btc-price"
  source_name: string;          // e.g. "CoinGecko BTC/USD Spot"
  source_type: "quantitative" | "qualitative" | "event" | "mixed";
  supported_domains: string[];  // e.g. ["crypto", "markets"]
  refresh_cadence: string;      // e.g. "5m", "1h", "daily"
  trust_tier: "primary" | "secondary" | "supplementary";
  max_staleness_seconds: number;
  failure_mode: "degrade" | "block";
};
```

### B. Source Response

```typescript
type SourceResponse = {
  source_id: string;
  status: "ok" | "stale" | "error" | "unavailable";
  retrieved_at: string;         // ISO timestamp of fetch
  data_timestamp: string | null; // when source data was produced
  staleness_seconds: number;
  data: unknown;
  error_message: string | null;
};
```

### C. Trust Tiers

| Tier | Meaning | Pipeline Behavior |
|------|---------|-------------------|
| primary | High-reliability quantitative feed | May state value directly with attribution |
| secondary | Structured but less reliable | May reference but must attribute and note recency |
| supplementary | Low-frequency or manually maintained | May mention if present but must not depend on it |

---

## 5. Evidence Model

### A. Evidence Item

```typescript
type EvidenceItem = {
  evidence_id: string;
  source_id: string;
  claim: string;                 // e.g. "BTC/USD spot price is $67,400"
  evidence_type: "observed" | "derived" | "inferred";
  freshness: "live" | "recent" | "stale" | "unavailable";
  data_timestamp: string | null;
  retrieved_at: string;
  confidence: "high" | "medium" | "low";
  supported_sections: string[]; // e.g. ["current_read", "watchlist", "scenarios"]
  raw_value: unknown;
};
```

### B. Freshness Definitions

| Label | Meaning | Max Age |
|-------|---------|---------|
| live | Fetched within current analysis request | 5 minutes |
| recent | Fetched within last retrieval window | 1 hour |
| stale | Older than source max_staleness | varies |
| unavailable | Source failed or returned no data | N/A |

### C. Evidence Types

| Type | Meaning | Example |
|------|---------|---------|
| observed | Directly from source, no inference | "BTC/USD is $67,400 per CoinGecko at 14:32 UTC" |
| derived | Computed from observed data | "7-day funding rate average is +0.02%" |
| inferred | Model reasoning about observed data | "Funding rates suggest moderate leverage" |

### D. Persistence

New nullable `evidenceSnapshotJson` text column on Analysis model. Contains the EvidenceItem array used at generation time. Follow-ups reference the saved snapshot, not live feeds.

---

## 6. Freshness and Honesty Rules

These are non-negotiable.

**What may be called "live":**
Only data fetched within the current request, from a primary-tier source, with data_timestamp ≤ 5 minutes old. Must include source attribution and timestamp.

**What counts as "recent snapshot":**
Data fetched within the last hour. Must say "as of [timestamp]" and name the source. Must NOT use language implying real-time currency.

**What counts as "stale":**
Data older than source max_staleness_seconds. Must display visible staleness warning. Model must NOT make current-state claims from stale data. May reference as "the last available reading was X at [timestamp]."

**When evidence is unavailable:**
Section must display: "Source [name] was unavailable at the time of this analysis." Model falls back to pre-trained reasoning and labels it: "Based on structural reasoning only (no live data available)." The current_read field must say: "Unavailable — to be checked manually."

**What the model may infer:**
Structural reasoning about what observed data implies. E.g. "Funding rates at +0.04% suggest moderate leverage, which historically precedes..."

**What the model may NOT do:**
- Fabricate specific current values without a source
- Imply freshness using pre-trained knowledge ("Recent data suggests..." without attribution)
- Use "currently" unless referring to an observed value from the evidence block

**Follow-up honesty:**
Follow-ups reference the saved evidence snapshot. If user asks about current state: "This follow-up uses saved context from [date]. For current data, regenerate the analysis."

---

## 7. Failure Behavior

| Failure State | Pipeline Behavior | User-Visible Behavior |
|--------------|-------------------|----------------------|
| Source timeout (>10s) | Skip, mark unavailable, continue | "Source timed out. Using pre-trained reasoning for this signal." |
| Source error | Skip, log, mark unavailable | Same as timeout |
| All sources fail | Continue pre-trained-only, flag ungrounded | "No live data available. Pre-trained reasoning only." |
| Partial success | Use available, mark missing per-signal | Per-signal freshness: live / stale / unavailable |
| Source stale | Include but restrict current-state claims | "Last reading: $65,200 at [timestamp] (stale)." |
| Sources disagree | Include both with attribution | "Source A reports X, Source B reports Y." |
| Domain has no live support | Standard pre-trained analysis | No change from current behavior |

**Principle:** Degrade gracefully, never silently. Every section that could have used evidence but didn't must say why.

---

## 8. First Pilot Domain: Crypto (BTC only)

### Why crypto, not macro

| Factor | Crypto | Macro |
|--------|--------|-------|
| Free API availability | Excellent (CoinGecko, no key needed) | Limited (FRED, slow updates) |
| Data freshness | Real-time | Monthly/quarterly |
| Eval coverage | 4 cases (all 4 objectives) | 2 cases |
| Monitor benefit | Very high (price, flows are exact monitor signals) | Moderate |
| current_read benefit | Observed values replace guesses | Still mostly qualitative |
| Fabrication risk without data | High (prices change daily) | Lower (macro moves slowly) |
| Implementation complexity | Low (simple JSON REST) | Medium (XML/CSV parsing) |

### Narrowest Viable Source Set

**Source 1: CoinGecko Simple Price** (primary, quantitative)
- `GET /api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true`
- Provides: BTC/USD spot, 24h change %
- Free tier: 10-30 calls/min, no key required
- Failure mode: degrade

**Source 2: CoinGecko Market Data** (primary, quantitative)
- `GET /api/v3/coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false`
- Provides: market cap, volume, circulating supply, ATH, 7d/14d/30d change
- Same rate limit
- Failure mode: degrade

Two endpoints. One API. One asset. Nothing else in the first pilot.

### What the Pilot Improves

| Section | Before | After |
|---------|--------|-------|
| current_read | "likely near neutral based on macro trajectory" | "BTC/USD $67,400 (-2.3% 24h) as of 14:32 UTC per CoinGecko" |
| scenarios | Generic reasoning about possible paths | Can reference actual price level as starting point |
| watchlist | "Track BTC price" | "BTC/USD at $67,400. Downgrade if < $60,000 sustained 1 week." |
| bottom line | Directional call from reasoning | Directional call grounded in observed price regime |

### What the Pilot Excludes

- On-chain data, funding rates, basis, open interest
- News/event feeds
- Non-crypto domains
- Stablecoin or ETF flow data
- Multiple crypto assets

---

## 9. Product Behavior for Source-Aware Analyses

### A. Analysis Flow

```
Current:
  question → prompts → LLM → validate → red-team → save → render

Source-aware:
  question → domain check → source eligibility
    → eligible: fetch sources (parallel, 10s timeout) → normalize to EvidenceItems
    → not eligible: proceed pre-trained only
  → prompts (with evidence block if available)
  → LLM → validate → red-team (with evidence) → save (with snapshot) → render
```

Source fetching happens before prompt building. Evidence is a structured block appended to the user prompt with strict usage rules. Red-team receives the same evidence block.

### B. UI Behavior

**Source indicator badge** (analysis header):
- Green: "Live data (CoinGecko, 14:32 UTC)"
- Amber: "Stale data (CoinGecko, 2h ago)"
- Gray: "Pre-trained reasoning only"

**Per-signal attribution** (monitor signal cards, below current_read):
- "Source: CoinGecko | As of: 14:32 UTC | Freshness: live"

**Stale/missing** (inline):
- "Data unavailable — using structural reasoning"
- "Last reading: $65,200 at 08:00 UTC (stale)"

**Follow-up disclosure**:
- "Evidence snapshot from [date]. No live refresh for follow-ups."

### C. Prompting Contract

When evidence is available, append after schema instruction:

```
Evidence block:
The following observed data was retrieved at the timestamps shown.
Use these values for current-state claims. Do not fabricate beyond what is provided.

- BTC/USD spot price is $67,400 (coingecko-btc-simple, live, 2026-04-14T14:32:00Z)
- BTC 24h change is -2.3% (coingecko-btc-simple, live, 2026-04-14T14:32:00Z)
- BTC 30d change is +8.1% (coingecko-btc-market, live, 2026-04-14T14:32:00Z)
- BTC market cap is $1.33T (coingecko-btc-market, live, 2026-04-14T14:32:00Z)

Rules:
- Reference observed values with source attribution
- Do not extrapolate or update observed values
- If no evidence for a claim, use structural reasoning and label it
- Do not use "currently" unless referring to a value from this block
```

When evidence is NOT available: no block appended, prompt unchanged from current behavior.

---

## 10. Source-Aware Evaluation Plan

### New Test Cases

| ID | Question | Objective | Source-Aware |
|----|----------|-----------|-------------|
| 13-btc-live-monitor | Current Bitcoin risk posture and signals to track this week | monitor | Yes |
| 14-btc-live-invest | Given current conditions, Bitcoin risk-reward for next 30 days | invest | Yes |
| 15-btc-control-monitor | Same as 13, sources disabled | monitor | No (control) |

### New Dimensions (source-aware cases only)

| Dimension | What It Measures |
|-----------|-----------------|
| evidence_grounding | Current-state claims backed by attributed source data? |
| freshness_honesty | Correctly represents live vs stale vs unavailable? |
| source_attribution | Source names and timestamps consistently present? |

### Failure/Degradation Tests

| Test | Setup | Expected |
|------|-------|----------|
| All sources fail | Mock returns error | Pre-trained with "no live data" badge |
| One source stale | Mock old timestamp | Stale badge, "last known reading" language |
| Source vs model disagreement | Source shows unexpected value | Both shown with attribution |

### Success Criteria

- evidence_grounding ≥ 4.0
- freshness_honesty ≥ 4.0
- Source-aware monitor > pre-trained monitor on watchlist_action_usefulness
- No regression on 12-case baseline (overall ≥ 3.59)

### Failure Conditions (do not expand pilot)

- evidence_grounding < 3.5
- freshness_honesty < 3.5
- Overall baseline regresses below 3.50
- Source failures produce confusing UX

---

## 11. Implementation Sequence

| Phase | Scope | Days | Changes |
|-------|-------|------|---------|
| 1 | Source adapter + evidence plumbing | 1-2 | New lib/sources/, evidence normalizer, Prisma column. No prompt/UI changes. |
| 2 | Prompt integration | 3 | Evidence block in buildPrompts(), red-team evidence awareness. |
| 3 | Pipeline integration | 4 | Source fetching in runAnalysis(), liveDataEnabled setting. |
| 4 | UI integration | 5 | Source badges, per-signal attribution, follow-up disclosure, markdown. |
| 5 | Evaluation | 6 | 3 new cases, 3 new dimensions, 15-case eval. |

Each phase independently mergeable. Feature gated by `liveDataEnabled: false`.

---

## 12. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Model overclaiming beyond evidence | High | Red-team verification + evidence_grounding eval dimension |
| CoinGecko rate limiting | Medium | 5-min response cache + graceful degradation on 429 |
| Evidence bloating prompt budget | Low | ~200 tokens of evidence vs 7,200 budget |
| Source API changes | Low | Adapter pattern isolates source logic |

---

## 13. What Should Wait

| Feature | Why Wait |
|---------|----------|
| On-chain data (Glassnode) | Paid API; validate free pilot first |
| News/event feeds | High noise; needs separate design spike |
| Macro data (FRED) | Lower frequency; second pilot |
| Cross-analysis evidence threading | Separate feature |
| Auto re-analysis on source updates | Needs scheduler infrastructure |
| Multiple crypto assets | BTC only until pilot validates |

---

## 14. Recommended Next Step

Implement Phase 1: source adapter + evidence normalization in isolation. No prompt, pipeline, or UI changes. Testable independently. Feature gated. Zero risk to existing functionality.
