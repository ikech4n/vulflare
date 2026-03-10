import type { Env } from '../types.ts';

/**
 * 現在の脆弱性統計をスナップショットとして保存する（日次）
 */
export async function createDailySnapshot(env: Env): Promise<void> {
  try {
    const id = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO vulnerability_snapshots (
        id, snapshot_date,
        total_count, critical_count, high_count, medium_count, low_count, informational_count,
        new_count, open_count, fixed_count, accepted_risk_count, false_positive_count
      )
      SELECT
        ? AS id,
        date('now', '+9 hours') AS snapshot_date,
        COUNT(*),
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END),
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END),
        SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END),
        SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END),
        SUM(CASE WHEN severity = 'informational' THEN 1 ELSE 0 END),
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END),
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END),
        SUM(CASE WHEN status = 'fixed' THEN 1 ELSE 0 END),
        SUM(CASE WHEN status = 'accepted_risk' THEN 1 ELSE 0 END),
        SUM(CASE WHEN status = 'false_positive' THEN 1 ELSE 0 END)
      FROM vulnerabilities
      ON CONFLICT(snapshot_date) DO UPDATE SET
        total_count = excluded.total_count,
        critical_count = excluded.critical_count,
        high_count = excluded.high_count,
        medium_count = excluded.medium_count,
        low_count = excluded.low_count,
        informational_count = excluded.informational_count,
        new_count = excluded.new_count,
        open_count = excluded.open_count,
        fixed_count = excluded.fixed_count,
        accepted_risk_count = excluded.accepted_risk_count,
        false_positive_count = excluded.false_positive_count
    `).bind(id).run();

    console.log('Daily snapshot created successfully');
  } catch (error) {
    console.error('Failed to create daily snapshot:', error);
  }
}
