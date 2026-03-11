# Dexter

**Your personal AI hedge fund. Lives in your terminal. Gets smarter every night.**

Dexter takes the “AI is infrastructure” thesis — energy, chips, data centers, models, applications — and turns it into a portfolio that manages itself based on what you actually believe. Write your real convictions in one file called **SOUL.md**. That’s literally all it cares about. Dexter reads your thesis, sets up **80% Bitcoin** as the core, then **10% stocks/options** and **10% on-chain equities** — all thesis-focused, zero overlap between sleeves.

It doesn’t buy and forget. It rebalances every week, collects options premium on names you already like, and every quarter it writes a full report asking: *where was your thesis right, where was it wrong?* That loop is the point — keep SOUL.md honest, and everything else compounds. This isn’t a robo-advisor or a signals bot. It’s thesis-first: the conviction constrains the search space, the data fills the positions, the attribution measures the outcome.

The bar is the **Portfolio Builder**: build and maintain a portfolio that beats the benchmarks (S&P 500, NASDAQ, BTC, top hedge funds). The tool doesn’t succeed by answering questions well; it succeeds by producing a portfolio that outperforms. We’re using the AI infrastructure thesis to invest in the AI infrastructure thesis. *[More: [The Researcher Who Thinks](https://ikigaistudio.substack.com/p/the-researcher-who-thinks)]*

**The challenger layer: [AI Hedge Fund](https://github.com/eliza420ai-beep/ai-hedge-fund).** Before any conviction gets trusted, it runs through 18 analyst agents — modeled on Buffett, Munger, Ackman, and systematic quant frameworks — that have never read SOUL.md and don’t care. They just run the numbers. The `/double-check` command fires all 18 against your current positions, surfaces every disagreement in plain language, and flags names you excluded that the agents would buy. When Dexter and the AI Hedge Fund agree, the conviction is load-bearing. When they fight, the conflict is the signal — not noise to dismiss.

**The most novel part of this fork: Dexter improves itself.** Karpathy recently let an AI agent spend two days optimizing his own neural net training code. 700 autonomous experiments. 11% performance gain. 20 improvements he’d missed after months of manual tuning — bugs found, hyperparameters dialed, missing regularization caught. His reaction after 20 years of doing this by hand and building Tesla Autopilot: *“wild.”* His real insight: *“any metric you care about that is reasonably efficient to evaluate can be autoresearched by an agent swarm.”*

For Dexter, that metric is **portfolio alpha vs BTC, SPY, and GLD** — a clean number, evaluated every quarter, no ambiguity. Which means the entire investment logic is fair game for autonomous optimization. [AutoResearch-MLX](docs/PRD-NORTH-STAR-AUTORESEARCH.md), our Apple Silicon-native port of Karpathy’s framework, runs overnight experiments on Dexter’s own reasoning: how to score conviction from SOUL.md, when and how to collect theta, how to audit a thesis against evidence. No GPU, no cloud, no bill — pure MLX on your Mac. Each run tests a variant, measures it against the benchmark, and commits only the winners. The reasoning compounds the same way the capital does.

The meta-point: two metrics, two autoresearch loops, one thesis. The AI Hedge Fund is optimized on **Sharpe ratio** — params tuned overnight, ~300 experiments per hour, pure Python backtest, no LLM calls. Dexter is optimized on **alpha vs BTC/SPY/GLD** — conviction scoring, theta logic, quarterly audit quality, running 5-minute MLX experiments on Apple Silicon. Both loops use the same ratchet: test a variant, measure it, commit the winners, revert the losers. The full stack: **SOUL.md sets conviction → Dexter builds sleeves → AI Hedge Fund challenges them → Autoresearch sharpens both overnight → repeat.** We’re deploying AI research infrastructure to build a better AI infrastructure investor. The thesis is eating itself — in the best possible way.

## Table of Contents

- [What you get](#what-you-get)
- [Customization](#customization)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running Dexter](#running-dexter)
  - [CLI shortcuts](#cli-shortcuts)
- [Project structure](#project-structure)
- [SOUL and HEARTBEAT](#soul-and-heartbeat)
- [Example queries](#example-queries)
- [tastytrade](#tastytrade)
  - [Why tastytrade is in Dexter](#why-tastytrade-is-in-dexter)
  - [How the integration works](#how-the-integration-works)
  - [Theta logic (Phase 5)](#theta-logic-phase-5)
- [Hyperliquid](#hyperliquid)
  - [Why Hyperliquid is in Dexter](#why-hyperliquid-is-in-dexter)
  - [How the integration works](#how-the-integration-works-1)
- [Evaluating, rate limits, debugging](#evaluating-rate-limits-debugging)
- [Documentation](#documentation)
- [License](#license)

---

## What you get

Not a chatbot. A **research loop**: plan → execute → validate → refine. A search engine retrieves; a researcher interrogates. When the numbers say one thing and the narrative says another, Dexter digs until it finds which one is lying. Every answer is constrained by **SOUL.md** — your identity and thesis, not a one-off prompt.

You get weekly rebalance checks (Mondays), quarterly benchmark reports, and optional dollar rebalancing when AUM is set. Regime labels, concentration alerts, investor-letter drafts. Fund ops: AUM config, YTD and since-inception performance, reports in `~/.dexter/`. **VOICE.md** gives every response a consistent tone; override at `~/.dexter/VOICE.md`.

**Two portfolios, zero overlap:** tastytrade sleeve (PORTFOLIO.md) for names *not* on Hyperliquid (e.g. AMAT, ASML, LRCX, KLAC, VRT, CEG — no TSM, AAPL, or any HL-tradable ticker). On-chain sleeve (PORTFOLIO-HYPERLIQUID.md) is for **HIP-3 onchain equities only** (tokenized stocks, commodities, indices) — not crypto. The intended global architecture is **80% BTC core / 10% tastytrade sleeve / 10% Hyperliquid sleeve**. The two sleeves are equally weighted diversification engines whose bar is to outperform **SPY**, **GLD**, and **BTC** over time. Use both sleeves. Suggest both. Save both.

**tastytrade:** Full theta engine — SOUL-aligned scan (thesis names, not index defaults), THETA-POLICY hard block, strategy preview, roll/repair, analytics. Dry-run before any live order; submit/cancel require explicit approval.

The thesis is structural. The sizing is tactical. The discipline is the moat.

---

## Customization

This fork extends [virattt/dexter](https://github.com/virattt/dexter) with a defined thesis, data stack, and broker integrations.

| Layer | What | Why |
|-------|------|-----|
| **Portfolio Builder** | Agent owns the outcome: rebalance, benchmark, report. Bar = beat hedge funds, indexes, BTC. Measurement is a number, not “insightful.” | Generic agents answer questions. This one is judged on the portfolio. |
| **SOUL.md** | Identity + thesis: AI infra supply chain (7 layers), conviction tiers, sizing rules. `80% BTC core / 10% tastytrade sleeve / 10% Hyperliquid sleeve`. “When the evidence conflicts with doctrine, I follow the evidence.” | Not a prompt — a worldview. The edge lives where standard tools can’t see (equipment, EDA, power). SOUL constrains every query. |
| **HEARTBEAT** | Weekly rebalance vs target. Quarterly report vs S&P, NASDAQ, BTC. Regime label. Newsletter draft when it matters. Dollar rebalancing when AUM set. | Passive monitoring isn't enough. Scheduled action: detect drift, deliver reports. |
| **VOICE.md** | ikigaistudio tone and structure in every prompt. | Generic output sounds generic. Essays and letters need a recognizable voice. |
| **Financial Datasets** | Primary source for prices, fundamentals, filings, insider trades, news. Optional Finnhub fallback for price/news when FD is down or rate-limited. | Built for agents: section-level filings, structured JSON. [DATA-API-FINANCIAL-DATASETS.md](docs/DATA-API-FINANCIAL-DATASETS.md). |
| **tastytrade** | 6 shipped phases: accounts + positions + balances (Ph 1), option chain + quote (Ph 2), dry-run/submit/cancel (Ph 3, opt-in), portfolio sync with Target/Actual/Gap + heartbeat (Ph 4), SOUL-aligned theta engine — scan, preview, roll, repair (Ph 5), analytics — transactions, earnings calendar, watchlist, risk metrics scorecard (Ph 6). | Live broker data vs static PORTFOLIO.md. Theta scan defaults to SOUL thesis names — not SPX/SPY/QQQ. THETA-POLICY hard block + no-call list protects Core Compounders. Dry-run before any live order; submit/cancel require explicit approval. [PRD-TASTYTRADE-INTEGRATION.md](docs/PRD-TASTYTRADE-INTEGRATION.md), [PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md](docs/PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md). |
| **Hyperliquid** | HIP-3 data, liquidity ranking, period returns, portfolio ops, live sync, order preview, opt-in execution with approval. **HL sleeve = onchain equities only** (TSM, NVDA, PLTR, COIN, HOOD, CRCL, etc.) — no BTC/SOL/HYPE/ETH/SUI/NEAR (those live in the core crypto portfolio). | Third portfolio: on-chain, 24/7, preview-first then execute when you say. [PRD-HYPERLIQUID-PORTFOLIO.md](docs/PRD-HYPERLIQUID-PORTFOLIO.md). |

Core thesis: BTC HODL is the foundation. The off-chain tastytrade sleeve and on-chain Hyperliquid sleeve are equal-sized diversification engines around that BTC core. The AI infrastructure universe is the main opportunity set. Dexter helps decide when to diversify — and when HODLing is the right call.

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| [Bun](https://bun.com) v1.0+ | Primary runtime |
| OpenAI API key | Required. [Get one](https://platform.openai.com/api-keys). |
| Financial Datasets API key | Required for market data. [Get one](https://financialdatasets.ai). |
| Exa API key | Optional, for web search. |
| tastytrade OAuth | Optional, for positions and options workflows. [developer.tastytrade.com](https://developer.tastytrade.com/). |

Install Bun:

```bash
curl -fsSL https://bun.com/install | bash   # macOS/Linux
# Windows: powershell -c "irm bun.sh/install.ps1|iex"
```

Restart the terminal. Verify: `bun --version`.

---

## Installation

```bash
git clone https://github.com/virattt/dexter.git
cd dexter
bun install
cp env.example .env
```

Edit `.env`: set at least `OPENAI_API_KEY` and `FINANCIAL_DATASETS_API_KEY`. Optional: Exa, Finnhub, tastytrade client ID/secret, Hyperliquid address. See comments in `env.example`.

---

## Running Dexter

```bash
bun start          # Interactive CLI
bun dev            # Watch mode
bun run typecheck  # Types only
bun test           # Tests
bun run heartbeat # Single heartbeat cycle (no gateway)
bun run heartbeat -- --dry-run   # Print query only
bun run validate-portfolio       # Exit 1 if weights ≠ 100% or HL symbols invalid
```

When the HTTP API is running, **GET /health** returns 200 when LLM and Financial Datasets are configured, 503 otherwise (response includes `checks` and `failed`). **GET /health?probe=true** runs a real FD reachability check.

Quick validation:

```bash
bun run typecheck && bun test && bun run heartbeat -- --dry-run && bun run validate-portfolio
```

Type a shortcut in the CLI to run a full query; see [ULTIMATE-TEST-QUERIES.md](docs/ULTIMATE-TEST-QUERIES.md) for the full library.

### CLI shortcuts

| Shortcut | What it does |
|----------|--------------|
| **Portfolio & reports** | |
| `/suggest` | Suggest and save two portfolios (tastytrade sleeve + Hyperliquid sleeve) from SOUL.md; zero overlap. |
| `/weekly` | Weekly performance report: portfolio return vs BTC, GLD, SPY; best/worst performers; one-line takeaway. |
| `/quarterly` | Quarterly report: portfolio vs benchmarks, layer attribution, regime assessment, outlook; save to `~/.dexter/QUARTERLY-REPORT-*.md`. |
| `/suggest-hl` | Suggest Hyperliquid portfolio (HIP-3 onchain equities only — no BTC/SOL/HYPE); save to PORTFOLIO-HYPERLIQUID.md. |
| `/hl-report` | Quarterly performance report for the HL sleeve only; save to `~/.dexter/QUARTERLY-REPORT-HL-*.md`. |
| `/write-essay` | Substack-ready 2,000–5,000 word draft from reports, AIHF, SOUL, and both live sleeves. Works with fallback sources, but the best two-sleeve fund essay needs both `/quarterly` and `/hl-report` first. |
| `/close-loop` | Post-publish recursive pass: score prior quarter tests, extract thesis deltas, and save `THESIS-DELTA-*.md` plus `NEXT-QUARTER-TESTS-*.md`. |
| `/btc-temp-check` | BTC core-position temperature check: reads `BTC.md` + `SOUL.md`, compares BTC vs GLD vs SPY, runs AIHF on `IBIT` as a proxy disagreement signal, and saves `BTC-TEMP-CHECK-*.md`. Alias: `/btc`. |
| `/full-loop` | Run the full pipeline: suggest both sleeves, run AIHF double-check, then draft the essay. Best output still comes after both quarterly reports exist. |
| `/hl-essay` | 600–800 word reflection on the on-chain stocks thesis using the latest HL quarterly report. |
| **Theta (tastytrade options)** | |
| `/theta-policy` | Bootstrap or explain `~/.dexter/THETA-POLICY.md` (allowed underlyings, no-call list, DTE, risk caps). No trades. |
| `/theta-help` | When to use each theta shortcut; safest order for a normal day vs a challenged short; reference THETA-POLICY. |
| `/theta-risk` | Live tastytrade options book: portfolio theta/delta, challenged shorts, concentration, assignment risk. |
| `/theta-scan` | Scan for safest theta trade today (THETA-POLICY defaults, SOUL non-crypto). Table + top 2 candidates; no submit. |
| `/theta-preview` | Run scan, pick best candidate, run strategy preview + dry-run. No submit. |
| `/theta-roll` | Find most challenged short put; build later-dated roll; show dry-run. No submit until you confirm. |
| `/theta-repair` | Analyze challenged short option; recommend hold, roll, close, or assignment. No submit. |
| `/options` | **Suggest options to execute on tastytrade** that fit SOUL.md thesis (equities only, non-crypto). Table + top 2–3 candidates; you preview and submit when ready. |
| **Hypersurface & BTC** | |
| `/theta-btc-weekly` | Optimal strike advice for **BTC options** expiring this Friday (same calendar as Hypersurface). Uses IBIT/BITO for data; **you execute on Hypersurface** — no tastytrade order. Prioritizes **why a given strike is best versus nearby strikes**, with only a short `IBIT on tastytrade instead` note. |
| `/hypersurface` | **Hypersurface-first advice** — optimal strike for BTC options this Friday. You execute manually on Hypersurface; no broker orders. Prioritizes **why the chosen strike wins versus neighboring lines** and keeps IBIT/tastytrade commentary brief. |
| **Broker status** | |
| `/tastytrade-status` | Report tastytrade setup: OAuth state, credentials path, configured vs connected. |

For essays, there are two modes:

- Fallback draft mode: `AIHF + SOUL + current sleeves` is enough to produce a validation-first essay when quarterly artifacts are missing.
- Best two-sleeve fund essay mode: run both `/quarterly` and `/hl-report` first so the draft has realized performance for both sleeves, not just live structure for the Hyperliquid side.

For recursion, there is a third step after publication:

- Post-publish recursive mode: run `/close-loop` after the essay is live to score the previous quarter's tests, save the current quarter's thesis delta, and generate falsifiable tests for the next quarter. This keeps the essay from becoming content-only; it becomes machine-readable learning.

For BTC-core risk, there is now a dedicated operating pass:

- BTC temp-check mode: run `/btc-temp-check` when you want a doctrine-aware answer to "should the BTC core be held, trimmed, hedged, or watched?" It uses `IBIT` as a proxy input for AIHF, but the final call is based on doctrine + regime + concentration, not ETF proxy sentiment alone.

---

## Project structure

```
dexter/
├── src/
│   ├── agent/       # Loop, prompts, scratchpad
│   ├── cli.tsx      # Ink/React CLI
│   ├── gateway/     # WhatsApp and channels
│   ├── model/       # Multi-provider LLM
│   ├── skills/      # SKILL.md workflows (e.g. DCF)
│   └── tools/       # finance, search, portfolio, tastytrade, hyperliquid, heartbeat
├── SOUL.md          # Thesis and coverage universe
├── docs/            # VOICE, HEARTBEAT.example, PRDs, data APIs
└── .dexter/        # Runtime state (gitignored): HEARTBEAT.md, PORTFOLIO.md, fund-config, credentials
```

---

## SOUL and HEARTBEAT

**SOUL.md** in the repo root is injected into every session. It’s not a system prompt — it’s the lens. It defines the coverage universe (seven layers: chip → foundry → equipment → EDA → power → memory → networking), conviction tiering (Core Compounders vs Cyclical vs Speculative vs Avoid), and sizing rules (regime, layer durability, catalyst timing). Standard tools validate the consensus names; the edge lives where they can’t — equipment cycles, EDA complexity, power bottlenecks. Edit SOUL to reflect your thesis. Structure matters more than the names. Recursive updates should flow through saved `THESIS-DELTA-*.md` and `NEXT-QUARTER-TESTS-*.md` artifacts first, then into reviewed SOUL changes.

**~/.dexter/HEARTBEAT.md** is your monitoring checklist. Weekly: rebalance vs target, regime label, concentration alerts, newsletter draft. Quarterly: performance vs BTC, SPY, GLD; result recorded for since-inception tracking. Keep **~/.dexter/PORTFOLIO.md** (and optionally **PORTFOLIO-HYPERLIQUID.md**) so Dexter can compare actual to target.

```bash
cp docs/HEARTBEAT.example.md ~/.dexter/HEARTBEAT.md
```

## Why this repo is recursive

Dexter is not just a research agent or a report generator. The repo is designed as a **recursive portfolio-learning loop**:

1. `SOUL.md` defines the thesis, architecture, conviction tiers, and sizing rules.
2. Dexter builds and monitors the actual sleeves against that thesis.
3. Quarterly reports measure what happened versus BTC, SPY, GLD, and (when available) the HL basket.
4. AIHF provides a second system that challenges the book from a different lens.
5. `/write-essay` turns the quarter into a narrative strong enough to expose the real tension between thesis and regime.
6. `/close-loop` turns that narrative back into machine-readable learning:
   - `THESIS-DELTA-YYYY-QN.md`
   - `NEXT-QUARTER-TESTS-YYYY-QN.md`
7. The next quarter is then judged not only on returns, but on whether the prior quarter's lessons held up.

That is the recursive property: the output of one quarter becomes an input to the next quarter's judgment. Essays are not just content. Reports are not just logs. They become scored feedback against the thesis.

In practice, the loop is:

`SOUL.md -> portfolio -> quarterly report -> essay -> thesis delta -> next-quarter tests -> revised SOUL.md / HEARTBEAT.md -> next portfolio decisions`

The important design choice is that recursion happens through **saved artifacts first**, not direct self-editing. Dexter should propose changes, score them, and carry them forward before doctrine is updated.

## When to adjust `SOUL.md`

`SOUL.md` is the doctrine layer. It should change when the quarter reveals a **structural** lesson, not just a temporary market move.

Good reasons to update `SOUL.md`:

- A thesis distinction became clearer and is likely durable. Example: **power is not one trade**; inside-the-data-center power and grid-level power deserve separate treatment.
- A portfolio architecture rule became explicit. Example: the two-sleeve structure, zero overlap where possible, different jobs for the default and Hyperliquid sleeves.
- A sizing or regime rule proved important enough to formalize. Example: gold strength as a regime signal, or BTC concentration as dominant regime risk.
- A repeated AIHF disagreement pattern taught a useful meta-rule. Example: second-system disagreement should affect sizing and timing first, not automatically invalidate structure.
- A lesson is strong enough that you want the next quarter judged against it.

Bad reasons to update `SOUL.md`:

- A single stock had a good or bad quarter.
- A regime move was real but obviously temporary.
- You are reacting to performance pain without knowing whether the problem was thesis, expression, timing, or sizing.
- The essay sounds persuasive, but the evidence is still thin.
- The proposed change is really a trade adjustment that belongs in `HEARTBEAT.md`, `PORTFOLIO.md`, or `PORTFOLIO-HYPERLIQUID.md`, not in doctrine.

Use this filter after each quarter:

1. Was the lesson **structural** or just **regime**?
2. Does it change the worldview, or only the current expression?
3. Would we want to judge the next quarter against this rule?
4. Can we write a falsifiable next-quarter test for it?

If the answer is "no" to most of those, do not edit `SOUL.md`. Capture it in `THESIS-DELTA-*.md` or `NEXT-QUARTER-TESTS-*.md` first and let another quarter test it.

In short:

- `SOUL.md` = doctrine
- `HEARTBEAT.md` = operating checklist
- `PORTFOLIO*.md` = current expression
- `THESIS-DELTA-*.md` = proposed learning
- `NEXT-QUARTER-TESTS-*.md` = falsifiable recursion

---

## Example queries

Thesis-aware research: *What's our thesis on Bloom Energy and where does it sit in the durability hierarchy?*

Data + thesis: *Pull price and key ratios for Layer 3 equipment: AMAT, ASML, LRCX, KLAC. Analyze TSM's latest income statement through the foundry tollbooth lens.*

Stress-test: *What's the bear case for Layer 1 chip designers right now?*

Portfolio: *Does my portfolio need rebalancing? Compare to SOUL target. What would a near-perfect portfolio look like given our thesis?*

More: [ULTIMATE-TEST-QUERIES.md](docs/ULTIMATE-TEST-QUERIES.md).

---

## tastytrade

Three states: **not connected** → **read-only** → **trading enabled**. In read-only you get accounts, positions, balances, option chain, theta scan, strategy preview, and **order dry-run** — no live orders. When you set `TASTYTRADE_ORDER_ENABLED=true`, live_orders, submit, and cancel appear; submit and cancel still require explicit approval in the CLI. Use `/tastytrade-status` to see your state.

### Why tastytrade is in Dexter

We did not integrate tastytrade so Dexter could become a generic broker chatbot. We integrated it because this repo is trying to close the loop between **thesis**, **portfolio**, and **execution**. Without broker state, Dexter can suggest a beautiful target portfolio while being blind to what you actually hold, how much buying power is left, which options are already open, where the risk is concentrated, and whether a “good idea” is even feasible in the real account. tastytrade turns Dexter from a research agent that can talk about options into an operator that can reason against the live book.

That matters because the repo is built around a very specific structure: **SOUL.md** defines the worldview, `PORTFOLIO.md` defines target exposure, HEARTBEAT checks drift, and the broker integration tells Dexter what is true right now. The tastytrade layer is what lets those pieces meet. Live balances and positions can be normalized, synced into the portfolio format, compared against targets, and fed back into options logic. Instead of saying “sell premium on whatever looks liquid,” Dexter can ask the more important question: *does this trade improve the portfolio we are actually trying to build?*

In practice, tastytrade unlocks six concrete capabilities. First, **live account awareness**: accounts, balances, positions, quotes, chains, transactions, watchlists, and risk metrics. Second, **portfolio sync**: broker positions can be transformed into a `PORTFOLIO.md`-style table with target/actual/gap so HEARTBEAT and portfolio review work from reality, not stale markdown. Third, **thesis-aware theta discovery**: scans start from SOUL-aligned underlyings and policy constraints instead of defaulting to SPX/SPY/QQQ. Fourth, **decision support before execution**: trade preview, dry-run, roll, and repair explain what a trade is, why it fits, what it risks, and how it should be managed. Fifth, **execution with brakes**: live submission is opt-in and approval-gated. Sixth, **venue separation**: tastytrade is the off-chain sleeve, Hyperliquid is the on-chain sleeve, and the code enforces zero overlap so the same thesis is not accidentally duplicated across venues.

So the integration exists for one reason: to make the repo accountable to portfolio outcomes. Research generates candidates. tastytrade tells Dexter what can actually be done, what should be done next, and whether the move still fits the thesis after you account for the book you already own.

### How the integration works

The integration is split into four layers.

1. **Authentication and operator state.** `src/tools/tastytrade/auth.ts` manages OAuth credentials in `~/.dexter/tastytrade-credentials.json`, refreshes access tokens, and exposes the repo’s three-state model: `not_connected`, `read_only`, and `trading_enabled`. `src/scripts/tastytrade-login.ts` gives the repo a first-class broker login flow via `bun run tastytrade:login` or `bun run start -- tastytrade login`.
2. **API transport and broker primitives.** `src/tools/tastytrade/api.ts` wraps every broker request with token refresh, bounded concurrency, retry/backoff, and helpers for accounts, balances, positions, chains, quotes, orders, transactions, and watchlists. This is the thin broker layer Dexter builds on.
3. **Tool registration and safety gating.** `src/tools/registry.ts` only exposes tastytrade tools when the OAuth client is configured and usable credentials exist. Live order tools are registered only when `TASTYTRADE_ORDER_ENABLED=true`. On top of that, `src/agent/tool-executor.ts` forces explicit runtime approval for `tastytrade_submit_order` and `tastytrade_cancel_order`, so even with trading enabled, nothing is sent silently.
4. **Portfolio and policy intelligence.** `src/tools/tastytrade/utils.ts` is where the repo-specific logic lives: 5-minute broker caching, first-query session sync into `PORTFOLIO.md`, option symbol normalization, THETA-POLICY parsing, SOUL/PORTFOLIO context loading, earnings-window filtering, and the hard zero-overlap rule with Hyperliquid. `src/agent/suggest-fast-path.ts` uses the same overlap logic when generating sleeves, so portfolio construction and options workflows obey the same venue split.

That last layer is the real point of the integration. The broker data is not treated as an isolated feed. It is fused with thesis and portfolio context. `tastytrade_sync_portfolio` turns live positions into target/actual/gap views. `tastytrade_theta_scan` starts from allowed underlyings, removes Hyperliquid-overlap names, checks earnings windows, measures buying power and max-loss caps, and then scores candidates. `tastytrade_strategy_preview` validates a proposed order against policy, attaches a trade memo, and runs dry-run before any live action. `tastytrade_submit_order` re-checks policy again at the moment of submission and invalidates broker cache after the trade lands.

The result is a broker integration that is deliberately opinionated. It is not “connect API, place order.” It is “connect the broker to the portfolio builder.” tastytrade gives Dexter the missing execution context for the off-chain sleeve: live holdings, live feasibility, live risk, and a clean path from thesis to preview to approval to order.

### Theta logic (Phase 5)

**What it is:** Theta = options premium selling (credit spreads, covered calls, cash-secured puts, iron condors). You sell time decay; Dexter helps find setups that fit your thesis and risk rules. The whole flow is **SOUL-first**: underlyings, sizing, and guardrails come from your identity and from **~/.dexter/THETA-POLICY.md**, not from generic index defaults.

**Why these trades:** Options income here is **thesis-serving**, not a separate strategy. (1) **Get paid to wait:** Sell cash-secured puts on names you’d buy anyway — you collect premium and may get assigned at a lower price. (2) **Earn on what you hold:** Sell covered calls only on names you’re willing to sell at the strike (never on Core Compounders; they’re on the no-call list so you don’t get called away). (3) **Defined-risk premium:** Credit spreads and iron condors cap max loss while harvesting time decay on thesis underlyings. (4) **Discipline:** Every underlying is a SOUL name with a reason to be there; sizing and risk caps in THETA-POLICY keep one bad trade from blowing up the book. The goal isn’t “trade options” — it’s **improve portfolio outcome** (lower cost basis, extra income, better entries) while staying within the thesis.

**Flow:** (1) **THETA-POLICY** defines allowed underlyings, no-call list, delta/DTE/risk caps, and earnings exclusion. (2) **Scan** runs over those underlyings (and your live positions/balances), filters by policy, and returns ranked candidates. (3) **Preview** turns a chosen candidate into an order payload; **roll** and **repair** suggest adjustments for existing positions. (4) **Dry-run** shows what would be sent; **submit**/ **cancel** only after you approve in the CLI. No auto-submit.

**Key rules:**

- **Hard block:** Only policy-compliant candidates are returned. If a trade would violate delta range, max risk, buying power cap, or no-call list, the tool returns `policy_blocked` and the violations — it never suggests a non-compliant order.
- **No-call list:** Names on this list (e.g. TSM, ASML, AMAT, LRCX, KLAC, ANET, CEG) must not get covered calls, so Core Compounders can’t be called away. Puts and spreads on those names are still allowed (e.g. cash-secured puts to add size).
- **Venue split:** Theta scan and tastytrade orders use **only** symbols that are *not* tradable on Hyperliquid. HL-tradable tickers (TSM, AAPL, COIN, etc.) are stripped from the scan universe and from the tastytrade sleeve; they live in PORTFOLIO-HYPERLIQUID.md and HL tools.
- **Earnings:** When THETA-POLICY sets `exclude_earnings_days` and Financial Datasets is configured, underlyings with earnings inside that window are dropped from the scan. If the key is missing, you get `earnings_exclusion_degraded` and no filtering.

**CLI shortcuts:** `/theta-policy` (show policy), `/theta-help` (workflow), `/theta-risk` (position risk), `/theta-scan` (run scan), `/theta-preview`, `/theta-roll`, `/theta-repair`, `/theta-btc-weekly` (BTC via IBIT), `/hypersurface` (Hypersurface strike advice), `/options` (tastytrade options that fit SOUL.md). Recommended loop: policy → risk → scan → preview → dry-run → approve → submit when you’re ready.

**Theta (Phase 5) tools (summary):** Position risk, scan, strategy preview, roll, repair. Scan defaults to **SOUL.md thesis names** (equipment, foundry, chip, power, memory, networking, cyclical adjacents) — not SPX/SPY/QQQ. THETA-POLICY is enforced as a **hard block**; no-call list protects Core Compounders; venue split keeps HL names out of tastytrade theta. **Use case:** Execution on tastytrade = SOUL non-crypto (equities) only; BTC options = advice for Hypersurface (strike/APR/prob via IBIT), execute on Hypersurface.

**Portfolio sync (Phase 4):** Sync from tastytrade to a PORTFOLIO.md-style table with **Target/Actual/Gap** columns. Optional write to `~/.dexter/PORTFOLIO.md`. Session cache (5-min TTL) avoids redundant API calls. With `TASTYTRADE_HEARTBEAT_ENABLED=true`, heartbeat compares live positions to SOUL.md target and flags drift. **Venue split:** The tastytrade sleeve has zero overlap with Hyperliquid — symbols tradable on HL (e.g. TSM, AAPL, MSFT, BTC, SOL, COIN) are hard-blocked from theta scan, preview, submit, and from the default PORTFOLIO.md; use PORTFOLIO-HYPERLIQUID.md for those.

**Analytics (Phase 6):** Realized P&L and win rate (`tastytrade_transactions`), upcoming earnings for SOUL underlyings + current positions with `within_7_days` flag (`tastytrade_earnings_calendar`), watchlist management with policy-alignment scan (`tastytrade_watchlist`), portfolio risk scorecard — Herfindahl concentration, theta/delta aggregate, buying power utilization (`tastytrade_risk_metrics`).

**Setup:** `TASTYTRADE_CLIENT_ID` and `TASTYTRADE_CLIENT_SECRET` in `.env`, then `bun run tastytrade:login` and paste the refresh token from my.tastytrade.com. Credentials in `~/.dexter/tastytrade-credentials.json`. Theta policy: copy [THETA-POLICY.example.md](docs/THETA-POLICY.example.md) to `~/.dexter/THETA-POLICY.md` and edit to match your holdings. Docs: [TASTYTRADE.md](docs/TASTYTRADE.md), [THETA-POLICY.md](docs/THETA-POLICY.md), [DATA-API-TASTYTRADE.md](docs/DATA-API-TASTYTRADE.md).

---

## Hyperliquid

**HIP-3 sleeve = onchain equities only.** The HL portfolio (PORTFOLIO-HYPERLIQUID.md) is for tokenized stocks, commodities, and indices — TSM, NVDA, PLTR, ORCL, COIN, HOOD, CRCL, TSLA, META, etc. Do *not* put BTC, SOL, HYPE, ETH, SUI, or NEAR in the HL target: core crypto is held separately (e.g. 80% BTC, 10% SOL, 10% HYPE for onchain options on Hypersurface). This keeps the HL sleeve focused on what HIP-3 uniquely offers (24/7 onchain equities) and avoids duplicating crypto weight.

HIP-3 stack: prices, liquidity ranking, period returns, portfolio ops (rebalance_check, quarterly_summary), live sync to PORTFOLIO-HYPERLIQUID.md, order preview, then opt-in execution (submit/cancel) gated by `HYPERLIQUID_ORDER_ENABLED` and private key, with runtime approval. Preview first; heartbeat never submits. Env: `HYPERLIQUID_ACCOUNT_ADDRESS`; optional `HYPERLIQUID_ORDER_ENABLED` and `HYPERLIQUID_PRIVATE_KEY`. **Test balance read:** `bun run hyperliquid:balance` (prints account value, withdrawable, and positions; requires `HYPERLIQUID_ACCOUNT_ADDRESS` in `.env`). [PRD-HYPERLIQUID-PORTFOLIO.md](docs/PRD-HYPERLIQUID-PORTFOLIO.md), [ULTIMATE-TEST-QUERIES.md](docs/ULTIMATE-TEST-QUERIES.md) (Queries 8, 8b–8e).

### Why Hyperliquid is in Dexter

We integrated Hyperliquid because the thesis in this repo is no longer just “what should I own?” It is also “which venue is structurally best for owning it?” Hyperliquid gives Dexter a second execution surface: **24/7 on-chain exposure to tokenized equities, commodities, and indices**. That unlocks a sleeve the tastytrade account cannot represent in the same way. Instead of collapsing everything into one broker account, Dexter can keep the off-chain book and the on-chain book separate, then reason about both as parts of one portfolio architecture.

That separation is the whole point. tastytrade is the off-chain sleeve for names that should live in a conventional broker workflow, especially the options-heavy and non-HL universe. Hyperliquid is the on-chain sleeve for **HIP-3 assets**: tokenized stocks, macro proxies, and other markets the repo wants to treat as their own 24/7 portfolio. The integration exists so Dexter can build, monitor, and rebalance that sleeve as a first-class portfolio instead of treating Hyperliquid as a price feed or a one-off execution toy.

Practically, Hyperliquid unlocks five things. First, **live public account reads** from a wallet address: account value, withdrawable balance, and normalized positions without needing a private key. Second, **live-to-file portfolio sync** into `PORTFOLIO-HYPERLIQUID.md`, so reports and rebalance checks can run on current holdings instead of stale markdown. Third, **deterministic portfolio operations**: rebalance checks, target validation, and quarterly summary payloads that can be fed into performance history. Fourth, **execution previews with market resolution**: drift actions are converted into concrete order intents with estimated sizes, liquidity warnings, and policy checks. Fifth, **opt-in live execution**: only when the user enables it and explicitly confirms.

The reason this matters in Dexter is the same reason tastytrade matters, but for a different venue. Hyperliquid is how the repo expresses the on-chain part of the thesis in an operational way. It lets Dexter answer not just “what are the best on-chain equities?” but “how far is the sleeve from target, what should be trimmed or added, what size would those orders be, and is the move safe enough to show for approval?”

### How the integration works

The Hyperliquid integration is also split into layers, but it is intentionally different from tastytrade because the read path is public and the execution path is separate.

1. **Public account-state layer.** `src/tools/hyperliquid/hyperliquid-account-api.ts` reads `clearinghouseState` from Hyperliquid using only `HYPERLIQUID_ACCOUNT_ADDRESS`. It normalizes positions into account value, withdrawable balance, symbol, size, value, and weight. That is why live portfolio reads and sync do not need a private key.
2. **Portfolio-sync layer.** `src/tools/hyperliquid/hyperliquid-sync-portfolio-tool.ts` converts live holdings into `PORTFOLIO-HYPERLIQUID.md` format. This is the bridge from raw on-chain positions to the rest of Dexter’s portfolio machinery. Once synced, the HL sleeve can be handled like a real managed portfolio, not just a wallet snapshot.
3. **Deterministic ops layer.** `src/tools/hyperliquid/hyperliquid-portfolio-ops-tool.ts` is the portfolio brain for the HL sleeve. It reads the current sleeve from `PORTFOLIO-HYPERLIQUID.md`, reads targets from `HEARTBEAT.md` or `SOUL-HL.md`, computes drift, raises concentration alerts, suggests trim/add actions, validates target tables, and builds quarterly summary payloads. This is where Hyperliquid stops being “an exchange” and becomes “a portfolio that can be operated.”
4. **Market-data and mapping layer.** `src/tools/hyperliquid/hl-fd-mapping.ts` maps HL symbols to Financial Datasets proxies so Dexter can compute returns and reports for tokenized equities, commodities, and indices. Hyperliquid-native prices and liquidity tools cover cases where direct FD mapping is unavailable or incomplete, especially for HL-native or pre-IPO names.
5. **Preview-first execution layer.** `src/tools/hyperliquid/hyperliquid-order-preview-tool.ts` takes rebalance actions and turns them into reviewable order intents. It resolves underlyings to actual HL markets, estimates size from `aum_hl`, adds warnings for unresolved or illiquid symbols, and validates intents against `~/.dexter/hl-execution-policy.json`. Only after that do `hyperliquid_submit_order` and `hyperliquid_cancel_order` come into play, and those require `HYPERLIQUID_ORDER_ENABLED=true`, `HYPERLIQUID_PRIVATE_KEY`, and explicit runtime approval. The signing and submission logic lives in `src/tools/hyperliquid/hyperliquid-execution-api.ts`.

The key design choice is that **execution is downstream of portfolio logic**. Dexter does not jump from “here are some prices” to “send an order.” The intended flow is: sync live holdings, compute drift against target, preview intents, inspect warnings and policy violations, then optionally execute. That makes Hyperliquid fit the same operating model as the rest of the repo: thesis first, portfolio second, execution last.

And just like with tastytrade, the Hyperliquid integration is opinionated about venue boundaries. The HL sleeve is for **HIP-3 on-chain equities and market proxies**, not for the core crypto stack and not for duplicated exposure that already belongs in the off-chain sleeve. That is why the repo keeps `PORTFOLIO-HYPERLIQUID.md` separate, maps its symbols separately, and uses dedicated deterministic ops instead of folding everything into one generic portfolio abstraction.

---

## Evaluating, rate limits, debugging

**Evals:** `bun run src/evals/run.ts` or `--sample 10`. LangSmith for tracking; set `LANGSMITH_API_KEY` and `LANGSMITH_TRACING=true` to trace.

**Rate limiting:** Concurrency cap (5), exponential backoff, retries. Batched tool calls. FD may have no data for some international tickers; fallback to web_search. Note OTC ADRs (e.g. BESIY) in SOUL when relevant.

**Debugging:** Tool calls and results go to `.dexter/scratchpad/` as JSONL per query (init, tool_result, thinking).

**WhatsApp:** `bun run gateway:login` then `bun run gateway`. [WhatsApp README](src/gateway/channels/whatsapp/README.md).

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [BTC.md](BTC.md) | BTC-core doctrine, temp-check workflow, IBIT proxy logic, and when BTC lessons belong in `SOUL.md` |
| [SOUL.md](SOUL.md) | Thesis, coverage universe, conviction tiers, sizing rules |
| [VOICE.md](docs/VOICE.md) | Brand and writing style |
| [HEARTBEAT.example.md](docs/HEARTBEAT.example.md) | Monitoring template → `~/.dexter/HEARTBEAT.md` |
| [DATA-API-FINANCIAL-DATASETS.md](docs/DATA-API-FINANCIAL-DATASETS.md) | Financial Datasets API reference |
| [**TASTYTRADE.md**](docs/TASTYTRADE.md) | **tastytrade user guide: setup, all tools, theta workflows** |
| [DATA-API-TASTYTRADE.md](docs/DATA-API-TASTYTRADE.md) | tastytrade API reference: all 6 phases, SOUL-aligned defaults |
| [THETA-POLICY.md](docs/THETA-POLICY.md) | Theta policy format and field reference |
| [THETA-POLICY.example.md](docs/THETA-POLICY.example.md) | SOUL-aligned policy template (copy to `~/.dexter/THETA-POLICY.md`) |
| [THETA-PROMPTS-12.md](docs/THETA-PROMPTS-12.md) | 12 canonical theta prompts (v1.1, SOUL-aligned) |
| [PRD-TASTYTRADE-INTEGRATION.md](docs/PRD-TASTYTRADE-INTEGRATION.md) | tastytrade integration PRD — all 6 phases |
| [PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md](docs/PRD-TASTYTRADE-PHASE-5-THETA-ENGINE.md) | Phase 5 theta engine: tools, SOUL policy, guardrails |
| [PRD-TASTYTRADE-OPTIONS-EXPLORATION.md](docs/PRD-TASTYTRADE-OPTIONS-EXPLORATION.md) | Explore tastytrade options alongside Hypersurface (venue comparison, gaps, readiness) |
| [RUNBOOK-TASTYTRADE-OPTIONS-FROM-HYPERSURFACE.md](docs/RUNBOOK-TASTYTRADE-OPTIONS-FROM-HYPERSURFACE.md) | One-page: from Hypersurface to tastytrade options via Dexter (venue split, flow, prerequisites) |
| [PRD-HYPERLIQUID-PORTFOLIO.md](docs/PRD-HYPERLIQUID-PORTFOLIO.md) | Hyperliquid portfolio and execution |
| [ULTIMATE-TEST-QUERIES.md](docs/ULTIMATE-TEST-QUERIES.md) | Copy-paste query library |
| [FUND-CONFIG.md](docs/FUND-CONFIG.md), [EXTERNAL-RESOURCES.md](docs/EXTERNAL-RESOURCES.md) | AUM, inception date, research references |

**Related:** [AI Hedge Fund](https://github.com/eliza420ai-beep/ai-hedge-fund) — same org; multi-agent equity analysis (18 analyst agents + risk/portfolio manager), Hyperliquid integration (planned), Tastytrade daily options (experimental). Shares thesis context via **SOUL.md** (and optional `~/.ai-hedge-fund/` config). Use it for signals and portfolio construction experiments; use Dexter for research, live broker data, theta workflows, and execution. Details: [EXTERNAL-RESOURCES.md §9](docs/EXTERNAL-RESOURCES.md#9-ai-hedge-fund--multi-agent-portfolio-construction).

For BTC-core decisions specifically, see [BTC.md](BTC.md). The short version: `SOUL.md` owns the structural BTC doctrine, while BTC temp checks are operational overlays that combine regime, concentration, and AIHF-on-IBIT proxy disagreement. Do not rewrite doctrine just because the proxy turns bearish for a week.

---

## Contributing

Fork, branch, commit, push, open a PR. Keep PRs small and focused.

**Syncing with upstream** (if you forked from virattt/dexter):

We're often many commits ahead (thesis, tastytrade, Hyperliquid, portfolio builder). To pull in upstream changes without losing our work:

```bash
git remote add upstream https://github.com/virattt/dexter.git   # once
git fetch upstream
git merge upstream/main
```

- If Git reports conflicts, resolve them in the listed files (keep our fork behavior and add upstream’s new behavior where it makes sense), then `git add` the resolved files and `git commit`.
- **Do not use GitHub’s “Discard commits” or “Sync fork” in a way that drops our commits** — always merge upstream into your branch locally so your 40+ commits stay intact.

---

## License

MIT
