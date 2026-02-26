export interface SlaPolicy {
  severity: string;
  response_days: number;
  created_at: string;
  updated_at: string;
}

export interface SlaBreach {
  asset_id: string;
  asset_name: string;
  vulnerability_id: string;
  vulnerability_title: string;
  severity: string;
  sla_deadline: string;
  days_overdue: number;
  priority: string;
}

export const slaRepo = {
  /**
   * 全SLAポリシーを取得
   */
  async listPolicies(db: D1Database): Promise<SlaPolicy[]> {
    const result = await db.prepare('SELECT * FROM sla_policies ORDER BY response_days ASC').all();
    return result.results as unknown as SlaPolicy[];
  },

  /**
   * 特定の重大度のSLAポリシーを取得
   */
  async findPolicy(db: D1Database, severity: string): Promise<SlaPolicy | null> {
    const result = await db
      .prepare('SELECT * FROM sla_policies WHERE severity = ?')
      .bind(severity)
      .first();
    return result as SlaPolicy | null;
  },

  /**
   * SLAポリシーを更新
   */
  async updatePolicy(db: D1Database, severity: string, responseDays: number): Promise<void> {
    await db
      .prepare('UPDATE sla_policies SET response_days = ? WHERE severity = ?')
      .bind(responseDays, severity)
      .run();
  },

  /**
   * SLA期限を計算
   */
  calculateDeadline(createdAt: string, responseDays: number): string {
    const created = new Date(createdAt);
    const deadline = new Date(created.getTime() + responseDays * 24 * 60 * 60 * 1000);
    return deadline.toISOString();
  },

  /**
   * SLA違反を検出
   */
  async findBreaches(db: D1Database): Promise<SlaBreach[]> {
    const now = new Date().toISOString();
    const result = await db
      .prepare(
        `SELECT
          av.asset_id,
          a.name as asset_name,
          av.vulnerability_id,
          v.title as vulnerability_title,
          v.severity,
          av.sla_deadline,
          av.priority,
          av.created_at
        FROM asset_vulnerabilities av
        JOIN assets a ON av.asset_id = a.id
        JOIN vulnerabilities v ON av.vulnerability_id = v.id
        WHERE av.status = 'active'
          AND av.sla_deadline IS NOT NULL
          AND av.sla_deadline < ?
          AND av.sla_breached = 0
        ORDER BY av.sla_deadline ASC`
      )
      .bind(now)
      .all();

    return (result.results as unknown[]).map((row: unknown) => {
      const r = row as Record<string, unknown>;
      const deadline = new Date(r.sla_deadline as string);
      const nowDate = new Date(now);
      const daysOverdue = Math.floor((nowDate.getTime() - deadline.getTime()) / (24 * 60 * 60 * 1000));

      return {
        asset_id: r.asset_id as string,
        asset_name: r.asset_name as string,
        vulnerability_id: r.vulnerability_id as string,
        vulnerability_title: r.vulnerability_title as string,
        severity: r.severity as string,
        sla_deadline: r.sla_deadline as string,
        days_overdue: daysOverdue,
        priority: r.priority as string,
      };
    });
  },

  /**
   * SLA違反をマーク
   */
  async markBreach(db: D1Database, assetId: string, vulnId: string): Promise<void> {
    await db
      .prepare(
        'UPDATE asset_vulnerabilities SET sla_breached = 1 WHERE asset_id = ? AND vulnerability_id = ?'
      )
      .bind(assetId, vulnId)
      .run();
  },

  /**
   * SLA遵守状況サマリー
   */
  async getSummary(db: D1Database): Promise<{
    total: number;
    within_sla: number;
    breached: number;
    no_sla: number;
  }> {
    const now = new Date().toISOString();
    const result = await db
      .prepare(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN sla_deadline IS NULL THEN 1 ELSE 0 END) as no_sla,
          SUM(CASE WHEN sla_deadline IS NOT NULL AND sla_deadline >= ? THEN 1 ELSE 0 END) as within_sla,
          SUM(CASE WHEN sla_deadline IS NOT NULL AND sla_deadline < ? THEN 1 ELSE 0 END) as breached
        FROM asset_vulnerabilities
        WHERE status = 'active'`
      )
      .bind(now, now)
      .first();

    return {
      total: (result?.total as number) ?? 0,
      within_sla: (result?.within_sla as number) ?? 0,
      breached: (result?.breached as number) ?? 0,
      no_sla: (result?.no_sla as number) ?? 0,
    };
  },
};
