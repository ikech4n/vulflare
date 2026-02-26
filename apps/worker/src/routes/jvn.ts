import { Hono } from 'hono';
import type { Env, JwtVariables } from '../types.ts';
import { authMiddleware, requireRole } from '../middleware/auth.ts';
import { handleJvnSync } from '../scheduled/jvn-sync.ts';

export const jvnRoutes = new Hono<{ Bindings: Env; Variables: JwtVariables }>();

jvnRoutes.use('/*', authMiddleware);

// GET /api/jvn/sync/status
jvnRoutes.get('/sync/status', async (c) => {
  const lastSyncDate = await c.env.KV_CACHE.get('jvn:last_sync_date');
  const latest = await c.env.DB
    .prepare('SELECT * FROM jvn_sync_logs ORDER BY started_at DESC LIMIT 1')
    .first<Record<string, unknown>>();

  return c.json({ lastSyncDate, latestLog: latest });
});

// POST /api/jvn/sync/trigger (admin only)
jvnRoutes.post('/sync/trigger', requireRole('admin'), async (c) => {
  c.executionCtx.waitUntil(handleJvnSync(c.env));
  return c.json({ message: 'JVN sync triggered' }, 202);
});

// GET /api/jvn/vuln/:jvnId - JVNDB ID または CVE ID で検索
jvnRoutes.get('/vuln/:jvnId', async (c) => {
  const jvnId = c.req.param('jvnId');

  const cached = await c.env.DB
    .prepare('SELECT * FROM vulnerabilities WHERE cve_id = ? AND source = ?')
    .bind(jvnId, 'jvn')
    .first<Record<string, unknown>>();

  if (cached) {
    return c.json({ source: 'cache', data: cached });
  }

  return c.json({ error: 'JVN entry not found' }, 404);
});
