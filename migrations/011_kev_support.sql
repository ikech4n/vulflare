-- vulnerabilities.source に 'kev' を追加し、KEV固有フィールドを追加するため、テーブルを再作成する
-- SQLite は CHECK 制約の ALTER COLUMN をサポートしないため、テーブル再作成が必要

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
  source           TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','nvd','trivy','grype','jvn','kev')),
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','fixed','accepted_risk','false_positive')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  -- KEV固有フィールド
  kev_due_date     TEXT,
  kev_required_action TEXT,
  kev_known_ransomware INTEGER DEFAULT 0
);

INSERT INTO vulnerabilities_new SELECT
  id, cve_id, title, description, severity, cvss_v3_score, cvss_v3_vector,
  cvss_v2_score, cvss_v2_vector, cwe_ids, affected_products, vuln_references,
  published_at, modified_at, source, status, created_at, updated_at,
  NULL, NULL, 0
FROM vulnerabilities;

DROP TABLE vulnerabilities;

ALTER TABLE vulnerabilities_new RENAME TO vulnerabilities;

CREATE UNIQUE INDEX idx_vulnerabilities_cve_id ON vulnerabilities(cve_id);
CREATE INDEX idx_vulnerabilities_severity ON vulnerabilities(severity);
CREATE INDEX idx_vulnerabilities_status ON vulnerabilities(status);
CREATE INDEX idx_vulnerabilities_source ON vulnerabilities(source);
CREATE INDEX idx_vulnerabilities_published_at ON vulnerabilities(published_at);
CREATE INDEX idx_vulnerabilities_kev_due_date ON vulnerabilities(kev_due_date);

PRAGMA foreign_keys = ON;

-- KEV 同期ログ
CREATE TABLE IF NOT EXISTS kev_sync_logs (
  id            TEXT PRIMARY KEY,
  sync_type     TEXT NOT NULL CHECK (sync_type IN ('full','incremental')),
  status        TEXT NOT NULL CHECK (status IN ('running','completed','failed')),
  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at  TEXT,
  total_fetched INTEGER NOT NULL DEFAULT 0,
  total_created INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  catalog_version TEXT
);
