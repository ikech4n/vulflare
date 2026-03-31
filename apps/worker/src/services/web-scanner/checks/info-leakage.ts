import type { CheckContext, CheckResult } from "../types.ts";

// パターンマッチで確実に検出できる機密情報
const DEFINITE_PATTERNS: Array<{
  pattern: RegExp;
  title: string;
  severity: "high" | "medium";
}> = [
  {
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"]?[^\s'"<>]{4,}/i,
    title: "HTMLにパスワードが記載されています",
    severity: "high",
  },
  {
    pattern:
      /(?:api[_-]?key|apikey|secret[_-]?key|access[_-]?token)\s*[:=]\s*['"]?[a-zA-Z0-9+/]{16,}/i,
    title: "HTMLにAPIキー/シークレットが記載されています",
    severity: "high",
  },
  {
    pattern: /(?:mongodb|mysql|postgresql|redis):\/\/[^'"<>\s]+/i,
    title: "HTMLにデータベース接続文字列が記載されています",
    severity: "high",
  },
  {
    pattern: /(?:192\.168\.|10\.\d+\.|172\.(?:1[6-9]|2\d|3[01])\.|127\.0\.0\.)\d+/,
    title: "HTMLに内部IPアドレスが記載されています",
    severity: "medium",
  },
  {
    pattern: /(?:\/var\/www\/|\/home\/\w+\/|C:\\\\|D:\\\\|\/etc\/)/i,
    title: "HTMLにサーバーのファイルパスが記載されています",
    severity: "medium",
  },
];

export async function checkInfoLeakage(ctx: CheckContext): Promise<CheckResult> {
  const findings = [];

  // HTMLコメントを抽出
  const commentPattern = /<!--([\s\S]*?)-->/g;
  const comments: string[] = [];
  let commentMatch: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard while-loop pattern for regex exec
  while ((commentMatch = commentPattern.exec(ctx.baseHtml)) !== null) {
    const content = (commentMatch[1] ?? "").trim();
    if (content.length > 5) {
      comments.push(content);
    }
  }

  // パターンマッチによる確実な検出（コメント内 + HTML全体）
  for (const { pattern, title, severity } of DEFINITE_PATTERNS) {
    const matchInHtml = ctx.baseHtml.match(pattern);
    if (matchInHtml) {
      findings.push({
        severity,
        title,
        description: `ページのHTMLソースコードに機密情報が含まれている可能性があります。この情報はWebブラウザの開発者ツールから誰でも閲覧できます。`,
        evidence: matchInHtml[0].substring(0, 100),
        remediation:
          "機密情報をHTMLに直接記述しないでください。サーバーサイドで管理し、必要な場合はAPIを通じて安全に提供してください。",
      });
    }
  }

  // コメント内の機密情報をWorkers AIで分析
  const suspiciousComments = comments.filter((c) => {
    const lower = c.toLowerCase();
    return (
      lower.includes("todo") ||
      lower.includes("fixme") ||
      lower.includes("hack") ||
      lower.includes("password") ||
      lower.includes("secret") ||
      lower.includes("key") ||
      lower.includes("token") ||
      lower.includes("debug") ||
      lower.includes("test") ||
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(c)
    );
  });

  if (suspiciousComments.length > 0) {
    // Workers AI でより詳細に分析
    try {
      const prompt = `以下はWebページのHTMLコメントです。セキュリティ上問題のある情報（パスワード、APIキー、内部パス、IPアドレス、開発者向けメモなど）が含まれているか判定してください。

コメント一覧:
${suspiciousComments
  .slice(0, 5)
  .map((c, i) => `[${i + 1}] ${c.substring(0, 200)}`)
  .join("\n")}

判定結果を JSON で返してください: {"isSensitive": true/false, "reason": "理由"}`;

      const aiResult = await ctx.env.AI.run(
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast" as Parameters<typeof ctx.env.AI.run>[0],
        {
          messages: [{ role: "user", content: prompt }],
          max_tokens: 200,
        } as Parameters<typeof ctx.env.AI.run>[1],
      );

      const responseText =
        aiResult !== null && typeof aiResult === "object" && "response" in (aiResult as object)
          ? String((aiResult as { response: unknown }).response ?? "")
          : "";

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { isSensitive: boolean; reason: string };
        if (parsed.isSensitive) {
          findings.push({
            severity: "medium" as const,
            title: "HTMLコメントに機密情報の可能性がある内容が含まれています",
            description: `HTMLコメントにセキュリティ上問題のある情報が含まれている可能性があります。AI分析: ${parsed.reason}`,
            evidence: suspiciousComments
              .slice(0, 3)
              .map((c) => `<!-- ${c.substring(0, 100)} -->`)
              .join("\n"),
            remediation:
              "本番環境のHTMLからデバッグコメント、内部情報、開発者メモを削除してください。",
          });
        }
      }
    } catch {
      // AI分析失敗時はパターンマッチのみで対応
      if (suspiciousComments.length > 0) {
        findings.push({
          severity: "low" as const,
          title: "HTMLコメントに機密情報の可能性がある内容が含まれています",
          description:
            "HTMLコメントに注意が必要なキーワード（password, secret, key, TODO等）が含まれています。手動で確認してください。",
          evidence: suspiciousComments
            .slice(0, 3)
            .map((c) => `<!-- ${c.substring(0, 100)} -->`)
            .join("\n"),
          remediation:
            "本番環境のHTMLからデバッグコメント、内部情報、開発者メモを削除してください。",
        });
      }
    }
  }

  // サーバーバージョン情報の漏洩
  const serverHeader = ctx.baseResponse.headers.get("server");
  const xPoweredBy = ctx.baseResponse.headers.get("x-powered-by");

  if (serverHeader && /\d+\.\d+/.test(serverHeader)) {
    findings.push({
      severity: "low" as const,
      title: "Server ヘッダーにバージョン情報が含まれています",
      description: `Server ヘッダーにソフトウェアのバージョン情報が含まれています。攻撃者がターゲットを絞るための情報になります。`,
      evidence: `Server: ${serverHeader}`,
      remediation: "Webサーバーの設定でバージョン情報を非表示にしてください。",
    });
  }

  if (xPoweredBy) {
    findings.push({
      severity: "low" as const,
      title: "X-Powered-By ヘッダーが公開されています",
      description: `X-Powered-By ヘッダーが設定されており、使用技術 (${xPoweredBy}) が公開されています。`,
      evidence: `X-Powered-By: ${xPoweredBy}`,
      remediation:
        "X-Powered-By ヘッダーを削除してください。Express.js: app.disable('x-powered-by')",
    });
  }

  return { checkId: "info-leakage", findings };
}
