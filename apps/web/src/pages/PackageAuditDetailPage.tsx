import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Package, RefreshCw, ShieldAlert, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api.ts";
import { useAuthStore } from "@/store/authStore.ts";
import type {
  AuditFindingWithDetails,
  AuditProjectWithStats,
  AuditScan,
} from "@vulflare/shared/types";
import type { PaginatedResponse } from "@vulflare/shared/types";
import type { AuditLockfileType } from "@vulflare/shared/types";

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  informational: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  informational: "Info",
};

type Tab = "findings" | "packages" | "scans";

export function PackageAuditDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isEditor = user?.role === "admin" || user?.role === "editor";
  const isAdmin = user?.role === "admin";

  const [activeTab, setActiveTab] = useState<Tab>("findings");
  const [page, setPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);

  const { data: project, isLoading: projectLoading } = useQuery<AuditProjectWithStats>({
    queryKey: ["audit-project", id],
    queryFn: async () => {
      const res = await api.get<AuditProjectWithStats>(`/audit/projects/${id}`);
      return res.data;
    },
    refetchInterval: (query) => (query.state.data?.latestScan?.status === "running" ? 3000 : false),
  });

  const { data: findingsData } = useQuery<PaginatedResponse<AuditFindingWithDetails>>({
    queryKey: ["audit-findings", id, page, severityFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (severityFilter) params.set("severity", severityFilter);
      const res = await api.get<PaginatedResponse<AuditFindingWithDetails>>(
        `/audit/projects/${id}/findings?${params}`,
      );
      return res.data;
    },
    enabled: activeTab === "findings" && !!id,
  });

  const { data: scans = [] } = useQuery<AuditScan[]>({
    queryKey: ["audit-scans", id],
    queryFn: async () => {
      const res = await api.get<AuditScan[]>(`/audit/projects/${id}/scans`);
      return res.data;
    },
    enabled: activeTab === "scans" && !!id,
  });

  const { data: packages = [] } = useQuery<Array<{ id: string; name: string; version: string }>>({
    queryKey: ["audit-packages", id],
    queryFn: async () => {
      const res = await api.get<Array<{ id: string; name: string; version: string }>>(
        `/audit/projects/${id}/packages`,
      );
      return res.data;
    },
    enabled: activeTab === "packages" && !!id,
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/audit/projects/${id}/scan`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["audit-project", id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/audit/projects/${id}`);
    },
    onSuccess: () => {
      navigate("/package-audit");
    },
  });

  const handleUpload = async (file: File) => {
    const lockfileContent = await file.text();
    await api.post(`/audit/projects/${id}/upload`, {
      lockfileContent,
      lockfileType: project?.lockfileType as AuditLockfileType,
    });
    void queryClient.invalidateQueries({ queryKey: ["audit-project", id] });
  };

  if (projectLoading) {
    return (
      <div className="p-6">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <p className="text-gray-500">プロジェクトが見つかりません</p>
        <Link to="/package-audit" className="text-blue-600 hover:underline mt-2 inline-block">
          ← 一覧に戻る
        </Link>
      </div>
    );
  }

  const isRunning = project.latestScan?.status === "running";

  return (
    <div className="p-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            to="/package-audit"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-2"
          >
            <ArrowLeft size={14} />
            パッケージ監査一覧
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Package size={22} />
            {project.name}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {project.lockfileType} · {project.ecosystem} · {project.packagesCount} パッケージ
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isEditor && (
            <>
              <input
                ref={uploadRef}
                type="file"
                accept=".json,.yaml,.yml,.lock"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(f);
                }}
              />
              <button
                type="button"
                onClick={() => uploadRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Upload size={14} />
                再アップロード
              </button>
              <button
                type="button"
                onClick={() => scanMutation.mutate()}
                disabled={isRunning || scanMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                <RefreshCw size={14} className={isRunning ? "animate-spin" : ""} />
                {isRunning ? "スキャン中..." : "再スキャン"}
              </button>
            </>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`"${project.name}" を削除しますか？`)) deleteMutation.mutate();
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 dark:text-red-400 bg-white dark:bg-gray-800 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 size={14} />
              削除
            </button>
          )}
        </div>
      </div>

      {/* 最新スキャン状態 */}
      {project.latestScan && (
        <div
          className={`rounded-lg p-3 text-sm ${
            project.latestScan.status === "failed"
              ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
              : project.latestScan.status === "running"
                ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
          }`}
        >
          {project.latestScan.status === "running" && "スキャン実行中..."}
          {project.latestScan.status === "completed" &&
            `スキャン完了: ${project.latestScan.vulnsFound} 件の脆弱性を検出`}
          {project.latestScan.status === "failed" &&
            `スキャン失敗: ${project.latestScan.errorMessage}`}
        </div>
      )}

      {/* タブ */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          {(["findings", "packages", "scans"] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {tab === "findings"
                ? `検出結果 (${project.vulnsFound})`
                : tab === "packages"
                  ? `パッケージ (${project.packagesCount})`
                  : "スキャン履歴"}
            </button>
          ))}
        </nav>
      </div>

      {/* 検出結果タブ */}
      {activeTab === "findings" && (
        <div className="space-y-3">
          {/* フィルター */}
          <div className="flex items-center gap-3">
            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">全ての深刻度</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <span className="text-sm text-gray-500">{findingsData?.total ?? 0} 件</span>
          </div>

          {findingsData?.data.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ShieldAlert size={40} className="mx-auto mb-3 opacity-30" />
              <p>脆弱性は検出されませんでした</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      CVE / タイトル
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      深刻度
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      影響パッケージ
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      修正バージョン
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      CVSS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {findingsData?.data.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3">
                        {f.cveId && (
                          <p className="font-mono text-xs text-blue-600 dark:text-blue-400 mb-0.5">
                            {f.cveId}
                          </p>
                        )}
                        <p className="text-gray-900 dark:text-white line-clamp-2">{f.title}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_BADGE[f.severity] ?? ""}`}
                        >
                          {SEVERITY_LABELS[f.severity] ?? f.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs">{f.packageName}</span>
                        <span className="text-gray-400 text-xs ml-1">@{f.packageVersion}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-green-600 dark:text-green-400">
                        {f.fixedVersion ? `→ ${f.fixedVersion}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-600 dark:text-gray-400">
                        {f.cvssV3Score ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ページネーション */}
          {findingsData && findingsData.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50"
              >
                前へ
              </button>
              <span className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400">
                {page} / {findingsData.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(findingsData.totalPages, p + 1))}
                disabled={page === findingsData.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50"
              >
                次へ
              </button>
            </div>
          )}
        </div>
      )}

      {/* パッケージ一覧タブ */}
      {activeTab === "packages" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {packages.length === 0 ? (
            <div className="p-8 text-center text-gray-400">パッケージがありません</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    パッケージ名
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    バージョン
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {packages.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 font-mono text-xs text-gray-900 dark:text-white">
                      {p.name}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{p.version}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* スキャン履歴タブ */}
      {activeTab === "scans" && (
        <div className="space-y-2">
          {scans.length === 0 ? (
            <div className="text-center py-8 text-gray-400">スキャン履歴がありません</div>
          ) : (
            scans.map((s) => (
              <div
                key={s.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        s.status === "completed"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : s.status === "running"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {s.status === "completed"
                        ? "完了"
                        : s.status === "running"
                          ? "実行中"
                          : "失敗"}
                    </span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {new Date(s.startedAt).toLocaleString("ja-JP")}
                    </span>
                  </div>
                  {s.errorMessage && <p className="text-xs text-red-500 mt-1">{s.errorMessage}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {s.vulnsFound} 件の脆弱性
                  </p>
                  <p className="text-xs text-gray-400">{s.packagesCount} パッケージ</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
