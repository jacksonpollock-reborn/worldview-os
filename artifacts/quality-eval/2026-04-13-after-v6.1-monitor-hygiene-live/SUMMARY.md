# Narrow Quality + Hygiene Sprint

Date: 2026-04-13
Baseline report: `artifacts/quality-eval/2026-04-13-after-v5b/report.json`
Post-sprint report: `artifacts/quality-eval/2026-04-13-after-v6.1-monitor-hygiene-live/report.json`

## Net result

- Overall average score: `4.27 -> 4.26`
- Objective differentiation score: `4 -> 4`
- Monitor objective score: `3 -> 3`
- Red-team completion rate: `12/12 -> 12/12`

This sprint improved operational honesty and monitor formatting on real outputs, but it did not produce a material aggregate-score lift. The strongest measured gain was watchlist usefulness. The weakest measurable outcome is that monitor mode still did not move above its prior score band.

## Requested deltas

- `bottom_line_decisiveness`: `4.00 -> 4.00`
- `change_my_mind_specificity`: `4.00 -> 3.92`
- `watchlist_action_usefulness`: `4.50 -> 4.58`
- `objective_alignment`: `5.00 -> 5.00`

## Red-team comparison

- Weak claims improvement: `1.42 -> 1.58`
- Disconfirmation logic improvement: `2.00 -> 2.00`
- Watchlist specificity improvement: `1.92 -> 1.75`
- Bottom-line sharpness improvement: `1.50 -> 1.58`

## Read

- Monitor improved in surface design and operational readability, but not materially in judged objective score.
- Bottom lines are structurally more falsifiable now because the output consistently carries explicit `View`, `Reason`, `Risk`, `Downgrade if`, and `Upgrade if` clauses.
- The largest remaining weakness is still monitor differentiation: the outputs are better organized, but the eval still sees them as only moderately distinct from forecast.
- The second remaining weakness is change-my-mind specificity, which slipped slightly in the aggregate even after the new thresholding rules.
