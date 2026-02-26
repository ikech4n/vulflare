-- sync_settings の data_sources を euvd から osv に更新
UPDATE sync_settings
SET value = json_set(
  json_remove(value, '$.euvd'),
  '$.osv',
  COALESCE(json_extract(value, '$.osv'), json_extract(value, '$.euvd'), 1)
),
updated_at = datetime('now')
WHERE key = 'data_sources' AND json_extract(value, '$.euvd') IS NOT NULL;
