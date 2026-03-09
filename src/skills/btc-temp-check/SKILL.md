---
name: btc-temp-check
description: Runs a BTC core-position temperature check using BTC.md, SOUL.md, heartbeat context, benchmark regime, and an AIHF proxy run on IBIT. Use when the user asks for a BTC temp check, BTC regime check, BTC concentration check, IBIT proxy check for BTC, or whether the BTC core should be held, trimmed, hedged, or watched.
---

# BTC Temp Check

## Workflow Checklist

Copy and track progress:

```text
BTC Temp Check Progress:
- [ ] Step 1: Gather doctrine and operating context
- [ ] Step 2: Measure regime vs benchmarks
- [ ] Step 3: Run AIHF proxy disagreement check on IBIT
- [ ] Step 4: Make the decision
- [ ] Step 5: Self-check for doctrine vs regime separation
- [ ] Step 6: Save the artifact
```

## Step 1: Gather doctrine and operating context

Read these sources first:

1. Root `BTC.md`
2. Root `SOUL.md`
3. Heartbeat context via the `heartbeat` tool first; if no heartbeat is configured, immediately read `docs/HEARTBEAT.example.md`
4. fund config / AUM context if available
5. current portfolio context if the user gave an explicit BTC weight or venue split

Heartbeat fallback rules:

- Prefer `Heartbeat(action=view)` over raw file reads for current heartbeat context
- If the heartbeat tool reports no checklist configured, treat that as normal degraded mode
- After a missing-heartbeat result, read `docs/HEARTBEAT.example.md` and continue
- Do not attempt to read `.dexter/HEARTBEAT.md` unless it is already confirmed to exist
- Do not surface missing-heartbeat fallback as an alarming error in the run

Fund-config rules:

- Prefer `Fund Config(action=view)` to determine whether AUM / sleeve sizing context exists
- If no fund config exists, continue anyway
- Mark the run as lower-confidence and scenario-based if live sizing context is missing

Extract:

- BTC-core doctrine
- current concentration assumptions
- regime rules involving BTC, gold, and risk appetite
- any standing operational alerts from heartbeat
- whether the run has live fund sizing context or only thesis-level assumptions

If the user gives a BTC weight explicitly, use it.

If no explicit BTC weight is provided:

- assume the repo-default framing: BTC / IBIT is the dominant core position
- state the assumed weight clearly in the final artifact
- label the result as a scenario analysis, not a precise live-portfolio diagnosis

## Step 2: Measure regime vs benchmarks

Fetch recent price performance for:

- `BTC-USD`
- `GLD`
- `SPY`
- `IBIT`

Measure at minimum:

- 7-day
- 30-day
- quarter-to-date when practical

Classify the regime as one of:

- `risk-on`
- `risk-off`
- `mixed`
- `gold-led safety`
- `btc-specific stress`

Use precise numbers. No vibes.

When interpreting:

- strong gold with weak BTC is a warning signal
- BTC weakness with strong SPY can indicate BTC-specific stress
- broad weakness with gold strength can indicate risk-off / safety demand
- broad strength with BTC strength supports hold or prepare-to-add logic

Use this regime rubric instead of freehand labels:

- `gold-led safety`: GLD outperforms both BTC and SPY in at least 2 of the 3 measured windows
- `btc-specific stress`: BTC underperforms both GLD and SPY in at least 2 of the 3 measured windows
- `risk-on`: BTC and SPY both outperform GLD in at least 2 of the 3 measured windows
- `risk-off`: SPY and BTC are both weak while GLD is relatively strongest in at least 2 of the 3 measured windows
- `mixed`: none of the above cleanly wins

If the short window and quarter-to-date conflict, say so explicitly, for example:

- `mixed, QTD defensive`
- `mixed, short-term bounce inside defensive quarter`

## Step 3: Run AIHF proxy disagreement check on IBIT

Use `aihf_double_check` as a one-ticker proxy run:

- ticker: `IBIT`
- included set only
- sleeve: `default`
- `top_n_included=1`
- `analyst_preset=lean`

Rules:

- do not read `PORTFOLIO.md` for this step
- keep the run constrained to `IBIT` only
- treat the result as a second-system signal, not doctrine

Extract:

- overall stance: bullish / bearish / mixed / unavailable
- the strongest disagreement points
- whether the disagreement sounds structural, regime-driven, or path/timing-driven
- saved filename if the tool creates one

If AIHF is unreachable or errors:

- set stance to `unavailable`
- do not relabel that as `mixed`
- explicitly reduce confidence in the final judgment

## Step 4: Make the decision

Return exactly one action:

- `hold`
- `trim`
- `hedge`
- `prepare to add`
- `no-action but watch`

Your reasoning must explicitly separate:

1. **Doctrine**: is the BTC-core thesis intact?
2. **Regime**: does BTC vs GLD vs SPY argue for caution or offense?
3. **Concentration**: is the current BTC size too large for this regime?
4. **Second system**: does AIHF on `IBIT` materially change sizing or only increase caution?

Decision logic:

- broken doctrine can justify thesis re-argument, but do not casually declare doctrine broken
- hostile regime plus sharp AIHF disagreement can justify `trim` or `hedge`
- intact doctrine plus stabilizing regime can justify `hold` or `prepare to add`
- unclear regime with intact doctrine usually means `no-action but watch`

## Required output structure

Draft the final artifact in this shape:

```markdown
---
title: "BTC Temp Check — YYYY-MM-DD"
artifact_type: btc_temp_check
publish_status: internal
---

# BTC Temp Check — YYYY-MM-DD

- Core exposure: <weight or assumption>
- Regime: <one label>
- AIHF proxy (IBIT): bullish / bearish / mixed / unavailable
- Confidence: high / medium / medium-low / low
- Decision: hold / trim / hedge / prepare to add / no-action but watch

## Why
- BTC vs GLD vs SPY evidence with precise numbers
- concentration judgment
- AIHF disagreement summary

## Doctrine vs regime
- what is structural
- what is temporary

## Missing inputs / degraded mode
- heartbeat available or missing
- fund config available or missing
- AIHF available or unavailable
- whether this is live-weight aware or scenario-only

## Invalidation
- one concrete condition that would make this call wrong

## Next review
- one date or market trigger
```

## Step 5: Self-check for doctrine vs regime separation

Before saving, verify:

- [ ] one regime label is explicit
- [ ] one action is explicit
- [ ] BTC-core doctrine is treated separately from temporary regime
- [ ] AIHF on `IBIT` is treated as calibration, not final authority
- [ ] at least 4 precise numeric datapoints are included
- [ ] confidence level is explicit
- [ ] missing inputs are explicitly named
- [ ] one invalidation condition exists
- [ ] one next-review trigger exists
- [ ] no placeholder text remains

If any check fails:

1. rewrite once
2. re-check once

## Step 6: Save the artifact

Use `save_report`.

Filename:

- `BTC-TEMP-CHECK-YYYY-MM-DD.md`

Return:

- the saved filename
- the decision
- the confidence
- a 3-bullet summary:
  - doctrine verdict
  - regime verdict
  - action now

Do not print the full saved markdown artifact back into chat unless the user explicitly asks for it.

Default chat response should be concise:

- saved filename
- decision
- confidence
- one-line regime label
- one-line invalidation
- one-line next review
