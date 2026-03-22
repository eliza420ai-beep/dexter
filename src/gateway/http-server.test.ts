import { describe, expect, test } from 'bun:test';
import { getHttpCapabilities } from './http-server.js';

describe('getHttpCapabilities', () => {
  test('returns stable machine-readable shape', () => {
    const cap = getHttpCapabilities();
    expect(cap.service).toBe('dexter');
    expect(typeof cap.version).toBe('string');
    expect(cap.version).toMatch(/^\d{4}\.\d{1,2}\.\d{1,2}$/);
    expect(cap.defaultPort).toBe(3847);
    const endpoints = cap.endpoints as Array<{ method: string; path: string }>;
    expect(Array.isArray(endpoints)).toBe(true);
    expect(endpoints.some((e) => e.path === '/api/chat' && e.method === 'POST')).toBe(true);
    expect(endpoints.some((e) => e.path === '/api/capabilities' && e.method === 'GET')).toBe(true);
  });
});
