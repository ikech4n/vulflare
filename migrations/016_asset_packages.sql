-- アセットに紐づくパッケージ/ソフトウェア
CREATE TABLE IF NOT EXISTS asset_packages (
  id         TEXT PRIMARY KEY,
  asset_id   TEXT NOT NULL,
  ecosystem  TEXT NOT NULL,  -- 'npm','pypi','maven','go','nuget','rubygems','crates.io','packagist','cpe'
  name       TEXT NOT NULL,
  version    TEXT NOT NULL,
  vendor     TEXT,           -- CPE用 (例: 'apache','oracle')
  cpe_string TEXT,           -- CPE 2.3形式
  purl       TEXT,           -- Package URL形式
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  UNIQUE(asset_id, ecosystem, name, version)
);

CREATE INDEX idx_asset_packages_asset_id ON asset_packages(asset_id);
CREATE INDEX idx_asset_packages_ecosystem ON asset_packages(ecosystem);
CREATE INDEX idx_asset_packages_name ON asset_packages(name);
CREATE INDEX idx_asset_packages_ecosystem_name ON asset_packages(ecosystem, name);
CREATE INDEX idx_asset_packages_vendor ON asset_packages(vendor);

-- 脆弱性-パッケージのマッチング記録
CREATE TABLE IF NOT EXISTS vulnerability_packages (
  id               TEXT PRIMARY KEY,
  vulnerability_id TEXT NOT NULL,
  asset_package_id TEXT NOT NULL,
  match_type       TEXT NOT NULL DEFAULT 'exact',   -- 'exact','range','cpe'
  match_source     TEXT NOT NULL,                   -- 'osv','nvd','jvn'
  matched_at       TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (vulnerability_id) REFERENCES vulnerabilities(id) ON DELETE CASCADE,
  FOREIGN KEY (asset_package_id) REFERENCES asset_packages(id) ON DELETE CASCADE,
  UNIQUE(vulnerability_id, asset_package_id)
);

CREATE INDEX idx_vulnerability_packages_vuln_id ON vulnerability_packages(vulnerability_id);
CREATE INDEX idx_vulnerability_packages_pkg_id ON vulnerability_packages(asset_package_id);

-- OSV同期ログ
CREATE TABLE IF NOT EXISTS osv_sync_logs (
  id               TEXT PRIMARY KEY,
  sync_type        TEXT NOT NULL CHECK (sync_type IN ('full','on_demand')),
  status           TEXT NOT NULL CHECK (status IN ('running','completed','failed','cancelled')),
  started_at       TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at     TEXT,
  packages_queried INTEGER NOT NULL DEFAULT 0,
  vulns_found      INTEGER NOT NULL DEFAULT 0,
  vulns_created    INTEGER NOT NULL DEFAULT 0,
  matches_created  INTEGER NOT NULL DEFAULT 0,
  error_message    TEXT
);
