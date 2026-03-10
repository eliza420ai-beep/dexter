/**
 * aihf_double_check tool.
 *
 * Sends Dexter's included + excluded tickers to AI Hedge Fund,
 * normalizes the multi-agent response, and returns a structured
 * second-opinion report. Advisory only — never mutates portfolio files.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { callAIHF, AihfError } from './aihf-api.js';
import { comparePortfolioVsAihf, renderDoubleCheckMarkdown } from './aihf-double-check.js';
import { recordRun } from './feedback.js';
import { parsePortfolioMarkdown } from '../../utils/portfolio-parse.js';
import { dexterPath, dexterPortfolioPath } from '../../utils/paths.js';
import { getLegacyPortfolioPath } from '../portfolio/portfolio-tool.js';
import type { TickerEntry, ExcludedEntry, DoubleCheckResult } from './types.js';
import type { AnalystPreset } from './aihf-graph.js';

const DEXTER_DIR = dexterPath();
const PORTFOLIO_MD_PATH = dexterPortfolioPath('PORTFOLIO.md');
const PORTFOLIO_HL_PATH = dexterPortfolioPath('PORTFOLIO-HYPERLIQUID.md');

// ---------------------------------------------------------------------------
// Tool description (injected into system prompt via registry)
// ---------------------------------------------------------------------------

export const AIHF_DOUBLE_CHECK_DESCRIPTION = `
Run AI Hedge Fund's analyst graph as a **second opinion** on Dexter's portfolio.

## When to Use

- User asks for a "double-check", "second opinion", "validate portfolio", or "run AIHF"
- After generating a two-sleeve portfolio suggestion, offer to run the double-check
- User asks "what does the hedge fund think?" or similar

## Actions

- **run**: Send included + excluded tickers to AIHF. Produces a structured report with:
  - Agreement score (% of included names AIHF confirms)
  - High-conviction conflicts (AIHF strongly disagrees with Dexter)
  - Excluded but interesting (names Dexter left out that AIHF likes)
  Saves the report to .dexter/reports/AIHF-DOUBLE-CHECK-YYYY-MM-DD.md

- **view_last**: Read the most recent double-check report from disk.

## Important

- This is **advisory only**. Never auto-modify PORTFOLIO.md or PORTFOLIO-HYPERLIQUID.md based on AIHF output.
- If tickers are not provided, the tool reads current PORTFOLIO.md and PORTFOLIO-HYPERLIQUID.md.
- Normal use should prefer one sleeve at a time, top positions only, and the lean analyst set.
- For deeper context on any single equity the committee flags (conflict or excluded-but-interesting), you may read its saved stock thesis via stock_thesis (view) when available instead of re-deriving a fresh thesis from scratch.
- AIHF runs may take 1-3+ minutes. If it times out, the tool suggests a manual CLI command.
- Requires AIHF backend running and AIHF_API_URL configured.
`.trim();

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const tickerEntrySchema = z.object({
  ticker: z.string(),
  weight: z.number().optional(),
  note: z.string().optional(),
});

const excludedEntrySchema = z.object({
  ticker: z.string(),
  reason: z.string(),
  sleeve: z.enum(['default', 'hyperliquid', 'either']).optional(),
});

const aihfSchema = z.object({
  action: z.enum(['run', 'view_last']).describe('Action to perform'),
  default_included: z
    .array(tickerEntrySchema)
    .optional()
    .describe('Tastytrade sleeve tickers. If omitted, reads from PORTFOLIO.md.'),
  hyperliquid_included: z
    .array(tickerEntrySchema)
    .optional()
    .describe('Hyperliquid sleeve tickers. If omitted, reads from PORTFOLIO-HYPERLIQUID.md.'),
  excluded: z
    .array(excludedEntrySchema)
    .optional()
    .describe('Excluded tickers with reasons. Optional.'),
  start_date: z.string().optional().describe('AIHF analysis start date (YYYY-MM-DD). Optional.'),
  end_date: z.string().optional().describe('AIHF analysis end date (YYYY-MM-DD). Defaults to today.'),
  initial_cash: z.number().optional().describe('AIHF initial cash for sizing. Defaults to 100000.'),
  sleeve: z
    .enum(['both', 'default', 'hyperliquid'])
    .optional()
    .describe('Scope the run to one sleeve when you do not want both books at once. Defaults to both.'),
  top_n_included: z
    .number()
    .int()
    .min(1)
    .max(25)
    .optional()
    .describe('Limit included names to the top N by weight after sleeve filtering. Defaults to 10.'),
  min_weight_pct: z
    .number()
    .min(0)
    .optional()
    .describe('Drop included positions below this portfolio weight before sending them to AIHF.'),
  focus_tickers_csv: z
    .string()
    .optional()
    .describe('Optional comma-separated ticker subset for conflict or marginal-name reruns.'),
  analyst_preset: z
    .enum(['full', 'lean'])
    .optional()
    .describe('Analyst graph preset. Defaults to lean for cheaper day-to-day checks.'),
});

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const aihfDoubleCheckTool = new DynamicStructuredTool({
  name: 'aihf_double_check',
  description:
    'Run AI Hedge Fund as a second opinion on portfolio tickers. Supports sleeve-scoped, top-N, and lean-analyst runs for cheaper day-to-day validation.',
  schema: aihfSchema,
  func: async (input, _runManager, config?: RunnableConfig) => {
    if (input.action === 'view_last') {
      return viewLastReport();
    }

    const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;

    // --- Resolve tickers ---
    const rawDefaultIncluded = input.default_included ?? readPortfolioTickers(PORTFOLIO_MD_PATH);
    const rawHlIncluded = input.hyperliquid_included ?? readPortfolioTickers(PORTFOLIO_HL_PATH);
    const rawExcluded: ExcludedEntry[] = input.excluded ?? [];
    const selection = selectRunUniverse(
      {
        defaultIncluded: rawDefaultIncluded,
        hyperliquidIncluded: rawHlIncluded,
        excluded: rawExcluded,
      },
      {
        sleeve: input.sleeve,
        topNIncluded: input.top_n_included,
        minWeightPct: input.min_weight_pct,
        focusTickersCsv: input.focus_tickers_csv,
      },
    );
    const defaultIncluded = selection.defaultIncluded;
    const hlIncluded = selection.hyperliquidIncluded;
    const excluded = selection.excluded;
    const analystPreset: AnalystPreset = input.analyst_preset ?? 'lean';

    const allTickers = [
      ...defaultIncluded.map((t) => t.ticker),
      ...hlIncluded.map((t) => t.ticker),
      ...excluded.map((t) => t.ticker),
    ];

    if (allTickers.length === 0) {
      return 'No tickers to validate. Provide tickers or ensure PORTFOLIO.md / PORTFOLIO-HYPERLIQUID.md exist.';
    }

    const uniqueTickers = [...new Set(allTickers.map((t) => t.toUpperCase()))];
    onProgress?.(
      `Preparing AIHF run for ${uniqueTickers.length} unique tickers ` +
        `(${defaultIncluded.length} default, ${hlIncluded.length} hyperliquid, ${excluded.length} excluded) ` +
        `using the ${analystPreset} analyst set...`,
    );

    // --- Call AIHF ---
    let aihfResult;
    try {
      aihfResult = await callAIHF({
        tickers: uniqueTickers,
        startDate: input.start_date ?? null,
        endDate: input.end_date,
        initialCash: input.initial_cash,
        analystPreset,
        onProgress,
      });
    } catch (err) {
      if (err instanceof AihfError) {
        return `AIHF double-check unavailable: ${err.message}`;
      }
      return `AIHF double-check failed: ${err instanceof Error ? err.message : String(err)}`;
    }

    // --- Compare ---
    onProgress?.('Comparing AIHF decisions against Dexter sleeves...');
    const result = comparePortfolioVsAihf(
      { defaultIncluded, hyperliquidIncluded: hlIncluded, excluded },
      aihfResult,
    );

    // --- Save report + record in feedback history ---
    const date = new Date().toISOString().slice(0, 10);
    const markdown = [
      renderDoubleCheckMarkdown(result, date),
      renderActionMemo({ defaultIncluded, hyperliquidIncluded: hlIncluded, excluded }, result),
    ].join('\n\n');
    const filename = `AIHF-DOUBLE-CHECK-${date}.md`;
    saveReport(filename, markdown);
    onProgress?.(`Saved AIHF report to .dexter/${filename}.`);
    try { recordRun(result, date); } catch { /* non-critical */ }

    // --- Format tool output ---
    return formatResult(result, filename);
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readPortfolioTickers(path: string): TickerEntry[] {
  const legacyPath = path.endsWith('PORTFOLIO-HYPERLIQUID.md')
    ? getLegacyPortfolioPath('hyperliquid')
    : getLegacyPortfolioPath('default');

  for (const candidate of [path, legacyPath]) {
    if (!existsSync(candidate)) continue;
    const content = readFileSync(candidate, 'utf-8');
    const parsed = parsePortfolioMarkdown(content).map((p) => ({
      ticker: p.ticker,
      weight: p.weight,
    }));
    if (parsed.length > 0) {
      return parsed;
    }
  }

  return [];
}

export function selectRunUniverse(
  input: {
    defaultIncluded: TickerEntry[];
    hyperliquidIncluded: TickerEntry[];
    excluded: ExcludedEntry[];
  },
  options: {
    sleeve?: 'both' | 'default' | 'hyperliquid';
    topNIncluded?: number;
    minWeightPct?: number;
    focusTickersCsv?: string;
  },
): {
  defaultIncluded: TickerEntry[];
  hyperliquidIncluded: TickerEntry[];
  excluded: ExcludedEntry[];
} {
  const sleeve = options.sleeve ?? 'both';
  const topNIncluded = options.topNIncluded ?? 10;
  const minWeightPct = options.minWeightPct;
  const focusTickers = parseFocusTickers(options.focusTickersCsv);

  const includeDefault = sleeve === 'both' || sleeve === 'default';
  const includeHyperliquid = sleeve === 'both' || sleeve === 'hyperliquid';

  let scopedIncluded = [
    ...(includeDefault
      ? input.defaultIncluded.map((entry) => ({ ...entry, sleeve: 'default' as const }))
      : []),
    ...(includeHyperliquid
      ? input.hyperliquidIncluded.map((entry) => ({ ...entry, sleeve: 'hyperliquid' as const }))
      : []),
  ];

  if (typeof minWeightPct === 'number') {
    scopedIncluded = scopedIncluded.filter((entry) => (entry.weight ?? 0) >= minWeightPct);
  }

  if (focusTickers.size > 0) {
    scopedIncluded = scopedIncluded.filter((entry) => focusTickers.has(entry.ticker.toUpperCase()));
  }

  scopedIncluded = scopedIncluded
    .slice()
    .sort((a, b) => (b.weight ?? Number.NEGATIVE_INFINITY) - (a.weight ?? Number.NEGATIVE_INFINITY));

  if (topNIncluded > 0) {
    scopedIncluded = scopedIncluded.slice(0, topNIncluded);
  }

  const defaultIncluded = scopedIncluded
    .filter((entry) => entry.sleeve === 'default')
    .map(({ sleeve: _sleeve, ...entry }) => entry);
  const hyperliquidIncluded = scopedIncluded
    .filter((entry) => entry.sleeve === 'hyperliquid')
    .map(({ sleeve: _sleeve, ...entry }) => entry);

  const excluded = input.excluded.filter((entry) => {
    if (focusTickers.size > 0 && !focusTickers.has(entry.ticker.toUpperCase())) {
      return false;
    }
    if (sleeve === 'both') return true;
    const entrySleeve = entry.sleeve ?? 'either';
    return entrySleeve === 'either' || entrySleeve === sleeve;
  });

  return { defaultIncluded, hyperliquidIncluded, excluded };
}

function parseFocusTickers(raw?: string): Set<string> {
  if (!raw?.trim()) return new Set<string>();
  return new Set(
    raw
      .split(',')
      .map((ticker) => ticker.trim().toUpperCase())
      .filter(Boolean),
  );
}

function viewLastReport(): string {
  if (!existsSync(DEXTER_DIR)) {
    return 'No double-check reports found. Run a double-check first.';
  }

  const files = readdirSync(DEXTER_DIR)
    .filter((f) => f.startsWith('AIHF-DOUBLE-CHECK-') && f.endsWith('.md'))
    .sort()
    .reverse();

  if (files.length === 0) {
    return 'No double-check reports found. Run a double-check first.';
  }

  const latest = files[0];
  const content = readFileSync(dexterPath(latest), 'utf-8');
  return `Latest report: .dexter/${latest}\n\n${content}`;
}

function saveReport(filename: string, content: string): void {
  if (!existsSync(DEXTER_DIR)) {
    mkdirSync(DEXTER_DIR, { recursive: true });
  }
  writeFileSync(dexterPath(filename), content, 'utf-8');
}

function formatResult(result: DoubleCheckResult, filename: string): string {
  const lines: string[] = [];

  const pct = Math.round(result.summary.included_agreement_pct * 100);
  const weightedPct = Math.round(result.summary.weighted_included_agreement_pct * 100);
  lines.push(`## Double-Check Summary`);
  lines.push('');
  lines.push(
    `**${pct}% agreement** on included tickers ` +
      `(${result.summary.included_agreement_count}/${result.summary.included_validated_count} validated). ` +
      `**${weightedPct}% weighted agreement** by included portfolio weight. ` +
      `**${result.summary.conflict_count} hard conflict${result.summary.conflict_count === 1 ? '' : 's'}**. ` +
      `**${result.summary.soft_disagreement_count} soft disagreement${result.summary.soft_disagreement_count === 1 ? '' : 's'}**. ` +
      `**${result.summary.excluded_interesting_count} excluded name${result.summary.excluded_interesting_count === 1 ? '' : 's'}** flagged as interesting.`,
  );

  lines.push('');
  lines.push('### Sleeve Breakdown');
  lines.push(
    `- **default:** ${Math.round(result.summary.by_sleeve.default.included_agreement_pct * 100)}% agreement ` +
      `(${result.summary.by_sleeve.default.included_agreement_count}/${result.summary.by_sleeve.default.included_validated_count}), ` +
      `${Math.round(result.summary.by_sleeve.default.weighted_included_agreement_pct * 100)}% weighted, ` +
      `${result.summary.by_sleeve.default.conflict_count} hard conflict${result.summary.by_sleeve.default.conflict_count === 1 ? '' : 's'}, ` +
      `${result.summary.by_sleeve.default.soft_disagreement_count} soft disagreement${result.summary.by_sleeve.default.soft_disagreement_count === 1 ? '' : 's'}.`,
  );
  lines.push(
    `- **hyperliquid:** ${Math.round(result.summary.by_sleeve.hyperliquid.included_agreement_pct * 100)}% agreement ` +
      `(${result.summary.by_sleeve.hyperliquid.included_agreement_count}/${result.summary.by_sleeve.hyperliquid.included_validated_count}), ` +
      `${Math.round(result.summary.by_sleeve.hyperliquid.weighted_included_agreement_pct * 100)}% weighted, ` +
      `${result.summary.by_sleeve.hyperliquid.conflict_count} hard conflict${result.summary.by_sleeve.hyperliquid.conflict_count === 1 ? '' : 's'}, ` +
      `${result.summary.by_sleeve.hyperliquid.soft_disagreement_count} soft disagreement${result.summary.by_sleeve.hyperliquid.soft_disagreement_count === 1 ? '' : 's'}.`,
  );

  if (result.conflicts.length > 0) {
    lines.push('');
    lines.push('### High-Conviction Conflicts');
    for (const c of result.conflicts) {
      lines.push(
        `- **${c.ticker}** (${c.sleeve}): Dexter ${c.dexter_stance}, AIHF ${c.aihf_stance} (${Math.round(c.aihf_confidence * 100)}%). ${c.note}`,
      );
    }
  }

  if (result.soft_disagreements.length > 0) {
    lines.push('');
    lines.push('### Soft Disagreements');
    for (const d of result.soft_disagreements) {
      lines.push(
        `- **${d.ticker}** (${d.sleeve}): Dexter ${d.dexter_stance}, AIHF ${d.aihf_stance} (${Math.round(d.aihf_confidence * 100)}%), score ${d.score}. ${d.note}`,
      );
    }
  }

  if (result.excluded_interesting.length > 0) {
    lines.push('');
    lines.push('### Excluded But Interesting');
    for (const e of result.excluded_interesting) {
      lines.push(
        `- **${e.ticker}**: Dexter excluded ("${e.dexter_reason}"), but AIHF signals ${e.aihf_signal} (${Math.round(e.aihf_confidence * 100)}%). ${e.suggested_action}`,
      );
    }
  }

  if (result.aihf_raw_meta.partial) {
    lines.push('');
    lines.push(
      `*Note: AIHF validated ${result.aihf_raw_meta.tickers_validated} of ${result.aihf_raw_meta.tickers_requested} tickers.*`,
    );
  }

  lines.push('');
  lines.push(`Full report saved to .dexter/${filename}`);
  lines.push('Action memo auto-appended to report: Keep / Trim / Remove / Exclusion Stance.');

  return lines.join('\n');
}

function renderActionMemo(
  input: {
    defaultIncluded: TickerEntry[];
    hyperliquidIncluded: TickerEntry[];
    excluded: ExcludedEntry[];
  },
  result: DoubleCheckResult,
): string {
  const lines: string[] = [];

  const included = [
    ...input.defaultIncluded.map((t) => ({ ticker: t.ticker.toUpperCase(), sleeve: 'default' as const })),
    ...input.hyperliquidIncluded.map((t) => ({ ticker: t.ticker.toUpperCase(), sleeve: 'hyperliquid' as const })),
  ];
  const conflictByTicker = new Map(result.conflicts.map((c) => [c.ticker.toUpperCase(), c]));
  const excludedInteresting = new Set(result.excluded_interesting.map((e) => e.ticker.toUpperCase()));

  const keepIncluded = included.filter((i) => !conflictByTicker.has(i.ticker));
  const trimOrRemove = included
    .map((i) => ({ i, c: conflictByTicker.get(i.ticker) }))
    .filter((x): x is { i: (typeof included)[number]; c: NonNullable<typeof x.c> } => Boolean(x.c));

  lines.push('## Action Memo (Auto-Generated)');
  lines.push('');
  lines.push('*Advisory only. Use with thesis/risk constraints before execution.*');
  lines.push('');

  lines.push('### Keep');
  if (keepIncluded.length === 0) {
    lines.push('- None.');
  } else {
    for (const k of keepIncluded) {
      lines.push(`- **${k.ticker}** (${k.sleeve}): keep.`);
    }
  }
  lines.push('');

  lines.push('### Trim / Remove');
  if (trimOrRemove.length === 0) {
    lines.push('- None.');
  } else {
    for (const row of trimOrRemove) {
      const decision = row.c.aihf_confidence >= 0.9 || ['SHORT', 'SELL'].includes(row.c.aihf_stance)
        ? 'remove'
        : 'trim';
      lines.push(
        `- **${row.i.ticker}** (${row.i.sleeve}): **${decision.toUpperCase()}** — AIHF ${row.c.aihf_stance} (${Math.round(
          row.c.aihf_confidence * 100,
        )}%). ${row.c.note}`,
      );
    }
  }
  lines.push('');

  lines.push('### Exclusion Stance');
  if (input.excluded.length === 0) {
    lines.push('- None.');
  } else {
    for (const e of input.excluded) {
      const ticker = e.ticker.toUpperCase();
      if (excludedInteresting.has(ticker)) {
        lines.push(`- **${ticker}**: revisit exclusion (AIHF flagged as interesting).`);
      } else {
        lines.push(`- **${ticker}**: exclusion stands (${e.reason}).`);
      }
    }
  }

  return lines.join('\n');
}
