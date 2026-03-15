import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';

const EarningsInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol. For example, 'NVDA' for Nvidia."),
});

/**
 * Most-recent earnings snapshot: revenue, EPS, estimates, BEAT/MISS/MEET,
 * key balance-sheet and cash-flow figures, plus QoQ/YoY change percentages.
 * Sourced from the company's 8-K earnings release.
 */
export const getEarnings = new DynamicStructuredTool({
  name: 'get_earnings',
  description:
    'Returns the most recent earnings snapshot for a ticker including quarterly and annual figures: revenue, EPS, net income, free cash flow, plus analyst estimate comparisons (BEAT/MISS/MEET) and period-over-period change percentages. Sourced from 8-K filings.',
  schema: EarningsInputSchema,
  func: async (input) => {
    const { data, url } = await callApi('/earnings', { ticker: input.ticker });
    return formatToolResult(data.earnings || data, [url]);
  },
});

const PressReleasesInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
});

/**
 * Full-text earnings press releases filed with the SEC.
 * Useful for reading management commentary, guidance, and qualitative context
 * that structured earnings data doesn't capture.
 */
export const getEarningsPressReleases = new DynamicStructuredTool({
  name: 'get_earnings_press_releases',
  description:
    "Returns earnings press releases for a ticker, including the full text, title, URL, and publish date. Useful for reading management commentary, forward guidance, and qualitative context around an earnings report.",
  schema: PressReleasesInputSchema,
  func: async (input) => {
    const { data, url } = await callApi('/earnings/press-releases', { ticker: input.ticker });
    return formatToolResult(data.press_releases || data, [url]);
  },
});
