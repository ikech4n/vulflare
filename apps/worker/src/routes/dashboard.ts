import { Hono } from 'hono';
import type { Env, JwtVariables } from '../types.ts';
import { authMiddleware } from '../middleware/auth.ts';

export const dashboardRoutes = new Hono<{ Bindings: Env; Variables: JwtVariables }>();

dashboardRoutes.use('/*', authMiddleware);

// GET /api/dashboard/trends - 時系列トレンド（30/90日間）
dashboardRoutes.get('/trends', async (c) => {
  const days = Number(c.req.query('days') ?? '30');
  const validDays = [7, 30, 90];
  const selectedDays = validDays.includes(days) ? days : 30;

  // スナップショットデータを取得
  const result = await c.env.DB.prepare(
    `SELECT * FROM vulnerability_snapshots
     WHERE snapshot_date >= date('now', '-${selectedDays} days')
     ORDER BY snapshot_date ASC`
  ).all();

  const snapshots = result.results ?? [];

  // データがない場合は空の配列を返す
  if (snapshots.length === 0) {
    return c.json({
      days: selectedDays,
      data: [],
      message: 'No snapshot data available. Run scheduled sync to generate snapshots.',
    });
  }

  const trends = snapshots.map((row: Record<string, unknown>) => ({
    date: row.snapshot_date,
    total: row.total_count,
    bySeverity: {
      critical: row.critical_count,
      high: row.high_count,
      medium: row.medium_count,
      low: row.low_count,
      informational: row.informational_count,
    },
    byStatus: {
      new: row.new_count,
      open: row.open_count,
      fixed: row.fixed_count,
      accepted_risk: row.accepted_risk_count,
      false_positive: row.false_positive_count,
    },
  }));

  return c.json({ days: selectedDays, data: trends });
});
