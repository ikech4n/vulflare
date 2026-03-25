import { notificationRepo } from "../db/notification-repository.ts";
import type { Env } from "../types.ts";

export type EventType =
  | "vulnerability_created"
  | "vulnerability_updated"
  | "vulnerability_critical"
  | "eol_approaching"
  | "eol_expired";

export interface NotificationPayload {
  eventType: EventType;
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * HTML特殊文字をエスケープする（XSS対策）
 */
function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 通知をディスパッチする
 */
export async function dispatchNotification(
  env: Env,
  eventType: EventType,
  data: Record<string, unknown>,
): Promise<void> {
  const rules = await notificationRepo.findRulesByEvent(env.DB, eventType);

  for (const rule of rules) {
    const channel = await notificationRepo.findChannelById(env.DB, rule.channel_id);
    if (!channel || !channel.is_active) continue;

    // フィルター条件チェック
    if (rule.filter_config) {
      try {
        const filter = JSON.parse(rule.filter_config) as Record<string, unknown>;
        let match = true;
        for (const [key, value] of Object.entries(filter)) {
          // 配列の場合は includes で判定（例: severity: ["critical", "high"]）
          if (Array.isArray(value)) {
            if (!value.includes(data[key])) {
              match = false;
              break;
            }
          } else if (data[key] !== value) {
            match = false;
            break;
          }
        }
        if (!match) continue;
      } catch {
        // フィルターのパースに失敗した場合はスキップ
        continue;
      }
    }

    const payload: NotificationPayload = {
      eventType,
      data,
      timestamp: new Date().toISOString(),
    };

    // 非同期でチャネルに送信
    await sendToChannel(env, channel, payload);
  }
}

/**
 * チャネルに通知を送信（内部用）
 */
async function sendToChannel(
  env: Env,
  channel: { id: string; type: string; config: string },
  payload: NotificationPayload,
): Promise<void> {
  await sendToChannelById(env, channel, payload);
}

/**
 * チャネルに通知を送信（再送信などで外部から呼ぶ用）
 */
export async function sendToChannelById(
  env: Env,
  channel: { id: string; type: string; config: string },
  payload: NotificationPayload,
): Promise<void> {
  const logId = crypto.randomUUID();

  try {
    const config = JSON.parse(channel.config) as Record<string, unknown>;

    if (channel.type === "email") {
      await sendEmail(env, config, payload);
    } else if (channel.type === "slack") {
      await sendSlack(config, payload);
    }

    await notificationRepo.createLog(env.DB, {
      id: logId,
      channel_id: channel.id,
      event_type: payload.eventType,
      payload: JSON.stringify(payload),
      status: "sent",
      error_message: null,
    });
  } catch (error) {
    await notificationRepo.createLog(env.DB, {
      id: logId,
      channel_id: channel.id,
      event_type: payload.eventType,
      payload: JSON.stringify(payload),
      status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Slack送信（Block Kit形式）
 */
async function sendSlack(
  config: Record<string, unknown>,
  payload: NotificationPayload,
): Promise<void> {
  const url = config.webhookUrl as string;
  if (!url) throw new Error("Slack webhook URL is required");

  const { eventType, data } = payload;

  const colorMap: Record<string, string> = {
    vulnerability_critical: "#dc2626",
    vulnerability_created: "#1e40af",
    vulnerability_updated: "#0284c7",
    eol_approaching: "#f59e0b",
    eol_expired: "#dc2626",
  };
  const color = colorMap[eventType] ?? "#6b7280";

  const headerText =
    eventType === "vulnerability_critical"
      ? "クリティカル脆弱性が検出されました"
      : eventType === "vulnerability_created"
        ? "脆弱性が登録されました"
        : eventType === "vulnerability_updated"
          ? "脆弱性が更新されました"
          : eventType === "eol_approaching"
            ? "EOL期限が近づいています"
            : eventType === "eol_expired"
              ? "サポート終了（EOL）"
              : `Vulflare: ${eventType}`;

  const fields: { type: "mrkdwn"; text: string }[] = [];

  if (eventType === "eol_approaching" || eventType === "eol_expired") {
    if (data.display_name)
      fields.push({
        type: "mrkdwn",
        text: `*プロダクト*\n${data.display_name} (${data.cycle ?? ""})`,
      });
    if (data.eol_date) fields.push({ type: "mrkdwn", text: `*EOL日*\n${data.eol_date}` });
    if (data.days_until_eol != null)
      fields.push({ type: "mrkdwn", text: `*残り日数*\n${data.days_until_eol}日` });
  } else {
    if (data.vuln_id) fields.push({ type: "mrkdwn", text: `*CVE ID*\n${data.vuln_id}` });
    if (data.title) fields.push({ type: "mrkdwn", text: `*タイトル*\n${data.title}` });
    if (data.severity) fields.push({ type: "mrkdwn", text: `*深刻度*\n${data.severity}` });
    if (data.created_count != null)
      fields.push({ type: "mrkdwn", text: `*登録件数*\n${data.created_count}件` });
  }

  const body = {
    attachments: [
      {
        color,
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: headerText },
          },
          ...(fields.length > 0 ? [{ type: "section", fields }] : []),
        ],
      },
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook failed with status ${response.status}`);
  }
}

/**
 * Email送信
 */
async function sendEmail(
  env: Env,
  config: Record<string, unknown>,
  payload: NotificationPayload,
): Promise<void> {
  const from = config.from as string;
  const to = config.to as string[];

  if (!from) throw new Error("Email from address is required");
  if (!to || !Array.isArray(to) || to.length === 0) {
    throw new Error("Email to addresses are required");
  }

  const eventTypeLabels: Record<string, string> = {
    vulnerability_created: "新規脆弱性が登録されました",
    vulnerability_updated: "脆弱性が更新されました",
    vulnerability_critical: "クリティカル脆弱性が検出されました",
    eol_approaching: "EOL期限が近づいています",
    eol_expired: "サポートが終了しました",
  };
  const subjectTemplate = (config.subject as string) || "Vulflare: {eventType}";
  const subject = subjectTemplate.replace(
    "{eventType}",
    eventTypeLabels[payload.eventType] ?? payload.eventType,
  );
  const appUrl = env.PAGES_URL ?? "";
  const htmlBody = generateEmailBody(payload, appUrl);
  const textBody = generateEmailBodyText(payload, appUrl);

  try {
    const { EmailMessage } = await import("cloudflare:email");

    for (const recipient of to) {
      // MIMEメッセージを構築（multipart/alternative形式）
      const messageId = `<${crypto.randomUUID()}@${from.split("@")[1]}>`;
      const date = new Date().toUTCString();
      const boundary = `boundary_${crypto.randomUUID().replace(/-/g, "")}`;

      let mimeMessage = `From: ${from}\r\n`;
      mimeMessage += `To: ${recipient}\r\n`;

      if (config.cc && Array.isArray(config.cc) && config.cc.length > 0) {
        mimeMessage += `Cc: ${config.cc.join(", ")}\r\n`;
      }

      mimeMessage += `Subject: ${subject}\r\n`;
      mimeMessage += `Date: ${date}\r\n`;
      mimeMessage += `Message-ID: ${messageId}\r\n`;
      mimeMessage += "MIME-Version: 1.0\r\n";
      mimeMessage += `List-Unsubscribe: <mailto:${from}?subject=unsubscribe>\r\n`;
      mimeMessage += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n`;
      mimeMessage += "\r\n";

      // プレーンテキストパート
      mimeMessage += `--${boundary}\r\n`;
      mimeMessage += "Content-Type: text/plain; charset=utf-8\r\n";
      mimeMessage += "\r\n";
      mimeMessage += textBody;
      mimeMessage += "\r\n";

      // HTMLパート
      mimeMessage += `--${boundary}\r\n`;
      mimeMessage += "Content-Type: text/html; charset=utf-8\r\n";
      mimeMessage += "\r\n";
      mimeMessage += htmlBody;
      mimeMessage += "\r\n";

      mimeMessage += `--${boundary}--\r\n`;

      const message = new EmailMessage(from, recipient, mimeMessage);
      await env.SEND_EMAIL.send(message);
    }
  } catch (error) {
    console.error("Email send error:", error);
    throw new Error(
      `Failed to send email: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * メール本文の生成（プレーンテキスト版）
 */
function generateEmailBodyText(payload: NotificationPayload, appUrl: string): string {
  const { eventType, data, timestamp } = payload;

  if (eventType === "eol_approaching") {
    return [
      "EOL期限が近づいています - Vulflare",
      "",
      `${data.display_name} (${data.cycle}) のサポート終了が ${data.days_until_eol}日後 に迫っています。`,
      "",
      `プロダクト: ${data.display_name} (${data.product_name})`,
      `バージョン: ${data.cycle}`,
      `カテゴリ: ${data.category}`,
      ...(data.vendor ? [`ベンダー: ${data.vendor}`] : []),
      `EOL日: ${data.eol_date}`,
      "",
      `通知日時: ${new Date(timestamp).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`,
    ].join("\n");
  }

  if (eventType === "vulnerability_created") {
    const count = data.created_count as number | undefined;
    const criticalCount = data.critical_count as number | undefined;
    const title = data.title as string | undefined;
    const vulnId = data.vuln_id as string | undefined;
    const lines = [
      "脆弱性が登録されました - Vulflare",
      "",
      count != null
        ? `新規脆弱性が ${count}件 登録されました。${criticalCount ? `（うちCritical: ${criticalCount}件）` : ""}`
        : `脆弱性が登録されました: ${vulnId ?? ""} ${title ?? ""}`.trim(),
    ];
    if (title) lines.push("", `タイトル: ${title}`);
    if (appUrl) lines.push("", `脆弱性一覧: ${appUrl}/vulnerabilities`);
    lines.push(
      "",
      `通知日時: ${new Date(timestamp).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`,
    );
    return lines.join("\n");
  }

  if (eventType === "vulnerability_updated") {
    const count = data.count as number | undefined;
    const title = data.title as string | undefined;
    const vulnId = data.vuln_id as string | undefined;
    return [
      "脆弱性が更新されました - Vulflare",
      "",
      count != null
        ? `${count}件の脆弱性が一括更新されました。`
        : `脆弱性が更新されました: ${vulnId ?? ""} ${title ?? ""}`.trim(),
      "",
      `通知日時: ${new Date(timestamp).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`,
    ].join("\n");
  }

  if (eventType === "vulnerability_critical") {
    const criticalCount = data.critical_count as number | undefined;
    const cveIds = data.cve_ids as string[] | undefined;
    const vulnId = data.vuln_id as string | undefined;
    return [
      "クリティカル脆弱性が検出されました - Vulflare",
      "",
      criticalCount != null
        ? `Critical脆弱性が ${criticalCount}件 検出されました。${cveIds?.length ? `\nCVE: ${cveIds.join(", ")}` : ""}`
        : `クリティカル脆弱性: ${vulnId ?? ""}`,
      "",
      `通知日時: ${new Date(timestamp).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`,
    ].join("\n");
  }

  if (eventType === "eol_expired") {
    return [
      "サポート終了（EOL） - Vulflare",
      "",
      `${data.display_name} (${data.cycle}) のサポートが終了しました。早急な対応が必要です。`,
      "",
      `プロダクト: ${data.display_name} (${data.product_name})`,
      `バージョン: ${data.cycle}`,
      `カテゴリ: ${data.category}`,
      ...(data.vendor ? [`ベンダー: ${data.vendor}`] : []),
      `EOL日: ${data.eol_date}`,
      "",
      `通知日時: ${new Date(timestamp).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`,
    ].join("\n");
  }

  return [
    `Vulflare Notification: ${eventType}`,
    "",
    `Timestamp: ${new Date(timestamp).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`,
    "",
    "Event Data:",
    JSON.stringify(data, null, 2),
  ].join("\n");
}

/**
 * メール共通テンプレートビルダー
 */
function buildEmailTemplate({
  accentColor,
  title,
  badge,
  alertHtml,
  infoItems,
  ctaUrl,
  ctaText,
  timestamp,
  appUrl,
}: {
  accentColor: string;
  title: string;
  badge?: { text: string; color: string } | undefined;
  alertHtml?: string | undefined;
  infoItems: { label: string; value: string }[];
  ctaUrl?: string | undefined;
  ctaText?: string | undefined;
  timestamp: string;
  appUrl?: string | undefined;
}): string {
  const formattedTime = new Date(timestamp).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

  const badgeHtml = badge
    ? `<span style="display:inline-block;background:${badge.color};color:white;padding:2px 10px;border-radius:9999px;font-size:11px;font-weight:700;letter-spacing:0.08em;vertical-align:middle;margin-left:10px;">${badge.text}</span>`
    : "";

  const alertBlock = alertHtml
    ? `<div style="background:#fef2f2;border-left:4px solid ${accentColor};padding:12px 16px;margin:0 0 16px;border-radius:0 6px 6px 0;color:#1e293b;font-size:14px;line-height:1.6;">${alertHtml}</div>`
    : "";

  const tableRows = infoItems
    .map(
      ({ label, value }) =>
        `<tr>
          <td style="padding:9px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;width:32%;vertical-align:top;white-space:nowrap;">
            <span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">${label}</span>
          </td>
          <td style="padding:9px 14px;background:white;border-bottom:1px solid #e2e8f0;color:#1e293b;font-size:14px;word-break:break-all;">${value}</td>
        </tr>`,
    )
    .join("");

  const infoTable = tableRows
    ? `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:20px;">${tableRows}</table>`
    : "";

  const ctaBlock =
    ctaUrl && ctaText
      ? `<div style="margin-bottom:4px;"><a href="${ctaUrl}" style="display:inline-block;padding:11px 22px;background:${accentColor};color:white;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">${ctaText} &rarr;</a></div>`
      : "";

  const footerLinks = appUrl
    ? `<a href="${appUrl}" style="color:#94a3b8;text-decoration:none;">Vulflare</a>&ensp;&middot;&ensp;<a href="${appUrl}/notifications" style="color:#94a3b8;text-decoration:none;">通知設定</a>`
    : "Vulflare";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr><td align="center" style="padding:32px 16px;">

  <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.12);">

    <!-- ヘッダー -->
    <tr>
      <td style="background:#ffffff;border-top:4px solid #f97316;padding:22px 28px 20px;border-bottom:1px solid #f1f5f9;">
        <div style="font-size:13px;font-weight:800;color:#ea580c;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px;">VULFLARE</div>
        <div style="font-size:20px;font-weight:700;color:#1e293b;line-height:1.3;">${title}${badgeHtml}</div>
      </td>
    </tr>

    <!-- 本文 -->
    <tr>
      <td style="background:white;padding:24px 28px;">
        ${alertBlock}${infoTable}${ctaBlock}
      </td>
    </tr>

    <!-- フッター -->
    <tr>
      <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 28px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">${footerLinks}</p>
        <p style="margin:5px 0 0;font-size:11px;color:#cbd5e1;">通知日時: ${formattedTime}</p>
      </td>
    </tr>

  </table>

</td></tr>
</table>
</body>
</html>`;
}

/**
 * 深刻度カラーマップ
 */
const SEVERITY_COLORS: Record<string, string> = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#d97706",
  low: "#65a30d",
  info: "#6b7280",
};

/**
 * メール本文の生成
 */
function generateEmailBody(payload: NotificationPayload, appUrl: string): string {
  const { eventType, data, timestamp } = payload;

  if (eventType === "vulnerability_created") {
    return generateVulnerabilityCreatedEmail(data, timestamp, appUrl);
  }
  if (eventType === "vulnerability_updated") {
    return generateVulnerabilityUpdatedEmail(data, timestamp, appUrl);
  }
  if (eventType === "vulnerability_critical") {
    return generateVulnerabilityCriticalEmail(data, timestamp, appUrl);
  }
  if (eventType === "eol_approaching") {
    return generateEolApproachingEmail(data, timestamp, appUrl);
  }
  if (eventType === "eol_expired") {
    return generateEolExpiredEmail(data, timestamp, appUrl);
  }

  // デフォルト
  return buildEmailTemplate({
    accentColor: "#1e40af",
    title: "Vulflare Notification",
    infoItems: [{ label: "Event", value: escapeHtml(eventType) }],
    timestamp,
    appUrl,
  });
}

/**
 * 脆弱性作成メール本文
 */
function generateVulnerabilityCreatedEmail(
  data: Record<string, unknown>,
  timestamp: string,
  appUrl: string,
): string {
  const count = data.created_count as number | undefined;
  const criticalCount = data.critical_count as number | undefined;
  const title = data.title as string | undefined;
  const vulnId = data.vuln_id as string | undefined;
  const severity = data.severity as string | undefined;
  const accentColor = severity === "critical" ? "#dc2626" : "#1e40af";

  const alertHtml =
    count != null
      ? `新規脆弱性が <strong>${count}件</strong> 登録されました。${criticalCount ? `うち Critical: <strong>${criticalCount}件</strong>` : ""}`
      : `脆弱性が登録されました: <strong>${escapeHtml(vulnId)}</strong>`;

  const infoItems: { label: string; value: string }[] = [];
  if (vulnId) infoItems.push({ label: "CVE ID", value: escapeHtml(vulnId) });
  if (title) infoItems.push({ label: "タイトル", value: escapeHtml(title) });
  if (severity) {
    const color = SEVERITY_COLORS[severity] ?? "#6b7280";
    infoItems.push({
      label: "深刻度",
      value: `<span style="display:inline-block;background:${color};color:white;padding:2px 10px;border-radius:9999px;font-size:12px;font-weight:700;">${escapeHtml(severity.toUpperCase())}</span>`,
    });
  }

  return buildEmailTemplate({
    accentColor,
    title: "脆弱性が登録されました",
    badge: severity === "critical" ? { text: "CRITICAL", color: "#dc2626" } : undefined,
    alertHtml,
    infoItems,
    ctaUrl: appUrl ? `${appUrl}/vulnerabilities` : undefined,
    ctaText: "脆弱性一覧を確認する",
    timestamp,
    appUrl,
  });
}

/**
 * 脆弱性更新メール本文
 */
function generateVulnerabilityUpdatedEmail(
  data: Record<string, unknown>,
  timestamp: string,
  appUrl: string,
): string {
  const count = data.count as number | undefined;
  const title = data.title as string | undefined;
  const vulnId = data.vuln_id as string | undefined;
  const status = data.status as string | undefined;

  const alertHtml =
    count != null
      ? `<strong>${count}件</strong> の脆弱性が一括更新されました。`
      : `脆弱性が更新されました: <strong>${escapeHtml(vulnId)}</strong>${title ? ` — ${escapeHtml(title)}` : ""}`;

  const infoItems: { label: string; value: string }[] = [];
  if (vulnId) infoItems.push({ label: "CVE ID", value: escapeHtml(vulnId) });
  if (title) infoItems.push({ label: "タイトル", value: escapeHtml(title) });
  if (status) infoItems.push({ label: "ステータス", value: escapeHtml(status) });

  return buildEmailTemplate({
    accentColor: "#1e40af",
    title: "脆弱性が更新されました",
    alertHtml,
    infoItems,
    ctaUrl: appUrl ? `${appUrl}/vulnerabilities` : undefined,
    ctaText: "脆弱性一覧を確認する",
    timestamp,
    appUrl,
  });
}

/**
 * クリティカル脆弱性メール本文
 */
function generateVulnerabilityCriticalEmail(
  data: Record<string, unknown>,
  timestamp: string,
  appUrl: string,
): string {
  const criticalCount = data.critical_count as number | undefined;
  const cveIds = data.cve_ids as string[] | undefined;
  const vulnId = data.vuln_id as string | undefined;
  const title = data.title as string | undefined;

  const alertHtml =
    criticalCount != null
      ? `Critical脆弱性が <strong>${criticalCount}件</strong> 検出されました。即時対応を推奨します。`
      : `クリティカル脆弱性が検出されました: <strong>${escapeHtml(vulnId)}</strong>${title ? ` — ${escapeHtml(title)}` : ""}`;

  const infoItems: { label: string; value: string }[] = [];
  if (cveIds?.length) {
    infoItems.push({ label: "CVE ID一覧", value: cveIds.map(escapeHtml).join(",&nbsp; ") });
  } else if (vulnId) {
    infoItems.push({ label: "CVE ID", value: escapeHtml(vulnId) });
  }
  if (title) infoItems.push({ label: "タイトル", value: escapeHtml(title) });

  return buildEmailTemplate({
    accentColor: "#dc2626",
    title: "クリティカル脆弱性が検出されました",
    badge: { text: "CRITICAL", color: "#dc2626" },
    alertHtml,
    infoItems,
    ctaUrl: appUrl ? `${appUrl}/vulnerabilities` : undefined,
    ctaText: "今すぐ確認する",
    timestamp,
    appUrl,
  });
}

/**
 * EOL期限が近づいている場合のメール本文
 */
function generateEolApproachingEmail(
  data: Record<string, unknown>,
  timestamp: string,
  appUrl: string,
): string {
  const severity = data.severity as string | undefined;
  const accentColor = SEVERITY_COLORS[severity ?? ""] ?? "#d97706";
  const daysUntilEol = data.days_until_eol as number | undefined;

  const alertHtml = `<strong>${escapeHtml(data.display_name)} (${escapeHtml(data.cycle)})</strong> のサポート終了が <strong>${escapeHtml(data.days_until_eol)}日後</strong> に迫っています。`;

  const infoItems: { label: string; value: string }[] = [
    {
      label: "プロダクト",
      value: `${escapeHtml(data.display_name)} (${escapeHtml(data.product_name)})`,
    },
    { label: "バージョン", value: escapeHtml(data.cycle) },
    { label: "カテゴリ", value: escapeHtml(data.category) },
  ];
  if (data.vendor) infoItems.push({ label: "ベンダー", value: escapeHtml(data.vendor) });
  infoItems.push({ label: "EOL日", value: `<strong>${escapeHtml(data.eol_date)}</strong>` });

  const badgeText = daysUntilEol != null ? `残り ${daysUntilEol}日` : undefined;

  return buildEmailTemplate({
    accentColor,
    title: "EOL期限が近づいています",
    badge: badgeText ? { text: badgeText, color: accentColor } : undefined,
    alertHtml,
    infoItems,
    ctaUrl: appUrl ? `${appUrl}/eol` : undefined,
    ctaText: "EOL一覧を確認する",
    timestamp,
    appUrl,
  });
}

/**
 * EOL期限切れの場合のメール本文
 */
function generateEolExpiredEmail(
  data: Record<string, unknown>,
  timestamp: string,
  appUrl: string,
): string {
  const alertHtml = `<strong>${escapeHtml(data.display_name)} (${escapeHtml(data.cycle)})</strong> のサポートが終了しました。早急な対応が必要です。`;

  const infoItems: { label: string; value: string }[] = [
    {
      label: "プロダクト",
      value: `${escapeHtml(data.display_name)} (${escapeHtml(data.product_name)})`,
    },
    { label: "バージョン", value: escapeHtml(data.cycle) },
    { label: "カテゴリ", value: escapeHtml(data.category) },
  ];
  if (data.vendor) infoItems.push({ label: "ベンダー", value: escapeHtml(data.vendor) });
  infoItems.push({ label: "EOL日", value: `<strong>${escapeHtml(data.eol_date)}</strong>` });

  return buildEmailTemplate({
    accentColor: "#dc2626",
    title: "サポートが終了しました",
    badge: { text: "EOL", color: "#dc2626" },
    alertHtml,
    infoItems,
    ctaUrl: appUrl ? `${appUrl}/eol` : undefined,
    ctaText: "EOL一覧を確認する",
    timestamp,
    appUrl,
  });
}

/**
 * 通知テスト送信
 */
export async function sendTestNotification(
  env: Env,
  channel: { id: string; type: string; config: string },
): Promise<void> {
  const testPayload: NotificationPayload = {
    eventType: "vulnerability_created",
    data: {
      test: true,
      vuln_id: "CVE-2024-00000",
      title: "これはテスト通知です（Vulflare）",
      severity: "high",
    },
    timestamp: new Date().toISOString(),
  };

  const config = JSON.parse(channel.config) as Record<string, unknown>;

  if (channel.type === "email") {
    await sendEmail(env, config, testPayload);
  } else if (channel.type === "slack") {
    await sendSlack(config, testPayload);
  }
}
