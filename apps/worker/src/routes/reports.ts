import { Hono } from "hono";
import { vulnRepo } from "../db/repository.ts";
import { authMiddleware } from "../middleware/auth.ts";
import type { Env, JwtVariables } from "../types.ts";

export const reportRoutes = new Hono<{ Bindings: Env; Variables: JwtVariables }>();

reportRoutes.use("/*", authMiddleware);

// GET /api/reports/vulnerabilities/csv - 脆弱性CSV エクスポート
reportRoutes.get("/vulnerabilities/csv", async (c) => {
  const severity = c.req.query("severity");
  const status = c.req.query("status");
  const source = c.req.query("source");

  const { dataStmt } = vulnRepo.list(c.env.DB, {
    page: 1,
    limit: 10000, // 最大10000件
    ...(severity && { severity }),
    ...(status && { status }),
    ...(source && { source }),
  });

  const result = await dataStmt.all();
  const rows = result.results ?? [];

  // CSV ヘッダー
  const headers = [
    "CVE ID",
    "Title",
    "Severity",
    "Status",
    "CVSS V3 Score",
    "Description",
    "Source",
    "Published At",
    "Created At",
  ];

  // CSV 行
  const csvLines = [headers.join(",")];

  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const line = [
      escapeCsv(r.cve_id as string | null),
      escapeCsv(r.title as string),
      escapeCsv(r.severity as string),
      escapeCsv(r.status as string),
      r.cvss_v3_score ?? "",
      escapeCsv(r.description as string | null),
      escapeCsv(r.source as string),
      r.published_at ?? "",
      r.created_at ?? "",
    ];
    csvLines.push(line.join(","));
  }

  const csv = csvLines.join("\n");

  return c.text(csv, 200, {
    "Content-Type": "text/csv",
    "Content-Disposition": 'attachment; filename="vulnerabilities.csv"',
  });
});

// GET /api/reports/vulnerabilities/json - 脆弱性JSONエクスポート（PDF用）
reportRoutes.get("/vulnerabilities/json", async (c) => {
  const severity = c.req.query("severity");
  const status = c.req.query("status");
  const source = c.req.query("source");

  const { dataStmt, countStmt } = vulnRepo.list(c.env.DB, {
    page: 1,
    limit: 1000,
    ...(severity && { severity }),
    ...(status && { status }),
    ...(source && { source }),
  });

  const [countResult, dataResult] = await c.env.DB.batch([countStmt, dataStmt]);
  const total = (countResult?.results[0] as { total: number } | undefined)?.total ?? 0;

  const stats = await vulnRepo.stats(c.env.DB);

  return c.json({
    total,
    stats: {
      total: stats?.total ?? 0,
      bySeverity: {
        critical: stats?.critical ?? 0,
        high: stats?.high ?? 0,
        medium: stats?.medium ?? 0,
        low: stats?.low ?? 0,
        informational: stats?.informational ?? 0,
      },
      byStatus: {
        new: stats?.new ?? 0,
        open: stats?.open ?? 0,
        fixed: stats?.fixed ?? 0,
        accepted_risk: stats?.accepted_risk ?? 0,
        false_positive: stats?.false_positive ?? 0,
      },
    },
    vulnerabilities: dataResult?.results ?? [],
    generatedAt: new Date().toISOString(),
  });
});

// GET /api/reports/summary - サマリー統計
reportRoutes.get("/summary", async (c) => {
  const vulnStats = await vulnRepo.stats(c.env.DB);

  const recentVulns = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM vulnerabilities WHERE created_at > datetime('now', '-7 days')`,
  ).first<{ cnt: number }>();

  const criticalActive = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM vulnerabilities WHERE severity = 'critical' AND status IN ('new', 'open')`,
  ).first<{ cnt: number }>();

  return c.json({
    vulnerabilities: {
      total: vulnStats?.total ?? 0,
      bySeverity: {
        critical: vulnStats?.critical ?? 0,
        high: vulnStats?.high ?? 0,
        medium: vulnStats?.medium ?? 0,
        low: vulnStats?.low ?? 0,
        informational: vulnStats?.informational ?? 0,
      },
      byStatus: {
        new: vulnStats?.new ?? 0,
        open: vulnStats?.open ?? 0,
        fixed: vulnStats?.fixed ?? 0,
        accepted_risk: vulnStats?.accepted_risk ?? 0,
        false_positive: vulnStats?.false_positive ?? 0,
      },
      recentlyAdded: recentVulns?.cnt ?? 0,
      criticalActive: criticalActive?.cnt ?? 0,
    },
    generatedAt: new Date().toISOString(),
  });
});

/**
 * CSV値をエスケープ
 */
function escapeCsv(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
