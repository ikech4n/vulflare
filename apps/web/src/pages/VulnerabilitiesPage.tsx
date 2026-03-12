import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Plus, Search, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api.ts';
import { useAuthStore } from '@/store/authStore.ts';
import { SeverityBadge } from '@/components/SeverityBadge.tsx';
import { StatusBadge } from '@/components/StatusBadge.tsx';
import type { Vulnerability, PaginatedResponse, BatchUpdateVulnerabilityRequest, BatchUpdateVulnerabilityResponse, VulnStatus } from '@vulflare/shared/types';

const PAGE_SIZE = 20;

export function VulnerabilitiesPage() {
  const { user } = useAuthStore();
  const isViewer = user?.role === 'viewer';
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const page = Number(searchParams.get('page') ?? 1);

  const severity = searchParams.get('severity') ?? '';
  const selectedSeverities = severity ? severity.split(',').filter(Boolean) : [];
  const status = searchParams.get('status') ?? '';
  const selectedStatuses = status ? status.split(',').filter(Boolean) : [];
  const source = searchParams.get('source') ?? '';

  // 初回マウント時にstatusが未指定なら「新規+対応中」をデフォルト設定
  useEffect(() => {
    if (!searchParams.has('status')) {
      const next = new URLSearchParams(searchParams);
      next.set('status', 'new,open');
      setSearchParams(next, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [severityOpen, setSeverityOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const severityRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (severityRef.current && !severityRef.current.contains(e.target as Node)) {
        setSeverityOpen(false);
      }
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setStatusOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchStatus, setBatchStatus] = useState('');

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['vulnerabilities', page, severity, status, source, q],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (severity) params.set('severity', severity);
      if (status) params.set('status', status);
      if (source) params.set('source', source);
      if (q) params.set('q', q);
      return api.get<PaginatedResponse<Vulnerability>>(`/vulnerabilities?${params}`).then((r) => r.data);
    },
  });

  const batchUpdateMutation = useMutation({
    mutationFn: (body: BatchUpdateVulnerabilityRequest) =>
      api.patch<BatchUpdateVulnerabilityResponse>('/vulnerabilities/batch', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vulnerabilities'] });
      setSelectedIds(new Set());
      setBatchStatus('');
    },
    onError: () => {
      alert('一括更新に失敗しました');
    },
  });

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    next.delete('page');
    setSearchParams(next);
  };

  const toggleStatus = (s: string) => {
    const next = selectedStatuses.includes(s)
      ? selectedStatuses.filter((x) => x !== s)
      : [...selectedStatuses, s];
    setFilter('status', next.join(','));
  };

  const toggleSeverity = (s: string) => {
    const next = selectedSeverities.includes(s)
      ? selectedSeverities.filter((x) => x !== s)
      : [...selectedSeverities, s];
    setFilter('severity', next.join(','));
  };

  const setPage = (p: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p));
    setSearchParams(next);
  };

  const toggleSelectAll = () => {
    if (!data?.data) return;
    if (selectedIds.size === data.data.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.data.map((v) => v.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleBatchUpdate = () => {
    if (selectedIds.size === 0) return;

    if (!batchStatus) {
      alert('ステータスを選択してください');
      return;
    }

    if (!confirm(`${selectedIds.size}件の脆弱性を更新しますか？`)) {
      return;
    }

    batchUpdateMutation.mutate({
      ids: Array.from(selectedIds),
      updates: { status: batchStatus as VulnStatus },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">脆弱性一覧</h1>
        {!isViewer && (
          <Link
            to="/vulnerabilities/new"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors self-start sm:self-auto"
          >
            <Plus size={16} />
            脆弱性を追加
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="CVE IDまたはタイトルで検索..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setFilter('q', q); }}
            className="w-full pl-9 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
          />
        </div>

        <div className="relative" ref={severityRef}>
          <button
            type="button"
            onClick={() => setSeverityOpen(!severityOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              selectedSeverities.length > 0
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300'
                : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-400'
            }`}
          >
            深刻度{selectedSeverities.length > 0 ? ` (${selectedSeverities.length})` : ''}
            <ChevronDown size={14} className={`transition-transform ${severityOpen ? 'rotate-180' : ''}`} />
          </button>
          {severityOpen && (
            <div className="absolute top-full mt-1 left-0 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-36">
              {['critical', 'high', 'medium', 'low', 'informational'].map((s) => (
                <label
                  key={s}
                  className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={selectedSeverities.includes(s)}
                    onChange={() => toggleSeverity(s)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </label>
              ))}
              {selectedSeverities.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-700 mt-1 pt-1">
                  <button
                    type="button"
                    onClick={() => setFilter('severity', '')}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    クリア
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative" ref={statusRef}>
          <button
            type="button"
            onClick={() => setStatusOpen(!statusOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              selectedStatuses.length > 0
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300'
                : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-400'
            }`}
          >
            ステータス{selectedStatuses.length > 0 ? ` (${selectedStatuses.length})` : ''}
            <ChevronDown size={14} className={`transition-transform ${statusOpen ? 'rotate-180' : ''}`} />
          </button>
          {statusOpen && (
            <div className="absolute top-full mt-1 left-0 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-36">
              {[
                { value: 'new', label: '新規' },
                { value: 'open', label: '対応中' },
                { value: 'fixed', label: '解決済み' },
                { value: 'accepted_risk', label: 'リスク受容' },
                { value: 'false_positive', label: '誤検知' },
              ].map((s) => (
                <label
                  key={s.value}
                  className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(s.value)}
                    onChange={() => toggleStatus(s.value)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {s.label}
                </label>
              ))}
              {selectedStatuses.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-700 mt-1 pt-1">
                  <button
                    type="button"
                    onClick={() => setFilter('status', '')}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    クリア
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Batch update bar */}
      {!isViewer && selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-4">
          <span className="text-sm font-medium text-blue-900">
            {selectedIds.size}件選択中
          </span>

          <select
            value={batchStatus}
            onChange={(e) => setBatchStatus(e.target.value)}
            className="border border-blue-300 bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">ステータスを変更...</option>
            <option value="new">新規</option>
            <option value="open">対応中</option>
            <option value="fixed">解決済み</option>
            <option value="accepted_risk">リスク受容</option>
            <option value="false_positive">誤検知</option>
          </select>

          <button
            onClick={handleBatchUpdate}
            disabled={batchUpdateMutation.isPending || !batchStatus}
            className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {batchUpdateMutation.isPending ? '更新中...' : '一括更新'}
          </button>

          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-gray-600 hover:text-gray-800 ml-auto"
          >
            選択解除
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">読み込み中...</div>
        ) : (data?.data.length ?? 0) === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">脆弱性が見つかりませんでした</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                {!isViewer && (
                  <th className="px-4 py-3 w-12">
                    <input
                      type="checkbox"
                      checked={data?.data && data.data.length > 0 && selectedIds.size === data.data.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">CVE / タイトル</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-28">深刻度</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-20">CVSS</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-32">ステータス</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-28">公開日</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-28">更新日</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data?.data.map((vuln) => (
                <tr key={vuln.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  {!isViewer && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(vuln.id)}
                        onChange={() => toggleSelect(vuln.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Link to={`/vulnerabilities/${vuln.id}`} className="font-medium text-blue-600 hover:underline block">
                      {vuln.cveId ?? '—'}
                    </Link>
                    {vuln.title && vuln.title !== vuln.cveId && (
                      <div className="text-gray-700 dark:text-gray-300 text-xs font-medium mt-0.5 line-clamp-1">{vuln.title}</div>
                    )}
                    {vuln.description && (
                      <div className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 line-clamp-2">{vuln.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3"><SeverityBadge severity={vuln.severity} /></td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {vuln.cvssV3Score != null ? vuln.cvssV3Score.toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={vuln.status} /></td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                    {vuln.publishedAt ? new Date(vuln.publishedAt).toLocaleDateString('ja-JP') : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                    {vuln.modifiedAt ? new Date(vuln.modifiedAt).toLocaleDateString('ja-JP') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        </div>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            全{data.total}件 / {data.page} / {data.totalPages}ページ
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
            >
              前へ
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= data.totalPages}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
            >
              次へ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
