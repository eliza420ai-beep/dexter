import { DynamicStructuredTool } from '@langchain/core/tools';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';

const FUND_CONFIG_PATH = join(homedir(), '.dexter', 'fund-config.json');

export const FUND_CONFIG_TOOL_DESCRIPTION = `
Manage fund config (~/.dexter/fund-config.json) for total AUM, optional sleeve AUMs, and inception date.
Used for dollar-amount rebalance recommendations.

## When to Use

- User asks to set or view AUM
- User asks for rebalance actions in dollar amounts
- Heartbeat rebalance: when aum_tastytrade is set, use that for the tastytrade sleeve; otherwise fall back to aum
- HL sleeve: when aum_hl is set, hyperliquid_portfolio_ops rebalance_check can output dollar trim/add for the Hyperliquid sleeve only.

## Schema

aum (number, optional total portfolio AUM), aum_tastytrade (number, optional tastytrade sleeve AUM), aum_hl (number, optional HL sleeve AUM), inceptionDate (YYYY-MM-DD, optional)

## Actions

- view: Show current config (or say not set)
- update: Set aum, aum_tastytrade, aum_hl (HL sleeve AUM in dollars), and/or inceptionDate.
`.trim();

const fundConfigSchema = z.object({
  action: z.enum(['view', 'update']),
  aum: z.number().optional().describe('Total portfolio AUM in dollars (e.g. 1000000)'),
  aum_tastytrade: z
    .number()
    .optional()
    .describe('Tastytrade sleeve AUM in dollars for main-sleeve dollar rebalance recommendations'),
  aum_hl: z.number().optional().describe('Hyperliquid sleeve AUM in dollars for HL dollar rebalance recommendations'),
  inceptionDate: z.string().optional().describe('Inception date YYYY-MM-DD'),
});

export const fundConfigTool = new DynamicStructuredTool({
  name: 'fund_config',
  description: 'View or update fund config (total AUM, sleeve AUMs, inception date) for dollar rebalance recommendations.',
  schema: fundConfigSchema,
  func: async (input) => {
    if (input.action === 'view') {
      if (!existsSync(FUND_CONFIG_PATH)) {
        return 'No fund config yet. Use update to set aum, aum_tastytrade, aum_hl, and/or inceptionDate.';
      }
      const content = readFileSync(FUND_CONFIG_PATH, 'utf-8');
      const config = JSON.parse(content) as {
        aum?: number;
        aum_tastytrade?: number;
        aum_hl?: number;
        inceptionDate?: string;
      };
      return `Fund config: ${JSON.stringify(config, null, 2)}`;
    }

    if (input.action === 'update') {
      const dir = join(homedir(), '.dexter');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      let config: {
        aum?: number;
        aum_tastytrade?: number;
        aum_hl?: number;
        inceptionDate?: string;
      } = {};
      if (existsSync(FUND_CONFIG_PATH)) {
        config = JSON.parse(readFileSync(FUND_CONFIG_PATH, 'utf-8'));
      }
      if (input.aum !== undefined) config.aum = input.aum;
      if (input.aum_tastytrade !== undefined) config.aum_tastytrade = input.aum_tastytrade;
      if (input.aum_hl !== undefined) config.aum_hl = input.aum_hl;
      if (input.inceptionDate !== undefined) config.inceptionDate = input.inceptionDate;
      writeFileSync(FUND_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
      return `Updated fund config: ${JSON.stringify(config, null, 2)}`;
    }

    return 'Unknown action. Use "view" or "update".';
  },
});
