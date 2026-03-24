import type { DbVulnerability } from "../db/repository.ts";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export function buildPrompt(vuln: DbVulnerability): string {
  const lines: string[] = [];

  lines.push(`タイトル: ${vuln.title}`);
  if (vuln.cve_id) lines.push(`CVE ID: ${vuln.cve_id}`);
  lines.push(`深刻度: ${vuln.severity}`);
  if (vuln.cvss_v3_score != null) lines.push(`CVSS v3スコア: ${vuln.cvss_v3_score}`);
  if (vuln.cvss_v4_score != null) lines.push(`CVSS v4スコア: ${vuln.cvss_v4_score}`);
  if (vuln.description) lines.push(`説明: ${vuln.description}`);

  try {
    const cweIds = JSON.parse(vuln.cwe_ids) as string[];
    if (cweIds.length > 0) lines.push(`CWE: ${cweIds.join(", ")}`);
  } catch {
    // ignore parse errors
  }

  try {
    const products = JSON.parse(vuln.affected_products) as string[];
    if (products.length > 0) lines.push(`影響を受ける製品: ${products.join(", ")}`);
  } catch {
    // ignore parse errors
  }

  return lines.join("\n");
}

export async function computePromptHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function generateRemediation(
  ai: Ai,
  vuln: DbVulnerability,
): Promise<{ content: string; model: string }> {
  const vulnerabilityInfo = buildPrompt(vuln);

  const messages: RoleScopedChatInput[] = [
    {
      role: "system",
      content: `あなたはセキュリティエンジニアのアシスタントです。
脆弱性情報を受け取り、日本語でMarkdown形式の分析レポートを作成してください。

必ず以下の形式で出力してください（## のセクション見出しを必ず使用すること）：

## 概要
脆弱性の概要を簡潔に説明してください。

## 影響
この脆弱性が悪用された場合の影響を説明してください。

## 対処方法
具体的な対処方法（パッチ適用、設定変更など）をステップバイステップで説明してください。

## 緩和策
即座に対処できない場合の一時的な緩和策を説明してください。

## 参考情報
参考となる情報源や追加リソースを提示してください。

重要：各セクションは必ず「## セクション名」の形式で始めてください。技術的に正確で実用的な情報を提供してください。`,
    },
    {
      role: "user",
      content: `以下の脆弱性について対処方法レポートを作成してください。\n\n${vulnerabilityInfo}`,
    },
  ];

  const response = await ai.run(MODEL as Parameters<Ai["run"]>[0], { messages, max_tokens: 2048 });

  let content: string;
  if (typeof response === "object" && response !== null && "response" in response) {
    content = (response as { response: string }).response;
  } else {
    throw new Error("Unexpected AI response format");
  }

  return { content, model: MODEL };
}
