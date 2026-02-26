import { type MiddlewareHandler } from 'hono';
import type { Env } from '../types.ts';

/**
 * CSRF保護ミドルウェア
 * Origin/Refererヘッダーを検証し、許可されたドメインからのリクエストのみを受け付ける
 */
export const csrfProtection: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const method = c.req.method;

  // GET, HEAD, OPTIONS は CSRF 保護不要
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return await next();
  }

  const origin = c.req.header('Origin');
  const referer = c.req.header('Referer');
  const pagesUrl = c.env.PAGES_URL;

  // Origin または Referer ヘッダーを取得
  const requestOrigin = origin || (referer ? new URL(referer).origin : null);

  if (!requestOrigin) {
    return c.json({ error: 'Missing Origin or Referer header' }, 403);
  }

  // 許可されたオリジンのリスト
  const allowedOrigins = [
    pagesUrl, // 環境変数で設定されたPages URL
    'http://localhost:5173', // Vite開発サーバー
    'http://localhost:3000', // 代替開発サーバー
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
  ];

  // ワイルドカードマッチング: *.vulflare.pages.dev
  const isAllowed =
    allowedOrigins.includes(requestOrigin) ||
    requestOrigin.endsWith('.vulflare.pages.dev') ||
    requestOrigin.endsWith('.pages.dev');

  if (!isAllowed) {
    return c.json({ error: 'Invalid origin' }, 403);
  }

  await next();
};
