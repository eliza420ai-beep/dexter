import { DynamicStructuredTool } from '@langchain/core/tools';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { dexterPath } from '../../utils/paths.js';

const DEXTER_DIR = dexterPath();
const THESIS_DIR = dexterPath('stock-theses');

export const STOCK_THESIS_DESCRIPTION = `
Create, update, view, and list saved stock thesis artifacts in .dexter/.

Each thesis is a markdown file with a stable schema, meant to be reused by portfolio, heartbeat, AIHF, and essay workflows.

## Filename convention

- Canonical per-ticker thesis: STOCK-THESIS-<TICKER>.md (e.g. STOCK-THESIS-NVDA.md)
- Automatic dated snapshot: <TICKER>_YYYY-MM-DD.md (e.g. NVDA_2026-03-10.md)

All files are stored under:

- .dexter/stock-theses/STOCK-THESIS-<TICKER>.md
- .dexter/stock-theses/<TICKER>_YYYY-MM-DD.md

## Recommended content schema (for the LLM caller)

The tool does NOT generate thesis text. The model must draft markdown using this structure:

---
title: "<Company Name> (<TICKER>) Investment Thesis"
ticker: "<TICKER>"
artifact_type: stock_thesis
publish_status: internal
updated_at: "YYYY-MM-DD"
source_mode: "single" | "batch"
role_in_portfolio: "core" | "compounder" | "cyclical" | "speculative" | "hedge" | "watchlist"
thesis_type: "compounder" | "cyclical" | "speculative" | "hedge"
confidence: "high" | "medium" | "low"
---

## The Thesis In One Paragraph
...

## Why This Stock Is Different
...

## Core Investment Case
...

## What Has To Go Right
...

## Valuation / Model
...

## Risks And Mitigants
...

## Invalidation
...

## Why Now
...

## Role In Portfolio
...

## When to use this tool

- generate: After drafting or refreshing a thesis for a specific ticker. Saves both canonical STOCK-THESIS-<TICKER>.md and a dated snapshot <TICKER>_YYYY-MM-DD.md.
- view: When you need to read an existing thesis for a ticker to inform portfolio or essay work.
- list: When you need to know which tickers already have saved theses.
`.trim();

const stockThesisSchema = z.object({
  action: z.enum(['generate', 'view', 'list']).describe('Which operation to perform.'),
  ticker: z
    .string()
    .optional()
    .describe('Stock ticker (required for generate/view). Use plain symbol like NVDA, TSM, AMAT.'),
  content: z
    .string()
    .optional()
    .describe(
      'Full thesis content in markdown (required for generate). Should follow the recommended schema, including frontmatter.'
    ),
});

function ensureThesisDir(): void {
  if (!existsSync(DEXTER_DIR)) {
    mkdirSync(DEXTER_DIR, { recursive: true });
  }
  if (!existsSync(THESIS_DIR)) {
    mkdirSync(THESIS_DIR, { recursive: true });
  }
}

function normalizeTicker(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
}

function thesisPathForTicker(ticker: string): string {
  return join(THESIS_DIR, `STOCK-THESIS-${ticker}.md`);
}

function snapshotPathForTicker(ticker: string, date: string): string {
  return join(THESIS_DIR, `${ticker}_${date}.md`);
}

function listThesisFiles(): string[] {
  if (!existsSync(THESIS_DIR)) return [];
  try {
    return readdirSync(THESIS_DIR)
      .filter((f) => f.startsWith('STOCK-THESIS-') && f.endsWith('.md'))
      .sort();
  } catch {
    return [];
  }
}

export const stockThesisTool = new DynamicStructuredTool({
  name: 'stock_thesis',
  description: STOCK_THESIS_DESCRIPTION,
  schema: stockThesisSchema,
  func: async (input) => {
    const { action } = input;

    if (action === 'list') {
      const files = listThesisFiles();
      if (files.length === 0) {
        return 'No saved stock thesis artifacts yet in .dexter/stock-theses.';
      }
      const tickers = files
        .map((f) => f.replace(/^STOCK-THESIS-/, '').replace(/\.md$/, ''))
        .join(', ');
      return `Saved stock theses for tickers: ${tickers}. Files are in .dexter/stock-theses/.`;
    }

    const ticker = normalizeTicker(input.ticker);
    if (!ticker) {
      return 'Error: ticker is required for generate and view actions.';
    }

    const path = thesisPathForTicker(ticker);

    if (action === 'view') {
      if (!existsSync(path)) {
        return `No saved thesis found for ${ticker} at ${path}. Use action=generate with content to create one.`;
      }
      const content = readFileSync(path, 'utf-8');
      return `Saved thesis for ${ticker} (${path}):\n\n${content}`;
    }

    if (action === 'generate') {
      if (!input.content) {
        return 'Error: content is required for generate action. Draft the thesis markdown and pass it as content.';
      }
      ensureThesisDir();
      const date = new Date().toISOString().slice(0, 10);
      const snapshotPath = snapshotPathForTicker(ticker, date);
      writeFileSync(path, input.content, 'utf-8');
      writeFileSync(snapshotPath, input.content, 'utf-8');
      return `Saved stock thesis for ${ticker} to ${path} and dated snapshot ${snapshotPath} (${input.content.length} characters).`;
    }

    return 'Unknown action. Use generate, view, or list.';
  },
});

