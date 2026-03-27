-- notification_rules の event_type CHECK 制約に hw_support_approaching と hw_support_expired を追加

ALTER TABLE notification_rules RENAME TO notification_rules_old;

CREATE TABLE notification_rules (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'vulnerability_created',
    'vulnerability_updated',
    'vulnerability_critical',
    'eol_approaching',
    'eol_expired',
    'hw_support_approaching',
    'hw_support_expired'
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

CREATE INDEX IF NOT EXISTS idx_notification_rules_channel ON notification_rules(channel_id);
CREATE INDEX IF NOT EXISTS idx_notification_rules_event ON notification_rules(event_type);

DROP TRIGGER IF EXISTS update_notification_rules_timestamp;
CREATE TRIGGER update_notification_rules_timestamp
AFTER UPDATE ON notification_rules
BEGIN
  UPDATE notification_rules SET updated_at = datetime('now') WHERE id = NEW.id;
END;
