-- webhook チャネルタイプを廃止し slack のみにする
-- 既存の webhook チャネルは削除（CASCADE により関連ルール・ログも削除）
DELETE FROM notification_channels WHERE type = 'webhook';

-- notification_channels を slack/email のみの CHECK 制約で再作成
ALTER TABLE notification_channels RENAME TO notification_channels_old;

CREATE TABLE notification_channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('slack', 'email')),
  config TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO notification_channels (id, name, type, config, is_active, created_at, updated_at)
SELECT id, name, type, config, is_active, created_at, updated_at
FROM notification_channels_old;

DROP TABLE notification_channels_old;

-- トリガーを再作成
DROP TRIGGER IF EXISTS update_notification_channels_timestamp;
CREATE TRIGGER update_notification_channels_timestamp
AFTER UPDATE ON notification_channels
BEGIN
  UPDATE notification_channels SET updated_at = datetime('now') WHERE id = NEW.id;
END;
