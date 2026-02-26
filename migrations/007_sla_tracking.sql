-- SLA ポリシーテーブル: 重大度別の対応期限
CREATE TABLE IF NOT EXISTS sla_policies (
  severity TEXT PRIMARY KEY CHECK (severity IN ('critical', 'high', 'medium', 'low', 'informational')),
  response_days INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- デフォルトSLAポリシーを挿入
INSERT INTO sla_policies (severity, response_days) VALUES
  ('critical', 7),
  ('high', 30),
  ('medium', 90),
  ('low', 180),
  ('informational', 365);

-- asset_vulnerabilities テーブルに SLA 関連カラムを追加
ALTER TABLE asset_vulnerabilities ADD COLUMN sla_deadline TEXT;
ALTER TABLE asset_vulnerabilities ADD COLUMN sla_breached INTEGER DEFAULT 0 CHECK (sla_breached IN (0, 1));

-- SLA期限を計算するトリガーは SQLite では複雑なので、アプリケーション側で実装
-- ただし、更新日時トリガーは追加
DROP TRIGGER IF EXISTS update_sla_policies_timestamp;
CREATE TRIGGER update_sla_policies_timestamp
AFTER UPDATE ON sla_policies
BEGIN
  UPDATE sla_policies SET updated_at = datetime('now') WHERE severity = NEW.severity;
END;
