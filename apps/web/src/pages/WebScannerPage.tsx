import { useQuery } from "@tanstack/react-query";
import type { WebScan, WebScanTargetWithStats } from "@vulflare/shared/types";
import { AlertTriangle, Globe, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { WebScanTargetModal } from "@/components/WebScanTargetModal.tsx";
import { api } from "@/lib/api.ts";
import { useAuthStore } from "@/store/authStore.ts";

function ScanStatusBadge({ scan }: { scan: WebScan | null }) {
  if (!scan) return <span className="text-xs text-gray-400">未スキャン</span>;
  if (scan.status === "running")
    return (
      <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
        <RefreshCw size={12} className="animate-spin" />
        スキャン中
      </span>
    );
  if (scan.status === "failed") return <span className="text-xs text-red-500">失敗</span>;
  return (
    <span className="text-xs text-green-600 dark:text-green-400">
      完了 ({new Date(scan.completedAt ?? "").toLocaleDateString("ja-JP")})
    </span>
  );
}

export function WebScannerPage() {
  const { user } = useAuthStore();
  const isEditor = user?.role === "admin" || user?.role === "editor";
  const [showModal, setShowModal] = useState(false);

  const { data: targets = [], isLoading } = useQuery<WebScanTargetWithStats[]>({
    queryKey: ["web-scanner-targets"],
    queryFn: async () => {
      const res = await api.get<WebScanTargetWithStats[]>("/web-scanner/targets");
      return res.data;
    },
    refetchInterval: (query) =>
      query.state.data?.some((t) => t.latestScan?.status === "running") ? 5000 : false,
  });

  const totalFindings = targets.reduce((sum, t) => sum + t.findingsCount, 0);
  const affectedTargets = targets.filter((t) => t.findingsCount > 0).length;

  return (
    <div className="p-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe size={24} />
            Webスキャナー
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            セキュリティヘッダー・機密ファイル・ライブラリ等の受動的脆弱性スキャン
          </p>
        </div>
        {isEditor && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Plus size={16} />
            新規ターゲット
          </button>
        )}
      </div>

      {/* 免責事項バナー */}
      <div className="flex items-start gap-3 rounded-lg border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3">
        <AlertTriangle
          size={16}
          className="flex-shrink-0 mt-0.5 text-yellow-600 dark:text-yellow-400"
        />
        <p className="text-sm text-yellow-800 dark:text-yellow-300">
          <strong>注意：</strong>
          このスキャナーは自身が所有・管理するサイト、またはスキャンの許可を得たサイトに対してのみ使用してください。無断でのスキャンは不正アクセスに該当し、法的責任を問われる場合があります。
        </p>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">スキャンターゲット</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{targets.length}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">検出された問題</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
            {totalFindings}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">問題のあるターゲット</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
            {affectedTargets}
          </p>
        </div>
      </div>

      {/* ターゲット一覧 */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800">
        <div className="p-4 border-b border-gray-200 dark:border-zinc-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">スキャンターゲット一覧</h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">読み込み中...</div>
        ) : targets.length === 0 ? (
          <div className="p-8 text-center">
            <Globe size={40} className="mx-auto mb-3 text-gray-300 dark:text-zinc-600" />
            <p className="text-gray-500 dark:text-gray-400">スキャンターゲットがありません</p>
            {isEditor && (
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                最初のターゲットを追加する
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-zinc-800">
            {targets.map((target) => (
              <Link
                key={target.id}
                to={`/web-scanner/${target.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Globe size={16} className="text-gray-400 flex-shrink-0" />
                    <span className="font-medium text-gray-900 dark:text-white truncate">
                      {target.name}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                    {target.url}
                  </p>
                </div>

                <div className="flex items-center gap-6 ml-4 flex-shrink-0">
                  <div className="text-right">
                    <ScanStatusBadge scan={target.latestScan} />
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    {target.findingsCount > 0 ? (
                      <>
                        <ShieldAlert size={14} className="text-orange-500" />
                        <span className="text-orange-600 dark:text-orange-400 font-medium">
                          {target.findingsCount}件
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-400 text-xs">問題なし</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showModal && <WebScanTargetModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
