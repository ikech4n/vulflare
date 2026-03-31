import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  PaginatedResponse,
  WebScan,
  WebScanFinding,
  WebScanTargetWithStats,
} from "@vulflare/shared/types";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Globe,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api.ts";
import { useAuthStore } from "@/store/authStore.ts";

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

const CHECK_ID_LABELS: Record<string, string> = {
  "security-headers": "セキュリティヘッダー",
  "sensitive-files": "機密ファイル",
  "directory-listing": "ディレクトリリスティング",
  "https-redirect": "HTTPSリダイレクト",
  "cookie-flags": "Cookieフラグ",
  "open-redirect": "オープンリダイレクト",
  "path-traversal": "パストラバーサル",
  "outdated-libraries": "古いライブラリ",
  "csrf-protection": "CSRF対策",
  "info-leakage": "情報漏洩",
};

type Tab = "findings" | "scans";

function ScanStatusBadge({ scan }: { scan: WebScan }) {
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

function FindingRow({ finding }: { finding: WebScanFinding }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-gray-100 dark:border-zinc-800 last:border-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-4 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown size={16} className="mt-0.5 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRight size={16} className="mt-0.5 text-gray-400 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${SEVERITY_BADGE[finding.severity] ?? SEVERITY_BADGE.informational}`}
            >
              {SEVERITY_LABELS[finding.severity] ?? finding.severity}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
              {CHECK_ID_LABELS[finding.checkId] ?? finding.checkId}
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {finding.title}
            </span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 ml-7 space-y-3">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">説明</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{finding.description}</p>
          </div>
          {finding.evidence && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">証跡</p>
              <pre className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-zinc-800 p-2 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">
                {finding.evidence}
              </pre>
            </div>
          )}
          {finding.remediation && (
            <div>
              <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">
                修正方法
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{finding.remediation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function WebScannerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isEditor = user?.role === "admin" || user?.role === "editor";
  const isAdmin = user?.role === "admin";

  const [activeTab, setActiveTab] = useState<Tab>("findings");
  const [page, setPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState("");
  const [checkIdFilter, setCheckIdFilter] = useState("");

  const { data: target, isLoading: targetLoading } = useQuery<WebScanTargetWithStats>({
    queryKey: ["web-scanner-target", id],
    queryFn: async () => {
      const res = await api.get<WebScanTargetWithStats>(`/web-scanner/targets/${id}`);
      return res.data;
    },
    refetchInterval: (query) => (query.state.data?.latestScan?.status === "running" ? 3000 : false),
  });

  const { data: findingsData } = useQuery<PaginatedResponse<WebScanFinding>>({
    queryKey: ["web-scanner-findings", id, page, severityFilter, checkIdFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (severityFilter) params.set("severity", severityFilter);
      if (checkIdFilter) params.set("checkId", checkIdFilter);
      const res = await api.get<PaginatedResponse<WebScanFinding>>(
        `/web-scanner/targets/${id}/findings?${params.toString()}`,
      );
      return res.data;
    },
    enabled: activeTab === "findings",
  });

  const { data: scans = [] } = useQuery<WebScan[]>({
    queryKey: ["web-scanner-scans", id],
    queryFn: async () => {
      const res = await api.get<WebScan[]>(`/web-scanner/targets/${id}/scans`);
      return res.data;
    },
    enabled: activeTab === "scans",
  });

  const rescanMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/web-scanner/targets/${id}/scan`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["web-scanner-target", id] });
      queryClient.invalidateQueries({ queryKey: ["web-scanner-targets"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/web-scanner/targets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["web-scanner-targets"] });
      navigate("/web-scanner");
    },
  });

  if (targetLoading) {
    return <div className="p-6 text-gray-500 dark:text-gray-400">読み込み中...</div>;
  }

  if (!target) {
    return (
      <div className="p-6">
        <p className="text-red-500">ターゲットが見つかりません</p>
        <Link to="/web-scanner" className="text-blue-600 hover:underline text-sm mt-2 block">
          ← 一覧に戻る
        </Link>
      </div>
    );
  }

  const findings = findingsData?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            to="/web-scanner"
            className="mt-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Globe size={20} />
              {target.name}
            </h1>
            <a
              href={target.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {target.url}
            </a>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isEditor && (
            <button
              type="button"
              onClick={() => rescanMutation.mutate()}
              disabled={rescanMutation.isPending || target.latestScan?.status === "running"}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 transition-colors"
            >
              <RefreshCw
                size={14}
                className={target.latestScan?.status === "running" ? "animate-spin" : ""}
              />
              再スキャン
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`"${target.name}" を削除しますか？`)) {
                  deleteMutation.mutate();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 size={14} />
              削除
            </button>
          )}
        </div>
      </div>

      {/* スキャン状態 */}
      {target.latestScan && (
        <div className="flex items-center gap-3 text-sm bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-4">
          <ScanStatusBadge scan={target.latestScan} />
          {target.latestScan.status === "completed" && (
            <>
              <span className="text-gray-300 dark:text-zinc-600">|</span>
              <span className="text-gray-600 dark:text-gray-400">
                {target.latestScan.checksRun} チェック実行
              </span>
              <span className="text-gray-300 dark:text-zinc-600">|</span>
              <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400 font-medium">
                <ShieldAlert size={14} />
                {target.latestScan.findingsCount} 件検出
              </span>
            </>
          )}
          {target.latestScan.status === "failed" && target.latestScan.errorMessage && (
            <span className="text-red-500 text-xs">{target.latestScan.errorMessage}</span>
          )}
        </div>
      )}

      {/* タブ */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800">
        <div className="flex border-b border-gray-200 dark:border-zinc-800">
          {(["findings", "scans"] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {tab === "findings" ? `検出結果 (${target.findingsCount})` : "スキャン履歴"}
            </button>
          ))}
        </div>

        {/* Findings タブ */}
        {activeTab === "findings" && (
          <div>
            {/* フィルター */}
            <div className="flex gap-2 p-3 border-b border-gray-100 dark:border-zinc-800">
              <select
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value);
                  setPage(1);
                }}
                className="text-sm border border-gray-300 dark:border-zinc-700 rounded-lg px-2 py-1.5 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
              >
                <option value="">全Severity</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="informational">Info</option>
              </select>
              <select
                value={checkIdFilter}
                onChange={(e) => {
                  setCheckIdFilter(e.target.value);
                  setPage(1);
                }}
                className="text-sm border border-gray-300 dark:border-zinc-700 rounded-lg px-2 py-1.5 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
              >
                <option value="">全チェック</option>
                {Object.entries(CHECK_ID_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {target.latestScan?.status === "running" ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <RefreshCw size={32} className="animate-spin mx-auto mb-2 text-blue-500" />
                スキャン中です...
              </div>
            ) : findings.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                {target.latestScan?.status === "completed"
                  ? "問題は検出されませんでした"
                  : "スキャンが完了するとここに結果が表示されます"}
              </div>
            ) : (
              <div>
                {findings.map((finding) => (
                  <FindingRow key={finding.id} finding={finding} />
                ))}

                {/* ページネーション */}
                {findingsData && findingsData.totalPages > 1 && (
                  <div className="flex justify-center gap-2 p-4">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1 text-sm border border-gray-300 dark:border-zinc-700 rounded disabled:opacity-40"
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
                      className="px-3 py-1 text-sm border border-gray-300 dark:border-zinc-700 rounded disabled:opacity-40"
                    >
                      次へ
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Scans タブ */}
        {activeTab === "scans" && (
          <div className="divide-y divide-gray-100 dark:divide-zinc-800">
            {scans.length === 0 ? (
              <p className="p-8 text-center text-gray-500 dark:text-gray-400">
                スキャン履歴がありません
              </p>
            ) : (
              scans.map((scan) => (
                <div key={scan.id} className="flex items-center justify-between p-4">
                  <div>
                    <ScanStatusBadge scan={scan} />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      開始: {new Date(scan.startedAt).toLocaleString("ja-JP")}
                    </p>
                    {scan.errorMessage && (
                      <p className="text-xs text-red-500 mt-0.5">{scan.errorMessage}</p>
                    )}
                  </div>
                  {scan.status === "completed" && (
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>{scan.checksRun} チェック</span>
                      <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                        <ShieldAlert size={14} />
                        {scan.findingsCount} 件
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
