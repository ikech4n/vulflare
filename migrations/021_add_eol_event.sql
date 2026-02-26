-- EOL期限接近イベントを通知ルールに追加

-- 既存のテーブルを一時的にリネーム
ALTER TABLE notification_rules RENAME TO notification_rules_old;

-- 新しいCHECK制約でテーブルを再作成
CREATE TABLE notification_rules (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'vulnerability_created',
    'vulnerability_updated',
    'vulnerability_critical',
    'sla_breach',
    'asset_created',
    'asset_updated',
    'eol_approaching'
  )),
  filter_config TEXT, -- JSON: 追加のフィルター条件（例: severity, assetId など）
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (channel_id) REFERENCES notification_channels(id) ON DELETE CASCADE
);

-- データを移行
INSERT INTO notification_rules (id, channel_id, event_type, filter_config, is_active, created_at, updated_at)
SELECT id, channel_id, event_type, filter_config, is_active, created_at, updated_at
FROM notification_rules_old;

-- 古いテーブルを削除
DROP TABLE notification_rules_old;

-- インデックスを再作成
CREATE INDEX idx_notification_rules_channel ON notification_rules(channel_id);
CREATE INDEX idx_notification_rules_event ON notification_rules(event_type);

-- トリガーを再作成
DROP TRIGGER IF EXISTS update_notification_rules_timestamp;
CREATE TRIGGER update_notification_rules_timestamp
AFTER UPDATE ON notification_rules
BEGIN
  UPDATE notification_rules SET updated_at = datetime('now') WHERE id = NEW.id;
END;
