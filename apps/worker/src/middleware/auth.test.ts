/// <reference types="@cloudflare/vitest-pool-workers" />
/**
 * authMiddleware / requireRole ユニットテスト
 *
 * 認証ミドルウェアの各シナリオを検証：
 * - Authorizationヘッダーなし・形式不正
 * - 期限切れ・不正署名・不正なtypeのトークン
 * - 有効なトークン → userId/role をセット
 * - requireRole のロール階層バリデーション
 */

import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { signJwt, makeAccessToken, makeRefreshToken } from '../services/auth.ts';
import { authMiddleware, requireRole } from './auth.ts';
import type { Env, JwtVariables } from '../types.ts';

const testEnv = env as unknown as Env;

// ─────────────────────────────────────────────
// テスト用ミニマルアプリ
// ─────────────────────────────────────────────

/** authMiddleware + オプションの requireRole を持つシンプルなアプリ */
function makeAuthApp() {
  const app = new Hono<{ Bindings: Env; Variables: JwtVariables }>();

  // 認証のみ（ロール制限なし）
  app.get('/protected', authMiddleware, (c) =>
    c.json({ userId: c.get('userId'), role: c.get('role') }),
  );

  // editor以上が必要
  app.post('/editor-only', authMiddleware, requireRole('editor'), (c) => c.json({ ok: true }));

  // admin以上が必要
  app.post('/admin-only', authMiddleware, requireRole('admin'), (c) => c.json({ ok: true }));

  return app;
}

const app = makeAuthApp();
const now = () => Math.floor(Date.now() / 1000);

// ─────────────────────────────────────────────
// authMiddleware
// ─────────────────────────────────────────────
describe('authMiddleware', () => {
  it('Authorizationヘッダーなし → 401', async () => {
    const res = await app.request('/protected', {}, testEnv);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Unauthorized');
  });

  it('"Bearer "プレフィックスなし → 401', async () => {
    const token = await makeAccessToken('user-id', 'editor', testEnv.JWT_SECRET);
    const res = await app.request(
      '/protected',
      { headers: { Authorization: token } }, // "Bearer " なし
      testEnv,
    );
    expect(res.status).toBe(401);
  });

  it('期限切れトークン → 401', async () => {
    const expired = await signJwt(
      { sub: 'user-id', role: 'editor', type: 'access', iat: now() - 3600, exp: now() - 1 },
      testEnv.JWT_SECRET,
    );
    const res = await app.request(
      '/protected',
      { headers: { Authorization: `Bearer ${expired}` } },
      testEnv,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Invalid or expired token');
  });

  it('type が "access" でないトークン（refresh）→ 401', async () => {
    const refresh = await makeRefreshToken('user-id', 'jti-123', testEnv.JWT_SECRET);
    const res = await app.request(
      '/protected',
      { headers: { Authorization: `Bearer ${refresh}` } },
      testEnv,
    );
    expect(res.status).toBe(401);
  });

  it('不正な秘密鍵で署名されたトークン → 401', async () => {
    const wrongSecret = await makeAccessToken('user-id', 'editor', 'wrong-secret-key');
    const res = await app.request(
      '/protected',
      { headers: { Authorization: `Bearer ${wrongSecret}` } },
      testEnv,
    );
    expect(res.status).toBe(401);
  });

  it('有効なトークン → 200 かつ userId と role をレスポンスに含む', async () => {
    const token = await makeAccessToken('user-abc', 'admin', testEnv.JWT_SECRET);
    const res = await app.request(
      '/protected',
      { headers: { Authorization: `Bearer ${token}` } },
      testEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { userId: string; role: string };
    expect(body.userId).toBe('user-abc');
    expect(body.role).toBe('admin');
  });
});

// ─────────────────────────────────────────────
// requireRole
// ─────────────────────────────────────────────
describe('requireRole', () => {
  async function request(path: string, role: 'admin' | 'editor' | 'viewer') {
    const token = await makeAccessToken('user-id', role, testEnv.JWT_SECRET);
    return app.request(
      path,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
      testEnv,
    );
  }

  it('viewer が editor-only ルートにアクセス → 403', async () => {
    const res = await request('/editor-only', 'viewer');
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Forbidden');
  });

  it('editor が editor-only ルートにアクセス → 200', async () => {
    const res = await request('/editor-only', 'editor');
    expect(res.status).toBe(200);
  });

  it('admin が editor-only ルートにアクセス → 200', async () => {
    const res = await request('/editor-only', 'admin');
    expect(res.status).toBe(200);
  });

  it('editor が admin-only ルートにアクセス → 403', async () => {
    const res = await request('/admin-only', 'editor');
    expect(res.status).toBe(403);
  });

  it('admin が admin-only ルートにアクセス → 200', async () => {
    const res = await request('/admin-only', 'admin');
    expect(res.status).toBe(200);
  });
});
