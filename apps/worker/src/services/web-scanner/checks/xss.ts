import type { CheckContext, CheckFinding, CheckResult } from "../types.ts";

// カナリア文字列: <, ", ' がHTMLエスケープされずに反映されるか検証する
const CANARY = "vflr7x<\"'>";

// 共通パラメータリスト（反射型XSS検出用）
const COMMON_PARAMS = [
  "q",
  "search",
  "query",
  "keyword",
  "s",
  "id",
  "name",
  "page",
  "lang",
  "callback",
  "message",
  "error",
  "text",
  "value",
  "input",
];

// DOM-based XSS: 危険なソース
const DOM_SOURCE_PATTERNS = [
  /location\.hash/,
  /location\.search/,
  /location\.href/,
  /document\.referrer/,
  /document\.URL/,
  /window\.name/,
];

// DOM-based XSS: 危険なシンク
const DOM_SINK_PATTERNS = [
  /\.innerHTML\s*=/,
  /\.outerHTML\s*=/,
  /document\.write\s*\(/,
  /document\.writeln\s*\(/,
  /\.insertAdjacentHTML\s*\(/,
  /\beval\s*\(/,
];

/** ctx.baseHtml からURLパラメータ名とフォームフィールド名を抽出し、共通リストとマージして返す */
function extractParams(html: string): string[] {
  const params = new Set<string>(COMMON_PARAMS);

  // href 属性のクエリパラメータ名を抽出
  for (const hrefMatch of html.matchAll(/href=["']([^"']*\?[^"']*)["']/gi)) {
    const href = hrefMatch[1];
    if (!href) continue;
    try {
      const url = new URL(href, "https://example.com");
      for (const key of url.searchParams.keys()) {
        params.add(key);
      }
    } catch {
      // 無効なURLは無視
    }
  }

  // <input name="..."> からフォームフィールド名を抽出
  for (const inputMatch of html.matchAll(/<input[^>]+name=["']([^"']+)["'][^>]*>/gi)) {
    const name = inputMatch[1];
    if (name) params.add(name);
  }

  // 最大15パラメータに制限（Workers CPU時間制限の考慮）
  return [...params].slice(0, 15);
}

/** 反射型XSS検出 */
async function checkReflectedXss(ctx: CheckContext, params: string[]): Promise<CheckFinding[]> {
  for (const param of params) {
    try {
      const testUrl = new URL(ctx.targetUrl);
      testUrl.searchParams.set(param, CANARY);

      const res = await fetch(testUrl.toString(), {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(5000),
      });

      const body = await res.text();

      // カナリア文字列がエスケープなしで反映されている場合
      if (body.includes(CANARY)) {
        return [
          {
            severity: "high" as const,
            title: `反射型XSSの脆弱性: ?${param}= パラメータ`,
            description: `?${param}= パラメータに入力した値がHTMLエスケープされずにレスポンスに反映されます。攻撃者が悪意あるスクリプトを実行できる可能性があります。`,
            evidence: `GET ${testUrl.toString()} → カナリア文字列 (${CANARY}) がエスケープなしで反映されました`,
            remediation:
              "すべてのユーザー入力をHTMLエスケープしてから出力してください。フレームワークのテンプレートエンジンの自動エスケープ機能を有効にし、Content-Security-Policy ヘッダーの導入も検討してください。",
          },
        ];
      }
    } catch {
      // タイムアウト・ネットワークエラーは無視
    }
  }
  return [];
}

/** DOM-based XSS静的解析 */
async function checkDomBasedXss(ctx: CheckContext): Promise<CheckFinding[]> {
  const scriptBlocks: Array<{ content: string; location: string }> = [];

  // インラインスクリプトを抽出
  let inlineIndex = 1;
  for (const inlineMatch of ctx.baseHtml.matchAll(
    /<script(?![^>]+src)[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    const content = inlineMatch[1];
    if (content?.trim()) {
      scriptBlocks.push({
        content,
        location: `インラインスクリプト #${inlineIndex++}`,
      });
    }
  }

  // 同一オリジンの外部JSを最大3ファイルfetch
  const baseOrigin = new URL(ctx.targetUrl).origin;
  let externalCount = 0;
  for (const srcMatch of ctx.baseHtml.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi)) {
    if (externalCount >= 3) break;
    try {
      const src = srcMatch[1];
      if (!src) continue;
      const jsUrl = new URL(src, ctx.targetUrl);
      if (jsUrl.origin !== baseOrigin) continue;

      const res = await fetch(jsUrl.toString(), {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(5000),
      });
      const jsContent = await res.text();
      scriptBlocks.push({ content: jsContent, location: jsUrl.pathname });
      externalCount++;
    } catch {
      // fetch失敗は無視
    }
  }

  // ソース + シンクのパターンを検出
  for (const { content, location } of scriptBlocks) {
    const foundSources = DOM_SOURCE_PATTERNS.filter((p) => p.test(content)).map((p) =>
      p.source.replace(/\\/g, ""),
    );
    const foundSinks = DOM_SINK_PATTERNS.filter((p) => p.test(content)).map((p) =>
      p.source.replace(/\\/g, ""),
    );

    if (foundSources.length > 0 && foundSinks.length > 0) {
      return [
        {
          severity: "medium" as const,
          title: "DOM-based XSSのリスク: 危険なパターンを検出",
          description: `JavaScriptコード内で、ユーザー制御可能な値 (${foundSources.join(", ")}) が危険なDOM操作 (${foundSinks.join(", ")}) に使用されている可能性があります。`,
          evidence: `検出箇所: ${location} / ソース: ${foundSources.join(", ")} / シンク: ${foundSinks.join(", ")}`,
          remediation:
            "ユーザー制御可能な値 (location.hash, document.referrer等) を innerHTML や document.write に直接渡さないでください。textContent や createTextNode を使用してください。",
        },
      ];
    }
  }

  return [];
}

export async function checkXss(ctx: CheckContext): Promise<CheckResult> {
  const params = extractParams(ctx.baseHtml);

  const [reflectedFindings, domFindings] = await Promise.all([
    checkReflectedXss(ctx, params),
    checkDomBasedXss(ctx),
  ]);

  return {
    checkId: "xss",
    findings: [...reflectedFindings, ...domFindings],
  };
}
