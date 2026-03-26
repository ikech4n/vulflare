-- eol_productsテーブルからvendorカラムを削除
CREATE TABLE eol_products_new (
  id TEXT PRIMARY KEY,
  product_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL,
  eol_api_id TEXT,
  link TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO eol_products_new SELECT id, product_name, display_name, category, eol_api_id, link, created_at, updated_at FROM eol_products;

DROP TABLE eol_products;
ALTER TABLE eol_products_new RENAME TO eol_products;
