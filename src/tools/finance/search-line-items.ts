import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApiPost } from './api.js';
import { formatToolResult } from '../types.js';

const VALID_LINE_ITEMS = [
  // Income statement
  'revenue', 'revenue_usd', 'cost_of_revenue', 'gross_profit', 'operating_expense',
  'operating_income', 'net_income', 'net_income_common_stock', 'ebit', 'ebit_usd',
  'earnings_per_share', 'earnings_per_share_diluted', 'earnings_per_share_usd',
  'interest_expense', 'income_tax_expense', 'research_and_development',
  'selling_general_and_administrative_expenses', 'weighted_average_shares',
  'weighted_average_shares_diluted', 'dividends_per_common_share',
  // Balance sheet
  'total_assets', 'total_liabilities', 'shareholders_equity', 'total_debt',
  'cash_and_equivalents', 'current_assets', 'current_liabilities', 'current_debt',
  'non_current_assets', 'non_current_liabilities', 'non_current_debt',
  'inventory', 'retained_earnings', 'goodwill_and_intangible_assets',
  'outstanding_shares', 'property_plant_and_equipment',
  // Cash flow
  'net_cash_flow_from_operations', 'net_cash_flow_from_investing',
  'net_cash_flow_from_financing', 'capital_expenditure',
  'depreciation_and_amortization', 'share_based_compensation',
  'change_in_cash_and_equivalents',
] as const;

const SearchLineItemsSchema = z.object({
  tickers: z
    .array(z.string())
    .min(1)
    .describe("Array of stock ticker symbols, e.g. ['NVDA', 'AMAT', 'KLAC']."),
  line_items: z
    .array(z.string())
    .min(1)
    .describe(`Array of financial line items to retrieve. Examples: 'revenue', 'net_income', 'total_debt', 'free_cash_flow', 'capital_expenditure'.`),
  period: z
    .enum(['annual', 'quarterly', 'ttm'])
    .default('ttm')
    .describe("Time period: 'ttm' (trailing twelve months), 'annual', or 'quarterly'."),
  limit: z
    .number()
    .default(1)
    .describe('Number of periods to return per ticker (default: 1 = most recent).'),
});

export const searchLineItems = new DynamicStructuredTool({
  name: 'search_line_items',
  description:
    'Batch-fetches specific financial line items across multiple tickers in a single call. Use for cross-portfolio comparisons — e.g., compare revenue, FCF, and debt across all watchlist names at once. Much more efficient than calling income statements one ticker at a time.',
  schema: SearchLineItemsSchema,
  func: async (input) => {
    const body = {
      tickers: input.tickers.map(t => t.toUpperCase()),
      line_items: input.line_items,
      period: input.period,
      limit: input.limit,
    };
    const { data, url } = await callApiPost('/financials/search/line-items', body, { cacheable: true });
    return formatToolResult(data.search_results || [], [url]);
  },
});
