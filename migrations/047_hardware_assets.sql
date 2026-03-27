-- ハードウェア資産管理テーブル
CREATE TABLE IF NOT EXISTS hardware_assets (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  identifier TEXT,        -- サービスタグ等の汎用識別情報
  hostname TEXT,          -- ホスト名
  device_name TEXT,       -- 機器名
  support_expiry TEXT,    -- サポート期限 (YYYY-MM-DD)
  serial_number TEXT,     -- シリアル番号
  asset_number TEXT,      -- 資産番号
  ip_address TEXT,        -- IPアドレス
  mac_address TEXT,       -- MACアドレス
  vendor TEXT,            -- メーカー/ベンダー
  model_number TEXT,      -- モデル番号
  firmware_version TEXT,  -- ファームウェアバージョン
  warranty_expiry TEXT,   -- 保証期限 (YYYY-MM-DD)
  purchase_date TEXT,     -- 購入日 (YYYY-MM-DD)
  location TEXT,          -- 設置場所
  owner TEXT,             -- 担当者
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired', 'spare')),
  notes TEXT,             -- 備考
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES eol_products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hardware_assets_product_id ON hardware_assets(product_id);
CREATE INDEX IF NOT EXISTS idx_hardware_assets_status ON hardware_assets(status);
CREATE INDEX IF NOT EXISTS idx_hardware_assets_support_expiry ON hardware_assets(support_expiry);
