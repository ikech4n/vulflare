import type { EventType, NotificationChannel, NotificationRule } from "@vulflare/shared/types";
import { Edit2, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { useCreateRule, useDeleteRule, useUpdateRule } from "@/hooks/useNotifications.ts";

const AVAILABLE_EVENTS: { type: EventType; label: string; category: "vulnerability" | "eol" }[] = [
  { type: "vulnerability_created", label: "脆弱性作成", category: "vulnerability" },
  { type: "vulnerability_updated", label: "脆弱性更新", category: "vulnerability" },
  { type: "eol_approaching", label: "EOL期限接近", category: "eol" },
  { type: "hw_support_approaching", label: "ハードウェア保守期限接近", category: "eol" },
];

const EVENT_LABELS: Record<string, string> = Object.fromEntries(
  AVAILABLE_EVENTS.map(({ type, label }) => [type, label]),
);

const TYPE_LABELS: Record<string, string> = {
  slack: "Slack",
  email: "Email",
};

const SEVERITY_OPTIONS = ["critical", "high", "medium", "low", "informational"] as const;

const SEVERITY_COLORS: Record<string, string> = {
  critical:
    "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-700 dark:text-red-400",
  high: "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/20 dark:border-orange-700 dark:text-orange-400",
  medium:
    "bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-700 dark:text-yellow-400",
  low: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-400",
  informational:
    "bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300",
};

type EventDraft = {
  enabled: boolean;
  severities: string[];
};

function parseFilterConfig(filterConfig: string | null): string[] {
  if (!filterConfig) return [];
  try {
    const fc = JSON.parse(filterConfig) as Record<string, unknown>;
    return Array.isArray(fc.severity) ? (fc.severity as string[]) : [];
  } catch {
    return [];
  }
}

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

interface ChannelCardProps {
  channel: NotificationChannel;
  rules: NotificationRule[];
  onEdit: (channel: NotificationChannel) => void;
  onTest: (id: string) => void;
  onDelete: (id: string) => void;
  isTestPending?: boolean;
  isDeletePending?: boolean;
}

export function ChannelCard({
  channel,
  rules,
  onEdit,
  onTest,
  onDelete,
  isTestPending,
  isDeletePending,
}: ChannelCardProps) {
  const [isEditingRules, setIsEditingRules] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, EventDraft>>({});
  const [isSaving, setIsSaving] = useState(false);

  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();

  const enterEditMode = () => {
    const initial: Record<string, EventDraft> = {};
    for (const { type } of AVAILABLE_EVENTS) {
      const existing = rules.find((r) => r.event_type === type);
      initial[type] = {
        enabled: Boolean(existing),
        severities: existing ? parseFilterConfig(existing.filter_config) : [],
      };
    }
    setDrafts(initial);
    setIsEditingRules(true);
  };

  const cancelEdit = () => {
    setIsEditingRules(false);
    setDrafts({});
  };

  const saveEdits = async () => {
    setIsSaving(true);
    try {
      const promises: Promise<unknown>[] = [];
      for (const { type } of AVAILABLE_EVENTS) {
        const draft = drafts[type];
        if (!draft) continue;
        const existing = rules.find((r) => r.event_type === type);

        if (draft.enabled && !existing) {
          const filterConfig =
            draft.severities.length > 0 ? { severity: draft.severities } : undefined;
          promises.push(
            createRule.mutateAsync({ channelId: channel.id, eventType: type, filterConfig }),
          );
        } else if (!draft.enabled && existing) {
          promises.push(deleteRule.mutateAsync(existing.id));
        } else if (draft.enabled && existing) {
          const origSeverities = parseFilterConfig(existing.filter_config);
          const severitiesChanged =
            JSON.stringify([...origSeverities].sort()) !==
            JSON.stringify([...draft.severities].sort());
          if (severitiesChanged) {
            const filterConfig =
              draft.severities.length > 0 ? { severity: draft.severities } : undefined;
            promises.push(updateRule.mutateAsync({ id: existing.id, data: { filterConfig } }));
          }
        }
      }
      await Promise.all(promises);
      setIsEditingRules(false);
      setDrafts({});
    } finally {
      setIsSaving(false);
    }
  };

  const updateDraft = (type: string, patch: Partial<EventDraft>) => {
    setDrafts((prev) => {
      const current = prev[type];
      if (!current) return prev;
      return { ...prev, [type]: { ...current, ...patch } };
    });
  };

  const toggleSeverity = (type: string, sev: string) => {
    const draft = drafts[type];
    if (!draft) return;
    updateDraft(type, {
      severities: draft.severities.includes(sev)
        ? draft.severities.filter((s) => s !== sev)
        : [...draft.severities, sev],
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* チャンネルヘッダー */}
      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-2 h-2 rounded-full shrink-0 ${
              channel.is_active ? "bg-green-400" : "bg-gray-300"
            }`}
          />
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white truncate">{channel.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {TYPE_LABELS[channel.type] ?? channel.type}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onTest(channel.id)}
            disabled={isTestPending}
            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-40"
            title="テスト送信"
          >
            <Send className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onEdit(channel)}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="通知先を編集"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (!confirm("この通知先を削除しますか？")) return;
              onDelete(channel.id);
            }}
            disabled={isDeletePending}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-40"
            title="削除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ルールセクション */}
      <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            通知ルール
          </span>
          {!isEditingRules ? (
            <button
              type="button"
              onClick={enterEditMode}
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
            >
              編集
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveEdits}
                disabled={isSaving}
                className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSaving ? "保存中..." : "保存"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={isSaving}
                className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full disabled:opacity-50 transition-colors"
              >
                キャンセル
              </button>
            </div>
          )}
        </div>

        {/* 表示モード */}
        {!isEditingRules && (
          <div className="space-y-1">
            {AVAILABLE_EVENTS.map(({ type, label, category }) => {
              const rule = rules.find((r) => r.event_type === type);
              const sevs = rule ? parseFilterConfig(rule.filter_config) : [];
              const enabled = Boolean(rule);
              return (
                <div
                  key={type}
                  className={`flex items-center gap-2.5 py-1.5 ${!enabled ? "opacity-35" : ""}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      enabled
                        ? category === "vulnerability"
                          ? "bg-orange-400"
                          : "bg-blue-400"
                        : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  />
                  <span
                    className={`text-xs ${
                      enabled
                        ? "text-gray-800 dark:text-gray-200"
                        : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {label}
                  </span>
                  {sevs.length > 0 && (
                    <div className="flex flex-wrap gap-1 ml-1">
                      {sevs.map((sev) => (
                        <span
                          key={sev}
                          className={`px-1.5 py-0.5 text-[10px] rounded-full border font-medium ${SEVERITY_COLORS[sev] ?? SEVERITY_COLORS.informational}`}
                        >
                          {sev}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 編集モード */}
        {isEditingRules && (
          <div className="space-y-4">
            {(["vulnerability", "eol"] as const).map((category) => {
              const events = AVAILABLE_EVENTS.filter((e) => e.category === category);
              return (
                <div key={category}>
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                    {category === "vulnerability" ? "脆弱性" : "EOL"}
                  </p>
                  <div className="space-y-3">
                    {events.map(({ type, label }) => {
                      const draft = drafts[type];
                      if (!draft) return null;
                      const isVuln = category === "vulnerability";
                      return (
                        <div key={type} className="space-y-2">
                          <div className="flex items-center gap-3">
                            <Toggle
                              checked={draft.enabled}
                              onChange={(v) => updateDraft(type, { enabled: v })}
                            />
                            <span
                              className={`text-sm transition-colors ${
                                draft.enabled
                                  ? "text-gray-900 dark:text-white"
                                  : "text-gray-400 dark:text-gray-500"
                              }`}
                            >
                              {label}
                            </span>
                          </div>
                          {draft.enabled && isVuln && (
                            <div className="ml-12 space-y-1.5">
                              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                                深刻度フィルタ（未選択で全て対象）
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {SEVERITY_OPTIONS.map((sev) => {
                                  const selected = draft.severities.includes(sev);
                                  return (
                                    <button
                                      key={sev}
                                      type="button"
                                      onClick={() => toggleSeverity(type, sev)}
                                      className={`px-2.5 py-1 text-xs rounded-full border font-medium transition-all ${
                                        selected
                                          ? (SEVERITY_COLORS[sev] ?? SEVERITY_COLORS.informational)
                                          : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-gray-300"
                                      }`}
                                    >
                                      {sev}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
