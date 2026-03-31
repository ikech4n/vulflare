import type { CheckContext, CheckResult } from "../types.ts";

const TRAVERSAL_PAYLOADS = [
  "/../../../etc/passwd",
  "/..%2F..%2F..%2Fetc%2Fpasswd",
  "/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
  "/../../../windows/win.ini",
  "/..%5c..%5c..%5cwindows%5cwin.ini",
];

const UNIX_INDICATORS = [/root:x?:0:0/, /daemon:x?:1:1/, /\/bin\/bash/, /\/bin\/sh/];
const WINDOWS_INDICATORS = [/\[extensions\]/i, /\[mail\]/i, /mapi=1/i];

export async function checkPathTraversal(ctx: CheckContext): Promise<CheckResult> {
  const findings = [];
  const baseUrl = ctx.targetUrl.replace(/\/$/, "");

  for (const payload of TRAVERSAL_PAYLOADS) {
    try {
      const url = `${baseUrl}${payload}`;
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(5000),
      });

      if (res.status !== 200) continue;

      const text = await res.text();

      const isUnixLeak = UNIX_INDICATORS.some((p) => p.test(text));
      const isWindowsLeak = WINDOWS_INDICATORS.some((p) => p.test(text));

      if (!isUnixLeak && !isWindowsLeak) continue;

      const targetFile = payload.includes("passwd") ? "/etc/passwd" : "Windows設定ファイル";

      findings.push({
        severity: "critical" as const,
        title: `パストラバーサル脆弱性: ${targetFile} が読み取り可能`,
        description: `パストラバーサル攻撃によりサーバーの ${targetFile} が読み取れる状態です。サーバーのユーザー情報やシステム設定が漏洩しています。`,
        evidence: `GET ${url} → HTTP ${res.status} (ファイル内容を確認)`,
        remediation:
          "ユーザー入力のファイルパスを検証・サニタイズしてください。../../ などのトラバーサル文字を除去し、アクセスを許可するベースディレクトリ外へのアクセスを拒否してください。",
      });
      break; // 1つ見つかれば十分
    } catch {
      // タイムアウト・ネットワークエラーは無視
    }
  }

  return { checkId: "path-traversal", findings };
}
