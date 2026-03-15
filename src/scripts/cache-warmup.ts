#!/usr/bin/env bun
/**
 * Pre-fetches and caches historical data from Financial Datasets API
 * for every ticker across all three portfolio JSON files.
 *
 * Cached data lands in .dexter/cache/ (same store the agent reads at runtime),
 * so subsequent tool calls and backtesting skills resolve from disk — zero API calls.
 *
 * Usage: bun run warmup
 *        bun run warmup -- --years 5 --prices-only
 */

import { config } from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { callApi, callApiPost } from '../tools/finance/api.js';
import { readCache } from '../utils/cache.js';

config({ path: '.env', quiet: true });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORTFOLIO_FILES = [
  'portfolio_tastytrade.json',
  'portfolio_hyperliquid.json',
  'portfolio_watchlist.json',
];

// Throttle between successful API calls to stay under the per-minute rate limit.
// Financial Datasets API enforces ~60 req/min on most endpoints.
const INTER_REQUEST_DELAY_MS = 1200;

// After hitting a 429, back off for this long before continuing.
const RATE_LIMIT_COOLDOWN_MS = 15_000;

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface PortfolioJson {
  assets: { symbol: string; target_weight_pct: number }[];
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  let years = 3;
  let pricesOnly = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--years' && args[i + 1]) {
      years = parseInt(args[i + 1], 10);
      i++;
    }
    if (args[i] === '--prices-only') pricesOnly = true;
  }
  return { years, pricesOnly };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function yearsAgo(n: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return dateStr(d);
}

function getUniqueTickers(): string[] {
  const tickers = new Set<string>();
  for (const file of PORTFOLIO_FILES) {
    const path = join(process.cwd(), file);
    if (!existsSync(path)) {
      console.log(`  skip: ${file} (not found)`);
      continue;
    }
    const portfolio: PortfolioJson = JSON.parse(readFileSync(path, 'utf-8'));
    for (const asset of portfolio.assets) {
      // Filter out non-equity symbols (crypto, metals, etc.)
      const s = asset.symbol.toUpperCase();
      if (!['GLD', 'SLV', 'BTC', 'ETH', 'SOL', 'HYPE', 'SUI'].includes(s)) {
        tickers.add(s);
      }
    }
  }
  return [...tickers].sort();
}

function isCached(endpoint: string, params: Record<string, string | number | undefined>): boolean {
  return readCache(endpoint, params as Record<string, string | number | string[] | undefined>) !== null;
}

// ---------------------------------------------------------------------------
// Warmup tasks per ticker
// ---------------------------------------------------------------------------

async function warmupPrices(ticker: string, startDate: string, endDate: string): Promise<boolean> {
  const params = { ticker, interval: 'day', start_date: startDate, end_date: endDate };
  if (isCached('/prices/', params)) return false;
  await callApi('/prices/', params, { cacheable: true });
  return true;
}

async function warmupWeeklyPrices(ticker: string, startDate: string, endDate: string): Promise<boolean> {
  const params = { ticker, interval: 'week', start_date: startDate, end_date: endDate };
  if (isCached('/prices/', params)) return false;
  await callApi('/prices/', params, { cacheable: true });
  return true;
}

async function warmupFinancialMetrics(ticker: string, limit: number): Promise<boolean> {
  const params = { ticker, period: 'quarterly', limit };
  if (isCached('/financial-metrics/', params)) return false;
  await callApi('/financial-metrics/', params, { cacheable: true });
  return true;
}

async function warmupIncomeStatements(ticker: string, limit: number): Promise<boolean> {
  const params = { ticker, period: 'quarterly', limit };
  if (isCached('/financials/income-statements/', params)) return false;
  await callApi('/financials/income-statements/', params, { cacheable: true });
  return true;
}

async function warmupInsiderTrades(ticker: string, startDate: string): Promise<boolean> {
  const params = { ticker, limit: 100, filing_date_gte: startDate };
  if (isCached('/insider-trades/', params)) return false;
  await callApi('/insider-trades/', params, { cacheable: true });
  return true;
}

async function warmupInstitutionalOwnership(ticker: string): Promise<boolean> {
  const params = { ticker, limit: 50 };
  if (isCached('/institutional-ownership/', params)) return false;
  await callApi('/institutional-ownership/', params, { cacheable: true });
  return true;
}

async function warmupCompanyFacts(ticker: string): Promise<boolean> {
  const params = { ticker };
  if (isCached('/company/facts', params)) return false;
  await callApi('/company/facts', params, { cacheable: true });
  return true;
}

async function warmupEarnings(ticker: string): Promise<boolean> {
  const params = { ticker };
  if (isCached('/earnings', params)) return false;
  await callApi('/earnings', params, { cacheable: true });
  return true;
}

// ---------------------------------------------------------------------------
// Batch line items (POST endpoint — cross-portfolio comparative data)
// ---------------------------------------------------------------------------

async function warmupBatchLineItems(tickers: string[]): Promise<void> {
  const lineItems = [
    'revenue', 'net_income', 'operating_income', 'free_cash_flow',
    'total_debt', 'cash_and_equivalents', 'earnings_per_share',
    'capital_expenditure', 'research_and_development',
  ];

  console.log(`\n  Batch line items (${tickers.length} tickers × ${lineItems.length} items)...`);

  for (const period of ['ttm', 'annual'] as const) {
    const limit = period === 'ttm' ? 1 : 5;
    try {
      await callApiPost('/financials/search/line-items', {
        tickers,
        line_items: lineItems,
        period,
        limit,
      }, { cacheable: true });
      console.log(`    ${period} (limit ${limit}): cached`);
    } catch (e) {
      console.log(`    ${period}: failed — ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Interest rates (macro overlay)
// ---------------------------------------------------------------------------

const MAJOR_BANKS = ['FED', 'ECB', 'BOJ', 'BOE', 'BOC', 'RBA', 'PBOC'];

async function warmupInterestRates(): Promise<void> {
  console.log('\n  Macro: interest rates...');
  for (const bank of MAJOR_BANKS) {
    try {
      const params = { bank };
      if (!isCached('/macro/interest-rates/', params)) {
        await callApi('/macro/interest-rates/', params, { cacheable: true });
        console.log(`    ${bank}: cached`);
        await pause(INTER_REQUEST_DELAY_MS);
      } else {
        console.log(`    ${bank}: already cached`);
      }
    } catch (e) {
      console.log(`    ${bank}: failed — ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { years, pricesOnly } = parseArgs();

  if (!process.env.FINANCIAL_DATASETS_API_KEY) {
    console.error('FINANCIAL_DATASETS_API_KEY is not set. Add it to .env.');
    process.exit(1);
  }

  console.log('Cache warmup — Financial Datasets API');
  console.log(`  History window: ${years} years`);
  console.log(`  Mode: ${pricesOnly ? 'prices only' : 'full (prices + fundamentals + ownership)'}`);
  console.log('');

  const tickers = getUniqueTickers();
  console.log(`Found ${tickers.length} unique equity tickers across ${PORTFOLIO_FILES.length} portfolios:`);
  console.log(`  ${tickers.join(', ')}`);

  const startDate = yearsAgo(years);
  const yesterday = dateStr(new Date(Date.now() - 86400000));
  const twoYearsAgo = yearsAgo(2);
  const quartersToFetch = years * 4;

  let fetched = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    const progress = `[${i + 1}/${tickers.length}]`;
    const tasks: { name: string; fn: () => Promise<boolean> }[] = [
      { name: 'daily prices', fn: () => warmupPrices(ticker, startDate, yesterday) },
      { name: 'weekly prices', fn: () => warmupWeeklyPrices(ticker, startDate, yesterday) },
    ];

    if (!pricesOnly) {
      tasks.push(
        { name: 'financial metrics', fn: () => warmupFinancialMetrics(ticker, quartersToFetch) },
        { name: 'income statements', fn: () => warmupIncomeStatements(ticker, quartersToFetch) },
        { name: 'insider trades', fn: () => warmupInsiderTrades(ticker, twoYearsAgo) },
        { name: 'institutional ownership', fn: () => warmupInstitutionalOwnership(ticker) },
        { name: 'company facts', fn: () => warmupCompanyFacts(ticker) },
        { name: 'earnings', fn: () => warmupEarnings(ticker) },
      );
    }

    const results: string[] = [];
    for (const task of tasks) {
      try {
        const wasFetched = await task.fn();
        if (wasFetched) {
          results.push(`${task.name} ✓`);
          fetched++;
          await pause(INTER_REQUEST_DELAY_MS);
        } else {
          skipped++;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const short = msg.includes('429') ? '429' : msg.includes('402') ? '402' : '✗';
        results.push(`${task.name} ${short}`);
        errors++;
        if (msg.includes('429')) {
          await pause(RATE_LIMIT_COOLDOWN_MS);
        }
      }
    }

    if (results.length > 0) {
      console.log(`${progress} ${ticker}: ${results.join(', ')}`);
    } else {
      console.log(`${progress} ${ticker}: all cached`);
    }
  }

  // Batch endpoints (cross-portfolio)
  if (!pricesOnly) {
    await warmupBatchLineItems(tickers);
    await warmupInterestRates();
  }

  console.log('');
  console.log(`Done. Fetched: ${fetched}, Already cached: ${skipped}, Errors: ${errors}`);
  console.log('Cache directory: .dexter/cache/');
}

main().catch((e) => {
  console.error('Fatal:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
