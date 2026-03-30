import type { Env } from "../types.ts";

type DB = Env["DB"];

export interface DbAuditProject {
  id: string;
  name: string;
  ecosystem: string;
  lockfile_type: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DbAuditPackage {
  id: string;
  project_id: string;
  name: string;
  version: string;
  created_at: string;
}

export interface DbAuditScan {
  id: string;
  project_id: string;
  status: string;
  packages_count: number;
  vulns_found: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export interface DbAuditFinding {
  id: string;
  scan_id: string;
  package_id: string;
  vulnerability_id: string;
  fixed_version: string | null;
  created_at: string;
}

export interface DbAuditFindingWithDetails extends DbAuditFinding {
  package_name: string;
  package_version: string;
  cve_id: string | null;
  title: string;
  severity: string;
  cvss_v3_score: number | null;
}

export const auditProjectRepo = {
  create(db: DB, project: Omit<DbAuditProject, "created_at" | "updated_at">) {
    return db
      .prepare(
        "INSERT INTO audit_projects (id, name, ecosystem, lockfile_type, created_by) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(project.id, project.name, project.ecosystem, project.lockfile_type, project.created_by)
      .run();
  },

  findById(db: DB, id: string) {
    return db.prepare("SELECT * FROM audit_projects WHERE id = ?").bind(id).first<DbAuditProject>();
  },

  list(db: DB) {
    return db
      .prepare("SELECT * FROM audit_projects ORDER BY created_at DESC")
      .all<DbAuditProject>();
  },

  updateName(db: DB, id: string, name: string) {
    return db
      .prepare("UPDATE audit_projects SET name = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(name, id)
      .run();
  },

  delete(db: DB, id: string) {
    return db.prepare("DELETE FROM audit_projects WHERE id = ?").bind(id).run();
  },
};

export const auditPackageRepo = {
  replaceProjectPackages(
    db: DB,
    projectId: string,
    packages: Array<{ id: string; name: string; version: string }>,
  ) {
    const stmts = [
      db.prepare("DELETE FROM audit_packages WHERE project_id = ?").bind(projectId),
      ...packages.map((p) =>
        db
          .prepare(
            "INSERT OR IGNORE INTO audit_packages (id, project_id, name, version) VALUES (?, ?, ?, ?)",
          )
          .bind(p.id, projectId, p.name, p.version),
      ),
    ];
    return db.batch(stmts);
  },

  listByProject(db: DB, projectId: string) {
    return db
      .prepare("SELECT * FROM audit_packages WHERE project_id = ? ORDER BY name ASC")
      .bind(projectId)
      .all<DbAuditPackage>();
  },

  countByProject(db: DB, projectId: string) {
    return db
      .prepare("SELECT COUNT(*) as count FROM audit_packages WHERE project_id = ?")
      .bind(projectId)
      .first<{ count: number }>();
  },
};

export const auditScanRepo = {
  create(db: DB, scan: Pick<DbAuditScan, "id" | "project_id" | "packages_count">) {
    return db
      .prepare(
        "INSERT INTO audit_scans (id, project_id, status, packages_count) VALUES (?, ?, 'running', ?)",
      )
      .bind(scan.id, scan.project_id, scan.packages_count)
      .run();
  },

  complete(db: DB, id: string, vulnsFound: number) {
    return db
      .prepare(
        "UPDATE audit_scans SET status = 'completed', vulns_found = ?, completed_at = datetime('now') WHERE id = ?",
      )
      .bind(vulnsFound, id)
      .run();
  },

  fail(db: DB, id: string, errorMessage: string) {
    return db
      .prepare(
        "UPDATE audit_scans SET status = 'failed', completed_at = datetime('now'), error_message = ? WHERE id = ?",
      )
      .bind(errorMessage, id)
      .run();
  },

  findLatestByProject(db: DB, projectId: string) {
    return db
      .prepare("SELECT * FROM audit_scans WHERE project_id = ? ORDER BY started_at DESC LIMIT 1")
      .bind(projectId)
      .first<DbAuditScan>();
  },

  listByProject(db: DB, projectId: string) {
    return db
      .prepare("SELECT * FROM audit_scans WHERE project_id = ? ORDER BY started_at DESC")
      .bind(projectId)
      .all<DbAuditScan>();
  },
};

export const auditFindingRepo = {
  bulkInsert(
    db: DB,
    findings: Array<
      Pick<DbAuditFinding, "id" | "scan_id" | "package_id" | "vulnerability_id" | "fixed_version">
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
                "INSERT OR IGNORE INTO audit_findings (id, scan_id, package_id, vulnerability_id, fixed_version) VALUES (?, ?, ?, ?, ?)",
              )
              .bind(f.id, f.scan_id, f.package_id, f.vulnerability_id, f.fixed_version ?? null),
          ),
        ),
      );
    }
    return Promise.all(batches);
  },

  listByScan(db: DB, scanId: string, page = 1, limit = 20, severity?: string) {
    const offset = (page - 1) * limit;
    const severityFilter = severity ? "AND v.severity = ?" : "";
    const params = severity ? [scanId, severity, limit, offset] : [scanId, limit, offset];

    const countStmt = db
      .prepare(
        `SELECT COUNT(*) as total FROM audit_findings af
         JOIN vulnerabilities v ON af.vulnerability_id = v.id
         WHERE af.scan_id = ? ${severityFilter}`,
      )
      .bind(...(severity ? [scanId, severity] : [scanId]));

    const dataStmt = db
      .prepare(
        `SELECT af.*, ap.name as package_name, ap.version as package_version,
                v.cve_id, v.title, v.severity, v.cvss_v3_score
         FROM audit_findings af
         JOIN audit_packages ap ON af.package_id = ap.id
         JOIN vulnerabilities v ON af.vulnerability_id = v.id
         WHERE af.scan_id = ? ${severityFilter}
         ORDER BY v.cvss_v3_score DESC NULLS LAST
         LIMIT ? OFFSET ?`,
      )
      .bind(...params);

    return { countStmt, dataStmt };
  },

  listByProject(db: DB, projectId: string, page = 1, limit = 20, severity?: string) {
    const offset = (page - 1) * limit;
    const severityFilter = severity ? "AND v.severity = ?" : "";
    const params = severity ? [projectId, severity, limit, offset] : [projectId, limit, offset];

    const countStmt = db
      .prepare(
        `SELECT COUNT(*) as total FROM audit_findings af
         JOIN audit_scans s ON af.scan_id = s.id
         JOIN vulnerabilities v ON af.vulnerability_id = v.id
         WHERE s.project_id = ? AND s.id = (
           SELECT id FROM audit_scans WHERE project_id = ? AND status = 'completed'
           ORDER BY started_at DESC LIMIT 1
         ) ${severityFilter}`,
      )
      .bind(...(severity ? [projectId, projectId, severity] : [projectId, projectId]));

    const dataStmt = db
      .prepare(
        `SELECT af.*, ap.name as package_name, ap.version as package_version,
                v.cve_id, v.title, v.severity, v.cvss_v3_score
         FROM audit_findings af
         JOIN audit_scans s ON af.scan_id = s.id
         JOIN audit_packages ap ON af.package_id = ap.id
         JOIN vulnerabilities v ON af.vulnerability_id = v.id
         WHERE s.project_id = ? AND s.id = (
           SELECT id FROM audit_scans WHERE project_id = ? AND status = 'completed'
           ORDER BY started_at DESC LIMIT 1
         ) ${severityFilter}
         ORDER BY v.cvss_v3_score DESC NULLS LAST
         LIMIT ? OFFSET ?`,
      )
      .bind(...params);

    return { countStmt, dataStmt };
  },

  countByProject(db: DB, projectId: string) {
    return db
      .prepare(
        `SELECT COUNT(*) as count FROM audit_findings af
         JOIN audit_scans s ON af.scan_id = s.id
         WHERE s.project_id = ? AND s.id = (
           SELECT id FROM audit_scans WHERE project_id = ? AND status = 'completed'
           ORDER BY started_at DESC LIMIT 1
         )`,
      )
      .bind(projectId, projectId)
      .first<{ count: number }>();
  },
};
