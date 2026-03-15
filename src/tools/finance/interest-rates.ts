import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';

export const getInterestRatesSnapshot = new DynamicStructuredTool({
  name: 'get_interest_rates_snapshot',
  description:
    'Fetches current interest rates from all major central banks worldwide (Fed, ECB, BoJ, BoE, etc.). Use for macro regime context and rate-sensitive position sizing.',
  schema: z.object({}),
  func: async () => {
    const { data, url } = await callApi('/macro/interest-rates/snapshot/', {});
    return formatToolResult(data, [url]);
  },
});

const MAJOR_BANKS = ['FED', 'ECB', 'BOJ', 'BOE', 'BOC', 'RBA', 'PBOC'] as const;

export const getInterestRatesHistorical = new DynamicStructuredTool({
  name: 'get_interest_rates_historical',
  description:
    'Retrieves historical interest rate data from a central bank. Defaults to FED. Available banks: FED, ECB, BOJ, BOE, BOC, RBA, PBOC. Useful for charting rate cycles, identifying regime shifts, and correlating rate changes with equity drawdowns.',
  schema: z.object({
    bank: z
      .string()
      .default('FED')
      .describe("Central bank code (e.g. 'FED', 'ECB', 'BOJ', 'BOE', 'BOC', 'RBA', 'PBOC'). Defaults to FED."),
    start_date: z
      .string()
      .optional()
      .describe("Start date in YYYY-MM-DD format. Optional."),
    end_date: z
      .string()
      .optional()
      .describe("End date in YYYY-MM-DD format. Optional."),
  }),
  func: async (input) => {
    const params: Record<string, string> = { bank: input.bank };
    if (input.start_date) params.start_date = input.start_date;
    if (input.end_date) params.end_date = input.end_date;
    const { data, url } = await callApi('/macro/interest-rates/', params, { cacheable: true });
    return formatToolResult(data, [url]);
  },
});
