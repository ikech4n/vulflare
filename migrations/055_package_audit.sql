-- Package Audit Tables

CREATE TABLE audit_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ecosystem TEXT NOT NULL,
  lockfile_type TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE audit_packages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES audit_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, name, version)
);

CREATE TABLE audit_scans (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES audit_projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running','completed','failed')),
  packages_count INTEGER NOT NULL DEFAULT 0,
  vulns_found INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  error_message TEXT
);

CREATE TABLE audit_findings (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL REFERENCES audit_scans(id) ON DELETE CASCADE,
  package_id TEXT NOT NULL REFERENCES audit_packages(id) ON DELETE CASCADE,
  vulnerability_id TEXT NOT NULL REFERENCES vulnerabilities(id) ON DELETE CASCADE,
  fixed_version TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(scan_id, package_id, vulnerability_id)
);

CREATE INDEX idx_audit_packages_project ON audit_packages(project_id);
CREATE INDEX idx_audit_scans_project ON audit_scans(project_id);
CREATE INDEX idx_audit_scans_status ON audit_scans(status);
CREATE INDEX idx_audit_findings_scan ON audit_findings(scan_id);
CREATE INDEX idx_audit_findings_package ON audit_findings(package_id);
CREATE INDEX idx_audit_findings_vuln ON audit_findings(vulnerability_id);
