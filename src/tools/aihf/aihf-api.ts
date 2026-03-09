/**
 * AIHF HTTP client.
 *
 * Calls POST /hedge-fund/run on the AI Hedge Fund backend.
 * The endpoint returns a Server-Sent Events (SSE) stream.
 * We parse events until `event: complete` delivers the final payload
 * with decisions, analyst_signals, and current_prices.
 */

import type { AihfRunRequest, AihfRunResult, AihfSseEvent, AihfSseEventType } from './types.js';
import { getDefaultAihfGraph } from './aihf-graph.js';

const DEFAULT_TIMEOUT_MS = 180_000; // 3 minutes

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CallAihfOptions {
  tickers: string[];
  startDate?: string | null;
  endDate?: string;
  initialCash?: number;
  onProgress?: (message: string) => void;
}

export async function callAIHF(opts: CallAihfOptions): Promise<AihfRunResult> {
  const apiUrl = getAihfApiUrl();
  if (!apiUrl) {
    throw new AihfError('AIHF_API_URL is not configured.');
  }

  const graph = getDefaultAihfGraph();
  const today = new Date().toISOString().slice(0, 10);

  const payload: AihfRunRequest = {
    tickers: opts.tickers,
    graph_nodes: graph.nodes,
    graph_edges: graph.edges,
    initial_cash: opts.initialCash ?? 100_000,
    margin_requirement: 0,
    start_date: opts.startDate ?? null,
    end_date: opts.endDate ?? today,
  };

  const url = `${apiUrl.replace(/\/$/, '')}/hedge-fund/run`;
  const timeoutMs = getTimeoutMs();
  opts.onProgress?.(`Starting AIHF second opinion for ${opts.tickers.length} tickers...`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      throw new AihfError(
        `AIHF timed out after ${Math.round(timeoutMs / 1000)}s. ` +
          `Run manually: poetry run python src/main.py --tickers ${opts.tickers.join(',')} --analysts-all --show-reasoning`,
        true,
      );
    }
    throw new AihfError(
      `AIHF unreachable at ${url}. ` +
        `Run manually: poetry run python src/main.py --tickers ${opts.tickers.join(',')} --analysts-all --show-reasoning`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new AihfError(`AIHF returned HTTP ${response.status}: ${body.slice(0, 500)}`);
  }

  opts.onProgress?.('Connected to AIHF stream. Waiting for analyst graph...');
  return parseSseStream(response, opts.tickers, opts.onProgress);
}

// ---------------------------------------------------------------------------
// SSE parser
// ---------------------------------------------------------------------------

export async function parseSseStream(
  response: Response,
  tickers: string[],
  onProgress?: (message: string) => void,
): Promise<AihfRunResult> {
  if (!response.body) {
    throw new AihfError('AIHF response has no body.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completedAnalystSteps = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = extractSseEvents(buffer);
      buffer = events.remaining;

      for (const evt of events.parsed) {
        if (
          evt.event === 'progress' &&
          typeof evt.data === 'object' &&
          evt.data !== null &&
          (evt.data as { status?: string }).status?.toLowerCase() === 'complete'
        ) {
          completedAnalystSteps += 1;
        }

        const progressMessage = formatAihfProgressEvent(evt, tickers, completedAnalystSteps);
        if (progressMessage) {
          onProgress?.(progressMessage);
        }

        if (evt.event === 'complete') {
          onProgress?.('AIHF run complete. Normalizing decisions...');
          debugAihfPayload('complete_event_raw', evt.data);
          return parseCompletePayload(evt.data, tickers);
        }
        if (evt.event === 'error') {
          const msg = typeof evt.data === 'object' && evt.data !== null
            ? (evt.data as any).detail ?? JSON.stringify(evt.data)
            : String(evt.data);
          throw new AihfError(`AIHF returned error event: ${msg}`);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  throw new AihfError(
    'AIHF stream ended without a `complete` event. ' +
      `Run manually: poetry run python src/main.py --tickers ${tickers.join(',')} --analysts-all --show-reasoning`,
  );
}

function formatAihfProgressEvent(
  evt: AihfSseEvent,
  tickers: string[],
  progressCount: number,
): string | null {
  if (evt.event === 'start') {
    const data = evt.data as { status?: string; tickers?: string[] } | string;
    if (typeof data === 'object' && data !== null) {
      const runTickers = Array.isArray(data.tickers) ? data.tickers.length : tickers.length;
      return `AIHF graph running for ${runTickers} tickers across 18 analyst personas...`;
    }
    return 'AIHF graph started...';
  }

  if (evt.event === 'progress') {
    if (typeof evt.data === 'object' && evt.data !== null) {
      const data = evt.data as { agent?: string; ticker?: string; status?: string };
      const agent = formatAgentName(data.agent);
      const ticker = data.ticker?.toUpperCase();
      const status = data.status?.toLowerCase();
      if (agent && ticker && status === 'complete') {
        return `AIHF progress: ${agent} finished ${ticker} (${progressCount} analyst steps done)...`;
      }
      if (agent && ticker) {
        return `AIHF progress: ${agent} processing ${ticker}...`;
      }
    }
    return `AIHF progress: ${progressCount} analyst steps completed...`;
  }

  if (evt.event === 'error') {
    return 'AIHF reported an error event...';
  }

  return null;
}

function formatAgentName(agent?: string): string | null {
  if (!agent) return null;
  return agent
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Extract SSE events from a text buffer.
 * Returns parsed events and the remaining (potentially incomplete) buffer.
 */
export function extractSseEvents(buffer: string): {
  parsed: AihfSseEvent[];
  remaining: string;
} {
  const parsed: AihfSseEvent[] = [];
  const blocks = buffer.split(/\n\n/);
  const remaining = blocks.pop() ?? '';

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    let eventType: AihfSseEventType = 'progress';
    let dataLines: string[] = [];

    for (const line of trimmed.split('\n')) {
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim() as AihfSseEventType;
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (dataLines.length === 0) continue;

    const raw = dataLines.join('\n');
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }

    parsed.push({ event: eventType, data });
  }

  return { parsed, remaining };
}

// ---------------------------------------------------------------------------
// Payload parsing
// ---------------------------------------------------------------------------

function parseCompletePayload(data: unknown, tickers: string[]): AihfRunResult {
  if (typeof data !== 'object' || data === null) {
    throw new AihfError('AIHF `complete` event data is not an object.');
  }

  const obj = data as Record<string, unknown>;
  debugAihfPayload('complete_event_keys', Object.keys(obj));

  // AIHF backend currently emits complete events as:
  // { type: "complete", data: { decisions, analyst_signals, current_prices }, timestamp }
  // but we also support the direct flat shape for compatibility.
  const payload =
    typeof obj.data === 'object' && obj.data !== null ? (obj.data as Record<string, unknown>) : obj;

  const decisions = (payload.decisions ?? {}) as AihfRunResult['decisions'];
  const analyst_signals = (payload.analyst_signals ?? {}) as AihfRunResult['analyst_signals'];
  const current_prices = (payload.current_prices ?? {}) as AihfRunResult['current_prices'];
  debugAihfPayload('complete_event_decision_keys', Object.keys(decisions ?? {}));
  if (Object.keys(decisions ?? {}).length === 0) {
    // Helps isolate backend shape/content mismatches when stream completes but no parsed decisions exist.
    debugAihfPayload('complete_event_empty_decisions_payload', payload);
  }

  return { decisions, analyst_signals, current_prices };
}

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

export function getAihfApiUrl(): string | undefined {
  return process.env.AIHF_API_URL?.trim() || undefined;
}

function getTimeoutMs(): number {
  const raw = process.env.AIHF_REQUEST_TIMEOUT_MS;
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_TIMEOUT_MS;
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class AihfError extends Error {
  constructor(
    message: string,
    public readonly timeout = false,
  ) {
    super(message);
    this.name = 'AihfError';
  }
}

function debugAihfPayload(label: string, value: unknown): void {
  if (process.env.AIHF_DEBUG_PAYLOAD !== '1') return;
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    console.error(`[aihf-debug] ${label}: ${serialized}`);
  } catch {
    console.error(`[aihf-debug] ${label}: [unserializable]`);
  }
}
