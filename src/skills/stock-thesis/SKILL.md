---
name: stock-thesis
description: >
  Generate and refresh per-stock investment thesis artifacts as markdown files
  under .dexter/stock-theses, for both single tickers and full portfolio sleeves.
  Use when the user asks for an individual stock thesis, wants thesis coverage
  gaps filled for a portfolio, or wants to refresh stale theses before a report
  or essay.
---

# Stock Thesis Skill

Structured workflow to create and maintain reusable stock thesis artifacts for individual equities. Theses are stored as markdown files and reused by portfolio review, heartbeat, AIHF double-check, and essay workflows.

## Workflow Checklist

```text
Stock Thesis Progress:
- [ ] Step 1: Resolve tickers and mode (single vs batch)
- [ ] Step 2: Gather data for each ticker
- [ ] Step 3: Draft thesis markdown using the standard schema
- [ ] Step 4: Save with stock_thesis (generate)
- [ ] Step 5: Summarize coverage and gaps back to the user
```

## Step 1: Resolve tickers and mode

- **Single-ticker mode**:
  - Trigger phrases: "thesis for NVDA", "/thesis NVDA", "write a thesis on TSM", "/refresh-thesis NVDA"
  - Extract a single ticker symbol (e.g. NVDA, TSM, AMAT).
- **Batch / portfolio mode**:
  - Trigger phrases: "/portfolio-theses", "generate theses for my portfolio", "fill thesis gaps", "which of my stocks have theses"
  - Use the `portfolio` tool with `action=view` for:
    - tastytrade sleeve: default (PORTFOLIO.md)
    - Hyperliquid sleeve: portfolio_id=hyperliquid (PORTFOLIO-HYPERLIQUID.md) ONLY for tokenized stocks / HIP-3 tickers
  - Parse table rows to extract tickers from each sleeve.

De-duplicate tickers across sleeves. For batch mode, prefer generating theses for the **tastytrade sleeve** first; Hyperliquid stock theses are useful but secondary.

## Step 2: Gather data for each ticker

For each target ticker:

1. **Financials / metrics / news**:
   - Use `financial_search` with a single natural-language query that includes:
     - the ticker
     - sector/layer if known (from SOUL.md)
     - the questions you need for thesis: business model, growth, margins, balance sheet, valuation, key risks, recent events.
   - Do NOT fan out multiple `financial_search` calls per ticker; one well-structured query is preferred.

2. **Filings (if needed)**:
   - If you need more precise fundamentals, use `read_filings` for the latest 10-K / 20-F / 10-Q.
   - Only fetch specific sections that matter (business, MD&A, risk factors) rather than dumping entire filings.

3. **Context from SOUL and portfolio**:
   - Read `SOUL.md` to understand:
     - how this ticker fits thesis layers (equipment, power, foundry-adjacent, AI infra, etc.)
     - conviction tiers (core, cyclical, speculative, avoid).
   - From `PORTFOLIO.md` / `PORTFOLIO-HYPERLIQUID.md`, extract:
     - current weight (if present)
     - any existing role / notes fields.

4. **Existing thesis artifact (if any)**:
   - Use `stock_thesis` with `action=view` and `ticker` to see if a prior thesis exists.
   - If it does, treat the new draft as a **refresh**:
     - keep durable structural points
     - update numbers, timing, catalysts, and risks
     - preserve or update `role_in_portfolio`, `thesis_type`, and `confidence`.

Work in degraded mode if some data sources are unavailable (e.g. financial_search errors, filings missing). Do not block the entire batch; just lower confidence and call that out.

## Step 3: Draft thesis markdown using the standard schema

For each ticker, draft a full markdown thesis with this structure. This is a **hard requirement** for compatibility with other workflows.

```markdown
---
title: "<Company Name> (<TICKER>) Investment Thesis"
ticker: "<TICKER>"
artifact_type: stock_thesis
publish_status: internal
updated_at: "YYYY-MM-DD"
source_mode: "single" | "batch"
role_in_portfolio: "core" | "compounder" | "cyclical" | "speculative" | "hedge" | "watchlist"
thesis_type: "compounder" | "cyclical" | "speculative" | "hedge"
confidence: "high" | "medium" | "low"
---

## The Thesis In One Paragraph
...

## Why This Stock Is Different
...

## Core Investment Case
...

## What Has To Go Right
...

## Valuation / Model
...

## Risks And Mitigants
...

## Invalidation
...

## Why Now
...

## Role In Portfolio
...
```

Guidance:

- Prefer the house style from `SOL.md`, `HYPE.md`, and `SUI.md`:
  - precise numbers
  - clear target / reference / upside
  - explicit regime framing when relevant
  - structural thesis vs timing separated.
- Be clear about:
  - where the thesis depends on AI / infra / power / equipment layers from `SOUL.md`
  - whether the stock is meant to be core, optionality, or a hedge.

If this is a **refresh** of an existing thesis, you may preserve and refine strong sections instead of rewriting from scratch, but the resulting markdown should still be coherent and readable on its own.

## Step 4: Save with stock_thesis (generate)

For each drafted thesis:

- Call `stock_thesis` with:
  - `action="generate"`
  - `ticker="<TICKER>"`
  - `content="<full markdown thesis>"`

This will save or overwrite `.dexter/stock-theses/STOCK-THESIS-<TICKER>.md`.

- Do **not** call filesystem write tools directly for theses.
- Do **not** write thesis content into `PORTFOLIO.md` or `PORTFOLIO-HYPERLIQUID.md`.

## Step 5: Summarize coverage and gaps back to the user

After saving:

- Use `stock_thesis` with `action="list"` once to show which tickers now have saved theses.
- In your chat response, summarize:
  - which tickers have fresh theses
  - which tickers still lack theses (if batch mode)
  - any major confidence or data-quality caveats.

Suggested reply shape:

1. A short list of tickers just covered or refreshed.
2. A list of uncovered names (if any) and why they were skipped (e.g. missing data, out-of-scope assets).
3. One-sentence reminders:
   - theses live in `.dexter/stock-theses/`
   - future portfolio / heartbeat / essay work will reuse them automatically.

