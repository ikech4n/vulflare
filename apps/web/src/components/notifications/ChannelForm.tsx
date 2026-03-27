import type { NotificationChannel, NotificationChannelType } from "@vulflare/shared/types";
import { useState } from "react";

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        checked ? "bg-blue-500" : "bg-gray-200 dark:bg-gray-600"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform duration-200 ${
          checked ? "translate-x-4.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

const inputClass =
  "w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors";

const labelClass =
  "block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5";

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
  const initType: NotificationChannelType = mode === "edit" ? (channel?.type ?? "slack") : "slack";

  const [name, setName] = useState(channel?.name ?? "");
  const [type, setType] = useState<NotificationChannelType>(initType);
  const [emailFrom, setEmailFrom] = useState(initConfig.from ?? "");
  const [emailTo, setEmailTo] = useState(initConfig.to?.join(", ") ?? "");
  const [emailCc, setEmailCc] = useState(initConfig.cc?.join(", ") ?? "");
  const [slackUrl, setSlackUrl] = useState(initConfig.webhookUrl ?? "");
  const [isActive, setIsActive] = useState(channel ? channel.is_active === 1 : true);

  const resolvedType = mode === "edit" ? initType : type;
  const isValid = !!name && (resolvedType === "slack" ? !!slackUrl : !!emailFrom && !!emailTo);

  const handleSubmit = () => {
    let config: Record<string, unknown>;
    if (resolvedType === "slack") {
      config = { webhookUrl: slackUrl };
    } else {
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
    }
    onSubmit({ name, type: resolvedType, config, ...(mode === "edit" && { isActive }) });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {mode === "create" ? "通知先を追加" : "通知先を編集"}
        </h3>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* 名前 */}
        <div>
          <label htmlFor="channel-name" className={labelClass}>
            名前
          </label>
          <input
            id="channel-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Slack通知など"
          />
        </div>

        {/* タイプ */}
        <div>
          <p className={labelClass}>タイプ</p>
          {mode === "create" ? (
            <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 w-fit">
              {(["slack", "email"] as NotificationChannelType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`px-5 py-1.5 text-sm font-medium transition-colors ${
                    type === t
                      ? "bg-blue-600 text-white"
                      : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                  }`}
                >
                  {t === "slack" ? "Slack" : "Email"}
                </button>
              ))}
            </div>
          ) : (
            <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg">
              {initType === "slack" ? "Slack" : "Email"}
            </span>
          )}
        </div>

        {/* Slack設定 */}
        {resolvedType === "slack" && (
          <div>
            <label htmlFor="channel-slack-url" className={labelClass}>
              Webhook URL
            </label>
            <input
              id="channel-slack-url"
              type="url"
              value={slackUrl}
              onChange={(e) => setSlackUrl(e.target.value)}
              className={inputClass}
              placeholder="https://hooks.slack.com/services/..."
            />
          </div>
        )}

        {/* Email設定 */}
        {resolvedType === "email" && (
          <div className="space-y-3">
            <div>
              <label htmlFor="channel-email-from" className={labelClass}>
                送信元アドレス
              </label>
              <input
                id="channel-email-from"
                type="email"
                value={emailFrom}
                onChange={(e) => setEmailFrom(e.target.value)}
                className={inputClass}
                placeholder="notifications@example.com"
              />
            </div>
            <div>
              <label htmlFor="channel-email-to" className={labelClass}>
                宛先（カンマ区切り）
              </label>
              <input
                id="channel-email-to"
                type="text"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                className={inputClass}
                placeholder="security@example.com, admin@example.com"
              />
            </div>
            <div>
              <label htmlFor="channel-email-cc" className={labelClass}>
                CC{" "}
                <span className="normal-case font-normal text-gray-400">
                  （任意、カンマ区切り）
                </span>
              </label>
              <input
                id="channel-email-cc"
                type="text"
                value={emailCc}
                onChange={(e) => setEmailCc(e.target.value)}
                className={inputClass}
                placeholder="manager@example.com"
              />
            </div>
          </div>
        )}

        {/* 有効/無効（編集時のみ） */}
        {mode === "edit" && (
          <div className="flex items-center gap-3">
            <Toggle checked={isActive} onChange={setIsActive} />
            <span className="text-sm text-gray-700 dark:text-gray-300">有効</span>
          </div>
        )}

        {/* ボタン */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || isPending}
            className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? "処理中..." : mode === "create" ? "追加" : "保存"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
