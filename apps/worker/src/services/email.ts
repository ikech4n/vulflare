import type { Env } from "../types.ts";

/** RFC 2047 Base64 エンコード（非ASCII ヘッダー用） */
function encodeHeader(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

/** Base64 エンコード＋76文字で折り返し（RFC 2045 準拠） */
function encodeBody(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/(.{76})/g, "$1\r\n");
}

/**
 * パスワードリセットメールを送信する
 */
export async function sendPasswordResetEmail(
  env: Env,
  from: string,
  to: string,
  resetUrl: string,
): Promise<void> {
  const subject = "Vulflare: パスワードリセット";

  const textBody = [
    "Vulflare パスワードリセット",
    "",
    "パスワードリセットのリクエストを受け付けました。",
    "以下のリンクをクリックして新しいパスワードを設定してください。",
    "",
    resetUrl,
    "",
    "このリンクは1時間有効です。",
    "このリクエストに心当たりがない場合は、このメールを無視してください。",
  ].join("\n");

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1e40af; color: white; padding: 20px; border-radius: 5px; }
    .content { padding: 20px; background: #f9fafb; margin-top: 20px; border-radius: 5px; }
    .button { display: inline-block; background-color: #1e40af; color: #ffffff !important; padding: 12px 24px; border-radius: 5px; text-decoration: none !important; font-weight: bold; margin: 20px 0; border: 2px solid #1e40af; }
    .note { color: #6b7280; font-size: 0.9em; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Vulflare パスワードリセット</h1>
    </div>
    <div class="content">
      <p>パスワードリセットのリクエストを受け付けました。</p>
      <p>以下のボタンをクリックして新しいパスワードを設定してください。</p>
      <a href="${resetUrl}" class="button">パスワードをリセットする</a>
      <p>ボタンが機能しない場合は、以下のURLをブラウザに貼り付けてください：</p>
      <p style="word-break: break-all; font-size: 0.85em; color: #4b5563;">${resetUrl}</p>
      <p class="note">このリンクは1時間有効です。このリクエストに心当たりがない場合は、このメールを無視してください。</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const { EmailMessage } = await import("cloudflare:email");

  const domain = from.split("@")[1];
  const messageId = `<${crypto.randomUUID()}@${domain}>`;
  const date = new Date().toUTCString();
  const boundary = `boundary_${crypto.randomUUID().replace(/-/g, "")}`;

  let mimeMessage = `From: ${encodeHeader("Vulflare")} <${from}>\r\n`;
  mimeMessage += `To: ${to}\r\n`;
  mimeMessage += `Subject: ${encodeHeader(subject)}\r\n`;
  mimeMessage += `Date: ${date}\r\n`;
  mimeMessage += `Message-ID: ${messageId}\r\n`;
  mimeMessage += "MIME-Version: 1.0\r\n";
  mimeMessage += `List-Unsubscribe: <mailto:${from}?subject=unsubscribe>\r\n`;
  mimeMessage += "List-Unsubscribe-Post: List-Unsubscribe=One-Click\r\n";
  mimeMessage += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n`;
  mimeMessage += "\r\n";

  mimeMessage += `--${boundary}\r\n`;
  mimeMessage += "Content-Type: text/plain; charset=utf-8\r\n";
  mimeMessage += "Content-Transfer-Encoding: base64\r\n";
  mimeMessage += "\r\n";
  mimeMessage += encodeBody(textBody);
  mimeMessage += "\r\n";

  mimeMessage += `--${boundary}\r\n`;
  mimeMessage += "Content-Type: text/html; charset=utf-8\r\n";
  mimeMessage += "Content-Transfer-Encoding: base64\r\n";
  mimeMessage += "\r\n";
  mimeMessage += encodeBody(htmlBody);
  mimeMessage += "\r\n";

  mimeMessage += `--${boundary}--\r\n`;

  const message = new EmailMessage(from, to, mimeMessage);
  await env.SEND_EMAIL.send(message);
}
