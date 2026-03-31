import type { CheckContext, CheckResult, FindingSeverity } from "../types.ts";

interface SensitiveFile {
  path: string;
  pattern: RegExp;
  title: string;
  severity: FindingSeverity;
}

const SENSITIVE_FILES: SensitiveFile[] = [
  {
    path: "/.env",
    pattern: /[A-Z_]+=.+/,
    title: ".env ファイルが公開されています",
    severity: "critical",
  },
  {
    path: "/.git/HEAD",
    pattern: /ref: refs\//,
    title: ".git ディレクトリが公開されています",
    severity: "critical",
  },
  {
    path: "/.git/config",
    pattern: /\[core\]/,
    title: ".git/config ファイルが公開されています",
    severity: "critical",
  },
  {
    path: "/wp-config.php",
    pattern: /DB_NAME|DB_PASSWORD|table_prefix/i,
    title: "WordPress 設定ファイルが公開されています",
    severity: "critical",
  },
  {
    path: "/backup.sql",
    pattern: /CREATE TABLE|INSERT INTO|DROP TABLE/i,
    title: "SQLバックアップファイルが公開されています",
    severity: "critical",
  },
  {
    path: "/dump.sql",
    pattern: /CREATE TABLE|INSERT INTO|DROP TABLE/i,
    title: "SQLダンプファイルが公開されています",
    severity: "critical",
  },
  {
    path: "/phpinfo.php",
    pattern: /PHP Version|phpinfo\(\)/i,
    title: "phpinfo() ページが公開されています",
    severity: "high",
  },
  {
    path: "/.htaccess",
    pattern: /RewriteEngine|Deny from|Allow from/i,
    title: ".htaccess ファイルが公開されています",
    severity: "high",
  },
  {
    path: "/web.config",
    pattern: /<configuration>|<connectionStrings>/i,
    title: "web.config ファイルが公開されています",
    severity: "high",
  },
  {
    path: "/config.php",
    pattern: /\$db|mysql|password/i,
    title: "config.php ファイルが公開されています",
    severity: "high",
  },
  {
    path: "/.DS_Store",
    pattern: /Bud1|DSDB/,
    title: ".DS_Store ファイルが公開されています",
    severity: "high",
  },
  {
    path: "/robots.txt",
    pattern: /Disallow:/i,
    title: "robots.txt に機密パスが記載されています",
    severity: "low",
  },
  {
    path: "/crossdomain.xml",
    pattern: /<cross-domain-policy>/i,
    title: "crossdomain.xml に過度な許可設定があります",
    severity: "high",
  },
  {
    path: "/.well-known/security.txt",
    pattern: /Contact:|Expires:/i,
    title: "security.txt が存在します（情報提供）",
    severity: "informational",
  },
];

export async function checkSensitiveFiles(ctx: CheckContext): Promise<CheckResult> {
  const findings = [];

  const baseUrl = ctx.targetUrl.replace(/\/$/, "");

  for (const file of SENSITIVE_FILES) {
    try {
      const url = `${baseUrl}${file.path}`;
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(5000),
      });

      if (res.status !== 200) continue;

      const text = await res.text();

      if (!file.pattern.test(text)) continue;

      // robots.txt は内容を確認して Disallow に機密パスっぽいものがあるか確認
      if (file.path === "/robots.txt") {
        const sensitiveDisallow = /Disallow:\s*\/(admin|wp-admin|config|backup|private|secret)/i;
        if (!sensitiveDisallow.test(text)) continue;
        findings.push({
          severity: file.severity,
          title: file.title,
          description: `robots.txt に機密と思われるパスへの Disallow 設定が見つかりました。これらのパスが攻撃者の標的になる可能性があります。`,
          evidence: `HTTP ${res.status} ${url}`,
          remediation:
            "robots.txt に機密パスを記載することは避けてください。セキュリティの観点から、公開しても問題ないパスのみを記載してください。",
        });
        continue;
      }

      // crossdomain.xml はワイルドカード許可を確認
      if (file.path === "/crossdomain.xml") {
        if (!/<allow-access-from domain="\*"/i.test(text)) continue;
        findings.push({
          severity: file.severity,
          title: "crossdomain.xml に全ドメイン許可設定があります",
          description: "crossdomain.xml がすべてのドメインからのアクセスを許可しています。",
          evidence: `HTTP ${res.status} ${url}`,
          remediation: "crossdomain.xml で許可するドメインを必要最小限に制限してください。",
        });
        continue;
      }

      findings.push({
        severity: file.severity,
        title: file.title,
        description: `${file.path} ファイルがインターネット上に公開されています。機密情報が漏洩する可能性があります。`,
        evidence: `HTTP ${res.status} ${url}`,
        remediation: `${file.path} ファイルへの外部アクセスを制限してください。Webサーバーの設定でアクセスを拒否するか、ファイルをWebルート外に移動してください。`,
      });
    } catch {
      // タイムアウト・ネットワークエラーは無視
    }
  }

  return { checkId: "sensitive-files", findings };
}
