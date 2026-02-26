-- NVD sync log
CREATE TABLE IF NOT EXISTS nvd_sync_logs (
  id            TEXT PRIMARY KEY,
  sync_type     TEXT NOT NULL CHECK (sync_type IN ('full','incremental')),
  status        TEXT NOT NULL CHECK (status IN ('running','completed','failed')),
  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at  TEXT,
  total_fetched INTEGER NOT NULL DEFAULT 0,
  total_created INTEGER NOT NULL DEFAULT 0,
  total_updated INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  last_modified TEXT
);

-- NVD sync configuration
CREATE TABLE IF NOT EXISTS nvd_sync_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO nvd_sync_config (key, value) VALUES
  ('last_sync_date', ''),
  ('sync_interval_hours', '24'),
  ('enabled', '1');
