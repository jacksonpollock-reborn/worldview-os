# Structured Quality Evaluation

Date: 2026-04-13
Provider used: OpenAI
Analysis model: `gpt-4.1-mini`
Judge model: `gpt-4.1-mini`
Run count: 12

Note:

- The first scoring pass showed ceiling inflation, so the final reported scores were recalibrated with a stricter judge prompt against the saved outputs rather than rerunning generation.

## Aggregate scores

- Overall average score: `4.27 / 5`
- Best dimension: `objective_alignment` at `5.00`
- Next strongest dimensions: `domain_relevance` at `4.75`, `watchlist_action_usefulness` at `4.67`
- Main ceiling-limited dimensions: `reframed_question_quality`, `lens_distinctness`, `scenario_differentiation`, `hidden_variable_usefulness`, `change_my_mind_specificity`, and `bottom_line_decisiveness`, all at roughly `4.00`

Category averages:

- Politics / geopolitics: `4.33`
- Macro / markets: `4.28`
- Crypto: `4.28`
- Sports: `4.22`
- Open-ended strategy: `4.22`

Average red-team improvement scores (`0` to `2`):

- Weak claims: `1.58`
- Disconfirmation logic: `1.83`
- Watchlist specificity: `1.83`
- Bottom-line sharpness: `1.58`

## Objective shaping test

Test question: `What is the serious 12-month outlook for Bitcoin?`

- Material difference score across `understand`, `invest`, `forecast`, `monitor`: `4 / 5`
- Alignment scores:
  - `understand`: `4`
  - `invest`: `5`
  - `forecast`: `4`
  - `monitor`: `3`

Takeaway:

- Objective shaping is materially different, not cosmetic.
- `invest` is the clearest differentiated mode.
- `monitor` improves the watchlist orientation, but still overlaps too much with the general forecast framing.

## What Improved Materially

- Domains are consistently relevant and rarely padded.
- Watchlists are now concrete enough to be operationally useful in most runs.
- Objective-aware shaping is real rather than nominal.
- The red-team pass usually improves disconfirmation logic and watchlist sharpness.

## What Still Feels Generic Or Repetitive

- Reframed questions are often sharper but still slightly verbose.
- Some lenses still reuse overlapping drivers instead of fully separating mechanisms.
- Hidden variables are better than before, but not consistently surprising.
- Bottom lines are decisive, but often still hedge instead of naming cleaner thresholds for reversal.
- Monitor mode is the least differentiated objective because it still inherits too much of the base forecast language.

## Highest-Impact Prompt Changes Next

- Push harder for mutually exclusive lens construction and explicitly ban repeating the same driver across multiple lenses unless the overlap is named and justified.
- Force change-my-mind conditions and bottom lines to include tighter threshold logic, not just observable directionality.
- Make hidden variables pass a stronger novelty test so obvious second-order factors do not qualify.
- Tighten the `monitor` objective pack so it privileges indicator architecture over narrative explanation.
- Constrain the red-team pass more tightly on watchlist length so it does not occasionally fail schema validation by overproducing items.

## Per-run summary

| Run | Category | Objective | Avg | Red-team | Strongest signal | Main weakness |
| --- | --- | --- | --- | --- | --- | --- |
| 01-taiwan-forecast | politics/geopolitics | forecast | 4.33 | yes | Strong causal domains and watchlist | Reframed question still verbose |
| 02-us-policy-monitor | politics/geopolitics | monitor | 4.33 | yes | Good operational monitoring frame | Some lens overlap and soft thresholds |
| 03-inflation-forecast | macro/markets | forecast | 4.33 | yes | Strong causal map and watchlist | Lens overlap and limited quantification |
| 04-recession-monitor | macro/markets | monitor | 4.22 | no | Clear monitoring-oriented reframing | Watchlist and action thresholds still broad |
| 05-bitcoin-understand | crypto | understand | 4.11 | yes | Strong causal structure and scenario logic | Watchlist and probabilities could be tighter |
| 06-bitcoin-invest | crypto | invest | 4.33 | yes | Best objective-specific investment framing | Some generic language remains |
| 07-bitcoin-forecast | crypto | forecast | 4.33 | yes | Clear scenario framing with operational watchpoints | Probability justification could be tighter |
| 08-bitcoin-monitor | crypto | monitor | 4.33 | yes | Strong watchlist and disconfirmation logic | Still overlaps with forecast mode |
| 09-lakers-forecast | sports | forecast | 4.33 | yes | Concrete sports-specific watchpoints | Some repeated drivers across lenses |
| 10-f1-understand | sports | understand | 4.11 | yes | Good causal framing of audience growth | Some media/distribution overlap remains |
| 11-ai-strategy-understand | open-ended strategy | understand | 4.11 | yes | Clear call and decent strategic structure | Hidden variables feel somewhat expected |
| 12-media-monitor | open-ended strategy | monitor | 4.33 | yes | Strong operational watchlist | Some evidence/signals still generic |
