---
name: portfolio-scoring
description: >
  Interpret the pre-computed ticker scorecard and overlay investment thesis context.
  Triggers on "score my portfolio", "portfolio analytics", "compare sleeves",
  "risk flags", "scorecard", or "which names to add or trim".
---

# Portfolio Scoring Skill

Interpret the **quantitative scorecard** (computed by `bun run score`) through the lens of SOUL.md. This skill does **not** compute returns, Sharpe ratios, or correlations — those are produced by the script. Your job is to read the scorecard, overlay thesis context, and recommend actions.

## Workflow

### 1. Check for the scorecard

- Use `read_file` to open `.dexter/scorecard.json` (or `.dexter/scorecard.md` for a human-readable table).
- If the file does not exist or is stale, tell the user:
  - *"Run `bun run score` to generate the scorecard from cached data. Then ask again."*
  - Do not attempt to compute factors yourself.

### 2. Load thesis context

- Read `SOUL.md` (or the path the user specifies for investment thesis).
- Extract:
  - **Layer assignment**: which tickers are core vs satellite vs watchlist.
  - **Conviction buckets**: high / medium / low conviction names.
  - **Regime or theme**: e.g. "risk-on", "defensive", "AI/semiconductor focus".

### 3. Overlay scorecard on thesis

- **High composite, high conviction**: Names that score well and align with thesis — affirm hold or size.
- **High composite, low conviction**: Strong quantitative profile but not yet core — candidates to upgrade from watchlist to an active sleeve, or to increase conviction.
- **Low composite, high conviction**: Thesis favorites that score poorly — flag for review (valuation, momentum, or balance-sheet concerns); suggest trim, reduce, or watch rather than recompute math.
- **Low composite, low conviction**: Weak score and low thesis priority — natural candidates to trim or move to watchlist.

Use the scorecard’s **factor breakdown** (growth, valuation, momentum, profitability, earnings quality, balance sheet, insider signal) and **flags** (e.g. `pe_above_50_low_growth`, `high_momentum`, `drawdown_40pct`, `insider_selling`) to explain *why* a name is strong or weak, without recalculating numbers.

### 4. Sleeve-level view

- Use the scorecard’s **sleeve averages** (tastytrade, hyperliquid, watchlist) to compare sleeves.
- Identify:
  - **Watchlist names with composite above the active-sleeve average** that could strengthen the portfolio if promoted.
  - **Active-sleeve names in the bottom decile** or with multiple risk flags that should be flagged for trim or downgrade.

### 5. Recommendations

Produce a short, actionable summary:

- **Hold / add**: 2–4 names with strong composite and thesis alignment; mention which factor(s) drive the score.
- **Flag for review**: 2–4 names with weak composite and/or risk flags; cite specific flags and factor weaknesses.
- **Promote from watchlist**: Up to 2–3 watchlist names that score above the active-sleeve average and fit the thesis.
- **Consider trimming**: 1–2 active names that score low and carry risk flags; tie to SOUL conviction so the user can decide.

Optionally mention sleeve balance (e.g. "hyperliquid sleeve scores higher on momentum; tastytrade has more valuation dispersion") if useful.

## Notes

- All quantitative scoring (factors, composite, flags) is produced by `src/scripts/score-tickers.ts` reading from `.dexter/cache/`. Ensure the user has run `bun run warmup` and then `bun run score` for up-to-date results.
- Do not compute Sharpe ratios, correlations, or drawdowns in this skill — reference the scorecard and SOUL only.
- If the user asks for "backtest" or "correlation matrix", explain that this skill interprets the scorecard; for full backtests they can use the backtesting skill or run custom analysis.
