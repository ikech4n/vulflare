import type { EventType, NotificationChannel } from "@vulflare/shared/types";
import { useState } from "react";

const EVENT_LABELS: Record<EventType, string> = {
  vulnerability_created: "脆弱性作成",
  vulnerability_updated: "脆弱性更新",
  vulnerability_critical: "クリティカル脆弱性",
  eol_approaching: "EOL期限接近",
  eol_expired: "EOL期限切れ",
};

const VULNERABILITY_EVENTS: EventType[] = [
  "vulnerability_created",
  "vulnerability_updated",
  "vulnerability_critical",
];

const SEVERITY_OPTIONS = ["critical", "high", "medium", "low", "informational"] as const;

interface RuleFormProps {
  channels: NotificationChannel[];
  onSubmit: (data: {
    channelId: string;
    eventType: EventType;
    filterConfig?: Record<string, unknown>;
  }) => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function RuleForm({ channels, onSubmit, onCancel, isPending }: RuleFormProps) {
  const [channelId, setChannelId] = useState("");
  const [eventType, setEventType] = useState<EventType>("vulnerability_created");
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);

  const isVulnEvent = VULNERABILITY_EVENTS.includes(eventType);

  const toggleSeverity = (sev: string) => {
    setSelectedSeverities((prev) =>
      prev.includes(sev) ? prev.filter((s) => s !== sev) : [...prev, sev],
    );
  };

  const handleSubmit = () => {
    const filterConfig: Record<string, unknown> = {};
    if (isVulnEvent && selectedSeverities.length > 0) {
      filterConfig.severity = selectedSeverities;
    }

    onSubmit({
      channelId,
      eventType,
      ...(Object.keys(filterConfig).length > 0 && { filterConfig }),
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold dark:text-white mb-4">新規ルール</h3>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="rule-channel"
            className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
          >
            チャネル
          </label>
          <select
            id="rule-channel"
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
          >
            <option value="">選択してください</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="rule-event-type"
            className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
          >
            イベント
          </label>
          <select
            id="rule-event-type"
            value={eventType}
            onChange={(e) => {
              setEventType(e.target.value as EventType);
              setSelectedSeverities([]);
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
          >
            {Object.entries(EVENT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {isVulnEvent && (
          <div>
            <p className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              深刻度フィルタ（未選択の場合は全て対象）
            </p>
            <div className="flex flex-wrap gap-2">
              {SEVERITY_OPTIONS.map((sev) => (
                <label key={sev} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSeverities.includes(sev)}
                    onChange={() => toggleSeverity(sev)}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{sev}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex space-x-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!channelId || isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            作成
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
