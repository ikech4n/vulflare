-- Web Scanner Tables

CREATE TABLE web_scan_targets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE web_scans (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL REFERENCES web_scan_targets(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  checks_run INTEGER NOT NULL DEFAULT 0,
  findings_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  error_message TEXT
);

CREATE TABLE web_scan_findings (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL REFERENCES web_scans(id) ON DELETE CASCADE,
  check_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'informational')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence TEXT,
  remediation TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(scan_id, check_id, title)
);

CREATE INDEX idx_web_scans_target ON web_scans(target_id);
CREATE INDEX idx_web_scans_status ON web_scans(status);
CREATE INDEX idx_web_scan_findings_scan ON web_scan_findings(scan_id);
CREATE INDEX idx_web_scan_findings_severity ON web_scan_findings(severity);
