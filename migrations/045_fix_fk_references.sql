-- notification_rules と notification_logs のFK参照が
-- テーブルリネームにより notification_channels_old を指したまま
-- notification_channels_old が存在しないため INSERT が失敗する
-- → 両テーブルを正しいFK参照で再作成する

-- notification_rules を再作成
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
FROM notification_rules_old;

DROP TABLE notification_rules_old;

-- notification_logs を再作成
ALTER TABLE notification_logs RENAME TO notification_logs_old;

CREATE TABLE notification_logs (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (channel_id) REFERENCES notification_channels(id) ON DELETE CASCADE
);

INSERT INTO notification_logs (id, channel_id, event_type, payload, status, error_message, sent_at)
SELECT id, channel_id, event_type, payload, status, error_message, sent_at
FROM notification_logs_old;

DROP TABLE notification_logs_old;

-- インデックスを再作成
CREATE INDEX IF NOT EXISTS idx_notification_rules_channel ON notification_rules(channel_id);
CREATE INDEX IF NOT EXISTS idx_notification_rules_event ON notification_rules(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_channel ON notification_logs(channel_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at);

-- トリガーを再作成
DROP TRIGGER IF EXISTS update_notification_rules_timestamp;
CREATE TRIGGER update_notification_rules_timestamp
AFTER UPDATE ON notification_rules
BEGIN
  UPDATE notification_rules SET updated_at = datetime('now') WHERE id = NEW.id;
END;
