import type { CheckContext, CheckResult } from "../types.ts";

export async function checkHttpsRedirect(ctx: CheckContext): Promise<CheckResult> {
  const findings = [];
  const parsedUrl = new URL(ctx.targetUrl);

  if (parsedUrl.protocol === "http:") {
    findings.push({
      severity: "high" as const,
      title: "サイトが HTTP で動作しています",
      description:
        "サイトが暗号化されていない HTTP で動作しています。通信内容が盗聴・改ざんされる可能性があります。",
      evidence: `対象URL: ${ctx.targetUrl}`,
      remediation:
        "HTTPS を有効化し、すべての HTTP リクエストを HTTPS へリダイレクトしてください。",
    });
    return { checkId: "https-redirect", findings };
  }

  // HTTPS サイトの場合、HTTP版へのアクセスがHTTPSにリダイレクトされるか確認
  const httpUrl = ctx.targetUrl.replace(/^https:/, "http:");

  try {
    const res = await fetch(httpUrl, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });

    const location = res.headers.get("location");

    if (res.status >= 300 && res.status < 400 && location) {
      if (!location.startsWith("https://")) {
        findings.push({
          severity: "medium" as const,
          title: "HTTP から HTTPS へのリダイレクト先が HTTPS ではありません",
          description: `HTTP へのアクセスがリダイレクトされますが、リダイレクト先が HTTPS ではありません。`,
          evidence: `HTTP ${res.status} → Location: ${location}`,
          remediation:
            "HTTP から HTTPS へのリダイレクトを正しく設定してください。リダイレクト先は https:// で始まる必要があります。",
        });
      }
      // 正常にHTTPSへリダイレクトされている場合はfindingsなし
    } else if (res.status === 200) {
      findings.push({
        severity: "high" as const,
        title: "HTTP から HTTPS へのリダイレクトが設定されていません",
        description:
          "HTTP でアクセスしてもリダイレクトされません。ユーザーが誤って HTTP でアクセスした場合に通信が暗号化されません。",
        evidence: `HTTP ${res.status} (リダイレクトなし) ${httpUrl}`,
        remediation: "すべての HTTP リクエストを HTTPS へ 301 リダイレクトしてください。",
      });
    }
  } catch {
    // HTTP版が接続拒否される場合はHTTPS強制と見なし問題なし
  }

  return { checkId: "https-redirect", findings };
}
