import type { CheckContext, CheckResult } from "../types.ts";

function parseCookieName(setCookie: string): string {
  return (setCookie.split("=")[0] ?? "").trim();
}

function hasFlag(setCookie: string, flag: string): boolean {
  const lower = setCookie.toLowerCase();
  const flagLower = flag.toLowerCase();
  // SameSite=Strict など値付きフラグも考慮
  return lower.split(";").some((part) => part.trim().startsWith(flagLower));
}

export async function checkCookieFlags(ctx: CheckContext): Promise<CheckResult> {
  const findings = [];

  const headersWithGetAll = ctx.baseResponse.headers as unknown as {
    getAll?: (name: string) => string[];
  };
  const setCookieHeaders =
    typeof headersWithGetAll.getAll === "function"
      ? headersWithGetAll.getAll("set-cookie")
      : ([ctx.baseResponse.headers.get("set-cookie")].filter(Boolean) as string[]);

  for (const setCookie of setCookieHeaders) {
    if (!setCookie) continue;
    const cookieName = parseCookieName(setCookie);
    const isSecure = hasFlag(setCookie, "secure");
    const isHttpOnly = hasFlag(setCookie, "httponly");
    const hasSameSite = hasFlag(setCookie, "samesite");

    if (!isHttpOnly) {
      findings.push({
        severity: "medium" as const,
        title: `Cookie "${cookieName}" に HttpOnly フラグがありません`,
        description:
          "HttpOnly フラグが設定されていないCookieはJavaScriptからアクセス可能です。XSS攻撃によってセッションが窃取されるリスクがあります。",
        evidence: `Set-Cookie: ${setCookie}`,
        remediation: `Set-Cookie に HttpOnly フラグを追加してください。例: Set-Cookie: ${cookieName}=value; HttpOnly`,
      });
    }

    if (!isSecure) {
      findings.push({
        severity: "medium" as const,
        title: `Cookie "${cookieName}" に Secure フラグがありません`,
        description:
          "Secure フラグが設定されていないCookieはHTTP通信でも送信されます。通信の盗聴によりCookieが窃取されるリスクがあります。",
        evidence: `Set-Cookie: ${setCookie}`,
        remediation: `Set-Cookie に Secure フラグを追加してください。例: Set-Cookie: ${cookieName}=value; Secure`,
      });
    }

    if (!hasSameSite) {
      findings.push({
        severity: "low" as const,
        title: `Cookie "${cookieName}" に SameSite 属性がありません`,
        description:
          "SameSite 属性が設定されていないCookieはクロスサイトリクエストで送信される可能性があります。CSRF攻撃のリスクが高まります。",
        evidence: `Set-Cookie: ${setCookie}`,
        remediation: `Set-Cookie に SameSite 属性を追加してください。例: Set-Cookie: ${cookieName}=value; SameSite=Strict`,
      });
    }
  }

  return { checkId: "cookie-flags", findings };
}
