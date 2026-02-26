-- データ保持期間設定を追加
INSERT OR IGNORE INTO sync_settings (key, value) VALUES ('retention_days', '0');
