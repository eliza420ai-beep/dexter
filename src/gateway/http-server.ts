/**
 * HTTP API server for Dexter - enables web frontends (e.g. Next.js chatbot) to connect.
 * Exposes POST /api/chat compatible with Vercel AI SDK useChat expectations.
 * GET /api/scorecard serves the pre-computed ticker scorecard for leaderboards/UIs.
 * GET /api/capabilities — stable JSON catalog for automation and agent discovery.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import packageJson from '../../package.json';
import { runAgentForMessage } from './agent-runner.js';
import { dexterPath } from '../utils/paths.js';

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' };
const SCORECARD_STALE_DAYS = 7;

const DEFAULT_PORT = 3847;

/** Machine-readable API catalog (for agents, scripts, codegen). */
export function getHttpCapabilities(): Record<string, unknown> {
  return {
    service: 'dexter',
    version: packageJson.version,
    description:
      'HTTP surface for chat (LLM loop), health checks, and pre-computed scorecard JSON. CLI remains the primary interactive entry.',
    defaultPort: DEFAULT_PORT,
    env: {
      port: 'DEXTER_HTTP_PORT',
      host: 'DEXTER_HTTP_HOST',
    },
    endpoints: [
      {
        method: 'GET',
        path: '/api/capabilities',
        aliases: ['/api'],
        description: 'This document. Same JSON from GET /api and GET /api/capabilities.',
      },
      {
        method: 'GET',
        path: '/health',
        aliases: ['/api/health'],
        description:
          'Liveness and configuration checks. 200 if LLM + Financial Datasets keys present; 503 degraded otherwise. ?probe=true hits FD API.',
      },
      {
        method: 'GET',
        path: '/api/scorecard',
        description: 'Full scorecard from ~/.dexter/scorecard.json (after `bun run score`). CORS enabled.',
        errors: { '404': 'Run `bun run score` (and `bun run warmup` if cache cold).' },
      },
      {
        method: 'GET',
        path: '/api/scorecard/summary',
        description: 'Ranked tickers only: symbol, sleeve, composite, flags; plus generatedAt, stale.',
      },
      {
        method: 'POST',
        path: '/api/chat',
        description: 'Run one agent turn from the latest user message in the messages array.',
        requestBody: {
          messages: "Array<{ role: 'user' | 'assistant' | 'system'; content: string }>",
          sessionId: 'optional string; default web-default',
          model: 'optional string; default gpt-5.4',
          modelProvider: 'optional string; default openai',
        },
        response: { text: 'string', sessionId: 'string' },
      },
    ],
    localArtifacts: [
      {
        path: '~/.dexter/scorecard.json',
        producedBy: 'bun run score',
        note: 'Interpretation via portfolio-scoring skill in interactive CLI, not via HTTP.',
      },
    ],
  };
}

export type HttpServerConfig = {
  port?: number;
  host?: string;
};

export type ChatRequestBody = {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  sessionId?: string;
  model?: string;
  modelProvider?: string;
};

export type ChatResponseJson = {
  text: string;
  sessionId?: string;
};

/**
 * Extracts the latest user message from the messages array.
 */
function getLatestUserMessage(messages: Array<{ role: string; content: string }>): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user' && messages[i]?.content) {
      return String(messages[i].content).trim();
    }
  }
  return '';
}

function isScorecardStale(generatedAt: string): boolean {
  const generated = new Date(generatedAt).getTime();
  const cutoff = Date.now() - SCORECARD_STALE_DAYS * 24 * 60 * 60 * 1000;
  return generated < cutoff;
}

type ScorecardLoadResult =
  | { ok: true; data: Record<string, unknown>; stale: boolean }
  | { ok: false; code: 404 }
  | { ok: false; code: 500; error: string };

function loadScorecard(): ScorecardLoadResult {
  const filepath = join(process.cwd(), dexterPath('scorecard.json'));
  if (!existsSync(filepath)) return { ok: false, code: 404 };
  try {
    const raw = readFileSync(filepath, 'utf-8');
    const data = JSON.parse(raw) as Record<string, unknown>;
    const generatedAt = typeof data.generatedAt === 'string' ? data.generatedAt : '';
    const stale = generatedAt ? isScorecardStale(generatedAt) : true;
    return { ok: true, data: { ...data, stale }, stale };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, code: 500, error: msg };
  }
}

/**
 * Starts the Dexter HTTP API server.
 * POST /api/chat - Run the agent and return the response.
 * GET /health - Health check.
 */
export async function startHttpServer(config: HttpServerConfig = {}): Promise<{ stop: () => void }> {
  const port = config.port ?? Number(process.env.DEXTER_HTTP_PORT) ?? DEFAULT_PORT;
  const host = config.host ?? process.env.DEXTER_HTTP_HOST ?? '0.0.0.0';

  const server = Bun.serve({
    port,
    hostname: host,
    async fetch(req) {
      const url = new URL(req.url);

      if (
        req.method === 'OPTIONS' &&
        (url.pathname === '/api' || url.pathname === '/api/capabilities')
      ) {
        return new Response(null, {
          status: 204,
          headers: {
            ...CORS_HEADERS,
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }

      if (
        req.method === 'GET' &&
        (url.pathname === '/api' || url.pathname === '/api/capabilities')
      ) {
        return Response.json(getHttpCapabilities(), {
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }

      if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/api/health')) {
        const probe = url.searchParams.get('probe') === 'true';
        const hasFdKey = !!(process.env.FINANCIAL_DATASETS_API_KEY?.trim?.());
        const hasLlmKey = !!(
          process.env.OPENAI_API_KEY ||
          process.env.ANTHROPIC_API_KEY ||
          process.env.GOOGLE_API_KEY ||
          process.env.XAI_API_KEY ||
          process.env.OPENROUTER_API_KEY
        );
        let financialDatasetsOk = hasFdKey;
        let llmOk = hasLlmKey;
        let probeResults: Record<string, 'ok' | 'error'> | undefined;

        if (probe) {
          if (hasFdKey) {
            try {
              const fdRes = await fetch(
                'https://api.financialdatasets.ai/prices/snapshot/?ticker=AAPL',
                { headers: { 'x-api-key': process.env.FINANCIAL_DATASETS_API_KEY! } },
              );
              financialDatasetsOk = fdRes.ok;
              probeResults = { ...probeResults, financialDatasets: fdRes.ok ? 'ok' : 'error' };
            } catch {
              financialDatasetsOk = false;
              probeResults = { ...probeResults, financialDatasets: 'error' };
            }
          }
        }

        const checks: Record<string, boolean> = {
          llm: llmOk,
          financialDatasets: financialDatasetsOk,
          search: !!(
            process.env.EXASEARCH_API_KEY ||
            process.env.TAVILY_API_KEY ||
            process.env.PERPLEXITY_API_KEY
          ),
        };
        const failed = (Object.entries(checks) as [string, boolean][])
          .filter(([, ok]) => !ok)
          .map(([name]) => name);
        const criticalOk = checks.llm && checks.financialDatasets;
        const status = criticalOk ? 'ok' : 'degraded';
        const code = criticalOk ? 200 : 503;
        const body: Record<string, unknown> = {
          status,
          service: 'dexter',
          checks,
          ...(failed.length > 0 ? { failed } : {}),
        };
        if (probeResults) body.probe = probeResults;
        return Response.json(body, { status: code });
      }

      if (
        req.method === 'OPTIONS' &&
        (url.pathname === '/api/scorecard' || url.pathname === '/api/scorecard/summary')
      ) {
        return new Response(null, {
          status: 204,
          headers: {
            ...CORS_HEADERS,
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }

      if (req.method === 'GET' && url.pathname === '/api/scorecard') {
        const loaded = loadScorecard();
        if (!loaded.ok) {
          if (loaded.code === 404) {
            return Response.json(
              { error: 'Scorecard not found. Run: bun run score' },
              { status: 404, headers: CORS_HEADERS }
            );
          }
          return Response.json(
            { error: loaded.error },
            { status: 500, headers: CORS_HEADERS }
          );
        }
        return Response.json(loaded.data, {
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }

      if (req.method === 'GET' && url.pathname === '/api/scorecard/summary') {
        const loaded = loadScorecard();
        if (!loaded.ok) {
          if (loaded.code === 404) {
            return Response.json(
              { error: 'Scorecard not found. Run: bun run score' },
              { status: 404, headers: CORS_HEADERS }
            );
          }
          return Response.json(
            { error: loaded.error },
            { status: 500, headers: CORS_HEADERS }
          );
        }
        const tickers = (loaded.data.tickers as Array<Record<string, unknown>>) ?? [];
        const summary = tickers.map((t, i) => ({
          rank: i + 1,
          symbol: t.symbol,
          sleeve: t.sleeve,
          composite: t.composite,
          flags: t.flags ?? [],
        }));
        return Response.json(
          {
            generatedAt: loaded.data.generatedAt,
            tickerCount: loaded.data.tickerCount,
            stale: loaded.stale,
            tickers: summary,
          },
          { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        );
      }

      if (req.method === 'OPTIONS' && url.pathname === '/api/chat') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }

      if (req.method === 'POST' && url.pathname === '/api/chat') {
        try {
          const body = (await req.json()) as ChatRequestBody;
          const messages = body.messages ?? [];
          const query = getLatestUserMessage(messages);

          if (!query) {
            return Response.json(
              { error: 'No user message found in messages array' },
              { status: 400 }
            );
          }

          const sessionKey = body.sessionId ?? 'web-default';
          const model = body.model ?? 'gpt-5.4';
          const modelProvider = body.modelProvider ?? 'openai';

          const answer = await runAgentForMessage({
            sessionKey,
            query,
            model,
            modelProvider,
            channel: 'web',
          });

          const response: ChatResponseJson = { text: answer, sessionId: sessionKey };
          return Response.json(response, {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return Response.json(
            { error: msg },
            { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
          );
        }
      }

      return new Response('Not Found', { status: 404 });
    },
  });

  console.log(`Dexter HTTP API: http://${host}:${port}/api/chat`);
  return {
    stop: () => server.stop(),
  };
}
