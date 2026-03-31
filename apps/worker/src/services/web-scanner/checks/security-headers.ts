import type { CheckContext, CheckResult } from "../types.ts";

interface HeaderCheck {
  header: string;
  severity: "high" | "medium";
  title: string;
  description: string;
  remediation: string;
}

const REQUIRED_HEADERS: HeaderCheck[] = [
  {
    header: "content-security-policy",
    severity: "high",
    title: "Content-Security-Policy ヘッダーが未設定",
    description:
      "CSP ヘッダーが設定されていません。XSS 攻撃などのコンテンツインジェクション攻撃に対して無防備な状態です。",
    remediation:
      "Content-Security-Policy ヘッダーを設定してください。例: Content-Security-Policy: default-src 'self'",
  },
  {
    header: "strict-transport-security",
    severity: "high",
    title: "Strict-Transport-Security ヘッダーが未設定",
    description:
      "HSTS ヘッダーが設定されていません。中間者攻撃（MITM）により HTTP ダウングレード攻撃を受ける可能性があります。",
    remediation:
      "Strict-Transport-Security ヘッダーを設定してください。例: Strict-Transport-Security: max-age=31536000; includeSubDomains",
  },
  {
    header: "x-frame-options",
    severity: "medium",
    title: "X-Frame-Options ヘッダーが未設定",
    description:
      "X-Frame-Options ヘッダーが設定されていません。クリックジャッキング攻撃に対して脆弱な可能性があります。",
    remediation:
      "X-Frame-Options ヘッダーを設定してください。例: X-Frame-Options: DENY または SAMEORIGIN",
  },
  {
    header: "x-content-type-options",
    severity: "medium",
    title: "X-Content-Type-Options ヘッダーが未設定",
    description:
      "X-Content-Type-Options ヘッダーが設定されていません。MIME タイプスニッフィング攻撃に対して脆弱な可能性があります。",
    remediation: "X-Content-Type-Options: nosniff を設定してください。",
  },
  {
    header: "referrer-policy",
    severity: "medium",
    title: "Referrer-Policy ヘッダーが未設定",
    description:
      "Referrer-Policy ヘッダーが設定されていません。リファラー情報の漏洩により内部URLや機密情報が外部に流出する可能性があります。",
    remediation:
      "Referrer-Policy ヘッダーを設定してください。例: Referrer-Policy: strict-origin-when-cross-origin",
  },
  {
    header: "permissions-policy",
    severity: "medium",
    title: "Permissions-Policy ヘッダーが未設定",
    description:
      "Permissions-Policy ヘッダーが設定されていません。カメラ・マイク・位置情報などのブラウザ機能へのアクセスが制限されていません。",
    remediation:
      "Permissions-Policy ヘッダーを設定してください。例: Permissions-Policy: camera=(), microphone=(), geolocation=()",
  },
];

export async function checkSecurityHeaders(ctx: CheckContext): Promise<CheckResult> {
  const findings = [];

  for (const check of REQUIRED_HEADERS) {
    const value = ctx.baseResponse.headers.get(check.header);
    if (!value) {
      findings.push({
        severity: check.severity,
        title: check.title,
        description: check.description,
        evidence: `ヘッダー "${check.header}" がレスポンスに含まれていません`,
        remediation: check.remediation,
      });
    }
  }

  return { checkId: "security-headers", findings };
}
