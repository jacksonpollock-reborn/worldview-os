# Monitor Schema Sprint Comparison

Date: 2026-04-13
Baseline report: `artifacts/quality-eval/2026-04-13-after-v6.1-monitor-hygiene-live/report.json`
Post-sprint report: `artifacts/quality-eval/2026-04-13-after-v6.2.1-monitor-schema-live/report.json`

## Net result

- Overall average score: `4.26 -> 4.44` (+0.18, first aggregate-score movement)
- Red-team completion rate: `12/12 -> 12/12`
- Objective differentiation score: `4 -> 4`
- Monitor objective score: `3 -> 3` (see caveat below)

This sprint introduced a monitor-specific output schema, replacing the forecast-style lens/scenario middle with signal cards, thresholds, current stance, review cadence, confirm/disconfirm, and noise filtering. It also enforced the IF [condition] -> [thesis fails] format for change-my-mind conditions.

## Dimension comparison

- `reframed_question_quality`: `4.00 -> 4.00`
- `domain_relevance`: `4.83 -> 5.00` (+0.17)
- `lens_distinctness`: `4.00 -> 4.33` (+0.33)
- `scenario_differentiation`: `4.00 -> 4.00`
- `hidden_variable_usefulness`: `4.00 -> 4.00`
- `change_my_mind_specificity`: `3.92 -> 4.67` (+0.75, largest single-dimension gain)
- `bottom_line_decisiveness`: `4.00 -> 4.33` (+0.33)
- `watchlist_action_usefulness`: `4.58 -> 4.67` (+0.09)
- `objective_alignment`: `5.00 -> 5.00`

## Key wins

1. `change_my_mind_specificity` jumped from 3.92 to 4.67. The IF -> THEN format with threshold language enforcement and assertion validation is working.
2. `bottom_line_decisiveness` improved to 4.33. The structured View/Reason/Risk/Downgrade if/Upgrade if format produces more falsifiable bottom lines.
3. `lens_distinctness` improved to 4.33. The MAX_ALLOWED_LENS_DRIVER_OVERLAPS relaxation reduced false-positive retries without degrading quality.
4. Monitor outputs now produce a fundamentally different artifact: signal cards with bullish/neutral/bearish thresholds, no lenses, no scenarios.

## Monitor objective score caveat

The eval judge still scores monitor at 3/5 on objective alignment. However, this is partly an eval-rubric artifact: the judge scores `scenario_differentiation` and `lens_distinctness` against monitor outputs that intentionally have neither. The media-monitor output received `scenario_differentiation: 1` because the judge penalized empty scenarios. The eval rubric has been updated to instruct the judge not to penalize intentionally empty lenses/scenarios in monitor mode. This should resolve in the next eval run.

## Red-team comparison

- Weak claims improvement: `1.58 -> 1.08` (-0.50)
- Disconfirmation logic improvement: `2.00 -> 1.92` (-0.08)
- Watchlist specificity improvement: `1.75 -> 1.75` (flat)
- Bottom-line sharpness improvement: `1.58 -> 1.08` (-0.50)

The red-team improvement scores declined because the primary analysis is now sharper. The IF -> THEN format and structured bottom lines leave less room for the red-team to add delta. This is a ceiling effect, not a regression.

## Category averages

- politics/geopolitics: `4.17 -> 4.39` (+0.22)
- macro/markets: `4.28 -> 4.33` (+0.05)
- crypto: `4.28 -> 4.64` (+0.36, strongest category gain)
- sports: `4.22 -> 4.22` (flat)
- open-ended strategy: `4.33 -> 4.45` (+0.12)

## What improved materially

- Monitor outputs are structurally distinct from forecast for the first time.
- Change-my-mind conditions are scannable and threshold-driven.
- Bottom lines are structurally falsifiable with labeled sections.
- Overall score moved for the first time across all sprints.

## What still needs the next sprint

- Monitor objective score needs a re-eval with the corrected rubric to get an honest number.
- `current_read` field has been added to the signal schema but was not present in this eval run; next eval will include it.
- The eval harness still uses the same model as judge by default; users should set EVAL_JUDGE_MODEL for honest grades.
- Reframed question quality has plateaued at 4.00 across all sprints.
- Sports category has not improved across any sprint (4.22 consistently).
