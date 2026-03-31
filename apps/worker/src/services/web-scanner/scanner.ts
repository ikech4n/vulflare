import {
  webScanFindingRepo,
  webScanRepo,
  webScanTargetRepo,
} from "../../db/web-scanner-repository.ts";
import type { Env } from "../../types.ts";
import { checkCookieFlags } from "./checks/cookie-flags.ts";
import { checkCsrfProtection } from "./checks/csrf-protection.ts";
import { checkDirectoryListing } from "./checks/directory-listing.ts";
import { checkHttpsRedirect } from "./checks/https-redirect.ts";
import { checkInfoLeakage } from "./checks/info-leakage.ts";
import { checkOpenRedirect } from "./checks/open-redirect.ts";
import { checkOutdatedLibraries } from "./checks/outdated-libraries.ts";
import { checkPathTraversal } from "./checks/path-traversal.ts";
import { checkSecurityHeaders } from "./checks/security-headers.ts";
import { checkSensitiveFiles } from "./checks/sensitive-files.ts";
import type { CheckContext, CheckFn } from "./types.ts";

const CHECKS: CheckFn[] = [
  checkSecurityHeaders,
  checkSensitiveFiles,
  checkDirectoryListing,
  checkHttpsRedirect,
  checkCookieFlags,
  checkOpenRedirect,
  checkPathTraversal,
  checkOutdatedLibraries,
  checkCsrfProtection,
  checkInfoLeakage,
];

export async function runWebScan(
  env: Env,
  targetId: string,
): Promise<{ scanId: string; findingsCount: number }> {
  const scanId = crypto.randomUUID();

  const target = await webScanTargetRepo.findById(env.DB, targetId);
  if (!target) {
    throw new Error(`Target not found: ${targetId}`);
  }

  await webScanRepo.create(env.DB, { id: scanId, target_id: targetId });

  try {
    // 対象URLの基本フェッチ
    let baseResponse: Response;
    let baseHtml: string;
    try {
      baseResponse = await fetch(target.url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(10000),
      });
      baseHtml = await baseResponse.text();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await webScanRepo.fail(env.DB, scanId, `対象URLへのアクセスに失敗しました: ${msg}`);
      return { scanId, findingsCount: 0 };
    }

    const ctx: CheckContext = {
      targetUrl: target.url,
      baseResponse,
      baseHtml,
      env,
    };

    // 各チェックを順次実行（1つ失敗しても継続）
    const allFindings: Array<{
      id: string;
      scan_id: string;
      check_id: string;
      severity: string;
      title: string;
      description: string;
      evidence: string | null;
      remediation: string | null;
    }> = [];

    let checksRun = 0;

    for (const check of CHECKS) {
      try {
        const result = await check(ctx);
        checksRun++;
        for (const finding of result.findings) {
          allFindings.push({
            id: crypto.randomUUID(),
            scan_id: scanId,
            check_id: result.checkId,
            severity: finding.severity,
            title: finding.title,
            description: finding.description,
            evidence: finding.evidence,
            remediation: finding.remediation,
          });
        }
      } catch {
        // チェック単体のエラーは無視して継続
        checksRun++;
      }
    }

    // findings を一括保存
    await webScanFindingRepo.bulkInsert(env.DB, allFindings);

    // スキャン完了
    await webScanRepo.complete(env.DB, scanId, checksRun, allFindings.length);

    return { scanId, findingsCount: allFindings.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    await webScanRepo.fail(env.DB, scanId, msg);
    return { scanId, findingsCount: 0 };
  }
}
