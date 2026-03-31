import type { Env } from "../types.ts";

type DB = Env["DB"];

export interface DbWebScanTarget {
  id: string;
  name: string;
  url: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DbWebScan {
  id: string;
  target_id: string;
  status: string;
  checks_run: number;
  findings_count: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export interface DbWebScanFinding {
  id: string;
  scan_id: string;
  check_id: string;
  severity: string;
  title: string;
  description: string;
  evidence: string | null;
  remediation: string | null;
  created_at: string;
}

export const webScanTargetRepo = {
  create(db: DB, target: Omit<DbWebScanTarget, "created_at" | "updated_at">) {
    return db
      .prepare("INSERT INTO web_scan_targets (id, name, url, created_by) VALUES (?, ?, ?, ?)")
      .bind(target.id, target.name, target.url, target.created_by)
      .run();
  },

  findById(db: DB, id: string) {
    return db
      .prepare("SELECT * FROM web_scan_targets WHERE id = ?")
      .bind(id)
      .first<DbWebScanTarget>();
  },

  list(db: DB) {
    return db
      .prepare("SELECT * FROM web_scan_targets ORDER BY created_at DESC")
      .all<DbWebScanTarget>();
  },

  update(db: DB, id: string, fields: { name?: string; url?: string }) {
    const sets: string[] = ["updated_at = datetime('now')"];
    const values: unknown[] = [];
    if (fields.name !== undefined) {
      sets.push("name = ?");
      values.push(fields.name);
    }
    if (fields.url !== undefined) {
      sets.push("url = ?");
      values.push(fields.url);
    }
    values.push(id);
    return db
      .prepare(`UPDATE web_scan_targets SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  },

  delete(db: DB, id: string) {
    return db.prepare("DELETE FROM web_scan_targets WHERE id = ?").bind(id).run();
  },
};

export const webScanRepo = {
  create(db: DB, scan: Pick<DbWebScan, "id" | "target_id">) {
    return db
      .prepare("INSERT INTO web_scans (id, target_id, status) VALUES (?, ?, 'running')")
      .bind(scan.id, scan.target_id)
      .run();
  },

  complete(db: DB, id: string, checksRun: number, findingsCount: number) {
    return db
      .prepare(
        "UPDATE web_scans SET status = 'completed', checks_run = ?, findings_count = ?, completed_at = datetime('now') WHERE id = ?",
      )
      .bind(checksRun, findingsCount, id)
      .run();
  },

  fail(db: DB, id: string, errorMessage: string) {
    return db
      .prepare(
        "UPDATE web_scans SET status = 'failed', completed_at = datetime('now'), error_message = ? WHERE id = ?",
      )
      .bind(errorMessage, id)
      .run();
  },

  findLatestByTarget(db: DB, targetId: string) {
    return db
      .prepare("SELECT * FROM web_scans WHERE target_id = ? ORDER BY started_at DESC LIMIT 1")
      .bind(targetId)
      .first<DbWebScan>();
  },

  listByTarget(db: DB, targetId: string) {
    return db
      .prepare("SELECT * FROM web_scans WHERE target_id = ? ORDER BY started_at DESC")
      .bind(targetId)
      .all<DbWebScan>();
  },
};

export const webScanFindingRepo = {
  bulkInsert(
    db: DB,
    findings: Array<
      Pick<
        DbWebScanFinding,
        | "id"
        | "scan_id"
        | "check_id"
        | "severity"
        | "title"
        | "description"
        | "evidence"
        | "remediation"
      >
    >,
  ) {
    if (findings.length === 0) return Promise.resolve();

    const BATCH = 50;
    const batches: Promise<unknown>[] = [];
    for (let i = 0; i < findings.length; i += BATCH) {
      const chunk = findings.slice(i, i + BATCH);
      batches.push(
        db.batch(
          chunk.map((f) =>
            db
              .prepare(
                "INSERT OR IGNORE INTO web_scan_findings (id, scan_id, check_id, severity, title, description, evidence, remediation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
              )
              .bind(
                f.id,
                f.scan_id,
                f.check_id,
                f.severity,
                f.title,
                f.description,
                f.evidence ?? null,
                f.remediation ?? null,
              ),
          ),
        ),
      );
    }
    return Promise.all(batches);
  },

  listByScan(db: DB, scanId: string, page = 1, limit = 20, severity?: string, checkId?: string) {
    const offset = (page - 1) * limit;
    const conditions: string[] = ["scan_id = ?"];
    const countParams: unknown[] = [scanId];
    const dataParams: unknown[] = [scanId];

    if (severity) {
      conditions.push("severity = ?");
      countParams.push(severity);
      dataParams.push(severity);
    }
    if (checkId) {
      conditions.push("check_id = ?");
      countParams.push(checkId);
      dataParams.push(checkId);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    const countStmt = db
      .prepare(`SELECT COUNT(*) as total FROM web_scan_findings ${where}`)
      .bind(...countParams);

    const dataStmt = db
      .prepare(
        `SELECT * FROM web_scan_findings ${where}
         ORDER BY CASE severity
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
           ELSE 5
         END, created_at ASC
         LIMIT ? OFFSET ?`,
      )
      .bind(...dataParams, limit, offset);

    return { countStmt, dataStmt };
  },

  countByTarget(db: DB, targetId: string) {
    return db
      .prepare(
        `SELECT COUNT(*) as count FROM web_scan_findings wsf
         JOIN web_scans ws ON wsf.scan_id = ws.id
         WHERE ws.target_id = ? AND ws.id = (
           SELECT id FROM web_scans WHERE target_id = ? AND status = 'completed'
           ORDER BY started_at DESC LIMIT 1
         )`,
      )
      .bind(targetId, targetId)
      .first<{ count: number }>();
  },
};
