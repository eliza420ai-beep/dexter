# AIHF Manual Double-Check Guide

This file explains how to use [AI Hedge Fund](https://github.com/eliza420ai-beep/ai-hedge-fund) manually to pressure-test Dexter's two-sleeve portfolio suggestions before we build a full integration.

The current goal is simple:

- Use Dexter to generate the portfolio ideas
- Use AIHF as an independent second opinion
- Compare where they agree, where they disagree, and which excluded names deserve another look

## Why This Exists

Dexter is good at:

- building a thesis-aligned portfolio from `SOUL.md`
- enforcing the two-sleeve split
- explaining why names are in or out

AIHF is good at:

- running 18 analyst agents plus risk manager and portfolio manager
- giving an independent multi-agent view on the same tickers
- surfacing hidden disagreement, crowding, valuation concerns, or missed opportunities

That is why we created [`docs/PRD-AIHF-DOUBLE-CHECK.md`](docs/PRD-AIHF-DOUBLE-CHECK.md):

- **manual now**: use AIHF by hand to validate Dexter outputs
- **autopilot later**: let Dexter call AIHF automatically and return a structured second-opinion report

The PRD exists because the manual workflow is useful, but repetitive. Full integration would put this on autopilot by:

- sending Dexter's included names and excluded names to AIHF
- parsing AIHF's output
- returning:
  - `Double-Check Summary`
  - `High-Conviction Conflicts`
  - `Excluded But Interesting`

Important: this is **advisory only**. AIHF should not automatically overwrite Dexter portfolio files.

## Prerequisites

Clone and set up AIHF:

```bash
git clone https://github.com/eliza420ai-beep/ai-hedge-fund.git
cd ai-hedge-fund
cp .env.example .env
poetry install
```

Add your API keys in `.env`.

At minimum you likely want:

```bash
OPENAI_API_KEY=...
FINANCIAL_DATASETS_API_KEY=...
```

If you want AIHF to reason from the same thesis as Dexter, share your `SOUL.md`:

```bash
mkdir -p ~/.ai-hedge-fund
cp /Users/macbookpro16/Documents/research-stocks/dexter/SOUL.md ~/.ai-hedge-fund/SOUL.md
```

AIHF already supports loading `SOUL.md`, which keeps the second opinion aligned with Dexter's worldview.

## Current Dexter Portfolio To Validate

These commands are based on the current portfolio suggestion shown in `terminals/22.txt`.

### Tastytrade sleeve

Included:

- `AMAT, ASML, LRCX, KLAC, TEL, VRT, CEG, EQT, ANET, SNPS, CDNS, BESIY, SNDK, WDC, STX, LITE, COHR, CIEN`

Main excluded challengers:

- `NVDA, AVGO, MRVL, ARM, AAPL, BE, SEI, CRWV, CORZ`

### Hyperliquid sleeve

Included:

- `TSM, NVDA, PLTR, ORCL, COIN, HOOD, CRCL, TSLA, META, MSFT, AMZN, GOOGL, GLD, SLV, SPY, SMH`

Main excluded challengers:

- `MU, NFLX, RIVN, AAPL, AMD, MSTR`

## Manual AIHF Commands

These are the best copy-paste commands to run manually in the `ai-hedge-fund` repo.

## Manual one-ticker checks inside Dexter

If you want a second opinion on **one specific ticker** from the Dexter terminal, do **not** use `/double-check` by itself. That shortcut is portfolio-wide by default.

Instead, explicitly tell Dexter to call `aihf_double_check` with only one included ticker.

If the ticker is really a **BTC proxy** rather than a normal equity idea, read `BTC.md` first. The repo treats `IBIT` as a proxy input for BTC temp checks, not as the doctrinal center of the thesis.

### Default / tastytrade sleeve ticker

Use this when the ticker belongs to the default sleeve:

```text
Use aihf_double_check action=run for one ticker only: AMAT.
Do not read PORTFOLIO.md.
Set default_included to [{"ticker":"AMAT","weight":100}], sleeve=default, top_n_included=1, analyst_preset=lean.
Return the second-opinion summary and saved filename.
```

### Hyperliquid sleeve ticker

Use this when the ticker belongs to the Hyperliquid sleeve:

```text
Use aihf_double_check action=run for one ticker only: NVDA.
Do not read PORTFOLIO-HYPERLIQUID.md.
Set hyperliquid_included to [{"ticker":"NVDA","weight":100}], sleeve=hyperliquid, top_n_included=1, analyst_preset=lean.
Return the second-opinion summary and saved filename.
```

### BTC proxy check via `IBIT`

Use this when you want AIHF to act as a second system for the BTC core:

```text
Use aihf_double_check action=run for one ticker only: IBIT.
Do not read PORTFOLIO.md.
Set default_included to [{"ticker":"IBIT","weight":100}], sleeve=default, top_n_included=1, analyst_preset=lean.
Return the second-opinion summary and saved filename.
```

Important:

- this is a **proxy disagreement check**, not the full BTC decision
- the final BTC call should also consider `SOUL.md`, concentration, and BTC vs GLD vs SPY regime
- for the full framework, use `BTC.md`
- if `IBIT` is unavailable as a ticker/proxy, retry with `BITO`, then `GBTC`
- if all listed proxies fail for ticker-availability reasons, direct-crypto fallback is `BTC-USD`
- never use raw `BTC` as the AIHF ticker; it appears mis-mapped
- if AIHF itself is unreachable, treat the second system as unavailable; switching from `IBIT` to `BTC-USD` will not solve a service outage

### Why this shape matters

- `default_included` or `hyperliquid_included` makes the run truly single-name
- `sleeve=default` or `sleeve=hyperliquid` prevents ambiguity
- `top_n_included=1` keeps the run constrained
- `analyst_preset=lean` makes it cheaper and faster for day-to-day checks

`focus_tickers_csv=AMAT` is useful when you are already running against a bigger sleeve and want to narrow the result, but for a **true one-ticker run** you should explicitly set `default_included` or `hyperliquid_included` as above.

### 1. Tastytrade sleeve only

Use this to validate the names Dexter currently included in the tastytrade sleeve.

```bash
poetry run python src/main.py --tickers AMAT,ASML,LRCX,KLAC,TEL,VRT,CEG,EQT,ANET,SNPS,CDNS,BESIY,SNDK,WDC,STX,LITE,COHR,CIEN --analysts-all --show-reasoning
```

### 2. Hyperliquid sleeve only

Use this to validate the names Dexter currently included in the Hyperliquid sleeve.

```bash
poetry run python src/main.py --tickers TSM,NVDA,PLTR,ORCL,COIN,HOOD,CRCL,TSLA,META,MSFT,AMZN,GOOGL,GLD,SLV,SPY,SMH --analysts-all --show-reasoning
```

### 3. Tastytrade sleeve plus the main excluded challengers

This is the best test of whether Dexter left out better non-HL names.

```bash
poetry run python src/main.py --tickers AMAT,ASML,LRCX,KLAC,TEL,VRT,CEG,EQT,ANET,SNPS,CDNS,BESIY,SNDK,WDC,STX,LITE,COHR,CIEN,NVDA,AVGO,MRVL,ARM,AAPL,BE,SEI,CRWV,CORZ --analysts-all --show-reasoning
```

### 4. Hyperliquid sleeve plus the main excluded challengers

This checks whether the current HL basket should include other names such as `MU` or `AMD`.

```bash
poetry run python src/main.py --tickers TSM,NVDA,PLTR,ORCL,COIN,HOOD,CRCL,TSLA,META,MSFT,AMZN,GOOGL,GLD,SLV,SPY,SMH,MU,NFLX,RIVN,AAPL,AMD,MSTR --analysts-all --show-reasoning
```

### 5. Excluded names only

This is often the most useful command. It tells you which omitted names AIHF actually likes.

```bash
poetry run python src/main.py --tickers NVDA,AVGO,MRVL,ARM,AAPL,BE,SEI,CRWV,CORZ,MU,NFLX,RIVN,AMD,MSTR --analysts-all --show-reasoning
```

### 6. Reproducible run with fixed dates

If you want stable comparisons over time, pin the date range:

```bash
poetry run python src/main.py --tickers TSM,NVDA,PLTR,ORCL,COIN,HOOD,CRCL,TSLA,META,MSFT,AMZN,GOOGL --analysts-all --show-reasoning --start-date 2025-12-01 --end-date 2026-03-08
```

## How To Read The Output

You do not want perfect agreement. You want to find **high-conviction disagreement**.

### Good confirmation

- Dexter includes a name
- AIHF is also positive or supportive on it

### Possible problem

- Dexter includes a name
- AIHF is strongly negative on it

### Most valuable signal

- Dexter excluded a name
- AIHF comes back strongly positive on it

That last category is the real reason to run AIHF manually.

## Suggested Workflow

Run the commands in this order:

1. `excluded names only`
2. `tastytrade + challengers`
3. `hyperliquid + challengers`

This sequence gives the fastest feedback on whether Dexter missed anything important.

## Simple Comparison Template

Use this after each manual run:

```markdown
| Ticker | Dexter Stance | AIHF Stance | Revisit? | Notes |
|--------|---------------|-------------|----------|-------|
| MU     | Excluded      | BUY         | Yes      | AIHF likes it more than Dexter does |
| NVDA   | Included HL   | BUY         | No       | Broad confirmation |
| BE     | Excluded      | SELL        | No       | Confirms exclusion |
```

## Why Full Integration Still Matters

Manual commands are useful, but they are slow and repetitive:

- you have to copy tickers by hand
- you have to separate included vs excluded names manually
- you have to read long AIHF output and interpret it yourself

The full integration proposed in [`docs/PRD-AIHF-DOUBLE-CHECK.md`](docs/PRD-AIHF-DOUBLE-CHECK.md) would automate that by:

1. taking Dexter's current two-sleeve output
2. sending included and excluded tickers to AIHF
3. normalizing AIHF's results
4. returning a structured report inside Dexter

That is the "autopilot" goal: not replacing Dexter, but giving Dexter a built-in independent second opinion from AIHF.

### AI Hedge Fund Second-Opinion API (Sleeve-Aware)

Dexter can ask the AI Hedge Fund (AIHF) for a structured second opinion on a **single sleeve** (tastytrade or Hyperliquid HIP-3). The contract is a `PortfolioDraft` JSON plus a few extra fields.

#### Request shape (HedgeFundRequest-compatible)

Dexter POSTs to AIHF:

```http
POST http://localhost:8000/api/v1/second-opinion/runs
Content-Type: application/json
```

Body (minimal example):

```json
{
  "sleeve": "tastytrade",
  "params_profile": "tastytrade_factors_on",
  "tickers": ["ASML", "AMAT", "KLAC", "LRCX"],
  "graph_nodes": [...],
  "graph_edges": [...],
  "margin_requirement": 0.5,
  "portfolio_positions": [],
  "model_name": "gpt-4.1",
  "model_provider": "openai",
  "api_keys": {
    "FINANCIAL_DATASETS_API_KEY": "..."
  }
}
```

- **`sleeve`**: `"tastytrade"` or e.g. `"hl_hip3"` so AIHF knows which sleeve this belongs to.
- **`params_profile`**: which config to use, e.g.:
  - `"tastytrade_baseline"` – technical-only reference,
  - `"tastytrade_factors_on"` – uses `params_tastytrade_sleeve.py`,
  - `"hl_hip3_factors_on"` – uses `params_hl_hip3_sleeve.py`.
- `tickers`, `graph_nodes`, `graph_edges`, `margin_requirement`, `portfolio_positions`, `model_*`, `api_keys` are the usual HedgeFundRequest fields.

AIHF responds:

```json
{
  "run_id": 123,
  "status": "queued"
}
```

Dexter should then:

1. Poll status:

   ```http
   GET /api/v1/second-opinion/runs/{run_id}
   ```

2. When `status` is `COMPLETE` or `ERROR`, fetch the result:

   ```http
   GET /api/v1/second-opinion/runs/{run_id}/result
   ```

   Response (shape simplified):

   ```json
   {
     "run_id": 123,
     "status": "COMPLETE",
     "results": {
       "decisions": { "ASML": { "action": "BUY", "confidence": 78 }, "...": "..." },
       "analyst_signals": { "...": "..." }
     },
     "error_message": null
   }
   ```

#### Optional: shell out to the helper client

Dexter can also just call the helper script in the AIHF repo:

```bash
python scripts/dexter_second_opinion_client.py \
  --draft path/to/portfolio_draft_tastytrade.json \
  --base-url http://localhost:8000 \
  --output-dir ./second_opinion_runs \
  --params-profile tastytrade_factors_on \
  --run-report
```

Where `portfolio_draft_tastytrade.json` looks like:

```json
{
  "sleeve": "tastytrade",
  "params_profile": "tastytrade_factors_on",
  "assets": [
    { "symbol": "ASML", "target_weight_pct": 8.0 },
    { "symbol": "AMAT", "target_weight_pct": 6.0 }
  ],
  "graph_nodes": [...],
  "graph_edges": [...],
  "margin_requirement": 0.5,
  "portfolio_positions": [],
  "model_name": "gpt-4.1",
  "model_provider": "openai"
}
```

The helper will:

- POST the appropriate body to `/api/v1/second-opinion/runs`.
- Poll until the run completes.
- Save `second_opinion_run_result_<run_id>.json`.
- If `--run-report` is set, run `autoresearch.second_opinion_report` to print **Strong agree / Mild disagree / Hard disagree** buckets, including:

```text
=== Second-opinion context ===
  Sleeve         : tastytrade
  Params profile : tastytrade_factors_on
```

Dexter can either:

- Use this script directly (simple shell integration), or
- Reuse the same request/response shapes in a native Python client and build its own reporting / Substack narrative from the `decisions` and `SecondOpinionSummary` layer.

## Full Test Runs (AIHF + Dexter)

The AIFD recommends two full test runs: one for **backtest sanity checks** inside AIHF and one for the **end-to-end Dexter → AIHF second-opinion loop**.

### 1) Full-sleeve backtest sanity run (AIHF)

From the AIHF repo root:

```bash
# 1. Make sure caches are still green
poetry run python -m autoresearch.validate_cache \
  --universes tastytrade_sleeve_long,hl_hip3_sleeve_long \
  --start 2018-01-01 \
  --end 2026-03-07
```

Then run **both sleeves, baseline vs factors**:

```bash
# TASTYTRADE — baseline (technical only)
poetry run python -m autoresearch.evaluate \
  --params autoresearch.params \
  --prices-path prices_tastytrade_sleeve_long.json \
  --tickers ASML,AMAT,KLAC,LRCX,SNPS,CDNS,ANET,AVGO,VRT,MRVL,CEG,EQT,WDC,STX,LITE

# TASTYTRADE — factors ON
poetry run python -m autoresearch.evaluate \
  --params autoresearch.params_tastytrade_sleeve \
  --prices-path prices_tastytrade_sleeve_long.json

# HIP-3 — baseline
poetry run python -m autoresearch.evaluate \
  --params autoresearch.params \
  --prices-path prices_hl_hip3_sleeve_long.json \
  --tickers NVDA,TSM,MSFT,AMZN,GOOGL,META,PLTR,ORCL,MU,COIN,HOOD,TSLA,AAPL,RTX,GLD,SLV

# HIP-3 — factors ON
poetry run python -m autoresearch.evaluate \
  --params autoresearch.params_hl_hip3_sleeve \
  --prices-path prices_hl_hip3_sleeve_long.json
```

This gives you four Sharpe/Sortino/DD/return lines for whole-sleeve performance with and without factor overlays.

### 2) End-to-end Dexter → AIHF second-opinion run

1. **Start the AIHF backend** (in the AIHF repo):

   ```bash
   uvicorn app.backend.main:app --reload
   ```

2. **Prepare a `PortfolioDraft` JSON** in the Dexter repo (e.g. `portfolio_draft_tastytrade.json`):

   ```json
   {
     "sleeve": "tastytrade",
     "params_profile": "tastytrade_factors_on",
     "assets": [
       { "symbol": "ASML", "target_weight_pct": 8.0 },
       { "symbol": "AMAT", "target_weight_pct": 6.0 }
     ],
     "graph_nodes": [...],
     "graph_edges": [...],
     "margin_requirement": 0.5,
     "portfolio_positions": [],
     "model_name": "gpt-4.1",
     "model_provider": "openai"
   }
   ```

3. **From the AIHF repo, run the helper client**:

   ```bash
   python scripts/dexter_second_opinion_client.py \
     --draft path/to/portfolio_draft_tastytrade.json \
     --base-url http://localhost:8000 \
     --output-dir ./second_opinion_runs \
     --params-profile tastytrade_factors_on \
     --run-report
   ```

You should see:

- A `run_id`, status polling, and a saved `second_opinion_run_result_<run_id>.json`.
- A terminal report with **Strong agree / Mild disagree / Hard disagree** buckets, plus the sleeve and params profile used for the run.

