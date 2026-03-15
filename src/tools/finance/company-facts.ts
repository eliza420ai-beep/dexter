import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';

const CompanyFactsInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol. For example, 'AAPL' for Apple."),
});

export const getCompanyFacts = new DynamicStructuredTool({
  name: 'get_company_facts',
  description:
    'Returns high-level company profile data including name, sector, industry, SIC code, exchange, location, CIK, and SEC filings URL. Useful for sector/industry classification, peer identification, and DCF WACC lookups.',
  schema: CompanyFactsInputSchema,
  func: async (input) => {
    const { data, url } = await callApi('/company/facts', { ticker: input.ticker });
    return formatToolResult(data.company_facts || data, [url]);
  },
});
