import { z } from 'zod';
import { callLlm, type LlmResult } from '../model/llm.js';
import { loadSoulDocument, loadSoulHLDocument, getCurrentDate } from './prompts.js';
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

function compactMarkdown(content?: string | null, maxChars = 1400): string {
  if (!content) return '';
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && (line.startsWith('#') || line.startsWith('-') || line.startsWith('*')));
  const summary = (lines.join('\n') || content.replace(/\s+/g, ' ').trim()).slice(0, maxChars);
  return summary.length < (content?.length ?? 0) ? `${summary}...` : summary;
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
    compactMarkdown(soul, 1800),
    compactMarkdown(soulHl, 1200),
  );

  const result = await callLlm(buildUserPrompt(args.mode), {
    model: args.model,
    systemPrompt,
    outputSchema: suggestOutputSchema,
    signal: args.signal,
  });

  const output = result.response as unknown as SuggestOutput;
  const savedPaths = saveRequestedSleeves(args.mode, output);

  const parts = ['Saved portfolio suggestion(s):', ...savedPaths.map((p) => `- ${p}`)];
  if (output.tastytrade?.positions?.length) {
    parts.push(`- tastytrade positions: ${output.tastytrade.positions.length}`);
  }
  if (output.hyperliquid?.positions?.length) {
    parts.push(`- hyperliquid positions: ${output.hyperliquid.positions.length}`);
  }
  parts.push('Use `/double-check` for AIHF or `/write-essay` for drafting.');

  return { answer: parts.join('\n'), usage: result.usage };
}
