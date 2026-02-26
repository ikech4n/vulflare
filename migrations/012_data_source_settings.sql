-- データソース有効/無効設定
CREATE TABLE IF NOT EXISTS data_source_settings (
  source     TEXT PRIMARY KEY CHECK (source IN ('nvd','jvn','kev','euvd')),
  enabled    INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- デフォルト値を挿入（NVD, JVN, KEVは有効、EUVDは無効）
INSERT OR IGNORE INTO data_source_settings (source, enabled) VALUES
  ('nvd', 1),
  ('jvn', 1),
  ('kev', 1),
  ('euvd', 0);
