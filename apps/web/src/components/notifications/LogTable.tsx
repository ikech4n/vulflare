import type { EventType, NotificationChannel } from "@vulflare/shared/types";
import { CheckCircle, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";
import type { LogFilters } from "@/hooks/useNotifications.ts";
import { useLogs, useResendLog } from "@/hooks/useNotifications.ts";
import { LogDetail } from "./LogDetail.tsx";

const EVENT_LABELS: Partial<Record<EventType, string>> = {
  vulnerability_created: "脆弱性作成",
  vulnerability_updated: "脆弱性更新",
  vulnerability_critical: "クリティカル脆弱性",
  eol_approaching: "EOL期限接近",
  eol_expired: "EOL期限切れ",
};

interface LogTableProps {
  channels: NotificationChannel[];
}

export function LogTable({ channels }: LogTableProps) {
  const [filters, setFilters] = useState<LogFilters>({ page: 1, limit: 50 });

  const { data: logsResult, isLoading } = useLogs(filters);
  const resendLog = useResendLog();

  const logs = logsResult?.data ?? [];
  const total = logsResult?.total ?? 0;
  const totalPages = Math.ceil(total / (filters.limit ?? 50));

  const updateFilter = (updates: Partial<LogFilters>) => {
    setFilters((prev) => ({ ...prev, ...updates, page: 1 }));
  };

  return (
    <div className="space-y-4">
      {/* フィルタバー */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-wrap gap-3">
        <select
          value={filters.channelId ?? ""}
          onChange={(e) => updateFilter({ channelId: e.target.value || undefined })}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
        >
          <option value="">全チャネル</option>
          {channels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.name}
            </option>
          ))}
        </select>

        <select
          value={filters.eventType ?? ""}
          onChange={(e) => updateFilter({ eventType: e.target.value || undefined })}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
        >
          <option value="">全イベント</option>
          {Object.entries(EVENT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={filters.status ?? ""}
          onChange={(e) =>
            updateFilter({
              status: (e.target.value || undefined) as LogFilters["status"],
            })
          }
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
        >
          <option value="">全ステータス</option>
          <option value="sent">成功</option>
          <option value="failed">失敗</option>
          <option value="pending">保留中</option>
        </select>

        <input
          type="date"
          value={filters.dateFrom ?? ""}
          onChange={(e) => updateFilter({ dateFrom: e.target.value || undefined })}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
          placeholder="開始日"
        />

        <input
          type="date"
          value={filters.dateTo ?? ""}
          onChange={(e) => updateFilter({ dateTo: e.target.value || undefined })}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
          placeholder="終了日"
        />

        <button
          type="button"
          onClick={() => setFilters({ page: 1, limit: 50 })}
          className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-md"
        >
          リセット
        </button>
      </div>

      {/* テーブル */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-gray-500 dark:text-gray-400">読み込み中...</div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-gray-500 dark:text-gray-400">ログがありません</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    送信日時
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    チャネル
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    イベント
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    詳細
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    状態
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    エラー
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {logs.map((log) => {
                  const channel = channels.find((c) => c.id === log.channel_id);
                  return (
                    <tr key={log.id}>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {new Date(`${log.sent_at.replace(" ", "T")}Z`).toLocaleString("ja-JP", {
                          timeZone: "Asia/Tokyo",
                          hour12: false,
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        {channel ? (
                          <span>{channel.name}</span>
                        ) : (
                          <span className="text-xs text-gray-400">
                            {log.channel_id.slice(0, 8)}…
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {EVENT_LABELS[log.event_type] ?? log.event_type}
                      </td>
                      <td className="px-6 py-4 min-w-48">
                        <LogDetail log={log} />
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`flex items-center gap-1 px-2 py-1 text-xs rounded whitespace-nowrap ${
                            log.status === "sent"
                              ? "bg-green-100 text-green-800"
                              : log.status === "failed"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {log.status === "sent" ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : log.status === "failed" ? (
                            <XCircle className="w-3 h-3" />
                          ) : null}
                          {log.status === "sent"
                            ? "成功"
                            : log.status === "failed"
                              ? "失敗"
                              : "保留中"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                        {log.error_message ?? "-"}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {log.status === "failed" && (
                          <button
                            type="button"
                            onClick={() => resendLog.mutate(log.id)}
                            disabled={resendLog.isPending}
                            className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded disabled:opacity-50"
                            title="再送信"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            全 {total} 件中 {((filters.page ?? 1) - 1) * (filters.limit ?? 50) + 1}〜
            {Math.min((filters.page ?? 1) * (filters.limit ?? 50), total)} 件
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={(filters.page ?? 1) <= 1}
              onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) - 1 }))}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-40"
            >
              前へ
            </button>
            <span className="px-3 py-1">
              {filters.page ?? 1} / {totalPages}
            </span>
            <button
              type="button"
              disabled={(filters.page ?? 1) >= totalPages}
              onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-40"
            >
              次へ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
