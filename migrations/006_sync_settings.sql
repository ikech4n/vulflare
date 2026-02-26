CREATE TABLE IF NOT EXISTS sync_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO sync_settings (key, value) VALUES
  ('keywords',       '[]'),
  ('full_sync_days', '365');
