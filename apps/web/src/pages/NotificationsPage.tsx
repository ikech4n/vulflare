import { useState } from "react";
import { ChannelList } from "@/components/notifications/ChannelList.tsx";
import { LogTable } from "@/components/notifications/LogTable.tsx";
import { useChannels, useRules } from "@/hooks/useNotifications.ts";
import { useAuthStore } from "@/store/authStore.ts";

export function NotificationsPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"channels" | "logs">("channels");

  const { data: channels = [] } = useChannels();
  const { data: rules = [] } = useRules();

  if (user?.role === "viewer") {
    return (
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">通知設定</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          この画面は編集者以上のみ利用できます。
        </p>
      </div>
    );
  }

  const tabs = [
    { id: "channels" as const, label: "通知先" },
    { id: "logs" as const, label: "ログ" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">通知設定</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">通知先とルールを管理します</p>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "channels" && <ChannelList channels={channels} rules={rules} />}
      {activeTab === "logs" && <LogTable channels={channels} />}
    </div>
  );
}
