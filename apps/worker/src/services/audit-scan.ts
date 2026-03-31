import { auditFindingRepo, auditPackageRepo, auditScanRepo } from "../db/audit-repository.ts";
import { vulnRepo } from "../db/repository.ts";
import type { Env } from "../types.ts";
import { dispatchNotification } from "./notifications.ts";
import { extractFixedVersion, mapOsvToVulnRecord, queryOsvBatch } from "./osv-api.ts";

/**
 * パッケージ監査スキャンを実行する
 */
export async function runPackageAuditScan(
  env: Env,
  projectId: string,
): Promise<{ scanId: string; vulnsFound: number }> {
  const scanId = crypto.randomUUID();

  // パッケージ一覧を取得
  const packagesResult = await auditPackageRepo.listByProject(env.DB, projectId);
  const packages = packagesResult.results;

  await auditScanRepo.create(env.DB, {
    id: scanId,
    project_id: projectId,
    packages_count: packages.length,
  });

  if (packages.length === 0) {
    await auditScanRepo.complete(env.DB, scanId, 0);
    return { scanId, vulnsFound: 0 };
  }

  try {
    // プロジェクトの ecosystem を取得
    const project = await env.DB.prepare("SELECT ecosystem FROM audit_projects WHERE id = ?")
      .bind(projectId)
      .first<{ ecosystem: string }>();

    const ecosystem = project?.ecosystem ?? "npm";

    // OSV querybatch API を呼び出し
    const osvInputs = packages.map((p) => ({
      name: p.name,
      version: p.version,
      ecosystem,
    }));

    const osvResults = await queryOsvBatch(osvInputs);

    // 検出結果を処理
    const findings: Array<{
      id: string;
      scan_id: string;
      package_id: string;
      vulnerability_id: string;
      fixed_version: string | null;
    }> = [];

    const criticalVulns: Array<{ cveId: string | null; title: string }> = [];

    for (const { pkg, vulns } of osvResults) {
      // 対応するパッケージのDBレコードを探す
      const dbPkg = packages.find((p) => p.name === pkg.name && p.version === pkg.version);
      if (!dbPkg) continue;

      for (const osvVuln of vulns) {
        const vulnRecord = mapOsvToVulnRecord(osvVuln);
        let vulnId: string;

        // CVE IDで既存の脆弱性を検索（JVNとの重複回避）
        if (vulnRecord.cveId) {
          const existing = await vulnRepo.findByCveId(env.DB, vulnRecord.cveId);
          if (existing) {
            vulnId = existing.id;
          } else {
            // 新規挿入 (source='osv')
            vulnId = crypto.randomUUID();
            await vulnRepo.create(env.DB, {
              id: vulnId,
              cve_id: vulnRecord.cveId,
              title: vulnRecord.title,
              description: vulnRecord.description,
              severity: vulnRecord.severity,
              cvss_v3_score: vulnRecord.cvssV3Score,
              cvss_v3_vector: vulnRecord.cvssV3Vector,
              cvss_v2_score: null,
              cvss_v2_vector: null,
              cvss_v4_score: null,
              cvss_v4_vector: null,
              cwe_ids: "[]",
              affected_products: "[]",
              vuln_references: JSON.stringify(vulnRecord.references),
              published_at: vulnRecord.publishedAt,
              modified_at: null,
              source: "osv",
              status: "new",
              memo: null,
            });
          }
        } else {
          // CVE IDなし → OSV ID で検索するか新規作成
          vulnId = crypto.randomUUID();
          await vulnRepo
            .create(env.DB, {
              id: vulnId,
              cve_id: null,
              title: vulnRecord.title,
              description: vulnRecord.description,
              severity: vulnRecord.severity,
              cvss_v3_score: vulnRecord.cvssV3Score,
              cvss_v3_vector: vulnRecord.cvssV3Vector,
              cvss_v2_score: null,
              cvss_v2_vector: null,
              cvss_v4_score: null,
              cvss_v4_vector: null,
              cwe_ids: "[]",
              affected_products: "[]",
              vuln_references: JSON.stringify(vulnRecord.references),
              published_at: vulnRecord.publishedAt,
              modified_at: null,
              source: "osv",
              status: "new",
              memo: null,
            })
            .catch(() => {
              // INSERT失敗（重複など）は無視
            });
        }

        const fixedVersion = extractFixedVersion(osvVuln, pkg.name);
        findings.push({
          id: crypto.randomUUID(),
          scan_id: scanId,
          package_id: dbPkg.id,
          vulnerability_id: vulnId,
          fixed_version: fixedVersion,
        });

        if (vulnRecord.severity === "critical") {
          criticalVulns.push({ cveId: vulnRecord.cveId, title: vulnRecord.title });
        }
      }
    }

    await auditFindingRepo.bulkInsert(env.DB, findings);
    await auditScanRepo.complete(env.DB, scanId, findings.length);

    // critical 脆弱性があれば通知
    if (criticalVulns.length > 0) {
      const projectRecord = await env.DB.prepare("SELECT name FROM audit_projects WHERE id = ?")
        .bind(projectId)
        .first<{ name: string }>();

      await dispatchNotification(env, "package_audit_critical", {
        projectId,
        projectName: projectRecord?.name ?? projectId,
        vulnsFound: findings.length,
        criticalCount: criticalVulns.length,
        criticalVulns: criticalVulns.slice(0, 5),
      });
    }

    return { scanId, vulnsFound: findings.length };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    await auditScanRepo.fail(env.DB, scanId, msg);
    throw error;
  }
}
