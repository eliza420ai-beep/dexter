/**
 * Pure comparison helpers for the AIHF double-check.
 *
 * No HTTP, no file I/O — just normalization and comparison logic.
 * Takes Dexter's sleeve/excluded input + raw AIHF result and produces
 * agreement scores, conflicts, and excluded-but-interesting entries.
 */

import type {
  AihfAnalystSignal,
  AihfAction,
  AihfDecision,
  AihfRunResult,
  AihfTickerSignals,
  AnalystSplitSummary,
  AnalystView,
  ConflictEntry,
  DoubleCheckResult,
  DoubleCheckSummary,
  ExcludedEntry,
  ExcludedInterestingEntry,
  SoftDisagreementEntry,
  TickerEntry,
} from './types.js';

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** AIHF normalized score below this for an included ticker triggers a conflict. */
const CONFLICT_THRESHOLD = -0.3;

/** AIHF normalized score above this for an excluded ticker flags it as interesting. */
const EXCLUDED_INTERESTING_THRESHOLD = 0.5;

/** Minimum raw AIHF confidence (0-100) to surface a conflict or interesting entry. */
const MIN_CONFIDENCE_RAW = 70;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CompareInput {
  defaultIncluded: TickerEntry[];
  hyperliquidIncluded: TickerEntry[];
  excluded: ExcludedEntry[];
}

export function comparePortfolioVsAihf(
  input: CompareInput,
  aihf: AihfRunResult,
): DoubleCheckResult {
  const allIncluded = [
    ...input.defaultIncluded.map((t) => ({ ...t, sleeve: 'default' as const })),
    ...input.hyperliquidIncluded.map((t) => ({ ...t, sleeve: 'hyperliquid' as const })),
  ];

  const tickersRequested =
    allIncluded.length + input.excluded.length;

  const tickersValidated = Object.keys(aihf.decisions).length;

  // --- Included ticker analysis ---
  let agreements = 0;
  let weightedAgreement = 0;
  let weightedValidated = 0;
  const conflicts: ConflictEntry[] = [];
  const softDisagreements: SoftDisagreementEntry[] = [];
  const sleeveStats = createSleeveStats(allIncluded);

  for (const entry of allIncluded) {
    const ticker = entry.ticker.toUpperCase();
    const decision = aihf.decisions[ticker];
    if (!decision) continue;

    const weight = normalizedWeight(entry.weight);
    const score = normalizeDecision(decision, aihf.analyst_signals[ticker]);
    const sleeve = sleeveStats[entry.sleeve];
    sleeve.included_validated_count++;
    sleeve.weighted_validated += weight;
    weightedValidated += weight;

    if (score >= 0) {
      agreements++;
      weightedAgreement += weight;
      sleeve.included_agreement_count++;
      sleeve.weighted_agreement += weight;
    } else if (score <= CONFLICT_THRESHOLD && decision.confidence >= MIN_CONFIDENCE_RAW) {
      const analystSplit = summarizeAnalystSplit(aihf.analyst_signals[ticker]);
      conflicts.push({
        ticker,
        sleeve: entry.sleeve,
        dexter_stance: `in @ ${entry.weight ?? '?'}%`,
        aihf_stance: decision.action.toUpperCase(),
        aihf_confidence: round2(decision.confidence / 100),
        note: buildConflictNote(decision, analystSplit),
        analyst_split: analystSplit,
      });
      sleeve.conflict_count++;
    } else {
      const analystSplit = summarizeAnalystSplit(aihf.analyst_signals[ticker]);
      softDisagreements.push({
        ticker,
        sleeve: entry.sleeve,
        dexter_stance: `in @ ${entry.weight ?? '?'}%`,
        aihf_stance: decision.action.toUpperCase(),
        aihf_confidence: round2(decision.confidence / 100),
        score: round2(score),
        note: buildSoftDisagreementNote(decision, score, analystSplit),
        analyst_split: analystSplit,
      });
      sleeve.soft_disagreement_count++;
    }
  }

  const includedWithDecisions = allIncluded.filter(
    (e) => aihf.decisions[e.ticker.toUpperCase()],
  ).length;

  const agreementPct = includedWithDecisions > 0
    ? round2(agreements / includedWithDecisions)
    : 1;
  const weightedAgreementPct = weightedValidated > 0
    ? round2(weightedAgreement / weightedValidated)
    : 1;

  // --- Excluded ticker analysis ---
  const excludedInteresting: ExcludedInterestingEntry[] = [];

  for (const entry of input.excluded) {
    const ticker = entry.ticker.toUpperCase();
    const decision = aihf.decisions[ticker];
    if (!decision) continue;

    const score = normalizeDecision(decision, aihf.analyst_signals[ticker]);

    if (score >= EXCLUDED_INTERESTING_THRESHOLD && decision.confidence >= MIN_CONFIDENCE_RAW) {
      excludedInteresting.push({
        ticker,
        dexter_reason: entry.reason,
        aihf_signal: decision.action.toUpperCase(),
        aihf_confidence: round2(decision.confidence / 100),
        suggested_action: buildExcludedNote(entry, decision),
      });
    }
  }

  const summary: DoubleCheckSummary = {
    included_agreement_pct: agreementPct,
    weighted_included_agreement_pct: weightedAgreementPct,
    included_count: allIncluded.length,
    included_validated_count: includedWithDecisions,
    included_agreement_count: agreements,
    conflict_count: conflicts.length,
    soft_disagreement_count: softDisagreements.length,
    excluded_interesting_count: excludedInteresting.length,
    by_sleeve: {
      default: finalizeSleeveStats(sleeveStats.default),
      hyperliquid: finalizeSleeveStats(sleeveStats.hyperliquid),
    },
  };

  return {
    summary,
    conflicts,
    soft_disagreements: softDisagreements,
    excluded_interesting: excludedInteresting,
    aihf_raw_meta: {
      tickers_validated: tickersValidated,
      tickers_requested: tickersRequested,
      timeout: false,
      partial: tickersValidated < tickersRequested,
    },
  };
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Produce a normalized score in [-1, 1] for a ticker.
 *
 * Weighting:
 *   60% portfolio manager confidence (signed by action direction)
 *   40% analyst consensus (fraction bullish - fraction bearish)
 */
export function normalizeDecision(
  decision: AihfDecision,
  analystSignals?: AihfTickerSignals,
): number {
  const direction = actionDirection(decision.action);
  const pmScore = direction * (decision.confidence / 100);

  let analystScore = 0;
  if (analystSignals) {
    const signals = Object.values(analystSignals);
    if (signals.length > 0) {
      const bullish = signals.filter((s) => s.signal === 'bullish').length;
      const bearish = signals.filter((s) => s.signal === 'bearish').length;
      analystScore = (bullish - bearish) / signals.length;
    }
  }

  return 0.6 * pmScore + 0.4 * analystScore;
}

function actionDirection(action: AihfAction): number {
  switch (action) {
    case 'buy':
    case 'hold':
    case 'cover':
      return 1;
    case 'sell':
    case 'short':
      return -1;
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Report rendering (markdown)
// ---------------------------------------------------------------------------

export function renderDoubleCheckMarkdown(result: DoubleCheckResult, date: string): string {
  const lines: string[] = [];

  lines.push(`# AIHF Double-Check Report — ${date}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  const pct = Math.round(result.summary.included_agreement_pct * 100);
  const weightedPct = Math.round(result.summary.weighted_included_agreement_pct * 100);
  lines.push(
    `${pct}% of included tickers confirmed by AIHF (${result.summary.included_agreement_count}/${result.summary.included_validated_count} validated included tickers). ` +
      `${weightedPct}% weighted agreement by included portfolio weight. ` +
      `${result.summary.conflict_count} high-conviction conflict${result.summary.conflict_count === 1 ? '' : 's'} detected. ` +
      `${result.summary.soft_disagreement_count} soft disagreement${result.summary.soft_disagreement_count === 1 ? '' : 's'}. ` +
      `${result.summary.excluded_interesting_count} excluded name${result.summary.excluded_interesting_count === 1 ? '' : 's'} flagged as interesting.`,
  );
  if (result.aihf_raw_meta.partial) {
    lines.push('');
    lines.push(
      `*Note: AIHF validated ${result.aihf_raw_meta.tickers_validated} of ${result.aihf_raw_meta.tickers_requested} tickers. Some may not be supported.*`,
    );
  }
  lines.push('');

  lines.push('### Breakdown');
  lines.push('');
  lines.push('| Sleeve | Agreement | Weighted Agreement | Hard Conflicts | Soft Disagreements |');
  lines.push('|--------|-----------|--------------------|----------------|--------------------|');
  lines.push(
    `| default | ${Math.round(result.summary.by_sleeve.default.included_agreement_pct * 100)}% (${result.summary.by_sleeve.default.included_agreement_count}/${result.summary.by_sleeve.default.included_validated_count}) | ${Math.round(result.summary.by_sleeve.default.weighted_included_agreement_pct * 100)}% | ${result.summary.by_sleeve.default.conflict_count} | ${result.summary.by_sleeve.default.soft_disagreement_count} |`,
  );
  lines.push(
    `| hyperliquid | ${Math.round(result.summary.by_sleeve.hyperliquid.included_agreement_pct * 100)}% (${result.summary.by_sleeve.hyperliquid.included_agreement_count}/${result.summary.by_sleeve.hyperliquid.included_validated_count}) | ${Math.round(result.summary.by_sleeve.hyperliquid.weighted_included_agreement_pct * 100)}% | ${result.summary.by_sleeve.hyperliquid.conflict_count} | ${result.summary.by_sleeve.hyperliquid.soft_disagreement_count} |`,
  );
  lines.push('');

  // Conflicts
  lines.push('## High-Conviction Conflicts');
  lines.push('');
  if (result.conflicts.length === 0) {
    lines.push('None. AIHF broadly agrees with Dexter on included names.');
  } else {
    lines.push('| Ticker | Sleeve | Dexter | AIHF | Confidence | Note |');
    lines.push('|--------|--------|--------|------|------------|------|');
    for (const c of result.conflicts) {
      lines.push(
        `| ${c.ticker} | ${c.sleeve} | ${c.dexter_stance} | ${c.aihf_stance} | ${Math.round(c.aihf_confidence * 100)}% | ${c.note} |`,
      );
    }
  }
  lines.push('');

  lines.push('## Analyst Split By Conflict');
  lines.push('');
  const conflictsWithAnalystSplit = result.conflicts.filter((c) => c.analyst_split);
  if (conflictsWithAnalystSplit.length === 0) {
    lines.push('No per-analyst split available.');
  } else {
    for (const c of conflictsWithAnalystSplit) {
      const split = c.analyst_split!;
      lines.push(`### ${c.ticker} (${c.sleeve})`);
      lines.push('');
      lines.push(
        `Final AIHF stance: ${c.aihf_stance} (${Math.round(c.aihf_confidence * 100)}%). ${split.narrative}`,
      );
      lines.push('');
      if (split.top_bullish.length > 0) {
        lines.push('Bullish analysts:');
        for (const analyst of split.top_bullish) {
          lines.push(
            `- ${analyst.analyst_name} (${Math.round(analyst.confidence * 100)}%): ${truncateReasoning(analyst.reasoning)}`,
          );
        }
        lines.push('');
      }
      if (split.top_bearish.length > 0) {
        lines.push('Bearish analysts:');
        for (const analyst of split.top_bearish) {
          lines.push(
            `- ${analyst.analyst_name} (${Math.round(analyst.confidence * 100)}%): ${truncateReasoning(analyst.reasoning)}`,
          );
        }
        lines.push('');
      }
      if (split.top_neutral.length > 0) {
        lines.push('Neutral / mixed analysts:');
        for (const analyst of split.top_neutral) {
          lines.push(
            `- ${analyst.analyst_name} (${Math.round(analyst.confidence * 100)}%): ${truncateReasoning(analyst.reasoning)}`,
          );
        }
        lines.push('');
      }
    }
  }
  lines.push('');

  lines.push('## Soft Disagreements');
  lines.push('');
  if (result.soft_disagreements.length === 0) {
    lines.push('None. All negative AIHF calls crossed the hard-conflict threshold.');
  } else {
    lines.push('| Ticker | Sleeve | Dexter | AIHF | Confidence | Score | Note |');
    lines.push('|--------|--------|--------|------|------------|-------|------|');
    for (const d of result.soft_disagreements) {
      lines.push(
        `| ${d.ticker} | ${d.sleeve} | ${d.dexter_stance} | ${d.aihf_stance} | ${Math.round(d.aihf_confidence * 100)}% | ${d.score} | ${d.note} |`,
      );
    }
  }
  lines.push('');

  // Excluded but interesting
  lines.push('## Excluded But Interesting');
  lines.push('');
  if (result.excluded_interesting.length === 0) {
    lines.push('None. AIHF does not strongly favor any excluded names.');
  } else {
    lines.push('| Ticker | Dexter Reason | AIHF Signal | Confidence | Suggested Action |');
    lines.push('|--------|---------------|-------------|------------|------------------|');
    for (const e of result.excluded_interesting) {
      lines.push(
        `| ${e.ticker} | ${e.dexter_reason} | ${e.aihf_signal} | ${Math.round(e.aihf_confidence * 100)}% | ${e.suggested_action} |`,
      );
    }
  }
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildConflictNote(decision: AihfDecision, analystSplit?: AnalystSplitSummary): string {
  const verb = decision.action === 'sell' ? 'bearish' : 'strongly negative';
  const short = decision.reasoning.length > 120
    ? decision.reasoning.slice(0, 117) + '...'
    : decision.reasoning;
  const split = analystSplit ? ` ${analystSplit.narrative}` : '';
  return `AIHF ${verb}; ${short}${split}`;
}

function buildSoftDisagreementNote(
  decision: AihfDecision,
  score: number,
  analystSplit?: AnalystSplitSummary,
): string {
  const short = decision.reasoning.length > 120
    ? decision.reasoning.slice(0, 117) + '...'
    : decision.reasoning;
  const split = analystSplit ? ` ${analystSplit.narrative}` : '';
  return `AIHF leans negative but below hard-conflict threshold (score ${round2(score)}); ${short}${split}`;
}

function buildExcludedNote(entry: ExcludedEntry, decision: AihfDecision): string {
  const sleeve = entry.sleeve && entry.sleeve !== 'either' ? ` to ${entry.sleeve} sleeve` : '';
  return `Consider revisiting${sleeve}; AIHF signals ${decision.action.toUpperCase()} with ${decision.confidence}% confidence.`;
}

function normalizedWeight(weight?: number): number {
  return typeof weight === 'number' && weight > 0 ? weight : 1;
}

function summarizeAnalystSplit(analystSignals?: AihfTickerSignals): AnalystSplitSummary | undefined {
  if (!analystSignals) return undefined;
  const allAnalysts = Object.entries(analystSignals).map(([analystId, signal]) =>
    toAnalystView(analystId, signal),
  );
  if (allAnalysts.length === 0) return undefined;

  const bullish = allAnalysts
    .filter((a) => a.signal === 'bullish')
    .sort((a, b) => b.confidence - a.confidence);
  const bearish = allAnalysts
    .filter((a) => a.signal === 'bearish')
    .sort((a, b) => b.confidence - a.confidence);
  const neutral = allAnalysts
    .filter((a) => a.signal === 'neutral')
    .sort((a, b) => b.confidence - a.confidence);

  return {
    bullish_count: bullish.length,
    bearish_count: bearish.length,
    neutral_count: neutral.length,
    top_bullish: bullish.slice(0, 2),
    top_bearish: bearish.slice(0, 2),
    top_neutral: neutral.slice(0, 1),
    narrative: buildAnalystNarrative(bullish, bearish, neutral),
  };
}

function toAnalystView(analystId: string, signal: AihfAnalystSignal): AnalystView {
  return {
    analyst_id: analystId,
    analyst_name: formatAnalystName(analystId),
    signal: signal.signal,
    confidence: (signal.confidence ?? 0) / 100,
    reasoning: signal.reasoning ?? '',
  };
}

function formatAnalystName(analystId: string): string {
  const explicit: Record<string, string> = {
    warren_buffett: 'Warren Buffett',
    charlie_munger: 'Charlie Munger',
    michael_burry: 'Michael Burry',
    bill_ackman: 'Bill Ackman',
    peter_lynch: 'Peter Lynch',
    phil_fisher: 'Phil Fisher',
    ben_graham: 'Ben Graham',
    cathie_wood: 'Cathie Wood',
    aswath_damodaran: 'Aswath Damodaran',
    mohnish_pabrai: 'Mohnish Pabrai',
    rakesh_jhunjhunwala: 'Rakesh Jhunjhunwala',
    stanley_druckenmiller: 'Stanley Druckenmiller',
    technical_analyst: 'Technical Analyst',
    fundamentals_analyst: 'Fundamentals Analyst',
    growth_analyst: 'Growth Analyst',
    news_sentiment_analyst: 'News Sentiment Analyst',
    sentiment_analyst: 'Sentiment Analyst',
    valuation_analyst: 'Valuation Analyst',
  };
  if (explicit[analystId]) return explicit[analystId];
  return analystId
    .split('_')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function buildAnalystNarrative(
  bullish: AnalystView[],
  bearish: AnalystView[],
  neutral: AnalystView[],
): string {
  if (bullish.length > 0 && bearish.length > 0) {
    const topBull = bullish[0]!;
    const topBear = bearish[0]!;
    return `Split inside AIHF: ${topBull.analyst_name} is bullish while ${topBear.analyst_name} is bearish.`;
  }
  if (bearish.length > 0 && bullish.length === 0) {
    return `AIHF analyst stack is broadly one-way bearish (${bearish.length} bearish, ${neutral.length} neutral).`;
  }
  if (bullish.length > 0 && bearish.length === 0) {
    return `AIHF analyst stack is broadly supportive (${bullish.length} bullish, ${neutral.length} neutral).`;
  }
  return `AIHF analyst stack is mostly neutral / mixed (${neutral.length} neutral).`;
}

function truncateReasoning(reasoning: string, max = 140): string {
  if (!reasoning) return 'No reasoning provided.';
  return reasoning.length > max ? `${reasoning.slice(0, max - 3)}...` : reasoning;
}

function createSleeveStats(
  included: Array<TickerEntry & { sleeve: 'default' | 'hyperliquid' }>,
): Record<'default' | 'hyperliquid', {
  included_count: number;
  included_validated_count: number;
  included_agreement_count: number;
  weighted_validated: number;
  weighted_agreement: number;
  conflict_count: number;
  soft_disagreement_count: number;
}> {
  const stats = {
    default: {
      included_count: 0,
      included_validated_count: 0,
      included_agreement_count: 0,
      weighted_validated: 0,
      weighted_agreement: 0,
      conflict_count: 0,
      soft_disagreement_count: 0,
    },
    hyperliquid: {
      included_count: 0,
      included_validated_count: 0,
      included_agreement_count: 0,
      weighted_validated: 0,
      weighted_agreement: 0,
      conflict_count: 0,
      soft_disagreement_count: 0,
    },
  };
  for (const entry of included) {
    stats[entry.sleeve].included_count++;
  }
  return stats;
}

function finalizeSleeveStats(stats: {
  included_count: number;
  included_validated_count: number;
  included_agreement_count: number;
  weighted_validated: number;
  weighted_agreement: number;
  conflict_count: number;
  soft_disagreement_count: number;
}) {
  return {
    included_count: stats.included_count,
    included_validated_count: stats.included_validated_count,
    included_agreement_count: stats.included_agreement_count,
    included_agreement_pct:
      stats.included_validated_count > 0
        ? round2(stats.included_agreement_count / stats.included_validated_count)
        : 1,
    weighted_included_agreement_pct:
      stats.weighted_validated > 0
        ? round2(stats.weighted_agreement / stats.weighted_validated)
        : 1,
    conflict_count: stats.conflict_count,
    soft_disagreement_count: stats.soft_disagreement_count,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
