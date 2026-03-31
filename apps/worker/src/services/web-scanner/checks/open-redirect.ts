import type { CheckContext, CheckResult } from "../types.ts";

const REDIRECT_PARAMS = [
  "url",
  "redirect",
  "next",
  "return",
  "return_to",
  "goto",
  "dest",
  "destination",
  "forward",
  "redir",
];
const EVIL_URL = "https://evil.example.com/phishing";

export async function checkOpenRedirect(ctx: CheckContext): Promise<CheckResult> {
  const findings = [];
  const baseUrl = new URL(ctx.targetUrl);

  for (const param of REDIRECT_PARAMS) {
    try {
      const testUrl = new URL(ctx.targetUrl);
      testUrl.searchParams.set(param, EVIL_URL);

      const res = await fetch(testUrl.toString(), {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
      });

      if (res.status < 300 || res.status >= 400) continue;

      const location = res.headers.get("location");
      if (!location) continue;

      // evil.example.com へリダイレクトされている場合
      if (location.includes("evil.example.com")) {
        findings.push({
          severity: "high" as const,
          title: `オープンリダイレクトの脆弱性: ?${param}= パラメータ`,
          description: `?${param}= パラメータに任意のURLを指定すると外部サイトにリダイレクトされます。フィッシング攻撃に悪用される可能性があります。`,
          evidence: `GET ${testUrl.toString()} → HTTP ${res.status} Location: ${location}`,
          remediation:
            "リダイレクト先URLを検証し、許可されたドメインのみにリダイレクトするようにしてください。または相対パスのみを受け付けるようにしてください。",
        });
        break; // 1つ見つかれば十分
      }

      // 同一ドメインへのリダイレクトは正常
      try {
        const redirectedUrl = new URL(location, ctx.targetUrl);
        if (redirectedUrl.hostname !== baseUrl.hostname) {
          findings.push({
            severity: "medium" as const,
            title: `外部ドメインへのリダイレクトの可能性: ?${param}= パラメータ`,
            description: `?${param}= パラメータによって異なるドメイン (${redirectedUrl.hostname}) へリダイレクトされます。`,
            evidence: `GET ${testUrl.toString()} → HTTP ${res.status} Location: ${location}`,
            remediation:
              "リダイレクト先URLのドメインを検証し、意図しない外部ドメインへのリダイレクトを防いでください。",
          });
          break;
        }
      } catch {
        // URL パース失敗は無視
      }
    } catch {
      // タイムアウト・ネットワークエラーは無視
    }
  }

  return { checkId: "open-redirect", findings };
}
