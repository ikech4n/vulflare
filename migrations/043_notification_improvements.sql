-- 通知チャネルに slack タイプを追加
-- 通知ルールに eol_expired イベントタイプを追加

-- notification_channels: 'slack' を追加
ALTER TABLE notification_channels RENAME TO notification_channels_old;

CREATE TABLE notification_channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('webhook', 'email', 'slack')),
  config TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO notification_channels (id, name, type, config, is_active, created_at, updated_at)
SELECT id, name, type, config, is_active, created_at, updated_at
FROM notification_channels_old;

DROP TABLE notification_channels_old;

-- notification_rules: 'eol_expired' を追加
ALTER TABLE notification_rules RENAME TO notification_rules_old;

CREATE TABLE notification_rules (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'vulnerability_created',
    'vulnerability_updated',
    'vulnerability_critical',
    'eol_approaching',
    'eol_expired'
  )),
  filter_config TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (channel_id) REFERENCES notification_channels(id) ON DELETE CASCADE
);

INSERT INTO notification_rules (id, channel_id, event_type, filter_config, is_active, created_at, updated_at)
SELECT id, channel_id, event_type, filter_config, is_active, created_at, updated_at
FROM notification_rules_old
WHERE event_type IN (
  'vulnerability_created',
  'vulnerability_updated',
  'vulnerability_critical',
  'eol_approaching',
  'eol_expired'
);

DROP TABLE notification_rules_old;

-- インデックスを再作成
CREATE INDEX IF NOT EXISTS idx_notification_rules_channel ON notification_rules(channel_id);
CREATE INDEX IF NOT EXISTS idx_notification_rules_event ON notification_rules(event_type);

-- トリガーを再作成
DROP TRIGGER IF EXISTS update_notification_channels_timestamp;
CREATE TRIGGER update_notification_channels_timestamp
AFTER UPDATE ON notification_channels
BEGIN
  UPDATE notification_channels SET updated_at = datetime('now') WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS update_notification_rules_timestamp;
CREATE TRIGGER update_notification_rules_timestamp
AFTER UPDATE ON notification_rules
BEGIN
  UPDATE notification_rules SET updated_at = datetime('now') WHERE id = NEW.id;
END;
