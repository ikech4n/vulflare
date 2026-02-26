-- sync_settingsにデータソース設定とベンダー/製品フィルターを追加

-- data_source_settingsの内容をsync_settingsに移行
INSERT OR IGNORE INTO sync_settings (key, value)
SELECT
  'data_sources',
  json_object(
    'nvd', COALESCE((SELECT enabled FROM data_source_settings WHERE source = 'nvd'), 1),
    'jvn', COALESCE((SELECT enabled FROM data_source_settings WHERE source = 'jvn'), 1),
    'kev', COALESCE((SELECT enabled FROM data_source_settings WHERE source = 'kev'), 1),
    'euvd', COALESCE((SELECT enabled FROM data_source_settings WHERE source = 'euvd'), 0)
  );

-- ベンダーと製品のフィルター（空配列で初期化）
INSERT OR IGNORE INTO sync_settings (key, value) VALUES ('vendors', '[]');
INSERT OR IGNORE INTO sync_settings (key, value) VALUES ('products', '[]');

-- data_source_settingsテーブルを削除（sync_settingsに統合したため）
DROP TABLE IF EXISTS data_source_settings;
