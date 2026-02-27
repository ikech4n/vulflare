-- アセット機能の完全削除
DROP TABLE IF EXISTS vulnerability_packages;
DROP TABLE IF EXISTS asset_packages;
DROP TABLE IF EXISTS asset_template_packages;
DROP TABLE IF EXISTS asset_template_eol_links;
DROP TABLE IF EXISTS asset_templates;
DROP TABLE IF EXISTS asset_vulnerabilities;
DROP TABLE IF EXISTS assets;

DROP INDEX IF EXISTS idx_assets_asset_type;
DROP INDEX IF EXISTS idx_assets_environment;
DROP INDEX IF EXISTS idx_asset_vuln_asset_id;
DROP INDEX IF EXISTS idx_asset_vuln_vuln_id;
DROP INDEX IF EXISTS idx_asset_vuln_status;
DROP INDEX IF EXISTS idx_asset_packages_asset_id;
DROP INDEX IF EXISTS idx_asset_packages_ecosystem;
DROP INDEX IF EXISTS idx_asset_packages_name;
DROP INDEX IF EXISTS idx_asset_packages_ecosystem_name;
DROP INDEX IF EXISTS idx_asset_packages_vendor;
DROP INDEX IF EXISTS idx_vulnerability_packages_vuln_id;
DROP INDEX IF EXISTS idx_vulnerability_packages_pkg_id;
DROP INDEX IF EXISTS idx_asset_templates_asset_type;
DROP INDEX IF EXISTS idx_asset_templates_created_by;
DROP INDEX IF EXISTS idx_asset_template_packages_template_id;
DROP INDEX IF EXISTS idx_asset_template_eol_links_template_id;
