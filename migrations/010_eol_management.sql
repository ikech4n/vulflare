-- EOL管理機能のテーブル定義

-- プロダクトマスタ
CREATE TABLE IF NOT EXISTS eol_products (
  id TEXT PRIMARY KEY,
  product_name TEXT NOT NULL UNIQUE, -- endoflife.date slug (例: "ubuntu")
  display_name TEXT NOT NULL, -- 表示名 (例: "Ubuntu")
  category TEXT NOT NULL, -- 'os' / 'runtime' / 'middleware' / 'framework' / 'library' / 'cloud_service' / 'hardware'
  eol_api_id TEXT, -- endoflife.date上のID（NULLなら手動管理）
  vendor TEXT, -- ベンダー名
  link TEXT, -- 公式URL
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- バージョンサイクル
CREATE TABLE IF NOT EXISTS eol_cycles (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  cycle TEXT NOT NULL, -- バージョン (例: "22.04", "20")
  codename TEXT, -- コードネーム
  release_date TEXT, -- リリース日
  eol_date TEXT, -- EOL日（NULL=未定）
  support_date TEXT, -- アクティブサポート終了日
  extended_support_date TEXT, -- 延長サポート終了日
  lts INTEGER DEFAULT 0, -- LTS版か (0/1)
  lts_date TEXT, -- LTS開始日
  latest_version TEXT, -- 最新パッチバージョン
  latest_release_date TEXT, -- 最新パッチリリース日
  is_eol INTEGER DEFAULT 0, -- 現在EOLか (同期時に計算)
  source TEXT NOT NULL DEFAULT 'manual', -- 'endoflife_date' / 'manual'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES eol_products(id) ON DELETE CASCADE,
  UNIQUE(product_id, cycle)
);

-- アセットとEOLサイクルの紐付け
CREATE TABLE IF NOT EXISTS asset_eol_links (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  eol_cycle_id TEXT NOT NULL,
  installed_version TEXT, -- 実際のバージョン (例: "22.04.3")
  notes TEXT, -- メモ
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  FOREIGN KEY (eol_cycle_id) REFERENCES eol_cycles(id) ON DELETE CASCADE,
  UNIQUE(asset_id, eol_cycle_id)
);

-- 同期ログ
CREATE TABLE IF NOT EXISTS eol_sync_logs (
  id TEXT PRIMARY KEY,
  product_name TEXT NOT NULL, -- 同期対象
  status TEXT NOT NULL DEFAULT 'running', -- 'running' / 'completed' / 'failed'
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  cycles_synced INTEGER DEFAULT 0, -- 同期件数
  error_message TEXT
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_eol_products_category ON eol_products(category);
CREATE INDEX IF NOT EXISTS idx_eol_products_eol_api_id ON eol_products(eol_api_id);
CREATE INDEX IF NOT EXISTS idx_eol_cycles_product_id ON eol_cycles(product_id);
CREATE INDEX IF NOT EXISTS idx_eol_cycles_is_eol ON eol_cycles(is_eol);
CREATE INDEX IF NOT EXISTS idx_eol_cycles_eol_date ON eol_cycles(eol_date);
CREATE INDEX IF NOT EXISTS idx_asset_eol_links_asset_id ON asset_eol_links(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_eol_links_eol_cycle_id ON asset_eol_links(eol_cycle_id);
CREATE INDEX IF NOT EXISTS idx_eol_sync_logs_product_name ON eol_sync_logs(product_name);
CREATE INDEX IF NOT EXISTS idx_eol_sync_logs_status ON eol_sync_logs(status);
