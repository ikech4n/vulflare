-- JVN同期設定のリデザイン: 検知モード廃止 → 組み合わせ可能フィルター方式へ

-- 旧 detection_mode キーを削除（モード選択の廃止）
DELETE FROM sync_settings WHERE key = 'detection_mode';

-- 新しい設定キーを追加
-- vendor_selections: ベンダー/製品選択（MyJVN APIから取得したベンダー・製品のリスト）
INSERT OR IGNORE INTO sync_settings (key, value, updated_at)
VALUES ('vendor_selections', '[]', datetime('now', '+9 hours'));

-- cvss_min_score: CVSS最小スコア閾値（0=無効, 7.0=High以上のみ など）
INSERT OR IGNORE INTO sync_settings (key, value, updated_at)
VALUES ('cvss_min_score', '0', datetime('now', '+9 hours'));

-- MyJVN API のベンダーリストキャッシュテーブル
-- getVendorList API の結果を保存して高速検索を実現
CREATE TABLE IF NOT EXISTS jvn_vendor_cache (
  vid TEXT PRIMARY KEY,           -- MyJVN vendor ID
  vname TEXT NOT NULL,            -- ベンダー名（表示用）
  fetched_at TEXT NOT NULL DEFAULT (datetime('now', '+9 hours'))  -- キャッシュ取得日時
);

-- ベンダー名による検索用インデックス（大文字小文字を区別しない検索）
CREATE INDEX IF NOT EXISTS idx_jvn_vendor_cache_vname_lower
ON jvn_vendor_cache(LOWER(vname));

-- MyJVN API の製品リストキャッシュテーブル
-- getProductList API の結果を保存（ベンダーごとの製品一覧）
CREATE TABLE IF NOT EXISTS jvn_product_cache (
  pid TEXT PRIMARY KEY,           -- MyJVN product ID
  pname TEXT NOT NULL,            -- 製品名（表示用）
  cpe TEXT NOT NULL DEFAULT '',   -- CPE文字列（JVN APIクエリに使用）
  vendor_vid TEXT NOT NULL,       -- 所属ベンダーのvid
  fetched_at TEXT NOT NULL DEFAULT (datetime('now', '+9 hours')),
  -- [D1注意] D1はデフォルトでFOREIGN KEY制約が有効（PRAGMA foreign_keys=ON）。
  -- このFKが有効なため、jvn_product_cacheへのINSERT前に必ずjvn_vendor_cacheへの
  -- UPSERT（ON CONFLICT DO NOTHING等）を実行すること。
  -- 順序を守らないとFOREIGN KEY constraint failedエラー（D1_ERROR: 7500）が発生する。
  FOREIGN KEY (vendor_vid) REFERENCES jvn_vendor_cache(vid) ON DELETE CASCADE
);

-- ベンダーIDによる製品検索用インデックス
CREATE INDEX IF NOT EXISTS idx_jvn_product_cache_vendor
ON jvn_product_cache(vendor_vid);

-- 製品名による検索用インデックス
CREATE INDEX IF NOT EXISTS idx_jvn_product_cache_pname_lower
ON jvn_product_cache(LOWER(pname));

-- 注記:
-- 既存の jvn_vendors / jvn_products テーブル（migration 024）は
-- 同期済み脆弱性データからCPEを抽出した結果の蓄積用であり、
-- 新しい jvn_vendor_cache / jvn_product_cache テーブルは
-- MyJVN API のルックアップ結果のキャッシュ用。用途が異なるため両方維持。
