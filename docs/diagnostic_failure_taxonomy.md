# Worldview OS Diagnostic Failure Taxonomy

Date: 2026-04-14
Sprint scope: diagnostic and stress-test only. No product redesign, no domain expansion, no live-data expansion.

## What The Current Product Handles Well

Worldview OS is currently strongest on questions that fit all of these conditions:

- one primary analytical target
- limited named-entity surface area
- a clear analytical objective (`understand`, `invest`, `forecast`, or `monitor`)
- a question that naturally maps to the fixed schema
- structural reasoning is acceptable even when live data is unavailable

Good-fit examples:

- "What is the serious 12-month outlook for Bitcoin?"
- "How should a premium consumer brand monitor recession risk over the next 12 months?"
- "What are the key forces shaping F1 audience growth over the next 3 years?"

In code terms, the current pipeline wants a short reframed thesis, distinct lenses, differentiated scenarios, novel hidden variables, tightly formatted change-my-mind conditions, and a labeled bottom line. That shape is defensible for structured analysis, but it is intentionally narrower than general-purpose Q&A.

## Failure Taxonomy

### A. Weak By Design

These are structurally poor fits for the current product mode. The model may be capable in the abstract, but the product shape is wrong.

1. Live/current-state questions outside the BTC pilot
- Pattern: "What is happening right now with X?" where X is not in the supported live-data path.
- Why weak by design: only BTC/crypto pilot evidence is wired into the honesty pipeline; everything else falls back to structural reasoning.
- Typical result: output may look analytical but cannot honestly satisfy the freshness implied by the question.

2. Recommendation bundles mixed with forecast and explanation
- Pattern: "What will happen, what should I do, and why?"
- Why weak by design: the system wants one dominant objective, but the user is asking for multiple incompatible deliverables in one run.
- Typical result: valid schema, low-value answer shape.

3. Quote-heavy, citation-heavy, or transcript-style requests
- Pattern: "Compare what Xi, Lai, and Blinken each said this week and quote them."
- Why weak by design: the product emits structured analysis, not quote retrieval or source synthesis.

4. Compare-intent disguised as new analysis
- Pattern: "Compare Ethereum vs Bitcoin" or "Magyar vs Orbán" when the real need is side-by-side comparison.
- Why weak by design: the product has a separate compare surface, but intake does not currently route intent there.

5. Open-ended list-generation or brainstorming requests
- Pattern: "Give me ten ideas..." or "List every reason..."
- Why weak by design: the schema forces lenses, scenarios, hidden variables, and watchlist even when the user wants ideation.

### B. Model-Capable, Pipeline-Brittle

These are the most important bug candidates. The likely failure is in validators, normalization, or retries rather than raw model capability.

1. Named-entity-heavy compound questions
- Pattern: multiple people, offices, countries, or organizations in one question.
- Likely break: reframed-question entity preservation.
- Why brittle: `lib/analysis.ts` extracts strict and prefix entities and fails the run if the reframed question drops them.

2. Title-heavy geopolitical questions
- Pattern: titles plus names or institutions, such as prime ministers, ministries, courts, parties, coalitions.
- Likely break: entity extraction/retention and verbose reframing.
- Why brittle: the current entity extractor intentionally ignores many title words, which helps precision but increases edge-case risk on office/title formulations.

3. Long branch-heavy questions
- Pattern: "If A happens do X, but if B and C happen do Y..."
- Likely break: verbose reframing, schema incompleteness, or retry churn.
- Why brittle: the system forces a short thesis-like reframed question under a strict word budget.

4. Alias-heavy or dual-naming questions
- Pattern: people or places named in multiple forms, transliterations, or nicknames.
- Likely break: entity-retention check.
- Why brittle: the preservation check is substring/prefix-based, not alias-aware.

5. Monitor questions with soft or qualitative indicators
- Pattern: "What should I monitor in elite sentiment, narrative tone, or management seriousness?"
- Likely break: monitor operationality or generic output-shape mismatch.
- Why brittle: monitor mode expects leading indicators plus observable thresholds, which soft signals often cannot provide cleanly.

6. Questions whose hidden variables naturally overlap with the main drivers
- Pattern: highly crowded domains where the non-obvious factors are still semantically adjacent to the key drivers.
- Likely break: hidden-variable novelty assertion.
- Why brittle: the overlap test in `lib/analysis.ts` rejects near-duplicate token sets, which can trip on legitimate but adjacent second-order risks.

### C. Passes But Produces Wrong-Shape Or Low-Value Output

These are quality weaknesses more than hard failures.

1. Mixed objective prompts
- Pattern: "Should I buy this, what will happen, and what should I monitor?"
- Current behavior: often passes.
- Failure mode: output lands in an awkward hybrid with diluted decision value.

2. Standard analysis on compare-style questions
- Pattern: "Bitcoin or Ethereum?", "Magyar or Orbán?", "OpenAI or Anthropic?"
- Current behavior: can pass.
- Failure mode: scenarios/lenses exist, but the user really wanted explicit side-by-side structure or compare routing.

3. Monitor mode on soft non-numeric domains
- Pattern: narrative, coalition, brand, or media monitoring.
- Current behavior: can pass.
- Failure mode: threshold language becomes artificial or generic.

4. Questions that do not fit the schema naturally
- Pattern: causal explainer requests, legal interpretation, tactical playbooks.
- Current behavior: the system still fills every field.
- Failure mode: hidden variables, scenarios, or watchlist feel performative rather than useful.

### D. Should Be Routed Or Warned On

1. Live-current questions outside supported evidence paths
- Add warning: structural reasoning only; no supported live-data feed for this topic.

2. Compare-intent questions
- Add routing: suggest compare mode or produce a compare-specific warning before generation.

3. Multi-objective bundles
- Add warning: choose one primary mode first; follow-up can handle the rest.

4. Monitor questions relying on narrative softness instead of trackable indicators
- Add warning: monitor mode works best when the target can be expressed as leading indicators and thresholds.

5. Quote/citation requests
- Add rejection or redirect: poor fit for current product mode.

## Category Grid

| Question class | Current status | Primary issue type |
| --- | --- | --- |
| Clean single-target analytical questions | Good fit | None |
| Named-entity-heavy compound questions | Structurally risky | Bug / validator brittleness |
| Title-heavy geopolitical questions | Structurally risky | Bug / validator brittleness |
| Multi-branch conditional questions | Structurally risky | Bug + shape mismatch |
| Nested branch questions | Weak fit | Shape mismatch |
| Multi-target probability questions | Weak fit | Shape mismatch / compare need |
| Forecast + recommendation + explanation mixes | Weak fit | Product-boundary mismatch |
| Live/current questions outside BTC pilot | Poor fit | Product-boundary mismatch |
| Quote-heavy / alias-heavy requests | Poor fit | Product-boundary mismatch plus entity brittleness |
| Soft-signal monitor prompts | Risky | Quality weakness / monitor-shape mismatch |
| Compare-intent disguised as analysis | Risky | Routing gap |

## Bug vs Weakness vs Boundary Mismatch

### Real bug candidates

- Reframed-question entity preservation is too brittle for some legitimate compound questions.
- Reframed-question brevity guard can reject valid but inherently branch-heavy formulations.
- Hidden-variable novelty guard can reject acceptable second-order factors in crowded domains.

### Quality weaknesses

- Monitor mode still struggles when signals are qualitative rather than thresholdable.
- Mixed-objective user prompts often pass but produce diluted answer shape.
- Compare-intent questions can produce technically valid but user-misaligned output.

### Product-boundary mismatches

- unsupported live/current-state questions outside BTC pilot
- quote/citation retrieval tasks
- broad ideation/listing tasks
- requests requiring a frontier assistant rather than structured analytical memory

## Highest-Risk Question Classes

1. Named-entity-heavy compound geopolitical questions
2. Long multi-branch conditional questions
3. Alias-heavy or title-heavy entity questions
4. Soft-signal monitor questions
5. Live-current-state questions outside supported evidence paths

## Defensible Scope Statement

Yes: the product currently has a narrow but defensible question scope.

That scope is:

- structured analytical questions
- one main target per run
- one dominant objective per run
- domains where structural reasoning is acceptable
- users who want scenario, disconfirmation, and watchlist outputs rather than a direct answer or live current-state briefing

The product should not pretend to be better than that. The right move is to protect this scope, fix the brittle validators inside it, and route or reject questions outside it rather than forcing them through the schema.
