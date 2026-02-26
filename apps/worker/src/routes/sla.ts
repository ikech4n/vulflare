import { Hono } from 'hono';
import type { Env, JwtVariables } from '../types.ts';
import { authMiddleware, requireRole } from '../middleware/auth.ts';
import { slaRepo } from '../db/sla-repository.ts';

export const slaRoutes = new Hono<{ Bindings: Env; Variables: JwtVariables }>();

slaRoutes.use('/*', authMiddleware);

// GET /api/sla/policies - SLAポリシー一覧
slaRoutes.get('/policies', async (c) => {
  const policies = await slaRepo.listPolicies(c.env.DB);
  return c.json(policies);
});

// PUT /api/sla/policies/:severity - SLAポリシー更新（admin限定）
slaRoutes.put('/policies/:severity', requireRole('admin'), async (c) => {
  const severity = c.req.param('severity');
  const body = await c.req.json<{ responseDays?: number }>();

  if (!body.responseDays || typeof body.responseDays !== 'number' || body.responseDays < 0) {
    return c.json({ error: 'responseDays must be a non-negative number' }, 400);
  }

  const validSeverities = ['critical', 'high', 'medium', 'low', 'informational'];
  if (!validSeverities.includes(severity)) {
    return c.json({ error: 'Invalid severity' }, 400);
  }

  await slaRepo.updatePolicy(c.env.DB, severity, body.responseDays);
  return c.json({ message: 'SLA policy updated' });
});

// GET /api/sla/breaches - SLA違反一覧
slaRoutes.get('/breaches', async (c) => {
  const breaches = await slaRepo.findBreaches(c.env.DB);
  return c.json(breaches);
});

// GET /api/sla/summary - SLA遵守状況サマリー
slaRoutes.get('/summary', async (c) => {
  const summary = await slaRepo.getSummary(c.env.DB);
  return c.json(summary);
});
