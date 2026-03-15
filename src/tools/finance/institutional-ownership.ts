import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';

const OwnershipByTickerSchema = z.object({
  ticker: z
    .string()
    .describe("Stock ticker symbol to fetch institutional owners for, e.g. 'NVDA'."),
  limit: z
    .number()
    .default(25)
    .describe('Maximum number of institutional holders to return (default: 25).'),
  report_period_gte: z
    .string()
    .optional()
    .describe('Filter for holdings reported on or after this date (YYYY-MM-DD).'),
  report_period_lte: z
    .string()
    .optional()
    .describe('Filter for holdings reported on or before this date (YYYY-MM-DD).'),
});

export const getInstitutionalOwnership = new DynamicStructuredTool({
  name: 'get_institutional_ownership',
  description:
    'Retrieves institutional ownership data (13F filings) for a stock ticker — who owns it, how many shares, and at what estimated price. Useful for tracking smart money flows, sector rotation, and portfolio overlap.',
  schema: OwnershipByTickerSchema,
  func: async (input) => {
    const params: Record<string, string | number | undefined> = {
      ticker: input.ticker.toUpperCase(),
      limit: input.limit,
      report_period_gte: input.report_period_gte,
      report_period_lte: input.report_period_lte,
    };
    const { data, url } = await callApi('/institutional-ownership/', params);
    return formatToolResult(data.institutional_ownership || data['institutional-ownership'] || [], [url]);
  },
});

const OwnershipByInvestorSchema = z.object({
  investor: z
    .string()
    .describe("Name of the investment manager, e.g. 'Berkshire Hathaway' or 'Bridgewater Associates'."),
  limit: z
    .number()
    .default(50)
    .describe('Maximum number of holdings to return (default: 50).'),
  report_period_gte: z
    .string()
    .optional()
    .describe('Filter for holdings reported on or after this date (YYYY-MM-DD).'),
  report_period_lte: z
    .string()
    .optional()
    .describe('Filter for holdings reported on or before this date (YYYY-MM-DD).'),
});

export const getInvestorHoldings = new DynamicStructuredTool({
  name: 'get_investor_holdings',
  description:
    "Retrieves all equity holdings for a named institutional investor from their 13F filing. Use to see what a fund like Berkshire Hathaway, Bridgewater, or Aschenbrenner's fund currently holds.",
  schema: OwnershipByInvestorSchema,
  func: async (input) => {
    const params: Record<string, string | number | undefined> = {
      investor: input.investor,
      limit: input.limit,
      report_period_gte: input.report_period_gte,
      report_period_lte: input.report_period_lte,
    };
    const { data, url } = await callApi('/institutional-ownership/', params);
    return formatToolResult(data.institutional_ownership || data['institutional-ownership'] || [], [url]);
  },
});
