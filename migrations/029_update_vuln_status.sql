-- マイグレーション: 脆弱性ステータスの拡張
-- 変更内容:
--   - 新ステータス `new`（新規・デフォルト）を追加
--   - `active` を `open`（対応中）にリネーム
--   - 既存データの `active` → `open` マイグレーション
--   - vulnerability_snapshots に new_count / open_count カラム追加

-- ============================================================
-- vulnerabilities テーブルの再作成（CHECK制約変更のため）
-- ============================================================

-- 1. 新テーブルを作成
CREATE TABLE vulnerabilities_new (
  id               TEXT PRIMARY KEY,
  cve_id           TEXT,
  title            TEXT NOT NULL,
  description      TEXT,
  severity         TEXT NOT NULL DEFAULT 'informational' CHECK (severity IN ('critical','high','medium','low','informational')),
  cvss_v3_score    REAL,
  cvss_v3_vector   TEXT,
  cvss_v2_score    REAL,
  cvss_v2_vector   TEXT,
  cwe_ids          TEXT NOT NULL DEFAULT '[]',
  affected_products TEXT NOT NULL DEFAULT '[]',
  vuln_references  TEXT NOT NULL DEFAULT '[]',
  published_at     TEXT,
  modified_at      TEXT,
  source           TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','nvd','trivy','grype','jvn','kev','osv')),
  status           TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','open','fixed','accepted_risk','false_positive')),
  kev_due_date     TEXT,
  kev_required_action TEXT,
  kev_known_ransomware INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. 既存データを移行（active → open）
INSERT INTO vulnerabilities_new
SELECT
  id,
  cve_id,
  title,
  description,
  severity,
  cvss_v3_score,
  cvss_v3_vector,
  cvss_v2_score,
  cvss_v2_vector,
  cwe_ids,
  affected_products,
  vuln_references,
  published_at,
  modified_at,
  source,
  CASE WHEN status = 'active' THEN 'open' ELSE status END AS status,
  kev_due_date,
  kev_required_action,
  kev_known_ransomware,
  created_at,
  updated_at
FROM vulnerabilities;

-- 3. 旧テーブルを削除
DROP TABLE vulnerabilities;

-- 4. 新テーブルをリネーム
ALTER TABLE vulnerabilities_new RENAME TO vulnerabilities;

-- 5. インデックスを再作成
CREATE UNIQUE INDEX idx_vulnerabilities_cve_id ON vulnerabilities(cve_id);
CREATE INDEX idx_vulnerabilities_severity ON vulnerabilities(severity);
CREATE INDEX idx_vulnerabilities_status ON vulnerabilities(status);
CREATE INDEX idx_vulnerabilities_source ON vulnerabilities(source);
CREATE INDEX idx_vulnerabilities_published_at ON vulnerabilities(published_at);

-- ============================================================
-- vulnerability_snapshots に new_count / open_count カラム追加
-- ============================================================
ALTER TABLE vulnerability_snapshots ADD COLUMN new_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vulnerability_snapshots ADD COLUMN open_count INTEGER NOT NULL DEFAULT 0;

-- 既存スナップショットの active_count を open_count にコピー
UPDATE vulnerability_snapshots SET open_count = active_count WHERE active_count > 0;
