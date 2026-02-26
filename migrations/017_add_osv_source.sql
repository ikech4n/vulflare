-- vulnerabilities テーブルの source に 'osv' を追加
PRAGMA foreign_keys = OFF;

CREATE TABLE vulnerabilities_new (
  id               TEXT PRIMARY KEY,
  cve_id           TEXT,
  title            TEXT NOT NULL,
  description      TEXT,
  severity         TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low','informational')),
  cvss_v3_score    REAL,
  cvss_v3_vector   TEXT,
  cvss_v2_score    REAL,
  cvss_v2_vector   TEXT,
  cwe_ids          TEXT NOT NULL DEFAULT '[]',
  affected_products TEXT NOT NULL DEFAULT '[]',
  vuln_references  TEXT NOT NULL DEFAULT '[]',
  published_at     TEXT,
  modified_at      TEXT,
  source           TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','nvd','trivy','grype','jvn','kev','euvd','osv')),
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','fixed','accepted_risk','false_positive')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  kev_due_date     TEXT,
  kev_required_action TEXT,
  kev_known_ransomware INTEGER DEFAULT 0
);

INSERT INTO vulnerabilities_new SELECT * FROM vulnerabilities;

DROP TABLE vulnerabilities;

ALTER TABLE vulnerabilities_new RENAME TO vulnerabilities;

CREATE UNIQUE INDEX idx_vulnerabilities_cve_id ON vulnerabilities(cve_id);
CREATE INDEX idx_vulnerabilities_severity ON vulnerabilities(severity);
CREATE INDEX idx_vulnerabilities_status ON vulnerabilities(status);
CREATE INDEX idx_vulnerabilities_source ON vulnerabilities(source);
CREATE INDEX idx_vulnerabilities_published_at ON vulnerabilities(published_at);

PRAGMA foreign_keys = ON;

-- unified_sync_logs に OSV カラムを追加
ALTER TABLE unified_sync_logs ADD COLUMN osv_queried INTEGER DEFAULT 0;
ALTER TABLE unified_sync_logs ADD COLUMN osv_found INTEGER DEFAULT 0;
ALTER TABLE unified_sync_logs ADD COLUMN osv_created INTEGER DEFAULT 0;
ALTER TABLE unified_sync_logs ADD COLUMN osv_matched INTEGER DEFAULT 0;
ALTER TABLE unified_sync_logs ADD COLUMN osv_error TEXT;
