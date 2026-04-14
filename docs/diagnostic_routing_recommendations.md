# Worldview OS Diagnostic Recommendations

Date: 2026-04-14
Scope: prioritize honesty and failure classification, not broad runtime redesign.

## What To Fix In-Validator Or Assertion Logic

These are real bug candidates because they reject or destabilize otherwise legitimate questions that still fit the product.

1. Reframed-question entity preservation
- Problem: `lib/analysis.ts` correctly tries to stop abstraction drift, but the extraction and strict/prefix matching are brittle on compound entity questions, title-heavy formulations, and aliases.
- Fix next: reduce false positives before widening coverage.
- Narrow implementation direction: make the validator more tolerant of office-title variants and alias forms without dropping the preservation requirement.

2. Reframed-question brevity and retry pressure on branch-heavy questions
- Problem: the hard brevity guard plus retry prompt can create churn on multi-branch prompts that still fit the product.
- Fix next: allow a slightly wider envelope for branch-heavy but still decision-shaped reframes, or classify these as routed/warned instead of repeatedly retrying them.

3. Hidden-variable novelty overreach
- Problem: the overlap heuristic catches real filler, but it can also reject valid second-order variables in crowded domains.
- Fix next: tighten the notion of "recycled" around exact or near-exact conceptual restatement, not merely adjacent topic overlap.

## What Intake Or Routing Should Handle

These are not primarily validator bugs.

1. Compare-intent detection
- Route questions with obvious A-vs-B or multi-target comparison intent toward compare mode or a compare warning before generation.

2. Unsupported live-current-state requests
- Detect freshness-demanding language like `latest`, `right now`, `currently`, `today`, and `this week`.
- If the question is outside the supported live path, warn or reject up front instead of pretending structural reasoning is enough.

3. Multi-objective bundles
- If a question mixes recommendation, forecast, and explanation, warn that one primary objective should drive the run.

## What Should Usually Pass With A Warning

1. Soft-signal monitor questions
- Warning: monitor mode works best with leading indicators and observable thresholds; qualitative signals may be less reliable.

2. Long branch-heavy but still analyzable questions
- Warning: the system may compress the question into one dominant thesis and lose some branch detail.

3. Unsupported-live topics where structural reasoning is still acceptable
- Warning: no supported live data is available; analysis is structural rather than current-state verified.

## What Should Be Rejected Honestly

1. Quote-heavy current-events requests
- Reason: not a retrieval or quoting product.

2. Broad live-current-state briefings outside supported evidence paths
- Reason: honesty requirement cannot be met.

3. Questions that fundamentally require multiple outputs at once
- Reason: the fixed schema is not the right surface for combined compare + forecast + recommendation + quote tasks.

## Top 3 Bugfixes To Prioritize

1. Make entity-retention validation more robust for compound named-entity questions.
2. Reduce retry churn from reframed-question verbosity on branch-heavy prompts.
3. Loosen hidden-variable overlap logic enough to stop rejecting legitimate second-order factors.

## Top 3 Boundary Warnings Or Routing Rules To Add

1. Route obvious compare-intent questions to compare mode.
2. Warn or reject live-current-state questions outside the BTC pilot.
3. Warn when a single prompt asks for multiple modes at once and ask the system to anchor on one primary objective.

## Product-Scope Conclusion

Worldview OS currently has a narrow but defensible scope:

- structured analytical questions
- one main target
- one dominant mode
- scenarios, disconfirmation logic, and watchlist outputs
- structural reasoning with selective evidence support

That scope becomes much more credible if the product does three things consistently:

- fix validator brittleness for legitimate in-scope questions
- route compare/live/multi-mode questions before generation
- reject poor-fit requests honestly instead of forcing schema-shaped output
