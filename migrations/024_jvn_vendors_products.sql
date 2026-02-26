-- JVNから抽出したベンダーと製品のマスターテーブル

CREATE TABLE IF NOT EXISTS jvn_vendors (
  name TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+9 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+9 hours'))
);

CREATE TABLE IF NOT EXISTS jvn_products (
  name TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+9 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+9 hours'))
);

-- インデックス（検索用）
CREATE INDEX IF NOT EXISTS idx_jvn_vendors_name ON jvn_vendors(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_jvn_products_name ON jvn_products(name COLLATE NOCASE);
