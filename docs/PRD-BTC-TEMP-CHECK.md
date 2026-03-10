# PRD: BTC Temp Check — Full Refactor

**Version:** 1.0  
**Status:** Draft  
**Last Updated:** 2026-03-10

---

## 1. Executive Summary

The `/btc-temp-check` command has been **disabled** as of 2026-03-10. After extensive iteration (15+ prompt revisions, aggressive fail-fast refactoring, source-pinning, and cost-reduction work) the command consistently failed to deliver decision-useful output at a reasonable token cost. The root causes are **data pipeline gaps**, not prompt engineering problems.

This PRD defines what must change before the command can be re-enabled, the target architecture for v2, and acceptance criteria that prevent a repeat of the same failure modes.

---

## 2. Why It Was Removed

### 2.1 Observed Failure Modes

| Failure | Frequency | Impact |
|---------|-----------|--------|
| `financial_search` cannot return historical ETF total returns (GLD, SPY, IBIT) for arbitrary windows (7d, 30d, QTD) | Every run | Benchmark table always incomplete; regime classification impossible |
| `web_search` returns prose summaries instead of structured BTC ETF flow data (CoinGlass etc.) | Every run | ETF flow section always "unavailable" |
| JS-rendered pages (CoinGlass) unreachable without `browser` tool | Every run | Dedicated-source fetching fails silently |
| Runs cost $0.30–$0.60 and 40–50 s even when returning "incomplete diagnostic" | Every run | Unacceptable cost/insight ratio |
| Model reads `.dexter/temp-checks/` directory as a file despite explicit negative instruction | Frequent | Wasted tool calls, EISDIR errors |
| Regime label assigned without supporting numbers | Frequent | False confidence; misleading output |
| AIHF run executed on incomplete base data | Occasional | Extra $0.10–$0.20 cost for zero calibration value |

### 2.2 Root Cause Analysis

The command was designed around three data sources that do not currently work through Dexter's tool layer:

1. **Multi-asset benchmark returns** — `financial_search` supports single-equity price fetches but has no reliable endpoint for computed total-return windows across ETFs.
2. **BTC ETF aggregate fund flows** — this data lives behind JS-rendered dashboards (CoinGlass, SoSoValue). `web_search` returns blog-post summaries, not structured numbers.
3. **Prior temp-check diffing** — the model cannot reliably locate files without `glob` or `ls`, and Dexter's tool set doesn't expose a directory-listing primitive to the agent.

Prompt engineering cannot fix missing data tools. The skill needs **new plumbing**, not better instructions.

---

## 3. Prerequisites for Re-Enablement

The command MUST NOT be re-enabled until **all three** of the following are satisfied:

### P0 — Structured Benchmark Data

A tool or data source that returns exact total-return percentages for arbitrary tickers (`BTC-USD`, `GLD`, `SPY`, `IBIT`) over arbitrary lookback windows (7 calendar days, 30 calendar days, quarter-to-date).

Options (pick one):

| Option | Effort | Notes |
|--------|--------|-------|
| Extend `financial_search` to support a `returns` sub-tool with window params | Medium | Cleanest; reusable by other skills |
| Add a dedicated `benchmark_returns` tool backed by a free/cheap API (Yahoo Finance, Polygon, Alpha Vantage) | Medium | Isolated; no regression risk to existing `financial_search` |
| Pre-compute benchmark snapshots in the heartbeat and cache to `.dexter/cache/benchmark-latest.json` | Low | Works offline; stale-data risk; requires heartbeat running |

### P1 — BTC ETF Flow Data

A tool or data source that returns aggregate BTC ETF net-flow numbers (1d, 5d, 20d) with the source named.

Options:

| Option | Effort | Notes |
|--------|--------|-------|
| `browser` tool pointed at `https://www.coinglass.com/etf/bitcoin` with a small extraction prompt | Low-Medium | Depends on Playwright working in the runtime env; page structure may change |
| CoinGlass API (if/when available) via a thin wrapper tool | Low | Ideal; no browser dependency; requires API key |
| SoSoValue or BitMEX Research RSS/API as fallback | Low | Less granular; 1d only in some cases |
| Pre-scrape in heartbeat → cache to `.dexter/cache/btc-etf-flow.json` | Low | Same stale-data caveat as above |

### P2 — Directory-Safe File Discovery

The agent must be able to find the latest `BTC-TEMP-CHECK-*.md` file without attempting to `ReadFile` on a directory.

Options:

| Option | Effort | Notes |
|--------|--------|-------|
| Expose a `list_files` / `glob` primitive as an agent tool | Low | Already exists in some tool registries; just needs wiring |
| Have `save_report` return the saved filename and store a `latest-btc-temp-check` cache key | Low | Eliminates the need for file discovery entirely |

---

## 4. Target Architecture (v2)

```
User: /btc-temp-check
        │
        ▼
  ┌─────────────────┐
  │  CLI shortcut    │  expand to skill invocation
  └────────┬────────┘
           ▼
  ┌─────────────────┐
  │  Skill: btc-    │
  │  temp-check v2  │
  └────────┬────────┘
           │
     ┌─────┼──────────────────┐
     ▼     ▼                  ▼
  ┌──────┐ ┌──────────────┐ ┌────────────────┐
  │bench │ │btc_etf_flow  │ │cache / glob    │
  │mark  │ │tool or       │ │for prior check │
  │_ret  │ │browser fetch │ │file            │
  └──┬───┘ └──────┬───────┘ └───────┬────────┘
     │            │                  │
     ▼            ▼                  ▼
  ┌───────────────────────────────────────┐
  │         Fail-fast gate               │
  │  all 3 inputs present? ──no──► stop  │
  └────────────────┬──────────────────────┘
                   │ yes
          ┌────────┼────────┐
          ▼        ▼        ▼
       regime   concen-   AIHF
       classif  tration   (optional)
          │        │        │
          └────────┴────────┘
                   │
                   ▼
            ┌─────────────┐
            │  Decision   │
            │  + save     │
            └─────────────┘
```

### 4.1 New Tools Required

| Tool | Input | Output | Source |
|------|-------|--------|--------|
| `benchmark_returns` | `tickers: string[], windows: string[]` | `{ ticker, window, return_pct }[]` | Polygon / Yahoo / Alpha Vantage |
| `btc_etf_flow` | none (or `windows: [1,5,20]`) | `{ source, 1d, 5d, 20d }` | CoinGlass API or `browser` scrape |

### 4.2 Skill Changes

The existing `src/skills/btc-temp-check/SKILL.md` should be **replaced**, not patched. Key design changes:

1. **Tool calls, not search queries.** The skill should call deterministic tools (`benchmark_returns`, `btc_etf_flow`) instead of hoping `financial_search` or `web_search` return the right shape.
2. **Fail-fast is structural.** The gate checks tool return shapes, not prose. If the tool returns an error or missing fields, the skill stops immediately.
3. **No regime without numbers.** The regime rubric only runs on a populated benchmark table. This is enforced by the tool pipeline, not a prompt instruction.
4. **AIHF is truly optional.** Only invoked when explicitly requested or when the decision is genuinely ambiguous (e.g., mixed regime + neutral flow).
5. **Output is machine-readable frontmatter + minimal prose.** Reduce the template to frontmatter fields (regime, decision, confidence, flow_signal) and 3–5 lines of reasoning. No multi-section essay.

### 4.3 CLI Shortcut Changes

The `/btc-temp-check` shortcut should be minimal:

```
Run a BTC core-position temperature check using the btc-temp-check skill.
```

All workflow logic belongs in the skill, not the shortcut prompt. The shortcut's only job is to invoke the skill.

---

## 5. Output Contract

### 5.1 Complete Run

```markdown
---
title: "BTC Temp Check — YYYY-MM-DD"
artifact_type: btc_temp_check
regime: risk-on | risk-off | mixed | gold-led safety | btc-specific stress
decision: hold | trim | hedge | prepare to add | no-action but watch
confidence: high | medium | low
btc_etf_flow: supportive | neutral | drag
aihf: bullish | bearish | mixed | skipped
---

# BTC Temp Check — YYYY-MM-DD

| Window | BTC-USD | GLD | SPY | IBIT |
| --- | ---: | ---: | ---: | ---: |
| 7d | x% | x% | x% | x% |
| 30d | x% | x% | x% | x% |
| QTD | x% | x% | x% | x% |

BTC ETF flow (source: CoinGlass): 1d +$XXM · 5d +$XXM · 20d +$XXM

Regime: <label> — <1 line justification with numbers>
Decision: <label> — <1 line justification>
Invalidation: <1 line>
Next review: <1 line>
```

Target: **under 20 lines** after the frontmatter.

### 5.2 Incomplete Run

```markdown
# BTC Temp Check — YYYY-MM-DD

- Status: incomplete
- Missing: <which tool failed and what it returned>
- Decision: deferred
```

Target: **under 5 lines**.

---

## 6. Cost Budget

| Metric | Current (broken) | Target (v2) |
|--------|-----------------|-------------|
| Token cost per complete run | $0.30–$0.60 | < $0.08 |
| Token cost per incomplete run | $0.20–$0.40 | < $0.02 |
| Wall-clock time (complete) | 40–50 s | < 15 s |
| Wall-clock time (incomplete) | 30–45 s | < 5 s |

The primary cost driver today is the agent spending tokens searching for data that doesn't exist through the available tools. With deterministic tools, most of the "searching" disappears.

---

## 7. Phased Rollout

### Phase 0 — Tool Implementation (blocks everything)

- [ ] Implement `benchmark_returns` tool (or extend `financial_search`)
- [ ] Implement `btc_etf_flow` tool (browser-based or API-based)
- [ ] Wire a file-discovery primitive (glob or cache key) so the agent can find prior checks
- [ ] Unit tests for each new tool with mock data

### Phase 1 — Skill Rewrite

- [ ] Replace `src/skills/btc-temp-check/SKILL.md` with v2 (tool-call-driven, not search-driven)
- [ ] Re-enable `/btc-temp-check` in `src/cli.ts` with minimal shortcut prompt
- [ ] Re-add `/btc-temp-check` to intro display in `src/components/intro.ts`
- [ ] Manual test: 3 consecutive runs produce a complete benchmark table and ETF flow data
- [ ] Manual test: cost per complete run < $0.10

### Phase 2 — Hardening

- [ ] Add structured output validation (frontmatter fields must be present and from allowed enums)
- [ ] Cache benchmark + ETF flow for 1 hour to avoid redundant fetches on repeated runs
- [ ] Integrate into heartbeat as an optional weekly check
- [ ] Track cost-per-run in `.dexter/metrics/` for ongoing monitoring

---

## 8. Success Criteria

| Criterion | Measurement |
|-----------|-------------|
| Benchmark table populated on every run where market data APIs are reachable | 100% of runs |
| BTC ETF flow sourced and numeric on every run where CoinGlass (or equivalent) is reachable | 100% of runs |
| Regime label backed by exact numbers from the benchmark table | 100% of complete runs |
| Complete run cost under $0.10 | p95 across 10 test runs |
| Incomplete run exits in < 5 seconds with < $0.02 cost | 100% of incomplete runs |
| No `EISDIR` or directory-read errors | 0 occurrences |

---

## 9. What NOT to Build

- **Do not** attempt to fix this with more prompt engineering on the existing tool set. The fundamental issue is data availability, not instruction quality.
- **Do not** make `web_search` the primary path for benchmark data or ETF flows. It returns unstructured prose and the numbers are unreliable.
- **Do not** run AIHF by default. It adds $0.10–$0.20 and 15+ seconds for marginal calibration value on a BTC-only check.
- **Do not** build a complex multi-section output template. The previous 200-line skill was mostly formatting instructions that the model followed poorly.

---

## 10. Dependencies and References

- Current (disabled) skill: [`src/skills/btc-temp-check/SKILL.md`](../src/skills/btc-temp-check/SKILL.md)
- Current (commented-out) CLI shortcut: [`src/cli.ts` line ~414](../src/cli.ts)
- Prior temp-check outputs: `.dexter/temp-checks/BTC-TEMP-CHECK-*.md`
- CoinGlass BTC ETF page: https://www.coinglass.com/etf/bitcoin
- AIHF double-check PRD: [`docs/PRD-AIHF-DOUBLE-CHECK.md`](PRD-AIHF-DOUBLE-CHECK.md)
- Doctrine files: `BTC.md`, `SOUL.md`

---

## 11. Acceptance Criteria for This PRD

- [x] Root causes documented with evidence from actual runs
- [x] Prerequisites are concrete tools, not prompt tweaks
- [x] Each prerequisite has at least two implementation options with effort estimates
- [x] Output contract is minimal and machine-verifiable
- [x] Cost budget is explicit and measurable
- [x] Phased rollout with blocking dependencies clearly marked
- [x] Anti-patterns ("what not to build") explicitly listed
- [ ] Phase 0 tools implemented — follow-on implementation work
