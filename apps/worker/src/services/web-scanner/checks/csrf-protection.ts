import type { CheckContext, CheckResult } from "../types.ts";

const CSRF_TOKEN_PATTERNS = [
  /name=["'](?:csrf[_-]?token|_token|csrf|_csrf|authenticity_token|csrfmiddlewaretoken|__requestverificationtoken|_method)[^"']*["']/i,
  /id=["'](?:csrf[_-]?token|_token|csrf|_csrf)[^"']*["']/i,
];

export async function checkCsrfProtection(ctx: CheckContext): Promise<CheckResult> {
  const findings = [];

  // POST フォームを抽出
  const formPattern = /<form[^>]*(?:method=["']post["']|method=post)[^>]*>([\s\S]*?)<\/form>/gi;

  let formMatch: RegExpExecArray | null;
  let formCount = 0;
  let unprotectedCount = 0;

  // biome-ignore lint/suspicious/noAssignInExpressions: standard while-loop pattern for regex exec
  while ((formMatch = formPattern.exec(ctx.baseHtml)) !== null) {
    formCount++;
    const formContent = formMatch[0];

    const hasCsrfToken = CSRF_TOKEN_PATTERNS.some((p) => p.test(formContent));

    // meta タグの CSRF トークンも確認（一部フレームワークはこちらを使用）
    const hasMetaCsrf = /<meta[^>]+(?:name=["']csrf-token["']|name=["']_token["'])[^>]*>/i.test(
      ctx.baseHtml,
    );

    if (!hasCsrfToken && !hasMetaCsrf) {
      unprotectedCount++;
    }
  }

  if (formCount > 0 && unprotectedCount > 0) {
    findings.push({
      severity: "high" as const,
      title: `${unprotectedCount}個のPOSTフォームにCSRF対策トークンがありません`,
      description: `ページ内の ${formCount} 個の POST フォームのうち ${unprotectedCount} 個にCSRFトークンが見当たりません。CSRF攻撃によって、悪意あるサイトから正規ユーザーの操作を誘導できる可能性があります。`,
      evidence: `POST フォーム数: ${formCount}, CSRF保護なし: ${unprotectedCount}`,
      remediation:
        "すべてのPOSTフォームにCSRFトークンを含めてください。ランダムなトークンを hidden フィールドで送信し、サーバー側で検証してください。また Cookie の SameSite=Strict 設定も CSRF 対策として有効です。",
    });
  }

  return { checkId: "csrf-protection", findings };
}
