import type { Env } from '../types.ts';
import { notificationRepo } from '../db/notification-repository.ts';

export type EventType =
  | 'vulnerability_created'
  | 'vulnerability_updated'
  | 'vulnerability_critical'
  | 'eol_approaching'
  | 'eol_expired';

export interface NotificationPayload {
  eventType: EventType;
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * 通知をディスパッチする
 */
export async function dispatchNotification(
  env: Env,
  eventType: EventType,
  data: Record<string, unknown>
): Promise<void> {
  const rules = await notificationRepo.findRulesByEvent(env.DB, eventType);

  for (const rule of rules) {
    const channel = await notificationRepo.findChannelById(env.DB, rule.channel_id);
    if (!channel || !channel.is_active) continue;

    // フィルター条件チェック（簡易版）
    if (rule.filter_config) {
      try {
        const filter = JSON.parse(rule.filter_config) as Record<string, unknown>;
        let match = true;
        for (const [key, value] of Object.entries(filter)) {
          if (data[key] !== value) {
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
 * チャネルに通知を送信
 */
async function sendToChannel(
  env: Env,
  channel: { id: string; type: string; config: string },
  payload: NotificationPayload
): Promise<void> {
  const logId = crypto.randomUUID();

  try {
    const config = JSON.parse(channel.config) as Record<string, unknown>;

    if (channel.type === 'webhook') {
      await sendWebhook(config, payload);
    } else if (channel.type === 'email') {
      await sendEmail(env, config, payload);
    }

    await notificationRepo.createLog(env.DB, {
      id: logId,
      channel_id: channel.id,
      event_type: payload.eventType,
      payload: JSON.stringify(payload),
      status: 'sent',
      error_message: null,
    });
  } catch (error) {
    await notificationRepo.createLog(env.DB, {
      id: logId,
      channel_id: channel.id,
      event_type: payload.eventType,
      payload: JSON.stringify(payload),
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Webhook送信
 */
async function sendWebhook(
  config: Record<string, unknown>,
  payload: NotificationPayload
): Promise<void> {
  const url = config.url as string;
  if (!url) throw new Error('Webhook URL is required');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(config.headers as Record<string, string> | undefined),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Webhook failed with status ${response.status}`);
  }
}

/**
 * Email送信
 */
async function sendEmail(
  env: Env,
  config: Record<string, unknown>,
  payload: NotificationPayload
): Promise<void> {
  const from = config.from as string;
  const to = config.to as string[];

  if (!from) throw new Error('Email from address is required');
  if (!to || !Array.isArray(to) || to.length === 0) {
    throw new Error('Email to addresses are required');
  }

  const subjectTemplate = (config.subject as string) || '[Vulflare] {eventType}';
  const subject = subjectTemplate.replace('{eventType}', payload.eventType);
  const htmlBody = generateEmailBody(payload);

  try {
    const { EmailMessage } = await import('cloudflare:email');

    for (const recipient of to) {
      // MIMEメッセージを構築
      const messageId = `<${crypto.randomUUID()}@${from.split('@')[1]}>`;
      const date = new Date().toUTCString();

      let mimeMessage = `From: ${from}\r\n`;
      mimeMessage += `To: ${recipient}\r\n`;

      if (config.cc && Array.isArray(config.cc) && config.cc.length > 0) {
        mimeMessage += `Cc: ${config.cc.join(', ')}\r\n`;
      }

      mimeMessage += `Subject: ${subject}\r\n`;
      mimeMessage += `Date: ${date}\r\n`;
      mimeMessage += `Message-ID: ${messageId}\r\n`;
      mimeMessage += `MIME-Version: 1.0\r\n`;
      mimeMessage += `Content-Type: text/html; charset=utf-8\r\n`;
      mimeMessage += `\r\n`;
      mimeMessage += htmlBody;

      const message = new EmailMessage(from, recipient, mimeMessage);
      await env.SEND_EMAIL.send(message);
    }
  } catch (error) {
    console.error('Email send error:', error);
    throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * メール本文の生成
 */
function generateEmailBody(payload: NotificationPayload): string {
  const { eventType, data, timestamp } = payload;

  // EOL関連イベントの場合は専用のフォーマットを使用
  if (eventType === 'eol_approaching') {
    return generateEolApproachingEmail(data, timestamp);
  } else if (eventType === 'eol_expired') {
    return generateEolExpiredEmail(data, timestamp);
  }

  // デフォルトのフォーマット
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1e40af; color: white; padding: 20px; border-radius: 5px; }
    .content { padding: 20px; background: #f9fafb; margin-top: 20px; border-radius: 5px; }
    .event-type { font-weight: bold; color: #1e40af; }
    .timestamp { color: #6b7280; font-size: 0.9em; }
    pre { background: #1f2937; color: #f3f4f6; padding: 15px; border-radius: 5px; overflow-x: auto; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Vulflare Notification</h1>
    </div>
    <div class="content">
      <p><strong>Event Type:</strong> <span class="event-type">${eventType}</span></p>
      <p class="timestamp"><strong>Timestamp:</strong> ${new Date(timestamp).toLocaleString('ja-JP')}</p>
      <h3>Event Data:</h3>
      <pre>${JSON.stringify(data, null, 2)}</pre>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * EOL期限が近づいている場合のメール本文
 */
function generateEolApproachingEmail(data: Record<string, unknown>, timestamp: string): string {
  const severity = data.severity as string;
  const severityColor = severity === 'critical' ? '#dc2626' : severity === 'high' ? '#ea580c' : '#f59e0b';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${severityColor}; color: white; padding: 20px; border-radius: 5px; }
    .content { padding: 20px; background: #f9fafb; margin-top: 20px; border-radius: 5px; }
    .warning { background: #fef3c7; border-left: 4px solid ${severityColor}; padding: 15px; margin: 15px 0; }
    .info-grid { display: grid; gap: 10px; }
    .info-item { padding: 10px; background: white; border-radius: 3px; }
    .info-label { font-weight: bold; color: #6b7280; font-size: 0.9em; }
    .info-value { color: #1f2937; margin-top: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ EOL期限が近づいています</h1>
    </div>
    <div class="content">
      <div class="warning">
        <strong>${data.display_name} (${data.cycle})</strong> のサポート終了が <strong>${data.days_until_eol}日後</strong> に迫っています。
      </div>

      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">プロダクト</div>
          <div class="info-value">${data.display_name} (${data.product_name})</div>
        </div>
        <div class="info-item">
          <div class="info-label">バージョン</div>
          <div class="info-value">${data.cycle}</div>
        </div>
        <div class="info-item">
          <div class="info-label">カテゴリ</div>
          <div class="info-value">${data.category}</div>
        </div>
        ${data.vendor ? `
        <div class="info-item">
          <div class="info-label">ベンダー</div>
          <div class="info-value">${data.vendor}</div>
        </div>
        ` : ''}
        <div class="info-item">
          <div class="info-label">EOL日</div>
          <div class="info-value">${data.eol_date}</div>
        </div>
      </div>

      <p style="margin-top: 20px; color: #6b7280; font-size: 0.9em;">
        通知日時: ${new Date(timestamp).toLocaleString('ja-JP')}
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * EOL期限切れの場合のメール本文
 */
function generateEolExpiredEmail(data: Record<string, unknown>, timestamp: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 20px; border-radius: 5px; }
    .content { padding: 20px; background: #f9fafb; margin-top: 20px; border-radius: 5px; }
    .alert { background: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 15px 0; }
    .info-grid { display: grid; gap: 10px; }
    .info-item { padding: 10px; background: white; border-radius: 3px; }
    .info-label { font-weight: bold; color: #6b7280; font-size: 0.9em; }
    .info-value { color: #1f2937; margin-top: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔴 サポート終了（EOL）</h1>
    </div>
    <div class="content">
      <div class="alert">
        <strong>${data.display_name} (${data.cycle})</strong> のサポートが終了しました。早急な対応が必要です。
      </div>

      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">プロダクト</div>
          <div class="info-value">${data.display_name} (${data.product_name})</div>
        </div>
        <div class="info-item">
          <div class="info-label">バージョン</div>
          <div class="info-value">${data.cycle}</div>
        </div>
        <div class="info-item">
          <div class="info-label">カテゴリ</div>
          <div class="info-value">${data.category}</div>
        </div>
        ${data.vendor ? `
        <div class="info-item">
          <div class="info-label">ベンダー</div>
          <div class="info-value">${data.vendor}</div>
        </div>
        ` : ''}
        <div class="info-item">
          <div class="info-label">EOL日</div>
          <div class="info-value">${data.eol_date}</div>
        </div>
      </div>

      <p style="margin-top: 20px; color: #6b7280; font-size: 0.9em;">
        通知日時: ${new Date(timestamp).toLocaleString('ja-JP')}
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * 通知テスト送信
 */
export async function sendTestNotification(
  env: Env,
  channel: { id: string; type: string; config: string }
): Promise<void> {
  const testPayload: NotificationPayload = {
    eventType: 'vulnerability_created',
    data: {
      test: true,
      message: 'This is a test notification from Vulflare',
    },
    timestamp: new Date().toISOString(),
  };

  const config = JSON.parse(channel.config) as Record<string, unknown>;

  if (channel.type === 'webhook') {
    await sendWebhook(config, testPayload);
  } else if (channel.type === 'email') {
    await sendEmail(env, config, testPayload);
  }
}
