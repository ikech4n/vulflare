-- ON CONFLICT(cve_id) が部分インデックス (WHERE cve_id IS NOT NULL) に対応しない問題を修正する
-- SQLite の upsert 構文は PRIMARY KEY か非部分 UNIQUE インデックスのみを conflict target として使用できる
-- NULL 同士は SQLite では等しくない (NULL != NULL) ため、WHERE 句なしでも複数の NULL 行が許可される

DROP INDEX IF EXISTS idx_vulnerabilities_cve_id;
CREATE UNIQUE INDEX idx_vulnerabilities_cve_id ON vulnerabilities(cve_id);
