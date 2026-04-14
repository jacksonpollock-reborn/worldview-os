# Live Data Pilot: Implementation Plan

Pilot domain: **Crypto (BTC only)**
Source: **CoinGecko Free API (2 endpoints)**
Estimated effort: **5-6 days, one engineer**
Prerequisite: Design spike completed (see `live_data_readiness_spike.md`)
Canonical prompt lineage:
- Core baseline: `wv-v6.4-core`
- BTC live pilot: `wv-v6.4-core+btc-live-pilot`

---

## Phase 1: Source Adapter + Evidence Plumbing (Days 1-2)

Build the data-fetching and normalization layer. No prompt, pipeline, or UI changes.

### Files to create

```
lib/sources/types.ts           — SourceRegistration, SourceResponse, EvidenceItem types
lib/sources/source-registry.ts — domain-to-source mapping, eligibility check
lib/sources/coingecko.ts       — CoinGecko adapter returning SourceResponse
lib/evidence.ts                — normalize SourceResponses to EvidenceItem[], handle failures
```

### Schema migration

Add to Analysis model in `prisma/schema.prisma`:
```prisma
evidenceSnapshotJson  String?   // JSON array of EvidenceItem[]
evidenceSourcesJson   String?   // JSON array of SourceSummary[]
```

Nullable columns — no migration risk for existing records. Run `npx prisma db push`.

### Acceptance criteria

- `fetchCoinGeckoSimplePrice()` returns valid SourceResponse
- `fetchCoinGeckoMarketData()` returns valid SourceResponse
- Both handle timeout (10s), non-2xx, and parse errors gracefully
- `normalizeToEvidence()` produces valid EvidenceItem[] from SourceResponses
- `checkSourceEligibility("crypto")` returns registered sources
- `checkSourceEligibility("politics")` returns empty
- Evidence freshness classification works: live (≤5m), recent (≤1h), stale (>max)

### Not in Phase 1
- No prompt changes
- No pipeline changes
- No UI changes
- No calls from existing code paths

---

## Phase 2: Prompt Integration (Day 3)

Teach prompts to use evidence when available.

### Files to create
```
lib/evidence-prompt.ts — evidence block builder + usage rules
```

### Files to modify
```
lib/prompt-builder.ts — accept optional EvidenceItem[], inject evidence block
```

### Evidence block format

Appended after `{{schema_instruction}}` replacement, only when evidence is non-empty:

```
Evidence block:
The following observed data was retrieved at the timestamps shown.
Use these values for current-state claims. Do not fabricate beyond what is provided.

- BTC/USD spot price is $67,400 (coingecko-btc-simple, live, 14:32 UTC)
- BTC 24h change is -2.3% (coingecko-btc-simple, live, 14:32 UTC)

Rules:
- Reference observed values with source attribution
- Do not extrapolate or update observed values
- If no evidence for a claim, use structural reasoning and label it
- Do not use "currently" unless referring to a value from this block
```

### Red-team integration

Pass same evidence block to `buildRedTeamPrompts()` so red-team can verify the primary analysis didn't overclaim beyond provided evidence.

### Acceptance criteria

- `buildPrompts()` with empty evidence produces identical output to current behavior
- `buildPrompts()` with evidence produces user prompt with evidence block appended
- Red-team receives evidence context

---

## Phase 3: Pipeline Integration (Day 4)

Wire source fetching into the analysis flow.

### Files to modify
```
lib/analysis.ts         — runAnalysis() optionally fetches sources
app/api/analyze/route.ts — pass evidence through to persistence
lib/settings.ts         — add liveDataEnabled
schemas/settings.ts     — add liveDataEnabled to Zod schema
prisma/schema.prisma    — add liveDataEnabled to AppSettings (default false)
```

### Flow change in runAnalysis()

```typescript
let evidence: EvidenceItem[] = [];
if (settings.liveDataEnabled) {
  const sources = checkSourceEligibility(input.domain);
  if (sources.length > 0) {
    const results = await fetchAllSources(sources, { timeoutMs: 10_000 });
    evidence = normalizeToEvidence(results);
  }
}
const { systemPrompt, userPrompt } = await buildPrompts(input, settings, evidence);
```

### Settings
Add toggle in settings page: "Enable live data for supported domains (currently: crypto)". Default off.

### Acceptance criteria
- `liveDataEnabled: false` → identical behavior to current system
- `liveDataEnabled: true` + domain "crypto" → CoinGecko fetched, evidence injected
- `liveDataEnabled: true` + domain "politics" → no sources, standard behavior
- Source failure → analysis proceeds, logged, no crash
- Evidence snapshot persisted in `evidenceSnapshotJson`

---

## Phase 4: UI Integration (Day 5)

Show source status and evidence attribution.

### Files to modify
```
app/analysis/[id]/page.tsx       — source indicator badge
components/analysis-view.tsx     — per-signal source attribution
components/follow-up-panel.tsx   — evidence recency disclosure
lib/markdown.ts                  — evidence attribution in export
```

### Source indicator badge (analysis header)
- Green: "Live data (CoinGecko, 14:32 UTC)"
- Amber: "Stale data (CoinGecko, 2h ago)"
- Gray: "Pre-trained reasoning only" (current default, no change needed)

### Per-signal attribution (monitor cards, below current_read)
- "Source: CoinGecko | As of: 14:32 UTC | Freshness: live"

### Follow-up disclosure
- "Evidence snapshot from [date]. No live refresh for follow-ups."

### Acceptance criteria
- Badge appears when evidence was used
- Stale badge when evidence was stale
- Missing badge when sources failed
- Follow-up correctly discloses
- Markdown export includes evidence attribution

---

## Phase 5: Evaluation (Day 6)

Measure whether the pilot actually improved quality.

### Files to modify
```
scripts/run-quality-eval.mjs — 3 new cases, 3 new dimensions
```

### New test cases

| ID | Question | Objective | Source-Aware |
|----|----------|-----------|-------------|
| 13-btc-live-monitor | Current Bitcoin risk posture and signals to track | monitor | Yes |
| 14-btc-live-invest | Current conditions, Bitcoin risk-reward next 30 days | invest | Yes |
| 15-btc-control-monitor | Same as 13, liveDataEnabled=false | monitor | No (control) |

### New dimensions (source-aware only)
- evidence_grounding (1-5)
- freshness_honesty (1-5)
- source_attribution (1-5)

### Success criteria
- evidence_grounding ≥ 4.0
- freshness_honesty ≥ 4.0
- Source-aware > pre-trained on watchlist_action_usefulness
- No regression on 12-case baseline (≥ 3.59)

### Failure conditions
- evidence_grounding < 3.5
- Overall regresses below 3.50

---

## Rollout

```
Phase 1 (plumbing)  → test in isolation
Phase 2 (prompts)   → test with mock evidence
Phase 3 (pipeline)  → test end-to-end, liveDataEnabled=false then =true
Phase 4 (UI)        → visual verification
Phase 5 (eval)      → measure, compare, decide
```

Each phase independently mergeable. Feature gated behind `liveDataEnabled: false`.

---

## After the Pilot

If success criteria met:
1. Add ETH (same adapter, second asset)
2. Add on-chain data (Glassnode — new adapter, paid API)
3. Add macro pilot (FRED API — second domain)
4. Add news/event feeds (separate design spike needed)
5. Auto re-analysis on threshold crossings (scheduler infrastructure)
