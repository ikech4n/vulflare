import { type MiddlewareHandler } from 'hono';
import type { Env } from '../types.ts';

interface RateLimitOptions {
  /**
   * ウィンドウ期間（秒）
   */
  windowSeconds: number;
  /**
   * ウィンドウ内の最大リクエスト数
   */
  maxRequests: number;
  /**
   * レート制限のキープレフィックス
   */
  keyPrefix: string;
}

/**
 * VULFLARE_KV_CACHE を使ったスライディングウィンドウ方式のレート制限ミドルウェア
 */
export function rateLimit(options: RateLimitOptions): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown';
    const key = `ratelimit:${options.keyPrefix}:${ip}`;
    const now = Date.now();
    const windowMs = options.windowSeconds * 1000;

    // 現在のカウントと最初のリクエスト時刻を取得
    const data = await c.env.VULFLARE_KV_CACHE.get(key);
    let count = 0;
    let windowStart = now;

    if (data) {
      try {
        const parsed = JSON.parse(data) as { count: number; windowStart: number };

        // ウィンドウが期限切れかチェック
        if (now - parsed.windowStart < windowMs) {
          count = parsed.count;
          windowStart = parsed.windowStart;
        } else {
          // ウィンドウリセット
          count = 0;
          windowStart = now;
        }
      } catch {
        // パースエラーの場合はリセット
        count = 0;
        windowStart = now;
      }
    }

    // レート制限チェック
    if (count >= options.maxRequests) {
      const retryAfter = Math.ceil((windowStart + windowMs - now) / 1000);
      return c.json(
        { error: 'Too many requests. Please try again later.' },
        429,
        {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': options.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(windowStart + windowMs).toISOString(),
        }
      );
    }

    // カウントを増やして保存
    const newCount = count + 1;
    await c.env.VULFLARE_KV_CACHE.put(
      key,
      JSON.stringify({ count: newCount, windowStart }),
      { expirationTtl: options.windowSeconds + 60 } // 少し余裕を持たせる
    );

    // レスポンスヘッダーに制限情報を追加
    c.header('X-RateLimit-Limit', options.maxRequests.toString());
    c.header('X-RateLimit-Remaining', (options.maxRequests - newCount).toString());
    c.header('X-RateLimit-Reset', new Date(windowStart + windowMs).toISOString());

    await next();
  };
}

/**
 * 事前定義されたレート制限設定
 */
export const rateLimitPresets = {
  /** ログイン: 15分間に5回まで */
  login: rateLimit({
    windowSeconds: 15 * 60,
    maxRequests: 5,
    keyPrefix: 'login',
  }),
  /** 登録: 1時間に3回まで */
  register: rateLimit({
    windowSeconds: 60 * 60,
    maxRequests: 3,
    keyPrefix: 'register',
  }),
  /** パスワード変更: 15分間に5回まで */
  password: rateLimit({
    windowSeconds: 15 * 60,
    maxRequests: 5,
    keyPrefix: 'password',
  }),
  /** トークンリフレッシュ: 1分間に10回まで */
  refresh: rateLimit({
    windowSeconds: 60,
    maxRequests: 10,
    keyPrefix: 'refresh',
  }),
};
