import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';

/** Compute simple moving average from an array of closes. */
function sma(closes: number[]): number {
  if (closes.length === 0) return 0;
  return closes.reduce((a, b) => a + b, 0) / closes.length;
}

/** Percentage distance: positive = above MA, negative = below MA */
function pctFromMA(price: number, ma: number): number {
  if (ma === 0) return 0;
  return ((price - ma) / ma) * 100;
}

function label(pct: number): string {
  if (Math.abs(pct) < 1) return 'at';
  return pct > 0 ? 'above' : 'below';
}

interface PricePoint {
  date: string;
  close: number;
}


const TechnicalIndicatorsInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
});

export const getTechnicalIndicators = new DynamicStructuredTool({
  name: 'get_technical_indicators',
  description:
    'Computes key technical indicators for a stock: 200-day SMA, 50-day SMA, 200-week SMA (the "weekly 200"), and current price distance from each. Returns how far above or below each moving average the stock is trading, plus a support/resistance signal. Use this when asked about moving averages, the 200-day MA, 200-week MA, technical support levels, or whether a stock is near a key moving average.',
  schema: TechnicalIndicatorsInputSchema,
  func: async (input) => {
    const ticker = input.ticker.trim().toUpperCase();
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // Daily: need ~260 trading days (~1 year + buffer) for SMA-200
    // Fetch 14 months to be safe with weekends/holidays
    const dailyStart = new Date(today);
    dailyStart.setMonth(dailyStart.getMonth() - 14);
    const dailyStartStr = dailyStart.toISOString().slice(0, 10);

    // Weekly: need 200 weeks (~3.9 years), fetch 4.5 years to be safe
    const weeklyStart = new Date(today);
    weeklyStart.setMonth(weeklyStart.getMonth() - 54);
    const weeklyStartStr = weeklyStart.toISOString().slice(0, 10);

    const sourceUrls: string[] = [];

    // Fetch daily and weekly in parallel
    const [dailyResp, weeklyResp] = await Promise.all([
      callApi('/prices/', {
        ticker,
        interval: 'day',
        start_date: dailyStartStr,
        end_date: todayStr,
      }, { cacheable: false }),
      callApi('/prices/', {
        ticker,
        interval: 'week',
        start_date: weeklyStartStr,
        end_date: todayStr,
      }, { cacheable: false }),
    ]);

    sourceUrls.push(dailyResp.url, weeklyResp.url);

    const dailyPrices: PricePoint[] = ((dailyResp.data.prices as Array<Record<string, unknown>>) || [])
      .map((p) => ({ date: String(p.date ?? ''), close: Number(p.close ?? 0) }))
      .filter((p) => p.close > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    const weeklyPrices: PricePoint[] = ((weeklyResp.data.prices as Array<Record<string, unknown>>) || [])
      .map((p) => ({ date: String(p.date ?? ''), close: Number(p.close ?? 0) }))
      .filter((p) => p.close > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (dailyPrices.length === 0) {
      return formatToolResult({ error: `No price data found for ${ticker}` }, sourceUrls);
    }

    const currentPrice = dailyPrices[dailyPrices.length - 1].close;
    const latestDate = dailyPrices[dailyPrices.length - 1].date;

    // SMA-200 daily: last 200 daily closes
    const last200Daily = dailyPrices.slice(-200).map((p) => p.close);
    const sma200d = last200Daily.length >= 100 ? sma(last200Daily) : null;

    // SMA-50 daily: last 50 daily closes
    const last50Daily = dailyPrices.slice(-50).map((p) => p.close);
    const sma50d = last50Daily.length >= 30 ? sma(last50Daily) : null;

    // SMA-200 weekly: last 200 weekly closes
    const last200Weekly = weeklyPrices.slice(-200).map((p) => p.close);
    const sma200w = last200Weekly.length >= 50 ? sma(last200Weekly) : null;

    const result: Record<string, unknown> = {
      ticker,
      current_price: Math.round(currentPrice * 100) / 100,
      as_of: latestDate,
      moving_averages: {
        sma_50d:
          sma50d !== null
            ? {
                value: Math.round(sma50d * 100) / 100,
                pct_from_ma: Math.round(pctFromMA(currentPrice, sma50d) * 100) / 100,
                signal: `${Math.abs(pctFromMA(currentPrice, sma50d)).toFixed(1)}% ${label(pctFromMA(currentPrice, sma50d))} 50-day MA`,
                bars_used: last50Daily.length,
              }
            : { error: 'Insufficient data (need 30+ daily bars)' },
        sma_200d:
          sma200d !== null
            ? {
                value: Math.round(sma200d * 100) / 100,
                pct_from_ma: Math.round(pctFromMA(currentPrice, sma200d) * 100) / 100,
                signal: `${Math.abs(pctFromMA(currentPrice, sma200d)).toFixed(1)}% ${label(pctFromMA(currentPrice, sma200d))} 200-day MA`,
                bars_used: last200Daily.length,
              }
            : { error: 'Insufficient data (need 100+ daily bars)' },
        sma_200w:
          sma200w !== null
            ? {
                value: Math.round(sma200w * 100) / 100,
                pct_from_ma: Math.round(pctFromMA(currentPrice, sma200w) * 100) / 100,
                signal: `${Math.abs(pctFromMA(currentPrice, sma200w)).toFixed(1)}% ${label(pctFromMA(currentPrice, sma200w))} 200-week MA`,
                bars_used: last200Weekly.length,
              }
            : { error: `Insufficient weekly data (have ${last200Weekly.length} bars, need 50+)` },
      },
    };

    // Add a human-readable summary
    const summaryParts: string[] = [`${ticker} @ $${result.current_price}`];
    if (sma50d !== null) summaryParts.push(`50D MA: $${Math.round(sma50d * 100) / 100} (${pctFromMA(currentPrice, sma50d) > 0 ? '+' : ''}${pctFromMA(currentPrice, sma50d).toFixed(1)}%)`);
    if (sma200d !== null) summaryParts.push(`200D MA: $${Math.round(sma200d * 100) / 100} (${pctFromMA(currentPrice, sma200d) > 0 ? '+' : ''}${pctFromMA(currentPrice, sma200d).toFixed(1)}%)`);
    if (sma200w !== null) summaryParts.push(`200W MA: $${Math.round(sma200w * 100) / 100} (${pctFromMA(currentPrice, sma200w) > 0 ? '+' : ''}${pctFromMA(currentPrice, sma200w).toFixed(1)}%)`);
    result.summary = summaryParts.join(' | ');

    return formatToolResult(result, sourceUrls);
  },
});
