import type { CheckContext, CheckResult } from "../types.ts";

interface LibVulnInfo {
  minSafeVersion: string;
  severity: "critical" | "high" | "medium";
  cves: string[];
  description: string;
}

// 既知の脆弱バージョン情報（主要ライブラリの最低安全バージョン）
const LIBRARY_VULN_DB: Record<string, LibVulnInfo> = {
  jquery: {
    minSafeVersion: "3.5.0",
    severity: "high",
    cves: ["CVE-2019-11358", "CVE-2020-11022", "CVE-2020-11023"],
    description: "XSS 脆弱性が含まれるバージョンです。",
  },
  "jquery-ui": {
    minSafeVersion: "1.13.0",
    severity: "high",
    cves: ["CVE-2021-41182", "CVE-2021-41183", "CVE-2021-41184"],
    description: "XSS 脆弱性が含まれるバージョンです。",
  },
  bootstrap: {
    minSafeVersion: "4.3.1",
    severity: "medium",
    cves: ["CVE-2019-8331"],
    description: "XSS 脆弱性が含まれるバージョンです。",
  },
  "moment.js": {
    minSafeVersion: "2.29.4",
    severity: "high",
    cves: ["CVE-2022-24785", "CVE-2022-31129"],
    description: "パスインジェクション・ReDoS 脆弱性が含まれるバージョンです。",
  },
  moment: {
    minSafeVersion: "2.29.4",
    severity: "high",
    cves: ["CVE-2022-24785", "CVE-2022-31129"],
    description: "パスインジェクション・ReDoS 脆弱性が含まれるバージョンです。",
  },
  lodash: {
    minSafeVersion: "4.17.21",
    severity: "high",
    cves: ["CVE-2021-23337", "CVE-2020-28500"],
    description: "プロトタイプ汚染脆弱性が含まれるバージョンです。",
  },
  handlebars: {
    minSafeVersion: "4.7.7",
    severity: "critical",
    cves: ["CVE-2021-23369", "CVE-2021-23383"],
    description: "Remote Code Execution 脆弱性が含まれるバージョンです。",
  },
  angularjs: {
    minSafeVersion: "1.9.0",
    severity: "high",
    cves: ["CVE-2022-25844"],
    description: "ReDoS 脆弱性が含まれるバージョンです。AngularJS はサポート終了しています。",
  },
};

// バージョン比較: v1 < v2 なら true
function isVersionLessThan(v1: string, v2: string): boolean {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);
  const len = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < len; i++) {
    const a = parts1[i] ?? 0;
    const b = parts2[i] ?? 0;
    if (a < b) return true;
    if (a > b) return false;
  }
  return false;
}

// script src から ライブラリ名とバージョンを抽出
function extractLibraryInfo(src: string): { name: string; version: string } | null {
  // パターン: /jquery/3.2.1/jquery.min.js or jquery-3.2.1.min.js
  const patterns = [
    // CDN パス形式: /ajax/libs/jquery/3.2.1/
    /\/(?:ajax\/libs\/)?([a-z0-9._-]+)\/(\d+\.\d+[.\d]*)\//i,
    // ファイル名形式: jquery-3.2.1.min.js
    /([a-z0-9._-]+)[.-](\d+\.\d+[.\d]*)(?:\.min)?\.js$/i,
  ];

  for (const pattern of patterns) {
    const match = src.match(pattern);
    if (match) {
      const name = (match[1] ?? "").toLowerCase().replace(/_/g, "-");
      const version = match[2];
      if (version && /^\d+\.\d+/.test(version)) {
        return { name, version };
      }
    }
  }
  return null;
}

export async function checkOutdatedLibraries(ctx: CheckContext): Promise<CheckResult> {
  const findings = [];

  // <script src="..."> を抽出
  const scriptPattern = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const found = new Map<string, string>(); // name -> version

  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard while-loop pattern for regex exec
  while ((match = scriptPattern.exec(ctx.baseHtml)) !== null) {
    const src = match[1] ?? "";
    const info = extractLibraryInfo(src);
    if (info && !found.has(info.name)) {
      found.set(info.name, info.version);
    }
  }

  for (const [name, version] of found) {
    const vulnInfo = LIBRARY_VULN_DB[name];
    if (!vulnInfo) continue;

    if (isVersionLessThan(version, vulnInfo.minSafeVersion)) {
      findings.push({
        severity: vulnInfo.severity,
        title: `古い ${name} ライブラリを使用: v${version}`,
        description: `${name} v${version} は脆弱なバージョンです。${vulnInfo.description} 最低でも v${vulnInfo.minSafeVersion} 以上に更新してください。`,
        evidence: `検出バージョン: ${name}@${version} (安全な最低バージョン: ${vulnInfo.minSafeVersion})\nCVE: ${vulnInfo.cves.join(", ")}`,
        remediation: `${name} を v${vulnInfo.minSafeVersion} 以上の最新バージョンに更新してください。`,
      });
    }
  }

  return { checkId: "outdated-libraries", findings };
}
