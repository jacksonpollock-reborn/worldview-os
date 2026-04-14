# Quality Sprint Comparison

Date: 2026-04-13
Baseline report: `artifacts/quality-eval/2026-04-13/report.json`
Post-sprint report: `artifacts/quality-eval/2026-04-13-after-v5b/report.json`

## Net result

- Overall average score: `4.27 -> 4.27`
- Red-team completion rate: `11/12 -> 12/12`
- Objective differentiation score: `4 -> 4`

This sprint improved structural discipline and red-team reliability, but it did not lift the aggregate score above baseline. The quality gains were concentrated in cleaner domain selection and stronger red-team disconfirmation/watchlist sharpening. The remaining weakness is that those gains were partly offset by slightly lower watchlist usefulness in the aggregate and continued softness in `monitor` differentiation.

## Dimension comparison

- `reframed_question_quality`: `4.00 -> 4.00`
- `domain_relevance`: `4.75 -> 5.00`
- `lens_distinctness`: `4.00 -> 4.00`
- `scenario_differentiation`: `4.00 -> 4.00`
- `hidden_variable_usefulness`: `4.00 -> 4.00`
- `change_my_mind_specificity`: `4.00 -> 4.00`
- `bottom_line_decisiveness`: `4.00 -> 4.00`
- `watchlist_action_usefulness`: `4.67 -> 4.50`
- `objective_alignment`: `5.00 -> 5.00`

## Objective shaping comparison

Bitcoin objective test:

- Material difference score stayed at `4 / 5`
- `understand`: `4 -> 4`
- `invest`: `5 -> 5`
- `forecast`: `4 -> 4`
- `monitor`: `3 -> 3`

Takeaway:

- The new prompt layer preserved objective differentiation rather than improving it materially.
- `invest` remains the clearest differentiated mode.
- `monitor` is still the weakest mode. It is more indicator-first in style, but not enough to move the eval score.

## Red-team comparison

- Weak claims improvement: `1.58 -> 1.42`
- Disconfirmation logic improvement: `1.83 -> 2.00`
- Watchlist specificity improvement: `1.83 -> 1.92`
- Bottom-line sharpness improvement: `1.58 -> 1.50`

Takeaway:

- Red-team is now more reliable and consistently runs to completion.
- The strongest measurable gains are in disconfirmation logic and watchlist sharpening.
- Bottom-line sharpening still lags, and weak-claim improvement is mixed.

## Practical read

What improved materially:

- Lens-overlap and verbose-reframe retries are catching low-quality outputs before they ship.
- Domain selection is cleaner and more causally disciplined.
- Red-team reliability improved from `11/12` to `12/12`.
- Red-team now contributes more reliably to disconfirmation logic and watchlist specificity.

What still needs the next sprint:

- Reframed questions are cleaner in style but not yet scoring above baseline.
- Lens distinctness improved operationally through retries, but the eval still sees residual overlap in some cases.
- Hidden variables are still the same score band as before; the novelty bar needs more than prompt language alone.
- `monitor` still needs stronger indicator architecture and less scenario-style narration.
- Bottom lines remain somewhat hedged even when the structure is otherwise strong.
