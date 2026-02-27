-- Migration 031: Remove email column from users table
--
-- scan_imports has a dangling FK reference to 'assets' (dropped in migration 026).
-- We must recreate scan_imports first to remove that broken FK before touching users.

-- Step 1: Recreate scan_imports without the dangling FK to assets
CREATE TABLE scan_imports_new (
  id            TEXT PRIMARY KEY,
  asset_id      TEXT,
  scanner_type  TEXT NOT NULL CHECK (scanner_type IN ('trivy','grype')),
  file_name     TEXT NOT NULL,
  r2_object_key TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  total_vulns   INTEGER NOT NULL DEFAULT 0,
  created_vulns INTEGER NOT NULL DEFAULT 0,
  updated_vulns INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  imported_by   TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at  TEXT,
  FOREIGN KEY (imported_by) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO scan_imports_new SELECT * FROM scan_imports;
DROP TABLE scan_imports;
ALTER TABLE scan_imports_new RENAME TO scan_imports;

CREATE INDEX IF NOT EXISTS idx_scan_imports_asset_id ON scan_imports(asset_id);
CREATE INDEX IF NOT EXISTS idx_scan_imports_status ON scan_imports(status);
CREATE INDEX IF NOT EXISTS idx_scan_imports_scanner_type ON scan_imports(scanner_type);
CREATE INDEX IF NOT EXISTS idx_scan_imports_created_at ON scan_imports(created_at);

-- Step 2: Recreate users without email
CREATE TABLE users_new (
  id            TEXT PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'viewer',
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO users_new (id, username, password_hash, role, is_active, created_at, updated_at)
SELECT id, username, password_hash, role, is_active, created_at, updated_at
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE UNIQUE INDEX idx_users_username ON users(username);
