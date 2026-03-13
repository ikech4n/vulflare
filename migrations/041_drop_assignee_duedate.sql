DROP INDEX IF EXISTS idx_vuln_assignee;
DROP INDEX IF EXISTS idx_vuln_due_date;
ALTER TABLE vulnerabilities DROP COLUMN assignee_id;
ALTER TABLE vulnerabilities DROP COLUMN due_date;
