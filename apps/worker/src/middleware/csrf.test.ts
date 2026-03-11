/// <reference types="@cloudflare/vitest-pool-workers" />
/**
 * csrfProtection ミドルウェアユニットテスト
 *
 * - GET/HEAD/OPTIONS → Origin なしでも通過
 * - POST/PUT/DELETE/PATCH で Origin/Referer なし → 403
 * - 許可されたオリジン（localhost, PAGES_URL, *.pages.dev）→ 通過
 * - 不正なオリジン → 403
 * - Origin なしで有効な Referer → 通過
 */

import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { csrfProtection } from './csrf.ts';
import type { Env } from '../types.ts';

const testEnv = env as unknown as Env;

// テスト用ミニマルアプリ（CSRF のみ適用）
const csrfApp = new Hono<{ Bindings: Env }>();
csrfApp.use('/*', csrfProtection);
csrfApp.get('/test', (c) => c.json({ ok: true }));
csrfApp.on('HEAD', '/test', () => new Response(null, { status: 200 }));
csrfApp.options('/test', (c) => c.json({ ok: true }));
csrfApp.post('/test', (c) => c.json({ ok: true }));
csrfApp.put('/test', (c) => c.json({ ok: true }));
csrfApp.delete('/test', (c) => c.json({ ok: true }));
csrfApp.patch('/test', (c) => c.json({ ok: true }));

describe('csrfProtection', () => {
  // ─── セーフメソッドはバイパス ───────────────────
  it('GET リクエスト → Originなしでも通過', async () => {
    const res = await csrfApp.request('/test', { method: 'GET' }, testEnv);
    expect(res.status).toBe(200);
  });

  it('HEAD リクエスト → Originなしでも通過', async () => {
    const res = await csrfApp.request('/test', { method: 'HEAD' }, testEnv);
    expect(res.status).toBe(200);
  });

  it('OPTIONS リクエスト → Originなしでも通過', async () => {
    const res = await csrfApp.request('/test', { method: 'OPTIONS' }, testEnv);
    expect(res.status).toBe(200);
  });

  // ─── Origin/Referer なし ──────────────────────
  it('POST で Origin も Referer もなし → 403', async () => {
    const res = await csrfApp.request('/test', { method: 'POST' }, testEnv);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Missing Origin or Referer header');
  });

  // ─── 許可されたオリジン ────────────────────────
  it('POST + Origin: http://localhost:5173 → 通過', async () => {
    const res = await csrfApp.request(
      '/test',
      { method: 'POST', headers: { Origin: 'http://localhost:5173' } },
      testEnv,
    );
    expect(res.status).toBe(200);
  });

  it('POST + Origin: http://localhost:3000 → 通過', async () => {
    const res = await csrfApp.request(
      '/test',
      { method: 'POST', headers: { Origin: 'http://localhost:3000' } },
      testEnv,
    );
    expect(res.status).toBe(200);
  });

  it('POST + Origin: http://127.0.0.1:5173 → 通過', async () => {
    const res = await csrfApp.request(
      '/test',
      { method: 'POST', headers: { Origin: 'http://127.0.0.1:5173' } },
      testEnv,
    );
    expect(res.status).toBe(200);
  });

  it('POST + Origin: PAGES_URL（wrangler.toml vars から取得）→ 通過', async () => {
    // testEnv.PAGES_URL = 'https://vulflare.pages.dev'（wrangler.toml [vars]）
    const res = await csrfApp.request(
      '/test',
      { method: 'POST', headers: { Origin: testEnv.PAGES_URL } },
      testEnv,
    );
    expect(res.status).toBe(200);
  });

  it('POST + Origin が *.vulflare.pages.dev → 通過', async () => {
    const res = await csrfApp.request(
      '/test',
      { method: 'POST', headers: { Origin: 'https://preview-abc.vulflare.pages.dev' } },
      testEnv,
    );
    expect(res.status).toBe(200);
  });

  it('POST + Origin が *.pages.dev → 通過', async () => {
    const res = await csrfApp.request(
      '/test',
      { method: 'POST', headers: { Origin: 'https://my-app.pages.dev' } },
      testEnv,
    );
    expect(res.status).toBe(200);
  });

  // ─── 不正なオリジン ────────────────────────────
  it('POST + 不正な Origin → 403', async () => {
    const res = await csrfApp.request(
      '/test',
      { method: 'POST', headers: { Origin: 'https://evil.example.com' } },
      testEnv,
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Invalid origin');
  });

  // ─── Referer フォールバック ──────────────────────
  it('POST + Origin なし + 有効な Referer → 通過', async () => {
    const res = await csrfApp.request(
      '/test',
      {
        method: 'POST',
        headers: { Referer: 'http://localhost:5173/dashboard' }, // Origin ヘッダーなし
      },
      testEnv,
    );
    expect(res.status).toBe(200);
  });

  it('POST + Origin なし + 不正な Referer → 403', async () => {
    const res = await csrfApp.request(
      '/test',
      { method: 'POST', headers: { Referer: 'https://evil.example.com/attack' } },
      testEnv,
    );
    expect(res.status).toBe(403);
  });

  // ─── 他のミューテーションメソッドにも適用 ──────────
  it('PUT / DELETE / PATCH も同様にCSRF保護される', async () => {
    for (const method of ['PUT', 'DELETE', 'PATCH'] as const) {
      const resBlocked = await csrfApp.request('/test', { method }, testEnv);
      expect(resBlocked.status).toBe(403);

      const resAllowed = await csrfApp.request(
        '/test',
        { method, headers: { Origin: 'http://localhost:5173' } },
        testEnv,
      );
      expect(resAllowed.status).toBe(200);
    }
  });
});
