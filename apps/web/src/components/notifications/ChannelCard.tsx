import type { NotificationChannel } from "@vulflare/shared/types";
import { Edit2, Send, Trash2 } from "lucide-react";

interface ChannelCardProps {
  channel: NotificationChannel;
  onEdit: (channel: NotificationChannel) => void;
  onTest: (id: string) => void;
  onDelete: (id: string) => void;
  isTestPending?: boolean;
  isDeletePending?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  webhook: "Webhook",
  email: "Email",
  slack: "Slack",
};

export function ChannelCard({
  channel,
  onEdit,
  onTest,
  onDelete,
  isTestPending,
  isDeletePending,
}: ChannelCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{channel.name}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {TYPE_LABELS[channel.type] ?? channel.type}
          </p>
          <div className="mt-2">
            <span
              className={`px-2 py-1 text-xs rounded ${
                channel.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
              }`}
            >
              {channel.is_active ? "有効" : "無効"}
            </span>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => onTest(channel.id)}
            disabled={isTestPending}
            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded disabled:opacity-50"
            title="テスト送信"
          >
            <Send className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onEdit(channel)}
            className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
            title="編集"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (!confirm("このチャネルを削除しますか？")) return;
              onDelete(channel.id);
            }}
            disabled={isDeletePending}
            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50"
            title="削除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
