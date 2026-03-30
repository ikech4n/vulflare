import type { OsvQueryBatchResponse, OsvVulnerability } from "@vulflare/shared/types";
import type { Severity } from "@vulflare/shared/types";

export interface OsvPackageInput {
  name: string;
  version: string;
  ecosystem: string;
}

const OSV_QUERYBATCH_URL = "https://api.osv.dev/v1/querybatch";
const BATCH_SIZE = 1000;

/**
 * OSV querybatch API を呼び出す（最大1000件/リクエスト）
 */
export async function queryOsvBatch(
  packages: OsvPackageInput[],
): Promise<Array<{ pkg: OsvPackageInput; vulns: OsvVulnerability[] }>> {
  const results: Array<{ pkg: OsvPackageInput; vulns: OsvVulnerability[] }> = [];

  // 1000件ずつ分割
  for (let i = 0; i < packages.length; i += BATCH_SIZE) {
    const chunk = packages.slice(i, i + BATCH_SIZE);
    const requestBody = {
      queries: chunk.map((p) => ({
        version: p.version,
        package: { name: p.name, ecosystem: p.ecosystem },
      })),
    };

    const res = await fetch(OSV_QUERYBATCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      throw new Error(`OSV API error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as OsvQueryBatchResponse;
    for (let j = 0; j < chunk.length; j++) {
      const vulns = data.results[j]?.vulns ?? [];
      const pkg = chunk[j];
      if (vulns.length > 0 && pkg) {
        results.push({ pkg, vulns });
      }
    }
  }

  return results;
}

/**
 * OSV vulnerability から CVE ID を抽出
 */
export function extractCveId(osvVuln: OsvVulnerability): string | null {
  if (osvVuln.id.startsWith("CVE-")) return osvVuln.id;
  const alias = osvVuln.aliases?.find((a) => a.startsWith("CVE-"));
  return alias ?? null;
}

/**
 * OSV severity score から Severity を算出
 */
export function mapOsvSeverity(osvVuln: OsvVulnerability): {
  severity: Severity;
  cvssV3Score: number | null;
  cvssV3Vector: string | null;
} {
  const cvssV3 = osvVuln.severity?.find((s) => s.type === "CVSS_V3");
  if (cvssV3) {
    // CVSS_V3 score は score フィールドに "CVSS:3.1/AV:..." 形式で入ることもある
    const scoreStr = cvssV3.score;
    let cvssScore: number | null = null;
    let cvssVector: string | null = null;

    if (scoreStr.startsWith("CVSS:")) {
      cvssVector = scoreStr;
      // ベクターからスコアは取れないためnull
    } else {
      cvssScore = parseFloat(scoreStr);
      if (Number.isNaN(cvssScore)) cvssScore = null;
    }

    const severity = scoreToSeverity(cvssScore);
    return { severity, cvssV3Score: cvssScore, cvssV3Vector: cvssVector };
  }

  return { severity: "medium", cvssV3Score: null, cvssV3Vector: null };
}

function scoreToSeverity(score: number | null): Severity {
  if (score === null) return "medium";
  if (score >= 9.0) return "critical";
  if (score >= 7.0) return "high";
  if (score >= 4.0) return "medium";
  if (score > 0) return "low";
  return "informational";
}

/**
 * OSV affected ranges から fixed バージョンを取得
 */
export function extractFixedVersion(osvVuln: OsvVulnerability, packageName: string): string | null {
  for (const affected of osvVuln.affected ?? []) {
    if (affected.package.name !== packageName) continue;
    for (const range of affected.ranges ?? []) {
      for (const event of range.events ?? []) {
        if (event.fixed) return event.fixed;
      }
    }
  }
  return null;
}

/**
 * OSV vulnerability を vulnerabilities テーブル挿入形式にマッピング
 */
export function mapOsvToVulnRecord(osvVuln: OsvVulnerability): {
  cveId: string | null;
  title: string;
  description: string | null;
  severity: Severity;
  cvssV3Score: number | null;
  cvssV3Vector: string | null;
  publishedAt: string | null;
  references: Array<{ url: string; name?: string; source?: string }>;
} {
  const cveId = extractCveId(osvVuln);
  const { severity, cvssV3Score, cvssV3Vector } = mapOsvSeverity(osvVuln);

  return {
    cveId,
    title: osvVuln.summary ?? osvVuln.id,
    description: osvVuln.details ?? null,
    severity,
    cvssV3Score,
    cvssV3Vector,
    publishedAt: osvVuln.published ?? null,
    references: (osvVuln.references ?? []).map((r) => ({ url: r.url, source: r.type })),
  };
}
