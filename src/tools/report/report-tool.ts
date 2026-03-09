import { DynamicStructuredTool } from '@langchain/core/tools';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { dexterPath } from '../../utils/paths.js';

const DEXTER_DIR = dexterPath();
const ESSAY_HISTORY_PATH = dexterPath('essay-history.json');

export const REPORT_TOOL_DESCRIPTION = `
Save reports to .dexter/ for persistence and essay workflow.

## When to Use

- After writing a quarterly performance report → save it so you can reference it later and feed it to essay drafts
- User asks to save a report to disk
- Heartbeat produces a quarterly report → MANDATORY: call this tool to persist it

## Actions

- save: Write content to .dexter/ (filename provided as argument). Creates .dexter if needed.

## Filename Convention

- Quarterly reports: QUARTERLY-REPORT-YYYY-QN.md (e.g. QUARTERLY-REPORT-2026-Q1.md)
- Weekly reports: optional, same pattern if desired
`.trim();

const reportSchema = z.object({
  filename: z
    .string()
    .describe('Filename only (e.g. QUARTERLY-REPORT-2026-Q1.md). Saved to .dexter/'),
  content: z.string().describe('Full report content (markdown).'),
});

export const reportTool = new DynamicStructuredTool({
  name: 'save_report',
  description:
    'Save a report (e.g. quarterly performance report) to .dexter/ for persistence and essay workflow.',
  schema: reportSchema,
  func: async (input) => {
    if (!input.filename.endsWith('.md')) {
      return 'Error: filename should end with .md';
    }
    const filePath = dexterPath(input.filename);
    if (!existsSync(DEXTER_DIR)) {
      mkdirSync(DEXTER_DIR, { recursive: true });
    }
    writeFileSync(filePath, input.content, 'utf-8');
    const historyNote = updateEssayHistoryIfDraft(input.filename, input.content);
    const suffix = historyNote ? ` ${historyNote}` : '';
    return `Saved report to .dexter/${input.filename} (${input.content.length} characters).${suffix}`;
  },
});

interface EssayHistoryEntry {
  savedAt: string;
  filename: string;
  period: string | null;
  publishStatus: string;
  wordCount: number;
  numericClaims: number;
  hasFrontmatter: boolean;
  requiredSectionsPresent: boolean;
  qualityScore: number;
}

const REQUIRED_SECTION_PATTERNS = [
  /hook/i,
  /thesis map/i,
  /committee challenge/i,
  /decision layer/i,
  /risk(?:\s*\+\s*|\s+and\s+)invalidation/i,
];

function updateEssayHistoryIfDraft(filename: string, content: string): string {
  if (!filename.startsWith('ESSAY-DRAFT-')) return '';

  const clean = stripFrontmatter(content);
  const entry: EssayHistoryEntry = {
    savedAt: new Date().toISOString(),
    filename,
    period: inferPeriodFromFilename(filename),
    publishStatus: extractPublishStatus(content) ?? 'draft',
    wordCount: countWords(clean),
    numericClaims: countNumericClaims(clean),
    hasFrontmatter: hasFrontmatter(content),
    requiredSectionsPresent: hasRequiredSections(clean),
    qualityScore: 0,
  };
  entry.qualityScore = scoreEssay(entry);

  const history = readEssayHistory();
  history.push(entry);
  writeFileSync(ESSAY_HISTORY_PATH, JSON.stringify(history, null, 2), 'utf-8');
  return `Essay metadata updated at .dexter/essay-history.json (quality score ${entry.qualityScore}).`;
}

function readEssayHistory(): EssayHistoryEntry[] {
  if (!existsSync(ESSAY_HISTORY_PATH)) return [];
  try {
    const parsed = JSON.parse(readFileSync(ESSAY_HISTORY_PATH, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function hasFrontmatter(content: string): boolean {
  return /^---\n[\s\S]*?\n---\n/m.test(content);
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n/m, '');
}

function extractPublishStatus(content: string): string | null {
  const match = content.match(/^\s*publish_status\s*:\s*(.+)\s*$/m);
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
}

function inferPeriodFromFilename(filename: string): string | null {
  const match = filename.match(/(\d{4}-Q[1-4])/);
  return match ? match[1] : null;
}

function countWords(content: string): number {
  const words = content.trim().match(/\S+/g);
  return words ? words.length : 0;
}

function countNumericClaims(content: string): number {
  const matches = content.match(/\b\d+(?:\.\d+)?%?|\$\d+(?:[.,]\d+)?(?:[MBK])?\b/g);
  return matches ? matches.length : 0;
}

function hasRequiredSections(content: string): boolean {
  return REQUIRED_SECTION_PATTERNS.every((p) => p.test(content));
}

function scoreEssay(entry: EssayHistoryEntry): number {
  let score = 0;
  if (entry.hasFrontmatter) score += 20;
  if (entry.requiredSectionsPresent) score += 30;
  if (entry.wordCount >= 2000 && entry.wordCount <= 5000) score += 30;
  if (entry.numericClaims >= 8) score += 20;
  return score;
}
