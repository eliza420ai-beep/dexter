---
name: essay-synthesis
description: Synthesizes Dexter's quarterly reports, AIHF double-check reports, and performance history into a Substack-ready essay in the ikigaistudio voice. Triggers when the user asks for "write an essay", "Substack draft", "essay from the quarterly report", "newsletter draft", "turn the report into an essay", or "write up this quarter."
---

# Essay Synthesis Skill

## Workflow Checklist

Copy and track progress:
```
Essay Synthesis Progress:
- [ ] Step 1: Gather source material
- [ ] Step 2: Identify narrative threads
- [ ] Step 3: Choose essay mode and structure
- [ ] Step 4: Draft the essay
- [ ] Step 5: Self-check against brand checklist
- [ ] Step 6: Save the draft
```

## Step 1: Gather Source Material

Read all available source reports from `.dexter/`.

You need at minimum one of:
- a quarterly report, or
- an AIHF double-check report

### Source Priority (Mandatory)

Use this exact priority order when multiple files exist:
1. Latest quarterly report for the requested period (`QUARTERLY-REPORT-YYYY-QN.md`)
2. Latest AIHF validation report for the same session/period (`AIHF-DOUBLE-CHECK-YYYY-MM-DD.md`)
3. `SOUL.md` thesis context (`.dexter/SOUL.md` first, bundled fallback second)
4. Current sleeve files for live context (`PORTFOLIO.md`, `PORTFOLIO-HYPERLIQUID.md`) so the essay always reflects both sleeves' current structure and weights

If any input is missing:
- Missing quarterly report but AIHF report exists: continue in **validation-first mode**. Use the AIHF report plus current sleeves and SOUL to write a pre-performance essay. Explicitly note that the quarterly performance report is not yet available, so attribution/performance claims are limited.
- Missing quarterly report and missing AIHF report: stop and ask user to run `/quarterly`, `/double-check`, or provide source text
- Missing AIHF report: continue, but include a short "validation unavailable" note in the essay body
- Missing SOUL: continue using bundled fallback and mention that assumption briefly

### 1.1 Quarterly Report (Preferred)
Read the most recent `QUARTERLY-REPORT-YYYY-QN.md` (or user-specified period) if it exists.

**Extract:** portfolio return, benchmark returns (BTC, SPY, Gold), layer/tier attribution, regime assessment, conviction-tier performance, outlook.

### 1.2 Hyperliquid Quarterly Report (If Exists)
Read `QUARTERLY-REPORT-HL-YYYY-QN.md` for the same period.

**Extract:** HIP-3 performance, tokenized equity thesis validation, top/bottom contributors, on-chain vs off-chain comparison.

### 1.3 AIHF Double-Check Report (If Exists)
Read the most recent `AIHF-DOUBLE-CHECK-YYYY-MM-DD.md`.

**Extract:** agreement percentage, high-conviction conflicts, excluded-but-interesting names, meta (how many tickers validated). The AIHF perspective adds a "second opinion" thread to the essay — where the 18-agent committee agreed and where it pushed back.

### 1.4 SOUL.md (Identity & Thesis)
Read `.dexter/SOUL.md` or the bundled `SOUL.md`.

**Extract:** current thesis layers, conviction tiers, regime framework. This is the thesis the essay measures against.

### 1.5 Current Sleeves (Always read when available)
Read the current `PORTFOLIO.md` and `PORTFOLIO-HYPERLIQUID.md` whenever they exist.

**Extract:** current weights, overlap rules, top positions, ballast names, sleeve split, and the "Not in the portfolio — and why" reasoning. Use these as the structural evidence layer. When quarterly attribution exists, use the sleeves to keep the essay aligned with the current book. When quarterly attribution is missing, use them as the main structure source.

### 1.6 VOICE.md and VOICE_DETAILED.md
These are already loaded into your system prompt. Use them as the authoritative style guide.

## Step 2: Identify Narrative Threads

From the gathered data, identify 3-5 narrative threads. Good threads include:

1. **Thesis validation or refutation** — Which layers outperformed? Which underperformed? Did the picks-and-shovels thesis hold? Did infrastructure beat application?
2. **Regime tension** — What did BTC/Gold/SPY tell us? Risk-on vs risk-off? Did the thesis and the regime align or conflict?
3. **The machine's disagreement** — If AIHF data exists: where did 18 agents disagree with Dexter? Was Dexter right or wrong? This is a powerful narrative thread ("We asked the committee. The committee pushed back on NVDA. The committee was right/wrong.")
4. **The excluded name** — If AIHF flagged an excluded ticker as interesting, explore why Dexter passed and whether that was wise.
5. **The sizing question** — Did position sizing match conviction? Where was the portfolio overweight vs thesis? Where was it underweight?
6. **The HIP-3 experiment** — If HL data exists: how did on-chain equities perform vs traditional sleeve? What does tokenization unlock that traditional brokerage doesn't?
7. **The pre-mortem** — If no quarterly report exists: what is the book implicitly betting on, what did the committee reject, and what would invalidate the current structure before results arrive?

Pick the 2-3 strongest threads. Every thread needs at least one precise number.

## Step 3: Choose Essay Mode and Structure

### System Essay (Default — use for most quarterly reflections)

Use **"Thesis → Evidence → System mapping → Implication → Close"** structure:

1. **Opening** — Italicized thesis statement or historical/factual anchor. One sentence that compresses the quarter.
2. **What the numbers say** — Layer attribution. Precise numbers. "+1.69 points from AMAT" not "equipment did well."
3. **The regime overlay** — BTC/Gold/SPY benchmarks. What the regime told us. Where thesis and regime aligned/conflicted.
4. **The committee** (if AIHF data exists) — What 18 agents said. Agreement percentage. The key conflict. Whether the conflict was prophetic or misguided.
5. **The tension** — The honest part. What worked. What didn't. Where we were wrong.
6. **One sharp sentence** — Captures the quarter.
7. **The life image or compressed thesis** — Closing before "Sixty-seven."
8. **"Sixty-seven."** — Always. Non-negotiable.

### Validation-First Essay (Use when quarterly report is missing but AIHF exists)

Use **"Current book → Committee challenge → Thesis defense → Decision layer → Invalidation → Close"** structure:

1. **Opening hook** — One sharp sentence about the current book or the committee disagreement.
2. **Thesis map** — What the current sleeves are actually betting on, with precise weights and category structure.
3. **Committee challenge** — What AIHF rejected, with agreement %, conflict count, and the most important disagreements.
4. **Decision layer** — What stays, what gets questioned, what still needs real-world performance evidence.
5. **Risk + invalidation** — What would prove the current book wrong before the quarterly report arrives.
6. **Close** — One sharp sentence before "Sixty-seven."

In this mode:
- Do not fake realized performance, attribution, or benchmark returns from a missing quarterly artifact
- You may use current weights, AIHF agreement/conflict numbers, and thesis-layer structure as the main evidence base
- Include a brief explicit note that this is a pre-performance draft because the quarterly report is not yet available

### Direct Address Essay (Use when essay targets non-technical readers)

Use **"Empathy → Reframe → Setup → Practical steps → Vision"** structure.

See VOICE_DETAILED.md for full guidance on this mode.

## Step 4: Draft the Essay

### Length
2,000–5,000 words. Short enough to finish, long enough to matter.

### Title + Subtitle
- Title: short, declarative, often a named concept or a statement
- Subtitle: the thesis in one or two sentences. Specific. Makes a claim.

### Voice Rules (Non-Negotiable)
- Paragraphs: 2-4 sentences max. Never longer than 5.
- "We" is default perspective for system essays.
- Periods do the work. Short declarative sentences.
- Em dashes sparingly — when the aside earns its place.
- No semicolons. No transition words between sections.
- Bold for key terms on first introduction only.
- Numbers are precise: "$885 million" not "a massive position." "14.9%" not "significant." "-9.45 points" not "the main drag."
- No: "exciting opportunity," "massive upside," "we're bullish on," "consider adding," "you might consider."
- Never: utilize, synergy, landscape, ecosystem, stakeholder, scalable, actionable, bandwidth, holistic, innovative, robust, streamline, cutting-edge, best-in-class, thought leader, furthermore, moreover, additionally, consequently, nevertheless.
- Never start with: a definition, a dictionary quote, "In this essay we will...", a disclaimer.
- Never end with: a summary paragraph, "in conclusion."

### Rhetorical Patterns to Deploy
- **The convergence reveal** — Two independent systems arrived at the same conclusion.
- **The layer peel** — Start with the obvious, reveal the structural insight underneath.
- **The honest status report** — State what's working, what isn't, with numbers.
- **The regime overlay** — Present thesis, then condition on current regime.
- **Precise quantification** — "17.8 points of outperformance" not "significantly better."
- **The "not X, Y" correction** — "Not a dashboard. A blinking cursor that reasons."
- **The stacked triple** — "The thesis is structural. The sizing is tactical. The discipline is the moat."
- **The honest admission** — "The diversification did help. It did not help enough."

### AIHF Thread (When Available)
Weave the AIHF double-check naturally into the narrative. Do not present it as a separate section titled "AIHF Results." Instead:

> "We asked the committee — eighteen agents, each with their own lens. The agreement was 87%. But the 13% is where it gets interesting. Three of them flagged NVDA as a sell at current levels. The reasoning: valuation stretched after a multi-year run, supply catching up to demand. They might be right. The thesis says hold. The committee says trim. We quantify the tension."

### Missing Quarterly Report Rule
If the quarterly report is missing but AIHF exists, the essay must still read like a finished essay, not an error message. Mention the missing quarterly artifact once, briefly, then move into the actual argument.

## Step 5: Self-Check Against Brand Checklist

Before saving, verify:

- [ ] Numbers are precise (no "roughly," "around," "approximately")
- [ ] Thesis vs regime tension is explicit
- [ ] One sharp closing sentence before "Sixty-seven."
- [ ] No hype or vague optimism
- [ ] No forbidden words (check the list in VOICE_DETAILED.md)
- [ ] No summary paragraph at the end
- [ ] No transition words between sections
- [ ] Ends with "Sixty-seven."
- [ ] Title is short, declarative
- [ ] Subtitle makes a specific, falsifiable claim
- [ ] Paragraphs are 2-4 sentences
- [ ] At least 3 precise numbers in the first 500 words
- [ ] Required sections exist: Hook, Thesis map, Committee challenge, Decision layer, Risk + invalidation
- [ ] Word count is between 2,000 and 5,000
- [ ] No placeholders such as "[TODO]", "TBD", "insert chart"

### Step 5.1: Single Fix Pass (Auto-Rewrite Once)

If any checklist item fails:
1. Rewrite the draft exactly once to fix missing requirements.
2. Re-check checklist.
3. If still failing, return best draft plus a concise note listing unresolved checklist items.

## Step 6: Save the Draft

Use the `save_report` tool to save the essay:

**Filename:** Prefer `ESSAY-DRAFT-YYYY-QN.md` when a quarterly period is known (e.g. `ESSAY-DRAFT-2026-Q1.md`).

If no quarterly report exists, infer the current quarter from today's date and still save as `ESSAY-DRAFT-YYYY-QN.md`.

If a Hyperliquid-specific essay was written: `ESSAY-DRAFT-HL-YYYY-QN.md`

Include frontmatter at the top for Substack handoff:

```markdown
---
title: "<short declarative title>"
subtitle: "<specific falsifiable claim>"
tags:
  - ai
  - investing
  - portfolio
  - markets
thesis_bullet: "<single-line thesis for this draft>"
publish_status: draft
---
```

The user will review, polish, and publish to Substack.
