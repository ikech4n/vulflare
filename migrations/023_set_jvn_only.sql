-- データソース設定をJVNのみに変更

UPDATE sync_settings
SET value = json_object('nvd', 0, 'jvn', 1, 'kev', 0, 'osv', 0),
    updated_at = datetime('now', '+9 hours')
WHERE key = 'data_sources';
