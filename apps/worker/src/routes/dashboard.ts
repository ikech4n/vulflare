import { Hono } from 'hono';
import type { Env, JwtVariables } from '../types.ts';
import { authMiddleware } from '../middleware/auth.ts';
import { slaRepo } from '../db/sla-repository.ts';

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
      active: row.active_count,
      fixed: row.fixed_count,
      accepted_risk: row.accepted_risk_count,
      false_positive: row.false_positive_count,
    },
  }));

  return c.json({ days: selectedDays, data: trends });
});

// GET /api/dashboard/by-asset - アセット別脆弱性数
dashboardRoutes.get('/by-asset', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT
      a.id,
      a.name,
      a.environment,
      COUNT(av.vulnerability_id) as vulnerability_count,
      SUM(CASE WHEN v.severity = 'critical' THEN 1 ELSE 0 END) as critical_count,
      SUM(CASE WHEN v.severity = 'high' THEN 1 ELSE 0 END) as high_count,
      SUM(CASE WHEN v.severity = 'medium' THEN 1 ELSE 0 END) as medium_count,
      SUM(CASE WHEN v.severity = 'low' THEN 1 ELSE 0 END) as low_count
    FROM assets a
    LEFT JOIN asset_vulnerabilities av ON a.id = av.asset_id AND av.status = 'active'
    LEFT JOIN vulnerabilities v ON av.vulnerability_id = v.id
    GROUP BY a.id, a.name, a.environment
    HAVING vulnerability_count > 0
    ORDER BY vulnerability_count DESC
    LIMIT 20`
  ).all();

  const data = (result.results ?? []).map((row: Record<string, unknown>) => ({
    assetId: row.id,
    assetName: row.name,
    environment: row.environment,
    total: row.vulnerability_count,
    bySeverity: {
      critical: row.critical_count,
      high: row.high_count,
      medium: row.medium_count,
      low: row.low_count,
    },
  }));

  return c.json(data);
});

// GET /api/dashboard/risk-scores - アセット別リスクスコア（加重CVSS）
dashboardRoutes.get('/risk-scores', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT
      a.id,
      a.name,
      a.environment,
      COUNT(av.vulnerability_id) as vulnerability_count,
      AVG(COALESCE(v.cvss_v3_score, 0)) as avg_cvss,
      MAX(COALESCE(v.cvss_v3_score, 0)) as max_cvss,
      SUM(CASE WHEN v.severity = 'critical' THEN 10 ELSE 0 END) as critical_weight,
      SUM(CASE WHEN v.severity = 'high' THEN 7 ELSE 0 END) as high_weight,
      SUM(CASE WHEN v.severity = 'medium' THEN 4 ELSE 0 END) as medium_weight,
      SUM(CASE WHEN v.severity = 'low' THEN 2 ELSE 0 END) as low_weight
    FROM assets a
    LEFT JOIN asset_vulnerabilities av ON a.id = av.asset_id AND av.status = 'active'
    LEFT JOIN vulnerabilities v ON av.vulnerability_id = v.id
    GROUP BY a.id, a.name, a.environment
    HAVING vulnerability_count > 0
    ORDER BY (critical_weight + high_weight + medium_weight + low_weight) DESC
    LIMIT 20`
  ).all();

  const data = (result.results ?? []).map((row: Record<string, unknown>) => {
    const criticalWeight = (row.critical_weight as number) ?? 0;
    const highWeight = (row.high_weight as number) ?? 0;
    const mediumWeight = (row.medium_weight as number) ?? 0;
    const lowWeight = (row.low_weight as number) ?? 0;
    const totalWeight = criticalWeight + highWeight + mediumWeight + lowWeight;

    return {
      assetId: row.id,
      assetName: row.name,
      environment: row.environment,
      vulnerabilityCount: row.vulnerability_count,
      avgCvss: Math.round((row.avg_cvss as number) * 10) / 10,
      maxCvss: row.max_cvss,
      riskScore: totalWeight,
    };
  });

  return c.json(data);
});

// GET /api/dashboard/sla-summary - SLA遵守状況
dashboardRoutes.get('/sla-summary', async (c) => {
  const summary = await slaRepo.getSummary(c.env.DB);

  const complianceRate =
    summary.total > 0
      ? Math.round((summary.within_sla / (summary.within_sla + summary.breached)) * 100)
      : 100;

  return c.json({
    total: summary.total,
    withinSla: summary.within_sla,
    breached: summary.breached,
    noSla: summary.no_sla,
    complianceRate,
  });
});
