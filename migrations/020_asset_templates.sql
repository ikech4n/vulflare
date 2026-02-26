-- アセットテンプレート
CREATE TABLE IF NOT EXISTS asset_templates (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  description  TEXT,
  asset_type   TEXT NOT NULL CHECK (asset_type IN ('server','container','application','library','network_device')),
  environment  TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production','staging','development')),
  created_by   TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_asset_templates_asset_type ON asset_templates(asset_type);
CREATE INDEX idx_asset_templates_created_by ON asset_templates(created_by);

-- テンプレートに含まれるパッケージ
CREATE TABLE IF NOT EXISTS asset_template_packages (
  id          TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  ecosystem   TEXT NOT NULL,
  name        TEXT NOT NULL,
  version     TEXT NOT NULL,
  vendor      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (template_id) REFERENCES asset_templates(id) ON DELETE CASCADE,
  UNIQUE(template_id, ecosystem, name, version)
);

CREATE INDEX idx_asset_template_packages_template_id ON asset_template_packages(template_id);

-- テンプレートに含まれるEOL情報
CREATE TABLE IF NOT EXISTS asset_template_eol_links (
  id              TEXT PRIMARY KEY,
  template_id     TEXT NOT NULL,
  eol_cycle_id    TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (template_id) REFERENCES asset_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (eol_cycle_id) REFERENCES eol_cycles(id) ON DELETE CASCADE,
  UNIQUE(template_id, eol_cycle_id)
);

CREATE INDEX idx_asset_template_eol_links_template_id ON asset_template_eol_links(template_id);
