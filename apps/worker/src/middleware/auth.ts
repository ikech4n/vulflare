import type { Context, Next } from 'hono';
import type { Env, JwtVariables } from '../types.ts';
import { verifyJwt } from '../services/auth.ts';

type HonoCtx = Context<{ Bindings: Env; Variables: JwtVariables }>;

export async function authMiddleware(c: HonoCtx, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyJwt<{
    sub: string;
    role: string;
    type: string;
  }>(token, c.env.JWT_SECRET);

  if (!payload || payload.type !== 'access') {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  c.set('userId', payload.sub);
  c.set('role', payload.role as JwtVariables['role']);
  await next();
}

export function requireRole(minRole: 'admin' | 'editor') {
  const hierarchy: Record<string, number> = { admin: 3, editor: 2, viewer: 1 };
  return async (c: HonoCtx, next: Next): Promise<Response | void> => {
    const userRole = c.get('role');
    if ((hierarchy[userRole] ?? 0) < (hierarchy[minRole] ?? 99)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  };
}
