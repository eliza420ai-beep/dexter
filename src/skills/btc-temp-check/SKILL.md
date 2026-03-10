---
name: btc-temp-check
description: Fast BTC core-position diagnostic. Use when the user asks for a BTC temp check, BTC regime check, BTC ETF flow check, or whether the BTC core should be held, trimmed, hedged, or watched.
---

# BTC Temp Check

Goal: produce a fast, credible answer or stop early.

## Core Rule

Do the cheapest high-signal checks first:

1. benchmark table: `BTC-USD`, `GLD`, `SPY`, `IBIT`
2. BTC ETF flow from one dedicated source
3. only then, optional AIHF

If core data is incomplete, stop. Do not write a long memo.

## Minimal Inputs

Read only:

1. `BTC.md`
2. `SOUL.md`
3. fund config if available
4. latest prior file in `.dexter/temp-checks/` if one exists

Skip heartbeat, X, and anything else unless the user explicitly asks.

Extract only:

- 1 short doctrine line
- assumed BTC weight if no live weight is given
- latest prior temp-check filename if present

If no explicit BTC weight is provided, assume repo-default BTC / IBIT core framing and say so briefly.

## Step 1: Benchmark Pass

Fetch exact total returns for:

- `BTC-USD`
- `GLD`
- `SPY`
- `IBIT`

Required windows:

- `7d`
- `30d`
- `QTD`

Build this table:

| Window | BTC-USD | GLD | SPY | IBIT |
| --- | ---: | ---: | ---: | ---: |
| 7d | ... | ... | ... | ... |
| 30d | ... | ... | ... | ... |
| QTD | ... | ... | ... | ... |

## Step 2: BTC ETF Flow

Fetch BTC ETF flow from one dedicated source only.

Preferred source:

- CoinGlass-style BTC ETF page / API

Required fields:

- source name
- aggregate `1d` net flow
- aggregate `5d` net flow
- aggregate `20d` net flow

Do not use generic web search summaries if a dedicated source is directly fetchable.

## Step 3: Fail Fast

Return `incomplete diagnostic` immediately if either is true:

- exact `GLD` or `SPY` returns for `7d`, `30d`, and `QTD` are missing
- dedicated BTC ETF flow source does not yield usable `1d`, `5d`, and `20d` values

When fail-fast triggers:

- do not run AIHF
- do not run X sentiment
- do not save a full memo
- do not force `hold`, `trim`, `hedge`, `prepare to add`, or `no-action but watch`

Use this output:

```markdown
# BTC Temp Check — YYYY-MM-DD

- Status: incomplete diagnostic
- Blocking inputs: <missing benchmark windows and/or missing BTC ETF flow values>
- What is known: <2 lines max>
- Decision: deferred pending missing core data
- Next trigger: <rerun condition>
```

Keep it under 7 lines total after the title.

## Step 4: Regime

Only if benchmark data is complete, classify regime:

- `risk-on`
- `risk-off`
- `mixed`
- `gold-led safety`
- `btc-specific stress`

Rubric:

- `gold-led safety`: GLD beats BTC and SPY in at least 2 of 3 windows
- `btc-specific stress`: BTC trails GLD and SPY in at least 2 of 3 windows
- `risk-on`: BTC and SPY both beat GLD in at least 2 of 3 windows
- `risk-off`: BTC and SPY are both weak while GLD is strongest in at least 2 of 3 windows
- `mixed`: none of the above

Interpret BTC ETF flow as supporting evidence only:

- persistent inflows: supportive
- persistent outflows: drag
- mixed flow: neutral

## Step 5: AIHF

Run AIHF on `IBIT` only if:

- benchmark table is complete
- BTC ETF flow is sourced and usable
- the decision would genuinely benefit from second-system calibration

If run:

- use `IBIT` first, then `BITO`, then `GBTC`, then `BTC-USD`
- keep it one ticker only
- treat it as calibration, not authority

## Step 6: Decision

Only for complete runs, return exactly one:

- `hold`
- `trim`
- `hedge`
- `prepare to add`
- `no-action but watch`

Use:

1. doctrine
2. regime
3. concentration
4. BTC ETF flow
5. AIHF if run

## Output

### Complete Run

```markdown
---
title: "BTC Temp Check — YYYY-MM-DD"
artifact_type: btc_temp_check
publish_status: internal
---

# BTC Temp Check — YYYY-MM-DD

- Core exposure: <weight or assumption>
- Regime: <label>
- BTC ETF flow: supportive / neutral / drag
- AIHF proxy (IBIT): bullish / bearish / mixed / unavailable / skipped
- Confidence: high / medium / medium-low
- Decision: hold / trim / hedge / prepare to add / no-action but watch

## Why
- doctrine: <1 line>
- regime: <1-2 lines with numbers>
- concentration: <1 line>
- BTC ETF flow: <source + 1d/5d/20d summary>
- AIHF: <1 line or skipped>

## Since last check
- prior file reviewed: <filename or none>
- what changed: <1 line>

## Invalidation
- <1 line>

## Next review
- <1 line>
```

### Save Rule

Save only complete runs by default.

For incomplete diagnostics:

- do not save unless the user explicitly asks

## Hard Constraints

- never read `.dexter/temp-checks/` as a file; locate the latest file first, then read that file
- never run AIHF on an incomplete base dataset
- never run X by default
- never spend tokens on a long degraded explanation
