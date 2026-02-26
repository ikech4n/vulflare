-- 通知チャネルテーブル: Webhook/Email設定
CREATE TABLE IF NOT EXISTS notification_channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('webhook', 'email')),
  config TEXT NOT NULL, -- JSON: { url, headers } for webhook or { recipients } for email
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 通知ルールテーブル: イベント→チャネルマッピング
CREATE TABLE IF NOT EXISTS notification_rules (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'vulnerability_created',
    'vulnerability_updated',
    'vulnerability_critical',
    'sla_breach',
    'asset_created',
    'asset_updated'
  )),
  filter_config TEXT, -- JSON: 追加のフィルター条件（例: severity, assetId など）
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (channel_id) REFERENCES notification_channels(id) ON DELETE CASCADE
);

-- 通知ログテーブル: 送信履歴
CREATE TABLE IF NOT EXISTS notification_logs (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL, -- JSON: イベントの詳細
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (channel_id) REFERENCES notification_channels(id) ON DELETE CASCADE
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_notification_rules_channel ON notification_rules(channel_id);
CREATE INDEX IF NOT EXISTS idx_notification_rules_event ON notification_rules(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_channel ON notification_logs(channel_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at);

-- 更新日時トリガー
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
