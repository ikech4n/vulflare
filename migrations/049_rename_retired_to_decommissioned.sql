-- 'retired' → 'decommissioned' に変更（テーブル再作成でCHECK制約を更新）
ALTER TABLE hardware_assets RENAME TO hardware_assets_old;

CREATE TABLE hardware_assets (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  identifier TEXT,
  hostname TEXT,
  device_name TEXT,
  support_expiry TEXT,
  serial_number TEXT,
  asset_number TEXT,
  ip_address TEXT,
  mac_address TEXT,
  vendor TEXT,
  model_number TEXT,
  firmware_version TEXT,
  purchase_date TEXT,
  location TEXT,
  owner TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'decommissioned', 'spare')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES eol_products(id) ON DELETE CASCADE
);

INSERT INTO hardware_assets
  SELECT id, product_id, identifier, hostname, device_name, support_expiry,
         serial_number, asset_number, ip_address, mac_address, vendor, model_number,
         firmware_version, purchase_date, location, owner,
         CASE WHEN status = 'retired' THEN 'decommissioned' ELSE status END,
         notes, created_at, updated_at
  FROM hardware_assets_old;

DROP TABLE hardware_assets_old;

CREATE INDEX IF NOT EXISTS idx_hardware_assets_product_id ON hardware_assets(product_id);
CREATE INDEX IF NOT EXISTS idx_hardware_assets_status ON hardware_assets(status);
CREATE INDEX IF NOT EXISTS idx_hardware_assets_support_expiry ON hardware_assets(support_expiry);
