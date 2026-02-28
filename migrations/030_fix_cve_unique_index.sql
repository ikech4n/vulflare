-- 029マイグレーションで cve_id インデックスが UNIQUE でなくなった問題を修正
-- ON CONFLICT(cve_id) を使用するために UNIQUE インデックスが必要

DROP INDEX IF EXISTS idx_vulnerabilities_cve_id;
CREATE UNIQUE INDEX idx_vulnerabilities_cve_id ON vulnerabilities(cve_id);

-- published_at インデックスも復元（元のスキーマに存在）
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_published_at ON vulnerabilities(published_at);
