# Apples-to-Apples Rescore Comparison

Date: 2026-04-13
Judge model: `gpt-4.1` (all 4 runs)
Generator model: `gpt-4.1-mini` (all 4 runs)
Rubric: current monitor-aware rubric (no penalty for empty lenses/scenarios in monitor mode)

## Why this exists

Previous eval runs used `gpt-4.1-mini` judging its own output, producing inflated scores (4.27-4.44 range). The judge was also penalizing monitor outputs for missing forecast-style sections.

This document rescores the 3 most relevant historical baselines under the same honest eval regime as the latest v6.3 run so all numbers are directly comparable.

## Runs compared

| Run | Version | What changed | Cases |
|-----|---------|-------------|-------|
| v5b | Pre-monitor-schema | Strongest baseline before monitor structural work | 12 |
| v6.1 | Prompt-only monitor | Monitor-specific prompt instructions but same schema as forecast | 12 |
| v6.2.1 | Monitor schema split | Monitor gets its own schema: signal cards, thresholds, confirm/disconfirm | 12 |
| v6.3 | current_read + rubric fix | Added current_read per signal, fixed eval rubric for monitor | 12 |

## Overall scores (all judged by gpt-4.1)

```
                                     v5b     v6.1   v6.2.1     v6.3
OVERALL AVERAGE                     3.36     3.44     3.49     3.53
```

Steady upward trend: +0.17 total from v5b to v6.3. Not dramatic, but consistent and real under honest grading.

## Dimension-by-dimension

```
Dimension                            v5b     v6.1   v6.2.1     v6.3
reframed_question_quality           3.58     3.58     3.67     3.75
domain_relevance                    4.00     4.00     4.00     3.92
lens_distinctness                   3.00     3.17     3.25     3.42
scenario_differentiation            3.17     3.25     3.33     3.42
hidden_variable_usefulness          3.00     3.00     3.00     3.00
change_my_mind_specificity          3.08     3.00     3.42     3.67
bottom_line_decisiveness            3.25     3.50     3.33     3.25
watchlist_action_usefulness         3.17     3.50     3.42     3.33
objective_alignment                 4.00     4.00     4.00     4.00
```

### What actually improved across sprints

- **change_my_mind_specificity**: 3.08 -> 3.67 (+0.59). Biggest single-dimension gain. The IF -> THEN format with threshold enforcement is the clearest product improvement.
- **lens_distinctness**: 3.00 -> 3.42 (+0.42). The overlap detection and retry logic is catching lazy lens duplication.
- **scenario_differentiation**: 3.17 -> 3.42 (+0.25). Incremental but real.
- **reframed_question_quality**: 3.58 -> 3.75 (+0.17). Word-count checks and verbose-prefix rejection helping.

### What stayed flat

- **hidden_variable_usefulness**: 3.00 across all 4 runs. This dimension has not moved at all. The novelty assertion catches recycled drivers but doesn't push the LLM toward genuinely non-obvious variables.
- **objective_alignment**: 4.00 across all 4 runs. Strong from the start, no regression.
- **domain_relevance**: 4.00 -> 3.92. Essentially flat; minor stochastic variation.

### What showed non-monotonic behavior

- **bottom_line_decisiveness**: 3.25 -> 3.50 -> 3.33 -> 3.25. Peaked at v6.1, then declined. The structured View/Reason/Risk format made bottom lines more complete but possibly more hedged.
- **watchlist_action_usefulness**: 3.17 -> 3.50 -> 3.42 -> 3.33. Same pattern — peaked at v6.1, then slightly declined as the format became more structured but potentially more generic.

## Monitor objective (from Bitcoin 4-objective comparison)

```
                     v5b     v6.1   v6.2.1     v6.3
monitor score          3        3        3        3
material_diff          3        3        3        3
```

Monitor has not moved under honest grading. All 4 runs score 3/5. The structural schema change (signal cards, confirm/disconfirm) made the output look different but the judge does not yet rate it as materially superior to forecast-style monitor.

## Red-team improvement

```
Dimension                        v5b     v6.1   v6.2.1     v6.3
weak_claims                     1.42     1.50     0.75     1.00
disconfirmation_logic           2.00     2.00     1.83     1.92
watchlist_specificity           2.00     1.92     2.00     2.00
bottom_line_sharpness           1.17     1.42     1.08     1.17
```

Red-team delta is stable. The decline in `weak_claims` improvement at v6.2.1 reflects a ceiling effect: the primary analysis is sharper, so the red-team adds less delta. By v6.3 it partially recovered.

## Category averages

```
Category                     v5b     v6.1   v6.2.1     v6.3
politics/geopolitics        3.39     3.44     3.61     3.45
macro/markets               3.28     3.28     3.45     3.50
crypto                      3.44     3.47     3.56     3.64
sports                      3.39     3.50     3.45     3.38
open-ended strategy         3.22     3.50     3.33     3.55
```

- **Crypto** is the strongest and most consistently improving category (+0.20 total).
- **Sports** is the weakest and shows no sustained improvement.
- **Strategy** shows the most sprint-to-sprint volatility.

## Key conclusions

### 1. Previously claimed gains were real but smaller than reported

The old self-judged runs showed 4.27 -> 4.44 (+0.17). Under honest grading, the true trajectory is 3.36 -> 3.53 (+0.17). The absolute magnitude of improvement is the same, but the baseline is ~0.9 points lower. The product was never 4.4-quality — it was 3.5-quality with an inflated grader.

### 2. The monitor schema change did not move the monitor objective score

Monitor stays at 3/5 across all 4 runs under honest grading. The structural change (signal cards, thresholds, confirm/disconfirm) made the output format genuinely different from forecast, but the judge rates the analytical quality about the same. The next monitor improvement needs to come from content quality, not structural formatting.

### 3. change_my_mind_specificity is the clearest genuine product improvement

3.08 -> 3.67 is the largest dimension gain under honest grading. The IF -> THEN format with threshold enforcement and assertion validation is the single feature that most clearly improved output quality.

### 4. hidden_variable_usefulness is the biggest untouched opportunity

3.00 across all 4 runs. No sprint has moved this at all. The novelty assertion prevents recycled drivers but does not push the LLM toward genuinely surprising or non-obvious variables.

### 5. Bottom-line decisiveness and watchlist usefulness peaked at v6.1 and regressed

These two dimensions showed early improvement from prompt work but declined slightly as more structural formatting was added. The structured labels (View/Reason/Risk/etc.) may be making bottom lines more complete but less sharp. Worth investigating whether the label structure is causing hedging.

## Recommended official baseline

**Use `wv-v6.4-core` as the canonical current baseline label.**

Rationale:
- It is the canonical label for the current Worldview OS core prompt family.
- It keeps saved analyses, eval reports, and live pilot derivatives on one lineage.
- The live BTC pilot now derives from it explicitly as `wv-v6.4-core+btc-live-pilot`.
- Historical directory names remain useful as sprint labels, but promptVersion references should map back to the canonical lineage labels.

For any future eval comparison, use:
- Generator: `gpt-4.1-mini`
- Judge: `gpt-4.1` (auto-selected by the harness)
- Rubric: current monitor-aware version
- Comparison point: `wv-v6.4-core` overall 3.59

## Reproducibility

To rerun any rescore:
```bash
cd /path/to/worldview-os

# Copy saved case files into a dated rescore directory
mkdir -p artifacts/quality-eval/YYYY-MM-DD-rescore-TAG
cp artifacts/quality-eval/SOURCE_DIR/[0-9]*.json artifacts/quality-eval/YYYY-MM-DD-rescore-TAG/

# Run with reuse mode (no analysis regeneration, judge-only)
OPENAI_API_KEY="your_openai_api_key_here" \
EVAL_BASE_URL=http://127.0.0.1:3002 \
EVAL_REUSE_EXISTING=true \
EVAL_TAG=rescore-TAG \
node scripts/run-quality-eval.mjs
```

Requires the dev server running (for the startup settings PUT) but makes zero analysis API calls.

## Artifact locations

| Directory | Contents |
|-----------|----------|
| `rescore-after-v5b` | v5b analyses rescored by gpt-4.1 judge |
| `rescore-after-v6.1` | v6.1 analyses rescored by gpt-4.1 judge |
| `rescore-after-v6.2.1` | v6.2.1 analyses rescored by gpt-4.1 judge |
| `after-v6.3-current-read` | v6.3 original run (already honest judge) |
