import { api } from "@/lib/api.ts";
import { useAuthStore } from "@/store/authStore.ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  EventType,
  NotificationChannel,
  NotificationLog,
  NotificationRule,
} from "@vulflare/shared/types";
import { Bell, CheckCircle, Edit2, Plus, Send, Trash2, XCircle } from "lucide-react";
import { useState } from "react";

const EVENT_LABELS: Record<EventType, string> = {
  vulnerability_created: "脆弱性作成",
  vulnerability_updated: "脆弱性更新",
  vulnerability_critical: "クリティカル脆弱性",
  eol_approaching: "EOL期限接近",
  eol_expired: "EOL期限切れ",
};

function parsePayload(payloadStr: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(payloadStr);
    return parsed.data ?? parsed;
  } catch {
    return {};
  }
}

function LogDetail({ log }: { log: NotificationLog }) {
  const data = parsePayload(log.payload);

  if (log.event_type === "eol_approaching" || log.event_type === "eol_expired") {
    const name = data.display_name as string | undefined;
    const cycle = data.cycle as string | undefined;
    const eolDate = data.eol_date as string | undefined;
    const daysUntil = data.days_until_eol as number | undefined;
    return (
      <div className="text-sm text-gray-700 dark:text-gray-300 space-y-0.5">
        {name && (
          <div>
            <span className="font-medium">{name}</span>
            {cycle ? ` (${cycle})` : ""}
          </div>
        )}
        {eolDate && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            EOL: {eolDate}
            {daysUntil != null ? ` (残 ${daysUntil}日)` : ""}
          </div>
        )}
      </div>
    );
  }

  if (log.event_type.startsWith("vulnerability_")) {
    const title = data.title as string | undefined;
    const vulnId = data.vuln_id as string | undefined;
    const severity = data.severity as string | undefined;
    const cvss = data.cvss_score as number | undefined;
    const createdCount = data.created_count as number | undefined;
    const updatedCount = data.updated_count as number | undefined;
    const criticalCount = data.critical_count as number | undefined;
    const cveIds = data.cve_ids as string[] | undefined;
    return (
      <div className="text-sm text-gray-700 dark:text-gray-300 space-y-0.5">
        {(vulnId || title) && (
          <div>
            <span className="font-medium">{vulnId}</span>
            {title ? ` ${title}` : ""}
          </div>
        )}
        {createdCount != null && (
          <div>
            {createdCount}件登録{criticalCount ? `（Critical: ${criticalCount}件）` : ""}
          </div>
        )}
        {updatedCount != null && <div>{updatedCount}件更新</div>}
        {cveIds?.length && (
          <div className="text-xs text-gray-500 dark:text-gray-400">CVE: {cveIds.join(", ")}</div>
        )}
        {(severity || cvss != null) && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {severity}
            {cvss != null ? ` CVSS: ${cvss}` : ""}
          </div>
        )}
      </div>
    );
  }

  return <span className="text-gray-400">-</span>;
}

export function NotificationsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"channels" | "rules" | "logs">("channels");

  // チャネル作成フォーム
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [channelName, setChannelName] = useState("");
  const [channelType, setChannelType] = useState<"webhook" | "email">("webhook");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [emailFrom, setEmailFrom] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");

  // チャネル編集フォーム
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editChannelName, setEditChannelName] = useState("");
  const [editWebhookUrl, setEditWebhookUrl] = useState("");
  const [editEmailFrom, setEditEmailFrom] = useState("");
  const [editEmailTo, setEditEmailTo] = useState("");
  const [editEmailCc, setEditEmailCc] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  // ルール作成フォーム
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleChannelId, setRuleChannelId] = useState("");
  const [ruleEventType, setRuleEventType] = useState<EventType>("vulnerability_created");

  // チャネル一覧
  const { data: channels = [] } = useQuery<NotificationChannel[]>({
    queryKey: ["notifications", "channels"],
    queryFn: async () => {
      const res = await api.get("/notifications/channels");
      return res.data;
    },
  });

  // ルール一覧
  const { data: rules = [] } = useQuery<NotificationRule[]>({
    queryKey: ["notifications", "rules"],
    queryFn: async () => {
      const res = await api.get("/notifications/rules");
      return res.data;
    },
  });

  // ログ一覧
  const { data: logs = [] } = useQuery<NotificationLog[]>({
    queryKey: ["notifications", "logs"],
    queryFn: async () => {
      const res = await api.get("/notifications/logs");
      return res.data;
    },
  });

  // チャネル作成
  const createChannelMutation = useMutation({
    mutationFn: async () => {
      const config =
        channelType === "webhook"
          ? { url: webhookUrl }
          : {
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

      await api.post("/notifications/channels", {
        name: channelName,
        type: channelType,
        config,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "channels"] });
      setShowChannelForm(false);
      setChannelName("");
      setWebhookUrl("");
      setEmailFrom("");
      setEmailTo("");
      setEmailCc("");
    },
    onError: () => {
      alert("チャネルの作成に失敗しました");
    },
  });

  // チャネル削除
  const deleteChannelMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/notifications/channels/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: () => {
      alert("チャネルの削除に失敗しました");
    },
  });

  // チャネル更新
  const updateChannelMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        name?: string;
        config?: Record<string, unknown>;
        isActive?: boolean;
      };
    }) => {
      await api.patch(`/notifications/channels/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "channels"] });
      setEditingChannelId(null);
      setEditChannelName("");
      setEditWebhookUrl("");
      setEditEmailFrom("");
      setEditEmailTo("");
      setEditEmailCc("");
    },
  });

  // チャネルテスト送信
  const testChannelMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/notifications/channels/${id}/test`);
    },
    onSuccess: () => {
      alert("テスト通知を送信しました。メールをご確認ください。");
    },
    onError: () => {
      alert("テスト送信に失敗しました。設定を確認してください。");
    },
  });

  // ルール作成
  const createRuleMutation = useMutation({
    mutationFn: async () => {
      await api.post("/notifications/rules", {
        channelId: ruleChannelId,
        eventType: ruleEventType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "rules"] });
      setShowRuleForm(false);
      setRuleChannelId("");
    },
    onError: () => {
      alert("ルールの作成に失敗しました");
    },
  });

  // ルール削除
  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/notifications/rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "rules"] });
    },
    onError: () => {
      alert("ルールの削除に失敗しました");
    },
  });

  // ルール有効/無効切り替え
  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await api.patch(`/notifications/rules/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "rules"] });
    },
    onError: () => {
      alert("ルールの更新に失敗しました");
    },
  });

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

  // チャネル編集開始
  const handleEditChannel = (channel: NotificationChannel) => {
    setEditingChannelId(channel.id);
    setEditChannelName(channel.name);
    setEditIsActive(channel.is_active === 1);

    let config: { url?: string; from?: string; to?: string[]; cc?: string[] };
    try {
      config = JSON.parse(channel.config) as typeof config;
    } catch {
      config = {};
    }
    if (channel.type === "webhook") {
      setEditWebhookUrl(config.url || "");
      setEditEmailFrom("");
      setEditEmailTo("");
      setEditEmailCc("");
    } else {
      setEditWebhookUrl("");
      setEditEmailFrom(config.from || "");
      setEditEmailTo(config.to?.join(", ") || "");
      setEditEmailCc(config.cc?.join(", ") || "");
    }
  };

  // チャネル編集保存
  const handleSaveChannel = (channel: NotificationChannel) => {
    const config =
      channel.type === "webhook"
        ? { url: editWebhookUrl }
        : {
            from: editEmailFrom,
            to: editEmailTo
              .split(",")
              .map((e) => e.trim())
              .filter((e) => e),
            ...(editEmailCc && {
              cc: editEmailCc
                .split(",")
                .map((e) => e.trim())
                .filter((e) => e),
            }),
          };

    updateChannelMutation.mutate({
      id: channel.id,
      data: {
        name: editChannelName,
        config,
        isActive: editIsActive,
      },
    });
  };

  // チャネル編集キャンセル
  const handleCancelEdit = () => {
    setEditingChannelId(null);
    setEditChannelName("");
    setEditWebhookUrl("");
    setEditEmailFrom("");
    setEditEmailTo("");
    setEditEmailCc("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">通知設定</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          イベント通知のチャネルとルールを管理します
        </p>
      </div>

      {/* タブ */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            type="button"
            onClick={() => setActiveTab("channels")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "channels"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300"
            }`}
          >
            チャネル
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rules")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "rules"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300"
            }`}
          >
            ルール
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("logs")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "logs"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300"
            }`}
          >
            ログ
          </button>
        </nav>
      </div>

      {/* チャネルタブ */}
      {activeTab === "channels" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowChannelForm(!showChannelForm)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              チャネル追加
            </button>
          </div>

          {showChannelForm && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold dark:text-white mb-4">新規チャネル</h3>
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
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
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
                  <select
                    id="channel-type"
                    value={channelType}
                    onChange={(e) => setChannelType(e.target.value as "webhook" | "email")}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  >
                    <option value="webhook">Webhook</option>
                    <option value="email">Email</option>
                  </select>
                </div>

                {channelType === "webhook" && (
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
                      placeholder="https://hooks.slack.com/..."
                    />
                  </div>
                )}

                {channelType === "email" && (
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
                        placeholder="notifications@vulflare.example.com"
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

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => createChannelMutation.mutate()}
                    disabled={
                      !channelName ||
                      (channelType === "webhook" && !webhookUrl) ||
                      (channelType === "email" && (!emailFrom || !emailTo))
                    }
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    作成
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowChannelForm(false)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {channels.map((channel) => (
              <div key={channel.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                {editingChannelId === channel.id ? (
                  // 編集モード
                  <div>
                    <h3 className="text-lg font-semibold dark:text-white mb-4">チャネル編集</h3>
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="edit-channel-name"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                        >
                          名前
                        </label>
                        <input
                          id="edit-channel-name"
                          type="text"
                          value={editChannelName}
                          onChange={(e) => setEditChannelName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                          placeholder="Slack通知など"
                        />
                      </div>

                      <div>
                        <p className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                          タイプ
                        </p>
                        <select
                          value={channel.type}
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-600 cursor-not-allowed dark:text-gray-300"
                        >
                          <option value="webhook">Webhook</option>
                          <option value="email">Email</option>
                        </select>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          タイプは変更できません
                        </p>
                      </div>

                      {channel.type === "webhook" && (
                        <div>
                          <label
                            htmlFor="edit-channel-webhook-url"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                          >
                            Webhook URL
                          </label>
                          <input
                            id="edit-channel-webhook-url"
                            type="url"
                            value={editWebhookUrl}
                            onChange={(e) => setEditWebhookUrl(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                            placeholder="https://hooks.slack.com/..."
                          />
                        </div>
                      )}

                      {channel.type === "email" && (
                        <>
                          <div>
                            <label
                              htmlFor="edit-channel-email-from"
                              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                            >
                              送信元アドレス
                            </label>
                            <input
                              id="edit-channel-email-from"
                              type="email"
                              value={editEmailFrom}
                              onChange={(e) => setEditEmailFrom(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                              placeholder="notifications@vulflare.example.com"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="edit-channel-email-to"
                              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                            >
                              宛先アドレス（カンマ区切り）
                            </label>
                            <input
                              id="edit-channel-email-to"
                              type="text"
                              value={editEmailTo}
                              onChange={(e) => setEditEmailTo(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                              placeholder="security@example.com, admin@example.com"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="edit-channel-email-cc"
                              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                            >
                              CC（オプション、カンマ区切り）
                            </label>
                            <input
                              id="edit-channel-email-cc"
                              type="text"
                              value={editEmailCc}
                              onChange={(e) => setEditEmailCc(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                              placeholder="manager@example.com"
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={editIsActive}
                            onChange={(e) => setEditIsActive(e.target.checked)}
                            className="mr-2"
                          />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                            有効
                          </span>
                        </label>
                      </div>

                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() => handleSaveChannel(channel)}
                          disabled={
                            !editChannelName ||
                            (channel.type === "webhook" && !editWebhookUrl) ||
                            (channel.type === "email" && (!editEmailFrom || !editEmailTo))
                          }
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // 通常モード
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {channel.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {channel.type}
                      </p>
                      <div className="mt-2">
                        <span
                          className={`px-2 py-1 text-xs rounded ${
                            channel.is_active
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {channel.is_active ? "有効" : "無効"}
                        </span>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => testChannelMutation.mutate(channel.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                        title="テスト送信"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditChannel(channel)}
                        className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                        title="編集"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!confirm("このチャネルを削除しますか？")) return;
                          deleteChannelMutation.mutate(channel.id);
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        title="削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ルールタブ */}
      {activeTab === "rules" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowRuleForm(!showRuleForm)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              ルール追加
            </button>
          </div>

          {showRuleForm && (
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
                    value={ruleChannelId}
                    onChange={(e) => setRuleChannelId(e.target.value)}
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
                    value={ruleEventType}
                    onChange={(e) => setRuleEventType(e.target.value as EventType)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  >
                    {Object.entries(EVENT_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => createRuleMutation.mutate()}
                    disabled={!ruleChannelId}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    作成
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRuleForm(false)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          )}

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
                    return (
                      <tr key={rule.id}>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                          {channel?.name || "Unknown"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                          {EVENT_LABELS[rule.event_type]}
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
                                toggleRuleMutation.mutate({
                                  id: rule.id,
                                  isActive: !rule.is_active,
                                })
                              }
                              disabled={toggleRuleMutation.isPending}
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
                              deleteRuleMutation.mutate(rule.id);
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
        </div>
      )}

      {/* ログタブ */}
      {activeTab === "logs" && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
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
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {log.error_message || "-"}
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
