-- vulnerabilities.source に 'jvn' を追加するため、テーブルを再作成する
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
  source           TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','nvd','trivy','grype','jvn')),
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','fixed','accepted_risk','false_positive')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now', '+9 hours')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now', '+9 hours'))
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

-- JVN 同期ログ
CREATE TABLE IF NOT EXISTS jvn_sync_logs (
  id            TEXT PRIMARY KEY,
  sync_type     TEXT NOT NULL CHECK (sync_type IN ('full','incremental')),
  status        TEXT NOT NULL CHECK (status IN ('running','completed','failed')),
  started_at    TEXT NOT NULL DEFAULT (datetime('now', '+9 hours')),
  completed_at  TEXT,
  total_fetched INTEGER NOT NULL DEFAULT 0,
  total_created INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);
