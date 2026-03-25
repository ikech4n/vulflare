import type { EventType, NotificationChannel, NotificationRule } from "@vulflare/shared/types";
import { CheckCircle, Plus, XCircle } from "lucide-react";
import { useState } from "react";
import { useCreateRule, useDeleteRule, useToggleRule } from "@/hooks/useNotifications.ts";
import { RuleForm } from "./RuleForm.tsx";

const EVENT_LABELS: Record<EventType, string> = {
  vulnerability_created: "脆弱性作成",
  vulnerability_updated: "脆弱性更新",
  vulnerability_critical: "クリティカル脆弱性",
  eol_approaching: "EOL期限接近",
  eol_expired: "EOL期限切れ",
};

interface RuleListProps {
  rules: NotificationRule[];
  channels: NotificationChannel[];
}

export function RuleList({ rules, channels }: RuleListProps) {
  const [showForm, setShowForm] = useState(false);

  const createRule = useCreateRule();
  const deleteRule = useDeleteRule();
  const toggleRule = useToggleRule();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          ルール追加
        </button>
      </div>

      {showForm && (
        <RuleForm
          channels={channels}
          onSubmit={(data) => {
            createRule.mutate(data, { onSuccess: () => setShowForm(false) });
          }}
          onCancel={() => setShowForm(false)}
          isPending={createRule.isPending}
        />
      )}

      {rules.length === 0 && !showForm ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          ルールがありません。「ルール追加」から作成してください。
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    チャネル
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    イベント
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    フィルタ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    状態
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {rules.map((rule) => {
                  const channel = channels.find((ch) => ch.id === rule.channel_id);
                  let filterSummary: string | null = null;
                  if (rule.filter_config) {
                    try {
                      const fc = JSON.parse(rule.filter_config) as Record<string, unknown>;
                      if (Array.isArray(fc.severity) && fc.severity.length > 0) {
                        filterSummary = `深刻度: ${(fc.severity as string[]).join(", ")}`;
                      }
                    } catch {
                      // ignore
                    }
                  }
                  return (
                    <tr key={rule.id}>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {channel?.name ?? "Unknown"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {EVENT_LABELS[rule.event_type as EventType] ?? rule.event_type}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {filterSummary ?? (
                          <span className="text-gray-300 dark:text-gray-600">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-1 text-xs rounded ${
                              rule.is_active
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {rule.is_active ? "有効" : "無効"}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              toggleRule.mutate({ id: rule.id, isActive: !rule.is_active })
                            }
                            disabled={toggleRule.isPending}
                            className={`p-1 rounded transition-colors ${
                              rule.is_active
                                ? "text-green-600 hover:bg-green-50"
                                : "text-gray-400 hover:bg-gray-50"
                            } disabled:opacity-50`}
                            title={rule.is_active ? "無効にする" : "有効にする"}
                          >
                            {rule.is_active ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            if (!confirm("このルールを削除しますか？")) return;
                            deleteRule.mutate(rule.id);
                          }}
                          className="text-sm text-red-600 hover:text-red-900"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
