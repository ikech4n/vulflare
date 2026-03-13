-- Feature 1: 担当者・期限
ALTER TABLE vulnerabilities ADD COLUMN assignee_id TEXT;
ALTER TABLE vulnerabilities ADD COLUMN due_date TEXT;
CREATE INDEX idx_vuln_assignee ON vulnerabilities(assignee_id);
CREATE INDEX idx_vuln_due_date ON vulnerabilities(due_date);

-- Feature 2: 変更履歴
CREATE TABLE IF NOT EXISTS vulnerability_history (
  id TEXT PRIMARY KEY,
  vulnerability_id TEXT NOT NULL,
  user_id TEXT,
  user_name TEXT,
  action TEXT NOT NULL,
  changes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_vuln_history_vid ON vulnerability_history(vulnerability_id);
CREATE INDEX idx_vuln_history_created ON vulnerability_history(created_at);
