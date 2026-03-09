# Essay Workflow — Dexter → Claude → Substack → Thesis Delta

**Version:** 1.1  
**Last Updated:** 2026-03-09

Turn Dexter's quarterly reports into published essays, then turn the published essay into recursive thesis updates. Learn, reflect, improve.

---

## The Loop

1. **Run Dexter** — Query 4 (quarterly report) or let the heartbeat run it in the first week of the quarter
2. **Report is saved** — Dexter writes to `~/.dexter/QUARTERLY-REPORT-YYYY-QN.md` automatically
3. **Run Query 5** — Reflection essay draft (optional; or paste report directly into Claude)
4. **Polish in Claude** — Copy Dexter output (or Query 5 draft) into Claude Sonnet for essay refinement
5. **Publish** — Substack, blog, etc.
6. **Run `/close-loop`** — Produce a thesis delta and next-quarter test set from the quarter's artifacts
7. **Review and update SOUL.md / HEARTBEAT.md** — Apply only the structural changes that survive review

---

## Step-by-Step

### 1. Generate the Quarterly Report

**Option A — Manual (Query 4):**
```
Write a quarterly performance report for my portfolio. Use ~/.dexter/PORTFOLIO.md. Fetch price data for the past 90 days for all holdings plus BTC-USD, GLD, and SPY. Include: portfolio return, benchmark returns, layer attribution, conviction-tier performance, regime assessment, outlook. Save the report to ~/.dexter/QUARTERLY-REPORT-2026-Q1.md using the save_report tool.
```

**Option B — Heartbeat:** If it's the first week of Jan/Apr/Jul/Oct, the heartbeat runs the quarterly report automatically and saves it.

### 2. Generate Essay Draft (Optional)

**Query 5:**
```
Using the quarterly performance report from ~/.dexter/QUARTERLY-REPORT-2026-Q1.md, write a 600–800 word reflection essay. Structure:
1. What the numbers say about our thesis — which layers validated, which didn't
2. The regime problem — what BTC/Gold/SPY told us
3. The machine's recommendation — sizing adjustments and why
4. One sentence that captures the tension between thesis and regime

Write in the voice of the ikigaistudio Substack essays. Output markdown ready for editing.
```

### 3. Polish in Claude

Paste the Dexter output (full report or Query 5 draft) into Claude. Ask for:
- Essay structure and narrative flow
- Voice consistency with prior Substack essays
- One sharp sentence that captures the quarter

### 4. Publish

Substack, blog, or wherever you publish.

### 5. Run the Recursive Postmortem

Use `/close-loop` after the essay is published. The recursive pass should:
- score the previous quarter's tests if they exist
- classify this quarter's lessons as `keep`, `refine`, `add`, `demote`, or `remove`
- separate regime observations from structural thesis changes
- propose, not auto-apply, updates to `SOUL.md` and `HEARTBEAT.md`
- generate a falsifiable test set for the next quarter

Artifacts saved by the recursive pass:
- `~/.dexter/THESIS-DELTA-YYYY-QN.md`
- `~/.dexter/NEXT-QUARTER-TESTS-YYYY-QN.md`

### 6. Feed Insights Back to SOUL.md

After each essay, ask: *What did we learn that should change the thesis?*

Examples from [The Terminal That Thinks Like We Do](https://ikigaistudio.substack.com/p/the-terminal-that-thinks-like-we):
- **Power is not one trade** — VRT (inside-the-DC) vs CEG (grid-level) behaved differently → added to SOUL Layer 5
- **BTC concentration as regime risk** — at 40–45%, BTC drives the quarter → added to sizing rules
- **Gold strength as regime signal** — when gold surges while BTC falls, it's a warning → added to regime section

---

## File Locations

| File | Purpose |
|------|---------|
| `~/.dexter/PORTFOLIO.md` | Current holdings (auto-saved when agent suggests) |
| `~/.dexter/PORTFOLIO-HYPERLIQUID.md` | On-chain portfolio (HIP-3 tickers) |
| `~/.dexter/QUARTERLY-REPORT-YYYY-QN.md` | Main quarterly performance report |
| `~/.dexter/QUARTERLY-REPORT-HL-YYYY-QN.md` | Hyperliquid quarterly report (when HL portfolio exists) |
| `~/.dexter/THESIS-DELTA-YYYY-QN.md` | Structured post-publish thesis changes for the quarter |
| `~/.dexter/NEXT-QUARTER-TESTS-YYYY-QN.md` | Falsifiable checks to score next quarter |
| `SOUL.md` | Thesis, layers, conviction tiers — update from essay insights |
| `~/.dexter/SOUL-HL.md` | Optional: HIP-3-specific thesis (target allocation, narrative) |

---

## Hyperliquid Loop (HIP-3 Portfolio)

When you maintain a Hyperliquid portfolio (`PORTFOLIO-HYPERLIQUID.md`):

1. **Heartbeat** — In the first week of the quarter, the heartbeat writes both `QUARTERLY-REPORT-YYYY-QN.md` and `QUARTERLY-REPORT-HL-YYYY-QN.md` when both portfolios exist.
2. **Query 10** — HL reflection essay: paste `QUARTERLY-REPORT-HL-*.md` or run Query 10 to generate a 600–800 word essay on the on-chain stocks thesis.
3. **Query 11** — HL investor letter: same source, structured letter format for LPs.
4. **Polish in Claude** — Same as main loop; refine voice and structure.
5. **Publish** — Substack (or HIP-3-specific channel) for on-chain narrative.
6. **Run `/close-loop`** — Save the thesis delta and next-quarter tests for the HL-aware quarter as well.
7. **Update HEARTBEAT** — Feed insights into the "## HIP-3 Target" section; adjust target weights if thesis evolved.

---

## References

- [ULTIMATE-TEST-QUERIES.md](ULTIMATE-TEST-QUERIES.md) — All copy-paste queries (Query 10, 11, 12 for HL)
- [The Terminal That Thinks Like We Do](https://ikigaistudio.substack.com/p/the-terminal-that-thinks-like-we) — Example essay from this workflow
