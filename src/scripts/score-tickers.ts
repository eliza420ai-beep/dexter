#!/usr/bin/env bun
/**
 * Quantitative factor scoring for all portfolio tickers using cached Financial Datasets data.
 * Reads from .dexter/cache/ (no API calls). Run `bun run warmup` first.
 *
 * Outputs: .dexter/scorecard.json, .dexter/scorecard.md
 * Usage: bun run score
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { readCache } from '../utils/cache.js';
import { dexterPath } from '../utils/paths.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORTFOLIO_FILES = [
  'portfolio_tastytrade.json',
  'portfolio_hyperliquid.json',
  'portfolio_watchlist.json',
];

const FACTOR_WEIGHTS: Record<string, number> = {
  growth: 0.25,
  valuation: 0.2,
  momentum: 0.15,
  profitability: 0.15,
  earnings_quality: 0.1,
  balance_sheet: 0.1,
  insider_signal: 0.05,
};

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function yearsAgo(n: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return dateStr(d);
}

// ---------------------------------------------------------------------------
// Portfolio loading
// ---------------------------------------------------------------------------

interface PortfolioJson {
  sleeve?: string;
  assets: { symbol: string; target_weight_pct: number }[];
}

function loadTickersWithSleeves(): { ticker: string; sleeve: string }[] {
  const seen = new Set<string>();
  const out: { ticker: string; sleeve: string }[] = [];
  for (const file of PORTFOLIO_FILES) {
    const path = join(process.cwd(), file);
    if (!existsSync(path)) continue;
    const portfolio: PortfolioJson = JSON.parse(readFileSync(path, 'utf-8'));
    const sleeve = portfolio.sleeve ?? file.replace('.json', '');
    for (const asset of portfolio.assets) {
      const s = asset.symbol.toUpperCase();
      if (['GLD', 'SLV', 'BTC', 'ETH', 'SOL', 'HYPE', 'SUI'].includes(s)) continue;
      if (seen.has(s)) continue;
      seen.add(s);
      out.push({ ticker: s, sleeve });
    }
  }
  return out.sort((a, b) => a.ticker.localeCompare(b.ticker));
}

// ---------------------------------------------------------------------------
// Cache reads (params aligned with warmup 3-year run)
// ---------------------------------------------------------------------------

function loadPrices(ticker: string): number[] {
  const startDate = yearsAgo(3);
  const endDate = dateStr(new Date(Date.now() - 86400000));
  const cached = readCache('/prices/', {
    ticker,
    interval: 'day',
    start_date: startDate,
    end_date: endDate,
  });
  if (!cached?.data?.prices) return [];
  const prices = cached.data.prices as Array<{ close?: number; time?: string }>;
  return prices
    .filter((p) => p?.close != null)
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
    .map((p) => Number(p.close));
}

function loadFinancialMetrics(ticker: string): Record<string, unknown>[] {
  const cached = readCache('/financial-metrics/', {
    ticker,
    period: 'quarterly',
    limit: 12,
  });
  if (!cached?.data?.financial_metrics) return [];
  return cached.data.financial_metrics as Record<string, unknown>[];
}

function loadEarnings(ticker: string): Record<string, unknown> | null {
  const cached = readCache('/earnings', { ticker });
  if (!cached?.data?.earnings) return null;
  return cached.data.earnings as Record<string, unknown>;
}

function loadCompanyFacts(ticker: string): Record<string, unknown> | null {
  const cached = readCache('/company/facts', { ticker });
  const raw = cached?.data?.company_facts ?? cached?.data;
  if (!raw || typeof raw !== 'object') return null;
  return raw as Record<string, unknown>;
}

function loadInsiderTrades(ticker: string): Record<string, unknown>[] {
  const cached = readCache('/insider-trades/', {
    ticker,
    limit: 100,
    filing_date_gte: yearsAgo(2),
  });
  if (!cached?.data?.insider_trades) return [];
  return cached.data.insider_trades as Record<string, unknown>[];
}

// ---------------------------------------------------------------------------
// Raw metrics extraction
// ---------------------------------------------------------------------------

function getLatestMetric(rows: Record<string, unknown>[], field: string): number | null {
  for (let i = 0; i < rows.length; i++) {
    const v = rows[i]?.[field];
    if (v !== undefined && v !== null && typeof v === 'number' && !Number.isNaN(v)) return v;
  }
  return null;
}

function getEarningsSurpriseValue(surprise: unknown): number | null {
  if (surprise === 'BEAT') return 100;
  if (surprise === 'MEET') return 50;
  if (surprise === 'MISS') return 0;
  return null;
}

function netInsiderSignal(trades: Record<string, unknown>[]): number | null {
  const now = Date.now();
  const sixMonthsMs = 180 * 86400000;
  let netDollars = 0;
  for (const t of trades) {
    const filingDate = t.filing_date ?? t.transaction_date;
    if (typeof filingDate !== 'string') continue;
    const ts = new Date(filingDate).getTime();
    if (Number.isNaN(ts) || now - ts > sixMonthsMs) continue;
    const value = Number(t.transaction_value ?? 0);
    const shares = Number(t.transaction_shares ?? 0);
    const type = String(t.transaction_type ?? t.acquisition_disposition ?? t.transaction_code ?? '').toUpperCase();
    const isBuy = type === 'P' || type === 'A' || type === 'BUY' || type === 'ACQUISITION' || shares > 0;
    const isSell = type === 'S' || type === 'D' || type === 'SELL' || type === 'DISPOSITION' || shares < 0;
    if (isBuy && !isSell) netDollars += Math.abs(value || shares * Number(t.transaction_price_per_share ?? 0));
    else if (isSell && !isBuy) netDollars -= Math.abs(value || Math.abs(shares) * Number(t.transaction_price_per_share ?? 0));
    else if (value !== 0) netDollars += value;
  }
  return netDollars;
}

interface RawTicker {
  symbol: string;
  sleeve: string;
  sector: string | null;
  industry: string | null;
  prices: number[];
  revenue_growth: number | null;
  earnings_per_share_growth: number | null;
  free_cash_flow_growth: number | null;
  operating_income_growth: number | null;
  pe: number | null;
  ev_ebitda: number | null;
  fcf_yield: number | null;
  peg: number | null;
  gross_margin: number | null;
  operating_margin: number | null;
  net_margin: number | null;
  return_on_equity: number | null;
  current_ratio: number | null;
  debt_to_equity: number | null;
  interest_coverage: number | null;
  free_cash_flow_per_share: number | null;
  revenue_surprise: number | null;
  eps_surprise: number | null;
  revenue_chg: number | null;
  net_income_chg: number | null;
  insider_net: number | null;
  ret_3m: number | null;
  ret_6m: number | null;
  ret_12m: number | null;
  dist_ath: number | null;
}

function extractRaw(ticker: string, sleeve: string): RawTicker {
  const prices = loadPrices(ticker);
  const metrics = loadFinancialMetrics(ticker);
  const earnings = loadEarnings(ticker);
  const facts = loadCompanyFacts(ticker);
  const insiders = loadInsiderTrades(ticker);

  const latest = metrics[0] ?? {};
  const quarterly = (earnings?.quarterly ?? {}) as Record<string, unknown>;
  const annual = (earnings?.annual ?? {}) as Record<string, unknown>;
  const earn = quarterly ?? annual;

  let ret_3m: number | null = null;
  let ret_6m: number | null = null;
  let ret_12m: number | null = null;
  let dist_ath: number | null = null;
  if (prices.length >= 2) {
    const n = prices.length;
    const current = prices[n - 1];
    const high = Math.max(...prices);
    if (n >= 63) ret_3m = (current / prices[n - 63]) - 1;
    if (n >= 126) ret_6m = (current / prices[n - 126]) - 1;
    if (n >= 252) ret_12m = (current / prices[n - 252]) - 1;
    dist_ath = high > 0 ? (current - high) / high : null;
  }

  return {
    symbol: ticker,
    sleeve,
    sector: (facts?.sector as string) ?? null,
    industry: (facts?.industry as string) ?? null,
    prices,
    revenue_growth: getLatestMetric(metrics, 'revenue_growth') ?? (earn.revenue_chg as number) ?? null,
    earnings_per_share_growth: getLatestMetric(metrics, 'earnings_per_share_growth') ?? null,
    free_cash_flow_growth: getLatestMetric(metrics, 'free_cash_flow_growth') ?? (earn.free_cash_flow_chg as number) ?? null,
    operating_income_growth: getLatestMetric(metrics, 'operating_income_growth') ?? (earn.operating_income_chg as number) ?? null,
    pe: getLatestMetric(metrics, 'price_to_earnings_ratio') ?? null,
    ev_ebitda: getLatestMetric(metrics, 'enterprise_value_to_ebitda_ratio') ?? null,
    fcf_yield: getLatestMetric(metrics, 'free_cash_flow_yield') ?? null,
    peg: getLatestMetric(metrics, 'peg_ratio') ?? null,
    gross_margin: getLatestMetric(metrics, 'gross_margin') ?? null,
    operating_margin: getLatestMetric(metrics, 'operating_margin') ?? null,
    net_margin: getLatestMetric(metrics, 'net_margin') ?? null,
    return_on_equity: getLatestMetric(metrics, 'return_on_equity') ?? null,
    current_ratio: getLatestMetric(metrics, 'current_ratio') ?? null,
    debt_to_equity: getLatestMetric(metrics, 'debt_to_equity') ?? null,
    interest_coverage: getLatestMetric(metrics, 'interest_coverage') ?? null,
    free_cash_flow_per_share: getLatestMetric(metrics, 'free_cash_flow_per_share') ?? null,
    revenue_surprise: getEarningsSurpriseValue(earn.revenue_surprise) ?? null,
    eps_surprise: getEarningsSurpriseValue(earn.eps_surprise) ?? null,
    revenue_chg: typeof earn.revenue_chg === 'number' ? earn.revenue_chg : null,
    net_income_chg: typeof earn.net_income_chg === 'number' ? earn.net_income_chg : null,
    insider_net: netInsiderSignal(insiders),
    ret_3m,
    ret_6m,
    ret_12m,
    dist_ath,
  };
}

// ---------------------------------------------------------------------------
// Rank / percentile (higher = better except for inverse metrics)
// ---------------------------------------------------------------------------

function rankPercentile(
  values: (number | null)[],
  inverse: boolean
): (number | null)[] {
  const valid = values.map((v, i) => ({ v, i })).filter((x) => x.v !== null) as { v: number; i: number }[];
  const n = valid.length;
  if (n === 0) return values.map(() => null);
  const sorted = [...valid].sort((a, b) => (inverse ? b.v - a.v : a.v - b.v));
  const rankByIndex = new Map<number, number>();
  sorted.forEach(({ i }, rank) => rankByIndex.set(i, rank));
  return values.map((v, i) => {
    if (v === null) return null;
    const rank = rankByIndex.get(i) ?? 0;
    return n > 1 ? (rank / (n - 1)) * 100 : 100;
  });
}

// ---------------------------------------------------------------------------
// Factor scores and composite
// ---------------------------------------------------------------------------

interface FactorScore {
  score: number;
  metrics: Record<string, number | null>;
}

function computeFactorScores(raw: RawTicker[], n: number): Map<string, { factors: Record<string, FactorScore>; composite: number; flags: string[] }> {
  const symbols = raw.map((r) => r.symbol);

  const revGrowth = rankPercentile(raw.map((r) => r.revenue_growth), false);
  const epsGrowth = rankPercentile(raw.map((r) => r.earnings_per_share_growth), false);
  const fcfGrowth = rankPercentile(raw.map((r) => r.free_cash_flow_growth), false);
  const opIncGrowth = rankPercentile(raw.map((r) => r.operating_income_growth), false);

  const pe = rankPercentile(raw.map((r) => r.pe), true);
  const evEbitda = rankPercentile(raw.map((r) => r.ev_ebitda), true);
  const fcfYield = rankPercentile(raw.map((r) => r.fcf_yield), false);
  const peg = rankPercentile(raw.map((r) => r.peg), true);

  const ret3m = rankPercentile(raw.map((r) => r.ret_3m), false);
  const ret6m = rankPercentile(raw.map((r) => r.ret_6m), false);
  const ret12m = rankPercentile(raw.map((r) => r.ret_12m), false);
  const distAth = rankPercentile(raw.map((r) => r.dist_ath), true);

  const gross = rankPercentile(raw.map((r) => r.gross_margin), false);
  const operating = rankPercentile(raw.map((r) => r.operating_margin), false);
  const net = rankPercentile(raw.map((r) => r.net_margin), false);
  const roe = rankPercentile(raw.map((r) => r.return_on_equity), false);

  const revSurprise = raw.map((r) => r.revenue_surprise);
  const epsSurprise = raw.map((r) => r.eps_surprise);
  const revChg = rankPercentile(raw.map((r) => r.revenue_chg), false);
  const niChg = rankPercentile(raw.map((r) => r.net_income_chg), false);

  const current = rankPercentile(raw.map((r) => r.current_ratio), false);
  const dte = rankPercentile(raw.map((r) => r.debt_to_equity), true);
  const interest = rankPercentile(raw.map((r) => r.interest_coverage), false);
  const fcfPs = rankPercentile(raw.map((r) => r.free_cash_flow_per_share), false);

  const insiderNet = rankPercentile(raw.map((r) => r.insider_net), false);

  const result = new Map<string, { factors: Record<string, FactorScore>; composite: number; flags: string[] }>();

  for (let i = 0; i < n; i++) {
    const r = raw[i];
    const growthScores = [revGrowth[i], epsGrowth[i], fcfGrowth[i], opIncGrowth[i]].filter((x): x is number => x !== null);
    const growth = growthScores.length ? growthScores.reduce((a, b) => a + b, 0) / growthScores.length : 50;

    const valScores = [pe[i], evEbitda[i], fcfYield[i], peg[i]].filter((x): x is number => x !== null);
    const valuation = valScores.length ? valScores.reduce((a, b) => a + b, 0) / valScores.length : 50;

    const momScores = [ret3m[i], ret6m[i], ret12m[i], distAth[i]].filter((x): x is number => x !== null);
    const momentum = momScores.length ? momScores.reduce((a, b) => a + b, 0) / momScores.length : 50;

    const profScores = [gross[i], operating[i], net[i], roe[i]].filter((x): x is number => x !== null);
    const profitability = profScores.length ? profScores.reduce((a, b) => a + b, 0) / profScores.length : 50;

    const eqScores = [
      revSurprise[i] ?? null,
      epsSurprise[i] ?? null,
      revChg[i],
      niChg[i],
    ].filter((x): x is number => x !== null);
    const earnings_quality = eqScores.length ? eqScores.reduce((a, b) => a + b, 0) / eqScores.length : 50;

    const bsScores = [current[i], dte[i], interest[i], fcfPs[i]].filter((x): x is number => x !== null);
    const balance_sheet = bsScores.length ? bsScores.reduce((a, b) => a + b, 0) / bsScores.length : 50;

    const insider = insiderNet[i] ?? 50;

    const composite =
      growth * FACTOR_WEIGHTS.growth +
      valuation * FACTOR_WEIGHTS.valuation +
      momentum * FACTOR_WEIGHTS.momentum +
      profitability * FACTOR_WEIGHTS.profitability +
      earnings_quality * FACTOR_WEIGHTS.earnings_quality +
      balance_sheet * FACTOR_WEIGHTS.balance_sheet +
      insider * FACTOR_WEIGHTS.insider_signal;

    const flags: string[] = [];
    if (r.pe != null && r.pe > 50 && (r.revenue_growth == null || r.revenue_growth < 0.15)) flags.push('pe_above_50_low_growth');
    if (r.ret_12m != null && r.ret_12m > 0.5) flags.push('high_momentum');
    if (r.dist_ath != null && r.dist_ath < -0.4) flags.push('drawdown_40pct');
    if (r.insider_net != null && r.insider_net < -100000) flags.push('insider_selling');

    result.set(r.symbol, {
      factors: {
        growth: { score: Math.round(growth * 10) / 10, metrics: { revenue_growth: r.revenue_growth ?? null, earnings_per_share_growth: r.earnings_per_share_growth ?? null, free_cash_flow_growth: r.free_cash_flow_growth ?? null, operating_income_growth: r.operating_income_growth ?? null } },
        valuation: { score: Math.round(valuation * 10) / 10, metrics: { pe: r.pe, ev_ebitda: r.ev_ebitda, fcf_yield: r.fcf_yield, peg: r.peg } },
        momentum: { score: Math.round(momentum * 10) / 10, metrics: { ret_3m: r.ret_3m, ret_6m: r.ret_6m, ret_12m: r.ret_12m, dist_ath: r.dist_ath } },
        profitability: { score: Math.round(profitability * 10) / 10, metrics: { gross_margin: r.gross_margin, operating_margin: r.operating_margin, net_margin: r.net_margin, return_on_equity: r.return_on_equity } },
        earnings_quality: { score: Math.round(earnings_quality * 10) / 10, metrics: { revenue_surprise: r.revenue_surprise, eps_surprise: r.eps_surprise, revenue_chg: r.revenue_chg, net_income_chg: r.net_income_chg } },
        balance_sheet: { score: Math.round(balance_sheet * 10) / 10, metrics: { current_ratio: r.current_ratio, debt_to_equity: r.debt_to_equity, interest_coverage: r.interest_coverage, free_cash_flow_per_share: r.free_cash_flow_per_share } },
        insider_signal: { score: Math.round(insider * 10) / 10, metrics: { insider_net: r.insider_net } },
      },
      composite: Math.round(composite * 10) / 10,
      flags,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function writeScorecard(
  tickersWithSleeves: { ticker: string; sleeve: string }[],
  raw: RawTicker[],
  scores: Map<string, { factors: Record<string, FactorScore>; composite: number; flags: string[] }>
): void {
  const outDir = join(process.cwd(), dexterPath());
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const tickerEntries = tickersWithSleeves.map(({ ticker, sleeve }) => {
    const r = raw.find((x) => x.symbol === ticker)!;
    const s = scores.get(ticker)!;
    return {
      symbol: ticker,
      sleeve,
      sector: r.sector,
      industry: r.industry,
      composite: s.composite,
      factors: s.factors,
      flags: s.flags,
    };
  });

  const sorted = [...tickerEntries].sort((a, b) => b.composite - a.composite);

  const json = {
    generatedAt: new Date().toISOString(),
    tickerCount: tickerEntries.length,
    weights: FACTOR_WEIGHTS,
    tickers: tickerEntries,
  };

  const jsonPath = join(process.cwd(), dexterPath('scorecard.json'));
  writeFileSync(jsonPath, JSON.stringify(json, null, 2));

  const sleeveAvg: Record<string, { sum: number; count: number }> = {};
  for (const t of tickerEntries) {
    if (!sleeveAvg[t.sleeve]) sleeveAvg[t.sleeve] = { sum: 0, count: 0 };
    sleeveAvg[t.sleeve].sum += t.composite;
    sleeveAvg[t.sleeve].count += 1;
  }

  let md = `# Ticker Scorecard\n\nGenerated: ${json.generatedAt}\n\n`;
  md += `| Rank | Ticker | Sleeve | Composite | Growth | Val | Mom | Profit | Earn | BS | Insider | Flags |\n`;
  md += `|------|--------|--------|-----------|--------|-----|-----|--------|------|-----|---------|-------|\n`;

  sorted.forEach((t, idx) => {
    const rank = idx + 1;
    const f = t.factors;
    const row = [
      rank,
      t.symbol,
      t.sleeve,
      t.composite.toFixed(1),
      (f.growth?.score ?? '-').toString(),
      (f.valuation?.score ?? '-').toString(),
      (f.momentum?.score ?? '-').toString(),
      (f.profitability?.score ?? '-').toString(),
      (f.earnings_quality?.score ?? '-').toString(),
      (f.balance_sheet?.score ?? '-').toString(),
      (f.insider_signal?.score ?? '-').toString(),
      t.flags.length ? t.flags.join(', ') : '-',
    ];
    md += `| ${row.join(' | ')} |\n`;
  });

  md += `\n## Sleeve averages\n\n`;
  for (const [sleeve, v] of Object.entries(sleeveAvg)) {
    const avg = (v.sum / v.count).toFixed(1);
    md += `- **${sleeve}**: ${avg} (n=${v.count})\n`;
  }

  md += `\n## Top 10\n\n`;
  sorted.slice(0, 10).forEach((t, i) => {
    md += `${i + 1}. **${t.symbol}** (${t.sleeve}) — ${t.composite} ${t.flags.length ? ` — ${t.flags.join(', ')}` : ''}\n`;
  });

  md += `\n## Bottom 10\n\n`;
  sorted.slice(-10).reverse().forEach((t, i) => {
    md += `${i + 1}. **${t.symbol}** (${t.sleeve}) — ${t.composite} ${t.flags.length ? ` — ${t.flags.join(', ')}` : ''}\n`;
  });

  const riskTickers = tickerEntries.filter((t) => t.flags.length > 0);
  if (riskTickers.length > 0) {
    md += `\n## Risk flags\n\n`;
    for (const t of riskTickers) {
      md += `- **${t.symbol}** (${t.sleeve}): ${t.flags.join(', ')}\n`;
    }
  }

  const mdPath = join(process.cwd(), dexterPath('scorecard.md'));
  writeFileSync(mdPath, md);

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(`Scored ${tickerEntries.length} tickers. Top: ${sorted[0]?.symbol} (${sorted[0]?.composite}), Bottom: ${sorted[sorted.length - 1]?.symbol} (${sorted[sorted.length - 1]?.composite})`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const tickersWithSleeves = loadTickersWithSleeves();
  if (tickersWithSleeves.length === 0) {
    console.error('No tickers found in portfolio files.');
    process.exit(1);
  }

  console.log(`Loading cache for ${tickersWithSleeves.length} tickers...`);
  const raw = tickersWithSleeves.map(({ ticker, sleeve }) => extractRaw(ticker, sleeve));
  const n = raw.length;
  const scores = computeFactorScores(raw, n);
  writeScorecard(tickersWithSleeves, raw, scores);
}

main();
