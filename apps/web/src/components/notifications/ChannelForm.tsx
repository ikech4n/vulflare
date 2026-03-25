import type { NotificationChannel, NotificationChannelType } from "@vulflare/shared/types";
import { useState } from "react";

interface ChannelFormProps {
  mode: "create" | "edit";
  channel?: NotificationChannel;
  onSubmit: (data: {
    name: string;
    type: NotificationChannelType;
    config: Record<string, unknown>;
    isActive?: boolean;
  }) => void;
  onCancel: () => void;
  isPending?: boolean;
}

function parseChannelConfig(channel: NotificationChannel): {
  url?: string;
  from?: string;
  to?: string[];
  cc?: string[];
  webhookUrl?: string;
} {
  try {
    return JSON.parse(channel.config) as ReturnType<typeof parseChannelConfig>;
  } catch {
    return {};
  }
}

export function ChannelForm({ mode, channel, onSubmit, onCancel, isPending }: ChannelFormProps) {
  const initConfig = channel ? parseChannelConfig(channel) : {};
  const initType: NotificationChannelType =
    mode === "edit" ? (channel?.type ?? "webhook") : "webhook";

  const [name, setName] = useState(channel?.name ?? "");
  const [type, setType] = useState<NotificationChannelType>(initType);
  const [webhookUrl, setWebhookUrl] = useState(initConfig.url ?? "");
  const [emailFrom, setEmailFrom] = useState(initConfig.from ?? "");
  const [emailTo, setEmailTo] = useState(initConfig.to?.join(", ") ?? "");
  const [emailCc, setEmailCc] = useState(initConfig.cc?.join(", ") ?? "");
  const [slackUrl, setSlackUrl] = useState(initConfig.webhookUrl ?? "");
  const [isActive, setIsActive] = useState(channel ? channel.is_active === 1 : true);

  const resolvedType = mode === "edit" ? initType : type;

  const isValid =
    !!name &&
    (resolvedType === "webhook"
      ? !!webhookUrl
      : resolvedType === "email"
        ? !!emailFrom && !!emailTo
        : !!slackUrl);

  const handleSubmit = () => {
    let config: Record<string, unknown>;
    if (resolvedType === "webhook") {
      config = { url: webhookUrl };
    } else if (resolvedType === "email") {
      config = {
        from: emailFrom,
        to: emailTo
          .split(",")
          .map((e) => e.trim())
          .filter((e) => e),
        ...(emailCc && {
          cc: emailCc
            .split(",")
            .map((e) => e.trim())
            .filter((e) => e),
        }),
      };
    } else {
      config = { webhookUrl: slackUrl };
    }

    onSubmit({
      name,
      type: resolvedType,
      config,
      ...(mode === "edit" && { isActive }),
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold dark:text-white mb-4">
        {mode === "create" ? "新規チャネル" : "チャネル編集"}
      </h3>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="channel-name"
            className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
          >
            名前
          </label>
          <input
            id="channel-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            placeholder="Slack通知など"
          />
        </div>

        <div>
          <label
            htmlFor="channel-type"
            className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
          >
            タイプ
          </label>
          {mode === "create" ? (
            <select
              id="channel-type"
              value={type}
              onChange={(e) => setType(e.target.value as NotificationChannelType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            >
              <option value="webhook">Webhook</option>
              <option value="email">Email</option>
              <option value="slack">Slack</option>
            </select>
          ) : (
            <>
              <select
                value={initType}
                disabled
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-600 cursor-not-allowed dark:text-gray-300"
              >
                <option value="webhook">Webhook</option>
                <option value="email">Email</option>
                <option value="slack">Slack</option>
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                タイプは変更できません
              </p>
            </>
          )}
        </div>

        {resolvedType === "webhook" && (
          <div>
            <label
              htmlFor="channel-webhook-url"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
            >
              Webhook URL
            </label>
            <input
              id="channel-webhook-url"
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              placeholder="https://example.com/webhook"
            />
          </div>
        )}

        {resolvedType === "slack" && (
          <div>
            <label
              htmlFor="channel-slack-url"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
            >
              Slack Webhook URL
            </label>
            <input
              id="channel-slack-url"
              type="url"
              value={slackUrl}
              onChange={(e) => setSlackUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              placeholder="https://hooks.slack.com/services/..."
            />
          </div>
        )}

        {resolvedType === "email" && (
          <>
            <div>
              <label
                htmlFor="channel-email-from"
                className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
              >
                送信元アドレス
              </label>
              <input
                id="channel-email-from"
                type="email"
                value={emailFrom}
                onChange={(e) => setEmailFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                placeholder="notifications@example.com"
              />
            </div>
            <div>
              <label
                htmlFor="channel-email-to"
                className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
              >
                宛先アドレス（カンマ区切り）
              </label>
              <input
                id="channel-email-to"
                type="text"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                placeholder="security@example.com, admin@example.com"
              />
            </div>
            <div>
              <label
                htmlFor="channel-email-cc"
                className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
              >
                CC（オプション、カンマ区切り）
              </label>
              <input
                id="channel-email-cc"
                type="text"
                value={emailCc}
                onChange={(e) => setEmailCc(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                placeholder="manager@example.com"
              />
            </div>
          </>
        )}

        {mode === "edit" && (
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">有効</span>
            </label>
          </div>
        )}

        <div className="flex space-x-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {mode === "create" ? "作成" : "保存"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
