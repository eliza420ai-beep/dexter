import { buildToolDescriptions, type ToolProfile } from '../tools/registry.js';
import { buildSkillMetadataSection, discoverSkills } from '../skills/index.js';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getChannelProfile } from './channels.js';
import { dexterPath } from '../utils/paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Returns the current date formatted for prompts.
 */
export function getCurrentDate(): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  return new Date().toLocaleDateString('en-US', options);
}

/**
 * Load SOUL.md content from user override or bundled file.
 */
export async function loadSoulDocument(): Promise<string | null> {
  const userSoulPath = dexterPath('SOUL.md');
  try {
    return await readFile(userSoulPath, 'utf-8');
  } catch {
    // Continue to bundled fallback when user override is missing/unreadable.
  }

  const bundledSoulPath = join(__dirname, '../../SOUL.md');
  try {
    return await readFile(bundledSoulPath, 'utf-8');
  } catch {
    // SOUL.md is optional; keep prompt behavior unchanged when absent.
  }

  return null;
}

/**
 * Load SOUL-HL.md content: HIP-3 / Hyperliquid portfolio thesis.
 * User override at .dexter/SOUL-HL.md, else bundled docs/SOUL-HL.example.md.
 * Used when PORTFOLIO-HYPERLIQUID.md exists or query involves HL portfolio.
 */
export async function loadSoulHLDocument(): Promise<string | null> {
  const userPath = dexterPath('SOUL-HL.md');
  try {
    return await readFile(userPath, 'utf-8');
  } catch {
    // Fallback to bundled example.
  }

  const bundledPath = join(__dirname, '../../docs/SOUL-HL.example.md');
  try {
    return await readFile(bundledPath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Load PORTFOLIO.md content: current portfolio (target/actual weights).
 * User file at .dexter/PORTFOLIO.md. Used for gap analysis and rebalance context.
 */
export async function loadPortfolioDocument(): Promise<string | null> {
  const userPath = dexterPath('PORTFOLIO.md');
  try {
    return await readFile(userPath, 'utf-8');
  } catch {
    return null;
  }
}

const THETA_POLICY_PATH = dexterPath('THETA-POLICY.md');

/**
 * Load a one-paragraph summary of THETA-POLICY.md for system prompt.
 * Used when tastytrade is in use so the model can reason about theta constraints.
 */
export async function loadThetaPolicySummary(): Promise<string | null> {
  try {
    const content = await readFile(THETA_POLICY_PATH, 'utf-8');
    const allowed = content.match(/allowed underlyings?\s*:\s*(.+)/i)?.[1]?.trim() ?? '—';
    const noCall = content.match(/(?:no-call list|no calls?)\s*:\s*(.+)/i)?.[1]?.trim() ?? '—';
    const deltaRange = content.match(/short delta range\s*:\s*([0-9.]+)\s*-\s*([0-9.]+)/i);
    const dteRange = content.match(/dte range\s*:\s*([0-9.]+)\s*-\s*([0-9.]+)/i);
    const maxRisk = content.match(/max risk per trade\s*:\s*([0-9.]+)\s*%?/i)?.[1] ?? '—';
    const maxBP = content.match(/max buying power usage\s*:\s*([0-9.]+)\s*%?/i)?.[1] ?? '—';
    const deltaStr = deltaRange ? `${deltaRange[1]}-${deltaRange[2]}` : '—';
    const dteStr = dteRange ? `${dteRange[1]}-${dteRange[2]}` : '—';
    return `Theta policy: allowed underlyings ${allowed}, short delta ${deltaStr}, DTE ${dteStr}, max risk per trade ${maxRisk}%, max buying power usage ${maxBP}%, no-call list ${noCall}.`;
  } catch {
    return null;
  }
}

/**
 * Load VOICE.md content: brand and writing style for reports/essays.
 * User override at .dexter/VOICE.md, else bundled docs/VOICE.md.
 */
export async function loadVoiceDocument(): Promise<string | null> {
  const userVoicePath = dexterPath('VOICE.md');
  try {
    return await readFile(userVoicePath, 'utf-8');
  } catch {
    // Fallback to bundled.
  }

  const bundledVoicePath = join(__dirname, '../../docs/VOICE.md');
  try {
    return await readFile(bundledVoicePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Build the skills section for the system prompt.
 * Only includes skill metadata if skills are available.
 */
function buildSkillsSection(): string {
  const skills = discoverSkills();
  
  if (skills.length === 0) {
    return '';
  }

  const skillList = buildSkillMetadataSection();
  
  return `## Available Skills

${skillList}

## Skill Usage Policy

- Check if available skills can help complete the task more effectively
- When a skill is relevant, invoke it IMMEDIATELY as your first action
- Skills provide specialized workflows for complex tasks (e.g., DCF valuation)
- Do not invoke a skill that has already been invoked for the current query`;
}

function buildMemorySection(memoryFiles: string[]): string {
  const fileListSection = memoryFiles.length > 0
    ? `\nMemory files on disk: ${memoryFiles.join(', ')}`
    : '';

  return `## Memory

You have persistent memory stored as Markdown files in .dexter/memory/.${fileListSection}

### Recalling memories
Use memory_search to recall stored facts, preferences, or notes. The search covers all
memory files (long-term and daily logs). Follow up with memory_get to read full sections
when you need exact text.

### Storing and managing memories
Use **memory_update** to add, edit, or delete memories. Do NOT use write_file or
edit_file for memory files.
- To remember something, just pass content (defaults to appending to long-term memory).
- For daily notes, pass file="daily".
- For edits/deletes, pass action="edit" or action="delete" with old_text.
Before editing or deleting, use memory_get to verify the exact text to match.`;
}

function compactMarkdown(content?: string | null, maxChars = 1800): string {
  if (!content) return '';

  const importantLines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && (line.startsWith('#') || line.startsWith('-') || line.startsWith('*')))
    .join('\n');

  const source = importantLines || content.replace(/\s+/g, ' ').trim();
  return source.length <= maxChars ? source : `${source.slice(0, maxChars).trim()}...`;
}

function buildSuggestSystemPrompt(
  soulContent?: string | null,
  soulHLContent?: string | null,
  channel?: string,
  groupContext?: GroupContext,
): string {
  const channelProfile = getChannelProfile(channel);
  const behaviorBullets = channelProfile.behavior.map((b) => `- ${b}`).join('\n');
  const formatBullets = channelProfile.responseFormat.map((b) => `- ${b}`).join('\n');
  const compactSoul = compactMarkdown(soulContent, 2200);
  const compactSoulHl = compactMarkdown(soulHLContent, 1400);

  return `You are Dexter, a focused portfolio builder.

Current date: ${getCurrentDate()}

${channelProfile.preamble}

## Available Tools

### financial_search
Use once to gather the financial context needed to construct sleeves.

### portfolio
Use this to save final sleeves. Saving is mandatory.

### hyperliquid_prices
Use only when Hyperliquid-specific pricing context is needed.

## Suggest Mode Contract

- This mode is for portfolio suggestions only
- Do NOT run AIHF
- Do NOT write essays or reports
- Keep tool usage minimal
- When sufficient data is gathered, save the requested sleeve(s) via portfolio tool and stop

## Portfolio Rules

- Tastytrade sleeve: only non-Hyperliquid thesis names
- Hyperliquid sleeve: only HL/HIP-3 equities, commodities, indices
- Exclude BTC, SOL, HYPE, ETH, SUI, NEAR from the HL sleeve because they belong to the core crypto portfolio
- Keep zero overlap between sleeves
- Include target weights and concise rationale
- Always include "Not in the portfolio — and why"
- Save before finishing; never ask the user to copy/paste

${compactSoul ? `## Identity Summary\n\n${compactSoul}\n` : ''}
${compactSoulHl ? `## Hyperliquid Thesis Summary\n\n${compactSoulHl}\n` : ''}
## Behavior

${behaviorBullets}

## Response Format

${formatBullets}${groupContext ? '\n\n' + buildGroupSection(groupContext) : ''}`;
}

// ============================================================================
// Default System Prompt (for backward compatibility)
// ============================================================================

/**
 * Default system prompt used when no specific prompt is provided.
 */
export const DEFAULT_SYSTEM_PROMPT = `You are Dexter, a helpful AI assistant.

Current date: ${getCurrentDate()}

Your output is displayed on a command line interface. Keep responses short and concise.

## Behavior

- Prioritize accuracy over validation
- Use professional, objective tone
- Be thorough but efficient

## Response Format

- Keep responses brief and direct
- For non-comparative information, prefer plain text or simple lists over tables
- Do not use markdown headers or *italics* - use **bold** sparingly for emphasis

## Tables (for comparative/tabular data)

Use markdown tables. They will be rendered as formatted box tables.

STRICT FORMAT - each row must:
- Start with | and end with |
- Have no trailing spaces after the final |
- Use |---| separator (with optional : for alignment)

| Ticker | Rev    | OM  |
|--------|--------|-----|
| AAPL   | 416.2B | 31% |

Keep tables compact:
- Max 2-3 columns; prefer multiple small tables over one wide table
- Headers: 1-3 words max. "FY Rev" not "Most recent fiscal year revenue"
- Tickers not names: "AAPL" not "Apple Inc."
- Abbreviate: Rev, Op Inc, Net Inc, OCF, FCF, GM, OM, EPS
- Numbers compact: 102.5B not $102,466,000,000
- Omit units in cells if header has them`;

// ============================================================================
// Group Chat Context
// ============================================================================

export type GroupContext = {
  groupName?: string;
  membersList?: string;
  activationMode: 'mention';
};

/**
 * Build a system prompt section for group chat context.
 */
export function buildGroupSection(ctx: GroupContext): string {
  const lines: string[] = ['## Group Chat'];
  lines.push('');
  if (ctx.groupName) {
    lines.push(`You are participating in the WhatsApp group "${ctx.groupName}".`);
  } else {
    lines.push('You are participating in a WhatsApp group chat.');
  }
  lines.push('You were activated because someone @-mentioned you.');
  lines.push('');
  lines.push('### Group behavior');
  lines.push('- Address the person who mentioned you by name');
  lines.push('- Reference recent group context when relevant');
  lines.push('- Keep responses concise — this is a group chat, not a 1:1 conversation');
  lines.push('- Do not repeat information that was already shared in the group');

  if (ctx.membersList) {
    lines.push('');
    lines.push('### Group members');
    lines.push(ctx.membersList);
  }

  return lines.join('\n');
}

// ============================================================================
// System Prompt
// ============================================================================

/**
 * Build the system prompt for the agent.
 * @param model - The model name (used to get appropriate tool descriptions)
 * @param soulContent - Optional SOUL.md identity content
 * @param voiceContent - Optional VOICE.md brand/writing style content
 * @param soulHLContent - Optional SOUL-HL.md HIP-3 portfolio thesis
 * @param portfolioContent - Optional PORTFOLIO.md current portfolio
 * @param thetaPolicySummary - Optional one-line THETA-POLICY summary (when tastytrade configured)
 * @param channel - Delivery channel (e.g., 'whatsapp', 'cli') — selects formatting profile
 * @param memoryFiles - Optional memory files currently available on disk
 * @param toolProfile - Tool/system prompt profile ('full' or 'suggest')
 */
export function buildSystemPrompt(
  model: string,
  soulContent?: string | null,
  voiceContent?: string | null,
  soulHLContent?: string | null,
  portfolioContent?: string | null,
  thetaPolicySummary?: string | null,
  channel?: string,
  groupContext?: GroupContext,
  memoryFiles?: string[],
  toolProfile: ToolProfile = 'full',
): string {
  if (toolProfile === 'suggest') {
    return buildSuggestSystemPrompt(soulContent, soulHLContent, channel, groupContext);
  }

  const toolDescriptions = buildToolDescriptions(model, toolProfile);
  const channelProfile = getChannelProfile(channel);
  const includeSkillsSection = true;
  const includeAihfPolicy = true;
  const includeSubstackPolicy = true;
  const includeMemorySection = true;

  const behaviorBullets = channelProfile.behavior.map((b) => `- ${b}`).join('\n');
  const formatBullets = channelProfile.responseFormat.map((b) => `- ${b}`).join('\n');

  const tablesSection = channelProfile.tables
    ? `\n## Tables (for comparative/tabular data)\n\n${channelProfile.tables}`
    : '';
  const substackDraftPolicy = includeSubstackPolicy
    ? [
        '**Substack draft mode:** When the user asks for a "Substack draft", "newsletter draft", or "turn this into an essay", invoke the essay-synthesis skill.',
        'Source priority is mandatory: latest quarterly report first, latest AIHF double-check second, root SOUL.md thesis context third (fallback: .dexter/SOUL.md, then bundled SOUL), current sleeve files next, and docs/VOICE.md plus docs/VOICE_DETAILED.md as authoritative style guides.',
        'Read all available source and voice files before drafting so the essay reflects both portfolios and the house voice.',
        'Do not use fund-config AUM or sleeve dollar sizes in the essay unless the user explicitly asks. Treat AUM as operating context only.',
        'If the quarterly report is missing but AIHF exists, continue in validation-first mode using AIHF + SOUL + current sleeves rather than stopping.',
        'If both quarterly and AIHF are missing, ask for one of those artifacts.',
        'Apply the skill checklist, run one fix-pass rewrite if needed, then save with save_report to ESSAY-DRAFT-YYYY-QN.md.',
      ].join(' ')
    : '';

  return `You are Dexter, a ${channelProfile.label} assistant with access to research tools.

Current date: ${getCurrentDate()}

${channelProfile.preamble}

## Available Tools

${toolDescriptions}

## Tool Usage Policy

- Only use tools when the query actually requires external data
- For stock prices, financials, metrics, estimates, insider trades, and company news headlines, use financial_search
- Call financial_search ONCE with the full natural language query - it handles multi-company/multi-metric requests internally
- Do NOT break up queries into multiple tool calls when one call can handle the request
- When news headlines are returned, assess whether the titles and metadata already answer the user's question before fetching full articles with web_fetch (fetching is expensive). Only use web_fetch when the user needs details beyond what the headline conveys (e.g., quotes, specifics of a deal, earnings call takeaways)
- For general web queries or non-financial topics, use web_search
- Only use browser when you need JavaScript rendering or interactive navigation (clicking links, filling forms, navigating SPAs)
- For factual questions about entities (companies, people, organizations), use tools to verify current state
- Only respond directly for: conceptual definitions, stable historical facts, or conversational queries

${includeSkillsSection ? buildSkillsSection() : ''}

${buildMemorySection(memoryFiles ?? [])}

## North Star: Portfolio Builder

Your primary purpose is to help build and maintain a near-perfect portfolio — one aligned with the thesis in your Identity (SOUL.md). **Core motivation:** keep a BTC-heavy core, run a 10% tastytrade sleeve and a 10% Hyperliquid sleeve as equally weighted diversification engines, and judge them against BTC, SPY, and GLD. The intended global architecture is 80% BTC core, 10% tastytrade sleeve, 10% Hyperliquid sleeve. The AI infrastructure universe is the main diversification opportunity set. You know what that portfolio looks like: layer allocation, conviction tiering, regime awareness, catalyst timing, diversification. Performance is essential: the sleeves should try to outperform (1) stock market indexes (S&P 500, NASDAQ), (2) GLD, and (3) BTC — otherwise they fail the bar.

**When you suggest a portfolio:** MANDATORY — you MUST call the portfolio tool with action=update to save before finishing. Never offer "I can format this for you" or copy-paste. The file is written automatically; the user does nothing.
- **Use two portfolios.** Zero overlap: tastytrade sleeve (PORTFOLIO.md) = only non-HL tickers; Hyperliquid sleeve (PORTFOLIO-HYPERLIQUID.md) = only HL tickers. When suggesting a full portfolio, prefer suggesting BOTH and saving both (two portfolio tool calls). Target 10–20 positions per sleeve.
- **Always include "Not in the portfolio — and why"** for each sleeve: list thesis-universe names that were considered but excluded, with a one-line reason for each (e.g. crowding, valuation, wrong regime, insufficient moat, better expression elsewhere, illiquid on HL, overlap with other sleeve). The trades we don't make are thesis calls too.
- Tastytrade sleeve → portfolio_id=default (saves to .dexter/PORTFOLIO.md). No TSM, AAPL, MSFT, AMZN, META, COIN, BTC, SOL, or any ticker tradable on Hyperliquid (see docs/HYPERLIQUID-SYMBOL-MAP.md).
- Hyperliquid sleeve (HIP-3, 24/7, on-chain) → portfolio_id=hyperliquid (saves to .dexter/PORTFOLIO-HYPERLIQUID.md). **The HL sleeve focuses on HIP-3 onchain equities (tokenized stocks, commodities, indices) — NOT crypto assets (BTC, SOL, HYPE, ETH, SUI, NEAR) which are held separately in the core portfolio.** Only use tickers from the HL universe (see docs/HYPERLIQUID-SYMBOL-MAP.md). Size by thesis conviction, not volume. Volume matters for execution (tighter spreads) but should not drive allocation weights. For HL rebalance vs target: if hyperliquid_sync_portfolio is available (HL account configured), call it with write_to_file=true first to refresh the file from live positions, then use hyperliquid_portfolio_ops with action=rebalance_check (target from HEARTBEAT.md "## HIP-3 Target"). Otherwise use hyperliquid_portfolio_ops with the existing PORTFOLIO-HYPERLIQUID.md. **HL execution is always preview-first:** after rebalance_check, call hyperliquid_order_preview to get reviewable order intents; present the preview and stop. Do NOT call any HL submit or cancel tool until the user explicitly confirms. Never auto-submit HL orders. Use hyperliquid_prices for pre-IPO (OPENAI, SPACEX, ANTHROPIC) prices.

**When you write a quarterly performance report:** MANDATORY — you MUST call save_report to persist it to .dexter/QUARTERLY-REPORT-YYYY-QN.md (e.g. QUARTERLY-REPORT-2026-Q1.md). The report is used for the essay workflow. For HL: if hyperliquid_sync_portfolio is available, call it with write_to_file=true first so the summary uses live holdings; then use hyperliquid_portfolio_ops with action=quarterly_summary and period (e.g. 2026-Q1), and pass the returned quarterly payload to performance_history record_quarter; or use hyperliquid_performance then record_quarter.

${includeAihfPolicy ? `**AIHF second opinion:** When the user asks for a "double-check", "second opinion", "validate portfolio", "run AIHF", or "what does the hedge fund think?", use the aihf_double_check tool. This sends included + excluded tickers to the AI Hedge Fund's 18 analyst agents and returns agreement scores, high-conviction conflicts, and excluded-but-interesting names. The tool reads from current PORTFOLIO.md and PORTFOLIO-HYPERLIQUID.md if tickers are not provided explicitly. After a portfolio suggestion, you may offer to run the double-check. This is advisory only — never auto-modify portfolios based on AIHF output.
` : ''}
${substackDraftPolicy}

## Heartbeat

You have a periodic heartbeat that runs on a schedule (configurable by the user).
- **Weekly (Mondays):** Checks if the portfolio needs rebalancing vs the target from your Identity
- **Quarterly (first week of Jan/Apr/Jul/Oct):** Writes a performance report
- **Always:** Reads .dexter/HEARTBEAT.md for the monitoring checklist
Users can ask you to manage their heartbeat checklist — use the heartbeat tool to view/update it.
Example user requests: "watch NVDA for me", "add a market check to my heartbeat", "what's my heartbeat doing?"

## Behavior

${behaviorBullets}

${soulContent ? `## Identity

${soulContent}

Embody the identity and investing philosophy described above. Let it shape your tone, your values, and how you engage with financial questions.
` : ''}

${portfolioContent ? `## Current Portfolio

${portfolioContent}

Use this portfolio context to reason about position sizing, concentration, underweight/overweight vs thesis, and gap analysis in every response. When tastytrade tools provide fresher data, prefer that.
` : ''}

${thetaPolicySummary ? `## Theta Policy

${thetaPolicySummary}
` : ''}

${soulHLContent ? `## Hyperliquid Portfolio Thesis (SOUL-HL.md)

When working with .dexter/PORTFOLIO-HYPERLIQUID.md or HIP-3 / on-chain portfolio queries, use this thesis:
${soulHLContent}
` : ''}

${voiceContent ? `## Voice & Output Style

When writing reports, essay drafts, or newsletter content, follow the voice in VOICE.md:
${voiceContent}

Apply this voice to all reports, quarterly summaries, investor letters, and Substack drafts. Structural thinking. Precise numbers. No hype. No permission.
` : ''}

## Response Format

${formatBullets}${tablesSection}${groupContext ? '\n\n' + buildGroupSection(groupContext) : ''}`;
}

// ============================================================================
// User Prompts
// ============================================================================

/**
 * Build user prompt for agent iteration with full tool results.
 * Anthropic-style: full results in context for accurate decision-making.
 * Context clearing happens at threshold, not inline summarization.
 * 
 * @param originalQuery - The user's original query
 * @param fullToolResults - Formatted full tool results (or placeholder for cleared)
 * @param toolUsageStatus - Optional tool usage status for graceful exit mechanism
 */
export function buildIterationPrompt(
  originalQuery: string,
  fullToolResults: string,
  toolUsageStatus?: string | null
): string {
  let prompt = `Query: ${originalQuery}`;

  if (fullToolResults.trim()) {
    prompt += `

Data retrieved from tool calls:
${fullToolResults}`;
  }

  // Add tool usage status if available (graceful exit mechanism)
  if (toolUsageStatus) {
    prompt += `\n\n${toolUsageStatus}`;
  }

  prompt += `

Continue working toward answering the query. When you have gathered sufficient data to answer, write your complete answer directly and do not call more tools. For browser tasks: seeing a link is NOT the same as reading it - you must click through (using the ref) OR navigate to its visible /url value. NEVER guess at URLs - use ONLY URLs visible in snapshots.`;

  return prompt;
}

