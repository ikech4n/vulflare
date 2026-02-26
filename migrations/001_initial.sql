-- Users
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_email ON users(email);

-- Refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  token_hash  TEXT UNIQUE NOT NULL,
  expires_at  TEXT NOT NULL,
  revoked     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);

-- Assets
CREATE TABLE IF NOT EXISTS assets (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  asset_type   TEXT NOT NULL CHECK (asset_type IN ('server','container','application','library','network_device')),
  description  TEXT,
  environment  TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production','staging','development')),
  owner        TEXT,
  tags         TEXT NOT NULL DEFAULT '[]',
  metadata     TEXT NOT NULL DEFAULT '{}',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_assets_asset_type ON assets(asset_type);
CREATE INDEX idx_assets_environment ON assets(environment);

-- Vulnerabilities
CREATE TABLE IF NOT EXISTS vulnerabilities (
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
  source           TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','nvd','trivy','grype')),
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','fixed','accepted_risk','false_positive')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_vulnerabilities_cve_id ON vulnerabilities(cve_id);
CREATE INDEX idx_vulnerabilities_severity ON vulnerabilities(severity);
CREATE INDEX idx_vulnerabilities_status ON vulnerabilities(status);
CREATE INDEX idx_vulnerabilities_source ON vulnerabilities(source);
CREATE INDEX idx_vulnerabilities_published_at ON vulnerabilities(published_at);

-- Asset <-> Vulnerability join table
CREATE TABLE IF NOT EXISTS asset_vulnerabilities (
  id               TEXT PRIMARY KEY,
  asset_id         TEXT NOT NULL,
  vulnerability_id TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','fixed','accepted_risk','false_positive')),
  priority         TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
  assigned_to      TEXT,
  due_date         TEXT,
  notes            TEXT,
  detected_at      TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at      TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  FOREIGN KEY (vulnerability_id) REFERENCES vulnerabilities(id) ON DELETE CASCADE,
  UNIQUE (asset_id, vulnerability_id)
);

CREATE INDEX idx_asset_vuln_asset_id ON asset_vulnerabilities(asset_id);
CREATE INDEX idx_asset_vuln_vuln_id ON asset_vulnerabilities(vulnerability_id);
CREATE INDEX idx_asset_vuln_status ON asset_vulnerabilities(status);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  action      TEXT NOT NULL,
  resource    TEXT NOT NULL,
  resource_id TEXT,
  details     TEXT NOT NULL DEFAULT '{}',
  ip_address  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
