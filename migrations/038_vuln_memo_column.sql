-- vulnerabilities テーブルにメモカラムを追加
ALTER TABLE vulnerabilities ADD COLUMN memo TEXT;

-- 不要になった別テーブルを削除
DROP TABLE IF EXISTS vulnerability_memos;
