import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuditProjectWithStats, AuditScan } from "@vulflare/shared/types";
import { Package, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { LockfileUploadModal } from "@/components/LockfileUploadModal.tsx";
import { api } from "@/lib/api.ts";
import { useAuthStore } from "@/store/authStore.ts";

const _SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-600 dark:text-red-400",
  high: "text-orange-600 dark:text-orange-400",
  medium: "text-yellow-600 dark:text-yellow-400",
  low: "text-blue-600 dark:text-blue-400",
};

const ECOSYSTEM_LABELS: Record<string, string> = {
  npm: "npm",
  Packagist: "PHP (Composer)",
};

function ScanStatusBadge({ scan }: { scan: AuditScan | null }) {
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

export function PackageAuditPage() {
  const { user } = useAuthStore();
  const isEditor = user?.role === "admin" || user?.role === "editor";
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const { data: projects = [], isLoading } = useQuery<AuditProjectWithStats[]>({
    queryKey: ["audit-projects"],
    queryFn: async () => {
      const res = await api.get<AuditProjectWithStats[]>("/audit/projects");
      return res.data;
    },
    refetchInterval: (query) =>
      query.state.data?.some((p) => p.latestScan?.status === "running") ? 5000 : false,
  });

  const totalVulns = projects.reduce((sum, p) => sum + p.vulnsFound, 0);
  const criticalProjects = projects.filter((p) => p.vulnsFound > 0).length;

  return (
    <div className="p-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Package size={24} />
            パッケージ監査
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            OSV.dev APIを使った依存パッケージの脆弱性スキャン
          </p>
        </div>
        {isEditor && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Plus size={16} />
            新規プロジェクト
          </button>
        )}
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">プロジェクト数</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{projects.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">脆弱性合計</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalVulns}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">影響プロジェクト</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
            {criticalProjects}
          </p>
        </div>
      </div>

      {/* プロジェクト一覧 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">読み込み中...</div>
        ) : projects.length === 0 ? (
          <div className="p-8 text-center">
            <Package size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">プロジェクトがありません</p>
            {isEditor && (
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="mt-3 text-sm text-blue-600 hover:underline"
              >
                lockfileをアップロードして始める
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  プロジェクト
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  エコシステム
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  パッケージ数
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  最終スキャン
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  脆弱性
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {projects.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/package-audit/${p.id}`}
                      className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {p.name}
                    </Link>
                    <p className="text-xs text-gray-400 mt-0.5">{p.lockfileType}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {ECOSYSTEM_LABELS[p.ecosystem] ?? p.ecosystem}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                    {p.packagesCount}
                  </td>
                  <td className="px-4 py-3">
                    <ScanStatusBadge scan={p.latestScan} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.vulnsFound > 0 ? (
                      <span className="flex items-center justify-end gap-1 text-red-600 dark:text-red-400 font-medium">
                        <ShieldAlert size={14} />
                        {p.vulnsFound}
                      </span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <LockfileUploadModal
          onClose={() => setShowModal(false)}
          onSuccess={() => void queryClient.invalidateQueries({ queryKey: ["audit-projects"] })}
        />
      )}
    </div>
  );
}
