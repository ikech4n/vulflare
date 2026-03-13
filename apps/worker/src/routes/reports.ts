import { cvssScoreToSeverity } from "@vulflare/shared/utils";
import { Hono } from "hono";
import { userRepo, vulnHistoryRepo, vulnRepo } from "../db/repository.ts";
import { authMiddleware, requireRole } from "../middleware/auth.ts";
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
    "Assignee",
    "Due Date",
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
      escapeCsv(r.assignee_username as string | null),
      r.due_date ?? "",
    ];
    csvLines.push(line.join(","));
  }

  const csv = csvLines.join("\n");

  return c.text(csv, 200, {
    "Content-Type": "text/csv",
    "Content-Disposition": 'attachment; filename="vulnerabilities.csv"',
  });
});

// POST /api/reports/vulnerabilities/csv/import - CSV インポート
reportRoutes.post("/vulnerabilities/csv/import", requireRole("editor"), async (c) => {
  const mode = (c.req.query("mode") ?? "skip") as "skip" | "update";
  const csvText = await c.req.text();

  if (!csvText.trim()) {
    return c.json({ error: "Empty CSV" }, 400);
  }

  const lines = csvText.split("\n").map((l) => l.trimEnd());
  // ヘッダー行をスキップ（先頭行）
  const dataLines = lines.slice(1).filter((l) => l.trim().length > 0);

  if (dataLines.length > 1000) {
    return c.json({ error: "Too many rows (max 1000)" }, 400);
  }

  const userId = c.get("userId");
  const user = await userRepo.findById(c.env.DB, userId);

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const errors: Array<{ row: number; message: string }> = [];

  for (let i = 0; i < dataLines.length; i++) {
    const rowNum = i + 2; // 1-indexed, header is row 1
    const line = dataLines[i]!;

    try {
      const cols = parseCsvLine(line);
      // Expected columns: CVE ID, Title, Severity, Status, CVSS V3 Score, Description, Source, Published At, Created At, Assignee, Due Date
      if (cols.length < 2) {
        errors.push({ row: rowNum, message: "Insufficient columns" });
        continue;
      }

      const cveId = cols[0]?.trim() || null;
      const title = cols[1]?.trim() ?? "";
      const severity = cols[2]?.trim().toLowerCase() || "informational";
      const status = cols[3]?.trim().toLowerCase() || "new";
      const cvssV3ScoreRaw = cols[4]?.trim();
      const description = cols[5]?.trim() || null;
      const source = cols[6]?.trim().toLowerCase() || "manual";
      const publishedAt = cols[7]?.trim() || null;
      const dueDate = cols[10]?.trim() || null;

      if (!title) {
        errors.push({ row: rowNum, message: "Title is required" });
        continue;
      }

      const validSeverities = ["critical", "high", "medium", "low", "informational"];
      const finalSeverity = validSeverities.includes(severity)
        ? severity
        : cvssV3ScoreRaw
          ? cvssScoreToSeverity(Number(cvssV3ScoreRaw))
          : "informational";

      const validStatuses = ["new", "open", "fixed", "accepted_risk", "false_positive"];
      const finalStatus = validStatuses.includes(status) ? status : "new";

      const validSources = ["manual", "jvn"];
      const finalSource = validSources.includes(source) ? source : "manual";

      const cvssV3Score = cvssV3ScoreRaw ? Number(cvssV3ScoreRaw) : null;
      const finalPublishedAt =
        publishedAt && /^\d{4}-\d{2}-\d{2}/.test(publishedAt)
          ? new Date(publishedAt).toISOString()
          : null;

      // due_date バリデーション
      const finalDueDate = dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null;

      if (cveId) {
        const existing = await vulnRepo.findByCveId(c.env.DB, cveId);
        if (existing) {
          if (mode === "skip") {
            skipped++;
            continue;
          }
          // update mode
          await vulnRepo.update(c.env.DB, existing.id, {
            title,
            ...(description !== null && { description }),
            severity: finalSeverity,
            status: finalStatus,
            ...(cvssV3Score !== null && { cvss_v3_score: cvssV3Score }),
            ...(finalPublishedAt && { published_at: finalPublishedAt }),
            ...(finalDueDate !== null && { due_date: finalDueDate }),
          });
          await vulnHistoryRepo.create(c.env.DB, {
            id: crypto.randomUUID(),
            vulnerability_id: existing.id,
            user_id: userId,
            user_name: user?.username ?? null,
            action: "imported",
            changes: null,
          });
          updated++;
          continue;
        }
      }

      // 新規作成
      const newId = crypto.randomUUID();
      await vulnRepo.create(c.env.DB, {
        id: newId,
        cve_id: cveId,
        title,
        description,
        severity: finalSeverity,
        cvss_v3_score: cvssV3Score,
        cvss_v3_vector: null,
        cvss_v2_score: null,
        cvss_v2_vector: null,
        cvss_v4_score: null,
        cvss_v4_vector: null,
        cwe_ids: "[]",
        affected_products: "[]",
        vuln_references: "[]",
        published_at: finalPublishedAt,
        modified_at: null,
        source: finalSource,
        status: finalStatus,
        memo: null,
        assignee_id: null,
        due_date: finalDueDate,
      });
      await vulnHistoryRepo.create(c.env.DB, {
        id: crypto.randomUUID(),
        vulnerability_id: newId,
        user_id: userId,
        user_name: user?.username ?? null,
        action: "imported",
        changes: null,
      });
      imported++;
    } catch (err) {
      errors.push({ row: rowNum, message: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return c.json({ imported, updated, skipped, errors });
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

/**
 * CSV行をパース（引用符対応）
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}
