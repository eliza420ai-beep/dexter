---
name: essay-postmortem
description: Turns a finished quarterly essay into recursive thesis updates. Reads the published essay or latest essay draft, quarterly artifacts, AIHF output, SOUL.md, and prior quarter test files. Produces a thesis delta for the current quarter and a falsifiable test set for the next quarter.
---

# Essay Postmortem Skill

## Workflow Checklist

Copy and track progress:
```
Essay Postmortem Progress:
- [ ] Step 1: Gather source material
- [ ] Step 2: Score the prior quarter's tests
- [ ] Step 3: Extract lessons from the current quarter
- [ ] Step 4: Draft thesis deltas and next-quarter tests
- [ ] Step 5: Self-check for recursion quality
- [ ] Step 6: Save the artifacts
```

## Step 1: Gather Source Material

Read the current quarter's artifacts first, then any prior recursive artifacts.

Important tool rules:
- `.dexter` is a directory. Do not call `ReadFile` on `.dexter` itself.
- Enumerate candidate files in `.dexter/`, then read only resolved file paths.
- Prefer concrete files over vague references.

### Required current-quarter inputs

Read these when available:
1. Latest main quarterly report: `.dexter/QUARTERLY-REPORT-YYYY-QN.md`
2. Latest Hyperliquid quarterly report: `.dexter/QUARTERLY-REPORT-HL-YYYY-QN.md`
3. Latest AIHF report for the same period/session: `.dexter/AIHF-DOUBLE-CHECK-YYYY-MM-DD.md`
4. Latest essay draft for the period: `.dexter/ESSAY-DRAFT-YYYY-QN.md`
5. Published essay text or published URL if the user provides one
6. Root `SOUL.md`
7. Current `.dexter/PORTFOLIO.md`
8. Current `.dexter/PORTFOLIO-HYPERLIQUID.md`

### Required prior recursive inputs

If they exist, read:
1. Previous quarter's `THESIS-DELTA-YYYY-QN.md`
2. Previous quarter's `NEXT-QUARTER-TESTS-YYYY-QN.md`

If prior recursive files do not exist:
- Continue anyway
- Mark this run as the first recursive checkpoint

### Extract from each source

**Quarterly reports**
- precise returns vs BTC, SPY, GLD
- attribution by layer/category
- regime observations
- HL-specific on-chain vs off-chain evidence when available

**AIHF report**
- agreement percentage
- weighted agreement
- hard conflicts
- where AIHF was likely reading regime rather than structure

**Essay draft or published essay**
- final narrative frame
- the quarter's main tension
- any thesis statements strong enough to become doctrine

**SOUL.md**
- current portfolio architecture
- current regime rules
- current second-system calibration rules

**Previous next-quarter tests**
- explicit hypotheses
- explicit invalidations
- any promised scoring rubric

## Step 2: Score the Prior Quarter's Tests

If a prior `NEXT-QUARTER-TESTS-YYYY-QN.md` exists:
- Score each prior test as one of:
  - `validated`
  - `mixed`
  - `not_yet_clear`
  - `invalidated`
- Base the score on current-quarter numbers, not vibes
- Quote at least one precise number for each scored test

Do not be polite. The point is not continuity. The point is measurement.

If no prior test file exists:
- Output a short note: `No prior test file found. This quarter initializes the recursive loop.`

## Step 3: Extract Lessons from the Current Quarter

Turn the quarter into decisions, not just observations.

You must classify each lesson as one of:
- `keep`
- `refine`
- `add`
- `demote`
- `remove`

Good lesson types:
- a thesis that validated
- a thesis that was structurally right but mistimed by regime
- a sleeve architecture rule that became clearer
- a sizing rule that needs tightening
- a committee/AIHF disagreement pattern that should now be codified
- a rule that should stay out of `SOUL.md` because it is only quarter-specific noise

For each lesson include:
- a short title
- category (`keep/refine/add/demote/remove`)
- evidence
- why it belongs in `SOUL.md`, `HEARTBEAT.md`, both, or neither

## Step 4: Draft Thesis Delta and Next-Quarter Tests

Create two outputs.

### Output A: `THESIS-DELTA-YYYY-QN.md`

Structure:
1. Hook
2. What we thought
3. What the quarter proved
4. What changed in the thesis
5. What did **not** change
6. Proposed SOUL updates
7. Proposed HEARTBEAT or workflow updates
8. Open questions that remain unresolved

Requirements:
- keep it concrete
- include precise numbers
- distinguish regime from structure
- do not auto-edit `SOUL.md`; propose changes only

### Output B: `NEXT-QUARTER-TESTS-YYYY-QN.md`

Each test must include:
- `Hypothesis`
- `Why it matters`
- `What would validate it`
- `What would invalidate it`
- `Primary metrics to watch`
- `Where it should show up` (`main sleeve`, `HL sleeve`, `both`, or `regime only`)

Good tests are falsifiable. Bad tests are philosophy.

Aim for 3-7 tests. Not more.

## Step 5: Self-Check for Recursion Quality

Before saving, verify:
- [ ] Prior-quarter tests were scored when available
- [ ] Every new lesson is categorized (`keep/refine/add/demote/remove`)
- [ ] Structure vs regime is explicit
- [ ] At least one proposed change is rejected as overfitting when appropriate
- [ ] Next-quarter tests are falsifiable
- [ ] No placeholder text
- [ ] No direct edits to `SOUL.md` are performed in this step

If any check fails:
1. Rewrite once
2. Re-check once

## Step 6: Save the Artifacts

Use `save_report` twice.

### Save 1

Filename:
- `THESIS-DELTA-YYYY-QN.md`

Frontmatter:
```markdown
---
title: "Thesis Delta — YYYY QN"
period: "YYYY-QN"
artifact_type: thesis_delta
publish_status: internal
---
```

### Save 2

Filename:
- `NEXT-QUARTER-TESTS-YYYY-QN.md`

Frontmatter:
```markdown
---
title: "Next Quarter Tests — YYYY QN"
period: "YYYY-QN"
artifact_type: next_quarter_tests
publish_status: internal
---
```

Return:
- both saved filenames
- a 3-bullet summary of the highest-conviction thesis changes
