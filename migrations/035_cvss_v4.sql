-- CVSS v4.0 フィールドを追加
ALTER TABLE vulnerabilities ADD COLUMN cvss_v4_score REAL;
ALTER TABLE vulnerabilities ADD COLUMN cvss_v4_vector TEXT;
