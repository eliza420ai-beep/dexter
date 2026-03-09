import { z } from 'zod';
import { callLlm, type LlmResult } from '../model/llm.js';
import { loadSoulDocument, loadSoulHLDocument, getCurrentDate } from './prompts.js';
import { isTickerTradableOnHyperliquid } from '../tools/tastytrade/utils.js';
import {
  writePortfolioContent,
  getPortfolioPath,
} from '../tools/portfolio/portfolio-tool.js';

export type SuggestMode = 'both' | 'default' | 'hyperliquid';

const tastytradePositionSchema = z.object({
  ticker: z.string(),
  weight: z.number(),
  layer: z.string(),
  tier: z.string(),
});

const hyperliquidPositionSchema = z.object({
  ticker: z.string(),
  weight: z.number(),
  category: z.string(),
  notes: z.string(),
});

const exclusionSchema = z.object({
  ticker: z.string(),
  reason: z.string(),
});

const tastytradeSleeveSchema = z.object({
  coreView: z.string(),
  positions: z.array(tastytradePositionSchema).min(5).max(20),
  whyItWorks: z.array(z.string()).min(2).max(6),
  excluded: z.array(exclusionSchema).min(3).max(20),
});

const hyperliquidSleeveSchema = z.object({
  coreView: z.string(),
  positions: z.array(hyperliquidPositionSchema).min(5).max(20),
  whyItWorks: z.array(z.string()).min(2).max(6),
  excluded: z.array(exclusionSchema).min(3).max(20),
});

const suggestOutputSchema = z.object({
  tastytrade: tastytradeSleeveSchema.nullable(),
  hyperliquid: hyperliquidSleeveSchema.nullable(),
});

type SuggestOutput = z.infer<typeof suggestOutputSchema>;

const TASTYTRADE_UNIVERSE = [
  'AMAT',
  'ASML',
  'LRCX',
  'KLAC',
  'TEL',
  'SNPS',
  'CDNS',
  'CEG',
  'EQT',
  'VRT',
  'BE',
  'SEI',
  'PSIX',
  'CRWV',
  'CORZ',
  'SNDK',
  'WDC',
  'STX',
  'ANET',
  'LITE',
  'COHR',
  'CIEN',
  'AVGO',
  'MRVL',
  'ARM',
  'OKLO',
  'IONQ',
  'QBTS',
  'KTOS',
  'ONDS',
  'ASTS',
  'QS',
  'EOSE',
  'DELL',
  'VRTX',
  'LLY',
].filter((ticker) => !isTickerTradableOnHyperliquid(ticker));

const HYPERLIQUID_UNIVERSE = [
  'TSM',
  'NVDA',
  'PLTR',
  'ORCL',
  'COIN',
  'HOOD',
  'CRCL',
  'TSLA',
  'META',
  'MU',
  'MSFT',
  'AMZN',
  'GOOGL',
  'AAPL',
  'INTC',
  'GLD',
  'SLV',
  'SPY',
  'SMH',
];

const TASTYTRADE_ALLOWED = new Set(TASTYTRADE_UNIVERSE);
const HYPERLIQUID_ALLOWED = new Set(HYPERLIQUID_UNIVERSE);
const SOUL_SECTION_PREFIXES = [
  '## Core Motivation',
  '## The Unified Thesis',
  '## Conviction Tiering',
  '## Near-Perfect Portfolio',
  '## What I Value',
];
const SOUL_HL_SECTION_PREFIXES = ['## Target Allocation', '## Sizing Rules'];

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function normalizeWeights<T extends { weight: number }>(positions: T[]): T[] {
  const sum = positions.reduce((acc, p) => acc + Math.max(0, p.weight), 0);
  if (sum <= 0) return positions;
  return positions.map((p) => ({
    ...p,
    weight: Math.round(((Math.max(0, p.weight) / sum) * 100) * 10) / 10,
  }));
}

function mergeExclusions(
  existing: { ticker: string; reason: string }[],
  extra: { ticker: string; reason: string }[],
): { ticker: string; reason: string }[] {
  const merged = new Map<string, { ticker: string; reason: string }>();
  for (const item of [...existing, ...extra]) {
    const ticker = normalizeTicker(item.ticker);
    if (!merged.has(ticker)) {
      merged.set(ticker, { ticker, reason: item.reason });
    }
  }
  return [...merged.values()].slice(0, 20);
}

function sanitizeTastytradeSleeve(
  sleeve: NonNullable<SuggestOutput['tastytrade']>,
): NonNullable<SuggestOutput['tastytrade']> {
  const seen = new Set<string>();
  const forcedExclusions: { ticker: string; reason: string }[] = [];
  const positions = sleeve.positions
    .map((p) => ({ ...p, ticker: normalizeTicker(p.ticker) }))
    .filter((p) => {
      if (seen.has(p.ticker)) return false;
      seen.add(p.ticker);
      if (isTickerTradableOnHyperliquid(p.ticker)) {
        forcedExclusions.push({
          ticker: p.ticker,
          reason: 'Excluded from tastytrade sleeve because it trades on Hyperliquid.',
        });
        return false;
      }
      if (!TASTYTRADE_ALLOWED.has(p.ticker)) {
        forcedExclusions.push({
          ticker: p.ticker,
          reason: 'Outside the off-chain AI infrastructure thesis universe.',
        });
        return false;
      }
      return true;
    })
    .slice(0, 20);

  return {
    ...sleeve,
    positions: normalizeWeights(positions),
    excluded: mergeExclusions(sleeve.excluded, forcedExclusions),
  };
}

function sanitizeHyperliquidSleeve(
  sleeve: NonNullable<SuggestOutput['hyperliquid']>,
): NonNullable<SuggestOutput['hyperliquid']> {
  const seen = new Set<string>();
  const forcedExclusions: { ticker: string; reason: string }[] = [];
  const positions = sleeve.positions
    .map((p) => ({ ...p, ticker: normalizeTicker(p.ticker) }))
    .filter((p) => {
      if (seen.has(p.ticker)) return false;
      seen.add(p.ticker);
      if (!HYPERLIQUID_ALLOWED.has(p.ticker)) {
        forcedExclusions.push({
          ticker: p.ticker,
          reason: 'Outside the Hyperliquid HIP-3 thesis universe.',
        });
        return false;
      }
      return true;
    })
    .slice(0, 20);

  return {
    ...sleeve,
    positions: normalizeWeights(positions),
    excluded: mergeExclusions(sleeve.excluded, forcedExclusions),
  };
}

function compactMarkdown(content?: string | null, maxChars = 1400): string {
  if (!content) return '';
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && (line.startsWith('#') || line.startsWith('-') || line.startsWith('*')));
  const summary = (lines.join('\n') || content.replace(/\s+/g, ' ').trim()).slice(0, maxChars);
  return summary.length < (content?.length ?? 0) ? `${summary}...` : summary;
}

function extractMarkdownSections(content: string, headingPrefixes: string[]): string {
  const lines = content.split('\n');
  const sections: string[] = [];
  let currentHeading = '';
  let currentLines: string[] = [];

  const flush = () => {
    if (!currentHeading) return;
    if (headingPrefixes.some((prefix) => currentHeading.startsWith(prefix))) {
      sections.push([currentHeading, ...currentLines].join('\n').trim());
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.startsWith('## ')) {
      flush();
      currentHeading = line;
      currentLines = [];
      continue;
    }

    if (currentHeading) {
      currentLines.push(line);
    }
  }

  flush();
  return sections.join('\n\n');
}

function summarizeSoulForSuggest(content?: string | null, maxChars = 2200): string {
  if (!content) return '';
  const extracted = extractMarkdownSections(content, SOUL_SECTION_PREFIXES);
  return compactMarkdown(extracted || content, maxChars);
}

function summarizeSoulHlForSuggest(content?: string | null, maxChars = 1200): string {
  if (!content) return '';
  const extracted = extractMarkdownSections(content, SOUL_HL_SECTION_PREFIXES);
  return compactMarkdown(extracted || content, maxChars);
}

function normalizeWeight(weight: number): string {
  const rounded = Math.round(weight * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

function renderTastytradeMarkdown(sleeve: NonNullable<SuggestOutput['tastytrade']>): string {
  const table = [
    '| Ticker | Weight | Layer | Tier |',
    '|---|---:|---|---|',
    ...sleeve.positions.map(
      (p) => `| ${p.ticker.toUpperCase()} | ${normalizeWeight(p.weight)} | ${p.layer} | ${p.tier} |`,
    ),
  ].join('\n');

  return [
    '# Tastytrade sleeve',
    '',
    `Core view: ${sleeve.coreView}`,
    '',
    table,
    '',
    'Why this works:',
    ...sleeve.whyItWorks.map((line) => `- ${line}`),
    '',
    'Not in the portfolio — and why',
    ...sleeve.excluded.map((item) => `- ${item.ticker.toUpperCase()} — ${item.reason}`),
  ].join('\n');
}

function renderHyperliquidMarkdown(sleeve: NonNullable<SuggestOutput['hyperliquid']>): string {
  const table = [
    '| Ticker | Weight | Category | Notes |',
    '|---|---:|---|---|',
    ...sleeve.positions.map(
      (p) =>
        `| ${p.ticker.toUpperCase()} | ${normalizeWeight(p.weight)} | ${p.category} | ${p.notes} |`,
    ),
  ].join('\n');

  return [
    '# Hyperliquid sleeve',
    '',
    `Core view: ${sleeve.coreView}`,
    '',
    table,
    '',
    'Why this works:',
    ...sleeve.whyItWorks.map((line) => `- ${line}`),
    '',
    'Not in the portfolio — and why',
    ...sleeve.excluded.map((item) => `- ${item.ticker.toUpperCase()} — ${item.reason}`),
  ].join('\n');
}

function buildSystemPrompt(mode: SuggestMode, soul: string, soulHl: string): string {
  const scope =
    mode === 'both'
      ? 'Generate both a tastytrade sleeve and a Hyperliquid sleeve.'
      : mode === 'default'
        ? 'Generate only the tastytrade sleeve.'
        : 'Generate only the Hyperliquid sleeve.';

  return `You are Dexter in dedicated suggest mode.

Current date: ${getCurrentDate()}

Your only job is to generate portfolio sleeve recommendations as structured data.
${scope}

Hard rules:
- Do not do AIHF, essays, reports, or extra workflows
- Tastytrade sleeve uses only non-Hyperliquid tickers
- Hyperliquid sleeve uses only HIP-3/on-chain equities, indices, commodities
- Exclude BTC, SOL, HYPE, ETH, SUI, NEAR from the Hyperliquid sleeve because they belong to the core crypto portfolio
- Keep zero overlap between tastytrade and Hyperliquid sleeves
- Return target weights, concise rationale, and excluded names with reasons
- Keep positions between 10 and 20 for each requested sleeve
- Prefer durable, high-conviction names over unnecessary breadth
- Tastytrade sleeve must stay anchored to the AI infrastructure diversification universe: ${TASTYTRADE_UNIVERSE.join(', ')}
- Do not output generic Buffett-style quality baskets like BRK.B, V, MA, COST, NVO, or broad non-thesis names
- Hyperliquid sleeve must stay anchored to this narrower universe: ${HYPERLIQUID_UNIVERSE.join(', ')}
- Do not output macro/fx symbols outside that list (for example SPX, NDX, DJI, XAU, XAG, CL, NG, EURUSD, USDJPY are not allowed here)

Identity summary:
${soul || 'No SOUL summary available.'}

Hyperliquid thesis summary:
${soulHl || 'No SOUL-HL summary available.'}`;
}

function buildUserPrompt(mode: SuggestMode): string {
  if (mode === 'default') {
    return 'Return only the tastytrade sleeve. Set hyperliquid to null.';
  }
  if (mode === 'hyperliquid') {
    return 'Return only the Hyperliquid sleeve. Set tastytrade to null.';
  }
  return 'Return both sleeves with zero overlap. Do not use null for either sleeve.';
}

function saveRequestedSleeves(mode: SuggestMode, output: SuggestOutput): string[] {
  const saved: string[] = [];

  if ((mode === 'both' || mode === 'default') && output.tastytrade) {
    writePortfolioContent('default', renderTastytradeMarkdown(output.tastytrade));
    saved.push(getPortfolioPath('default'));
  }

  if ((mode === 'both' || mode === 'hyperliquid') && output.hyperliquid) {
    writePortfolioContent('hyperliquid', renderHyperliquidMarkdown(output.hyperliquid));
    saved.push(getPortfolioPath('hyperliquid'));
  }

  return saved;
}

export async function runSuggestFastPath(args: {
  mode: SuggestMode;
  model: string;
  signal?: AbortSignal;
}): Promise<{ answer: string; usage?: LlmResult['usage'] }> {
  const [soul, soulHl] = await Promise.all([loadSoulDocument(), loadSoulHLDocument()]);
  const systemPrompt = buildSystemPrompt(
    args.mode,
    summarizeSoulForSuggest(soul, 2200),
    summarizeSoulHlForSuggest(soulHl, 1200),
  );

  const result = await callLlm(buildUserPrompt(args.mode), {
    model: args.model,
    systemPrompt,
    outputSchema: suggestOutputSchema,
    signal: args.signal,
  });

  const output = result.response as unknown as SuggestOutput;
  const renderedSections: string[] = [];
  const sanitized: SuggestOutput = {
    tastytrade: output.tastytrade ? sanitizeTastytradeSleeve(output.tastytrade) : null,
    hyperliquid: output.hyperliquid ? sanitizeHyperliquidSleeve(output.hyperliquid) : null,
  };

  if ((args.mode === 'both' || args.mode === 'default') && (!sanitized.tastytrade || sanitized.tastytrade.positions.length < 5)) {
    throw new Error('Suggest fast path produced an invalid tastytrade sleeve; please retry.');
  }
  if ((args.mode === 'both' || args.mode === 'hyperliquid') && (!sanitized.hyperliquid || sanitized.hyperliquid.positions.length < 5)) {
    throw new Error('Suggest fast path produced an invalid Hyperliquid sleeve; please retry.');
  }

  if (sanitized.tastytrade) {
    renderedSections.push(renderTastytradeMarkdown(sanitized.tastytrade));
  }
  if (sanitized.hyperliquid) {
    renderedSections.push(renderHyperliquidMarkdown(sanitized.hyperliquid));
  }

  const savedPaths = saveRequestedSleeves(args.mode, sanitized);

  const parts = ['Saved portfolio suggestion(s):', ...savedPaths.map((p) => `- ${p}`)];
  if (sanitized.tastytrade?.positions?.length) {
    parts.push(`- tastytrade positions: ${sanitized.tastytrade.positions.length}`);
  }
  if (sanitized.hyperliquid?.positions?.length) {
    parts.push(`- hyperliquid positions: ${sanitized.hyperliquid.positions.length}`);
  }
  parts.push('Use `/double-check` for AIHF or `/write-essay` for drafting.');
  if (renderedSections.length > 0) {
    parts.push('', ...renderedSections);
  }

  return { answer: parts.join('\n'), usage: result.usage };
}
