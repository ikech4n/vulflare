import type { Env } from '../types.ts';

type DB = Env['DB'];

// --- Asset Packages ---

export interface DbAssetPackage {
  id: string;
  asset_id: string;
  ecosystem: string;
  name: string;
  version: string;
  vendor: string | null;
  cpe_string: string | null;
  purl: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbVulnerabilityPackage {
  id: string;
  vulnerability_id: string;
  asset_package_id: string;
  match_type: string;
  match_source: string;
  matched_at: string;
}

/** CPE 2.3形式の文字列を生成 */
function buildCpeString(vendor: string, name: string, version: string): string {
  return `cpe:2.3:a:${vendor}:${name}:${version}:*:*:*:*:*:*:*`;
}

/** Package URL形式の文字列を生成 */
function buildPurl(ecosystem: string, name: string, version: string): string {
  const typeMap: Record<string, string> = {
    npm: 'npm',
    pypi: 'pypi',
    maven: 'maven',
    go: 'golang',
    nuget: 'nuget',
    rubygems: 'gem',
    'crates.io': 'cargo',
    packagist: 'composer',
  };
  const purlType = typeMap[ecosystem] ?? ecosystem;
  return `pkg:${purlType}/${name}@${version}`;
}

export const packageRepo = {
  listByAsset(db: DB, assetId: string) {
    return db
      .prepare('SELECT * FROM asset_packages WHERE asset_id = ? ORDER BY ecosystem, name')
      .bind(assetId)
      .all<DbAssetPackage>();
  },

  create(db: DB, pkg: Omit<DbAssetPackage, 'created_at' | 'updated_at' | 'cpe_string' | 'purl'> & { cpe_string?: string | null; purl?: string | null }) {
    const cpeString = pkg.ecosystem === 'cpe' && pkg.vendor
      ? buildCpeString(pkg.vendor, pkg.name, pkg.version)
      : (pkg.cpe_string ?? null);
    const purl = pkg.ecosystem !== 'cpe'
      ? buildPurl(pkg.ecosystem, pkg.name, pkg.version)
      : (pkg.purl ?? null);

    return db
      .prepare(
        `INSERT INTO asset_packages (id, asset_id, ecosystem, name, version, vendor, cpe_string, purl)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(asset_id, ecosystem, name, version) DO UPDATE SET
           vendor = excluded.vendor,
           cpe_string = excluded.cpe_string,
           purl = excluded.purl,
           updated_at = datetime('now')`,
      )
      .bind(pkg.id, pkg.asset_id, pkg.ecosystem, pkg.name, pkg.version, pkg.vendor ?? null, cpeString, purl);
  },

  delete(db: DB, id: string) {
    return db.prepare('DELETE FROM asset_packages WHERE id = ?').bind(id).run();
  },

  findById(db: DB, id: string) {
    return db.prepare('SELECT * FROM asset_packages WHERE id = ?').bind(id).first<DbAssetPackage>();
  },

  /** 全アセット横断のユニークパッケージ一覧（同期用、cpe除外） */
  listDistinctPackages(db: DB) {
    return db
      .prepare(
        `SELECT DISTINCT ecosystem, name, version
         FROM asset_packages
         WHERE ecosystem != 'cpe'
         ORDER BY ecosystem, name`,
      )
      .all<{ ecosystem: string; name: string; version: string }>();
  },

  /** エコシステムと名前でパッケージを検索 */
  findByEcosystemAndName(db: DB, ecosystem: string, name: string) {
    return db
      .prepare('SELECT * FROM asset_packages WHERE ecosystem = ? AND name = ?')
      .bind(ecosystem, name)
      .all<DbAssetPackage>();
  },

  /** エコシステム別パッケージ一覧 */
  listByEcosystem(db: DB, ecosystem: string) {
    return db
      .prepare('SELECT * FROM asset_packages WHERE ecosystem = ? ORDER BY name')
      .bind(ecosystem)
      .all<DbAssetPackage>();
  },

  /** CPEパッケージのユニーク一覧（バージョンワイルドカード版） */
  listDistinctCpePackages(db: DB) {
    return db
      .prepare(
        `SELECT DISTINCT vendor, name
         FROM asset_packages
         WHERE ecosystem = 'cpe' AND vendor IS NOT NULL
         ORDER BY vendor, name`,
      )
      .all<{ vendor: string; name: string }>()
      .then((result) => {
        // バージョンをワイルドカードにしたCPE文字列を生成
        return {
          ...result,
          results: result.results?.map((pkg) => ({
            vendor: pkg.vendor,
            name: pkg.name,
            cpe_string: `cpe:2.3:a:${pkg.vendor}:${pkg.name}:*:*:*:*:*:*:*:*`,
          })),
        };
      });
  },
};

export const vulnPackageRepo = {
  create(db: DB, vp: Omit<DbVulnerabilityPackage, 'matched_at'>) {
    return db
      .prepare(
        `INSERT OR IGNORE INTO vulnerability_packages (id, vulnerability_id, asset_package_id, match_type, match_source)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(vp.id, vp.vulnerability_id, vp.asset_package_id, vp.match_type, vp.match_source);
  },

  findByVulnerability(db: DB, vulnerabilityId: string) {
    return db
      .prepare(
        `SELECT vp.*, ap.ecosystem, ap.name, ap.version
         FROM vulnerability_packages vp
         JOIN asset_packages ap ON vp.asset_package_id = ap.id
         WHERE vp.vulnerability_id = ?`,
      )
      .bind(vulnerabilityId)
      .all();
  },

  findByPackage(db: DB, assetPackageId: string) {
    return db
      .prepare(
        `SELECT vp.*, v.cve_id, v.title, v.severity
         FROM vulnerability_packages vp
         JOIN vulnerabilities v ON vp.vulnerability_id = v.id
         WHERE vp.asset_package_id = ?`,
      )
      .bind(assetPackageId)
      .all();
  },
};
