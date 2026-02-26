-- 統合同期ログテーブル
CREATE TABLE IF NOT EXISTS unified_sync_logs (
  id            TEXT PRIMARY KEY,
  status        TEXT NOT NULL CHECK (status IN ('running','completed','failed')),
  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at  TEXT,
  -- 各データソースの結果
  nvd_fetched   INTEGER DEFAULT 0,
  nvd_created   INTEGER DEFAULT 0,
  nvd_error     TEXT,
  jvn_fetched   INTEGER DEFAULT 0,
  jvn_created   INTEGER DEFAULT 0,
  jvn_error     TEXT,
  kev_fetched   INTEGER DEFAULT 0,
  kev_created   INTEGER DEFAULT 0,
  kev_error     TEXT,
  -- 全体のサマリー
  total_fetched INTEGER DEFAULT 0,
  total_created INTEGER DEFAULT 0
);

-- 既存の個別同期ログテーブルは保持（過去のログ参照用）
-- 新しい同期は unified_sync_logs を使用
