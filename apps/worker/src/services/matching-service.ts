import type { Env } from '../types.ts';
import { packageRepo, vulnPackageRepo, type DbAssetPackage } from '../db/package-repository.ts';
import { assetRepo } from '../db/repository.ts';

/**
 * 同期時マッチング: 特定のエコシステム/名前に該当するasset_packagesを検索し、
 * vulnerability_packages + asset_vulnerabilities にマッチング記録を作成
 *
 * @param vulnCveId - 脆弱性のCVE ID（空文字の場合はスキップ）
 * @param matchSource - マッチングソース ('jvn')
 * @returns 作成されたマッチ記録数
 */
export async function createMatchRecords(
  env: Env,
  ecosystem: string,
  name: string,
  vulnCveId: string,
  matchSource: 'jvn',
): Promise<number> {
  let matchCount = 0;

  // 該当パッケージを検索
  const packagesResult = await packageRepo.findByEcosystemAndName(env.DB, ecosystem, name);
  const packages = packagesResult.results ?? [];
  if (packages.length === 0) return 0;

  // 脆弱性をCVE IDで検索
  if (!vulnCveId) return 0;
  const vuln = await env.DB.prepare('SELECT id, severity FROM vulnerabilities WHERE cve_id = ?')
    .bind(vulnCveId).first<{ id: string; severity: string }>();
  if (!vuln) return 0;

  const matchType = ecosystem === 'cpe' ? 'cpe' : 'exact';

  for (const pkg of packages) {
    // vulnerability_packages にマッチ記録を作成
    const vpStmt = vulnPackageRepo.create(env.DB, {
      id: crypto.randomUUID(),
      vulnerability_id: vuln.id,
      asset_package_id: pkg.id,
      match_type: matchType,
      match_source: matchSource,
    });
    await vpStmt.run();

    // asset_vulnerabilities にも自動リンク
    const linkId = crypto.randomUUID();
    const priority = mapSeverityToPriority(vuln.severity);
    await assetRepo.linkVulnerability(env.DB, linkId, pkg.asset_id, vuln.id, priority);
    matchCount++;
  }

  return matchCount;
}

/**
 * パッケージ登録時のオンデマンドマッチング
 * CPEパッケージ → 既存vulnerabilitiesのaffected_productsをLIKE検索
 */
export async function matchPackageToVulnerabilities(
  env: Env,
  packages: DbAssetPackage[],
): Promise<number> {
  let totalMatches = 0;

  // CPEパッケージ → 既存vulnerabilitiesのaffected_productsをLIKE検索
  const cpePackages = packages.filter((p) => p.ecosystem === 'cpe');
  if (cpePackages.length > 0) {
    totalMatches += await matchViaCpeLookup(env, cpePackages);
  }

  return totalMatches;
}

/**
 * CPEパッケージに対する既存脆弱性のLIKE検索マッチング
 */
async function matchViaCpeLookup(
  env: Env,
  packages: DbAssetPackage[],
): Promise<number> {
  let matchCount = 0;

  for (const pkg of packages) {
    if (!pkg.cpe_string) continue;

    // affected_productsにCPE文字列を含む脆弱性を検索
    const vulns = await env.DB.prepare(
      `SELECT id, severity FROM vulnerabilities WHERE affected_products LIKE ?`,
    ).bind(`%${pkg.vendor ?? pkg.name}%`).all<{ id: string; severity: string }>();

    for (const vuln of vulns.results ?? []) {
      // vulnerability_packages にマッチ記録を作成
      const vpStmt = vulnPackageRepo.create(env.DB, {
        id: crypto.randomUUID(),
        vulnerability_id: vuln.id,
        asset_package_id: pkg.id,
        match_type: 'cpe',
        match_source: 'jvn',
      });
      await vpStmt.run();

      // asset_vulnerabilities にも自動リンク
      const linkId = crypto.randomUUID();
      const priority = mapSeverityToPriority(vuln.severity);
      await assetRepo.linkVulnerability(env.DB, linkId, pkg.asset_id, vuln.id, priority);
      matchCount++;
    }
  }

  return matchCount;
}

function mapSeverityToPriority(severity: string): string {
  switch (severity) {
    case 'critical': return 'critical';
    case 'high': return 'high';
    case 'medium': return 'medium';
    default: return 'low';
  }
}
