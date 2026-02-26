-- Scanner import history
CREATE TABLE IF NOT EXISTS scan_imports (
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
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL,
  FOREIGN KEY (imported_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_scan_imports_asset_id ON scan_imports(asset_id);
CREATE INDEX idx_scan_imports_status ON scan_imports(status);
CREATE INDEX idx_scan_imports_scanner_type ON scan_imports(scanner_type);
CREATE INDEX idx_scan_imports_created_at ON scan_imports(created_at);
