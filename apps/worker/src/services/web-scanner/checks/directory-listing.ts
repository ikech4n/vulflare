import type { CheckContext, CheckResult } from "../types.ts";

const DIRECTORY_PATHS = ["/images/", "/img/", "/css/", "/js/", "/uploads/", "/files/", "/assets/"];

const LISTING_PATTERNS = [
  /<title>Index of\s/i,
  /Directory listing for\s/i,
  /\[To Parent Directory\]/i,
  /<h1>Index of\//i,
];

export async function checkDirectoryListing(ctx: CheckContext): Promise<CheckResult> {
  const findings = [];
  const baseUrl = ctx.targetUrl.replace(/\/$/, "");

  for (const path of DIRECTORY_PATHS) {
    try {
      const url = `${baseUrl}${path}`;
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(5000),
      });

      if (res.status !== 200) continue;

      const text = await res.text();
      const isListing = LISTING_PATTERNS.some((pattern) => pattern.test(text));

      if (!isListing) continue;

      findings.push({
        severity: "medium" as const,
        title: `ディレクトリリスティングが有効: ${path}`,
        description: `${path} でディレクトリのファイル一覧が表示されます。内部ファイル構造が攻撃者に公開されます。`,
        evidence: `HTTP ${res.status} ${url}`,
        remediation:
          "Webサーバーのディレクトリリスティングを無効にしてください。Apache: Options -Indexes、Nginx: autoindex off",
      });
    } catch {
      // タイムアウト・ネットワークエラーは無視
    }
  }

  return { checkId: "directory-listing", findings };
}
