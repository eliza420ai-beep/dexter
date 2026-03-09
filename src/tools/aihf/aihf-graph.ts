/**
 * Bundled default AIHF graph template.
 *
 * Dexter owns this graph so we don't depend on AIHF's /flows endpoint.
 * 18 analyst nodes feed into a single portfolio_manager node.
 * The AIHF backend inserts its own risk_manager between analysts and PM.
 */

import type { AihfGraph, AihfGraphNode, AihfGraphEdge } from './types.js';

const ANALYST_IDS = [
  'aswath_damodaran',
  'ben_graham',
  'bill_ackman',
  'cathie_wood',
  'charlie_munger',
  'michael_burry',
  'mohnish_pabrai',
  'peter_lynch',
  'phil_fisher',
  'rakesh_jhunjhunwala',
  'stanley_druckenmiller',
  'warren_buffett',
  'technical_analyst',
  'fundamentals_analyst',
  'growth_analyst',
  'news_sentiment_analyst',
  'sentiment_analyst',
  'valuation_analyst',
] as const;

export type AnalystId = (typeof ANALYST_IDS)[number];
export type AnalystPreset = 'full' | 'lean';

const LEAN_ANALYST_IDS = [
  'warren_buffett',
  'charlie_munger',
  'aswath_damodaran',
  'michael_burry',
  'technical_analyst',
  'fundamentals_analyst',
  'valuation_analyst',
  'sentiment_analyst',
] as const satisfies readonly AnalystId[];

const SUFFIX = 'dxt001';
const PM_NODE_ID = `portfolio_manager_${SUFFIX}`;

export function getAnalystIds(preset: AnalystPreset = 'full'): readonly string[] {
  return preset === 'lean' ? LEAN_ANALYST_IDS : ANALYST_IDS;
}

export function getPMNodeId(): string {
  return PM_NODE_ID;
}

/**
 * AIHF backend strips a trailing 6-char token from node IDs to recover base keys.
 * Use a deterministic suffix so IDs like `phil_fisher` don't get misparsed as `phil`.
 */
function suffixed(id: string): string {
  return `${id}_${SUFFIX}`;
}

export function getDefaultAihfGraph(): AihfGraph {
  return getAihfGraph('full');
}

export function getAihfGraph(preset: AnalystPreset = 'full'): AihfGraph {
  const analystIds = getAnalystIds(preset);
  const nodes: AihfGraphNode[] = [
    ...analystIds.map((id) => ({ id: suffixed(id), type: 'analyst' })),
    { id: PM_NODE_ID, type: 'portfolio_manager' },
  ];

  const edges: AihfGraphEdge[] = analystIds.map((id) => ({
    id: `${suffixed(id)}->${PM_NODE_ID}`,
    source: suffixed(id),
    target: PM_NODE_ID,
  }));

  return { nodes, edges };
}
