import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { api } from '@/lib/api.ts';
import { SeverityBadge } from '@/components/SeverityBadge.tsx';
import { StatusBadge } from '@/components/StatusBadge.tsx';
import type { Vulnerability, PaginatedResponse, BatchUpdateVulnerabilityRequest, BatchUpdateVulnerabilityResponse, Severity, VulnStatus } from '@vulflare/shared/types';

const PAGE_SIZE = 20;

export function VulnerabilitiesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const page = Number(searchParams.get('page') ?? 1);

  const severity = searchParams.get('severity') ?? '';
  const status = searchParams.get('status') ?? '';
  const source = searchParams.get('source') ?? '';

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchSeverity, setBatchSeverity] = useState('');
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
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ['vulnerabilities'] });
      setSelectedIds(new Set());
      setBatchSeverity('');
      setBatchStatus('');
      alert(`${response.data.affectedRows}件の脆弱性を更新しました`);
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

    const updates: { severity?: Severity; status?: VulnStatus } = {};
    if (batchSeverity) updates.severity = batchSeverity as Severity;
    if (batchStatus) updates.status = batchStatus as VulnStatus;

    if (!updates.severity && !updates.status) {
      alert('更新する項目を選択してください');
      return;
    }

    if (!confirm(`${selectedIds.size}件の脆弱性を更新しますか？`)) {
      return;
    }

    batchUpdateMutation.mutate({
      ids: Array.from(selectedIds),
      updates,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">脆弱性一覧</h1>
        <Link
          to="/vulnerabilities/new"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          脆弱性を追加
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="CVE IDまたはタイトルで検索..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setFilter('q', q); }}
            className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={severity}
          onChange={(e) => setFilter('severity', e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">すべての深刻度</option>
          {['critical', 'high', 'medium', 'low', 'informational'].map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setFilter('status', e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">すべてのステータス</option>
          <option value="active">対応中</option>
          <option value="fixed">解決済み</option>
          <option value="accepted_risk">リスク受容</option>
        </select>
      </div>

      {/* Batch update bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-4">
          <span className="text-sm font-medium text-blue-900">
            {selectedIds.size}件選択中
          </span>

          <select
            value={batchSeverity}
            onChange={(e) => setBatchSeverity(e.target.value)}
            className="border border-blue-300 bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">深刻度を変更...</option>
            {['critical', 'high', 'medium', 'low', 'informational'].map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>

          <select
            value={batchStatus}
            onChange={(e) => setBatchStatus(e.target.value)}
            className="border border-blue-300 bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">ステータスを変更...</option>
            <option value="active">対応中</option>
            <option value="fixed">解決済み</option>
            <option value="accepted_risk">リスク受容</option>
            <option value="false_positive">誤検知</option>
          </select>

          <button
            onClick={handleBatchUpdate}
            disabled={batchUpdateMutation.isPending || (!batchSeverity && !batchStatus)}
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
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 text-sm">読み込み中...</div>
        ) : (data?.data.length ?? 0) === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">脆弱性が見つかりませんでした</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 w-12">
                  <input
                    type="checkbox"
                    checked={data?.data && data.data.length > 0 && selectedIds.size === data.data.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CVE / タイトル</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-28">深刻度</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-20">CVSS</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">ステータス</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-28">公開日</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-28">更新日</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.data.map((vuln) => (
                <tr key={vuln.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(vuln.id)}
                      onChange={() => toggleSelect(vuln.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/vulnerabilities/${vuln.id}`} className="font-medium text-blue-600 hover:underline block">
                      {vuln.cveId ?? '—'}
                    </Link>
                    {vuln.title && vuln.title !== vuln.cveId && (
                      <div className="text-gray-700 text-xs font-medium mt-0.5 line-clamp-1">{vuln.title}</div>
                    )}
                    {vuln.description && (
                      <div className="text-gray-500 text-xs mt-0.5 line-clamp-2">{vuln.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3"><SeverityBadge severity={vuln.severity} /></td>
                  <td className="px-4 py-3 text-gray-700">
                    {vuln.cvssV3Score != null ? vuln.cvssV3Score.toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={vuln.status} /></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {vuln.publishedAt ? new Date(vuln.publishedAt).toLocaleDateString('ja-JP') : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {vuln.modifiedAt ? new Date(vuln.modifiedAt).toLocaleDateString('ja-JP') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            全{data.total}件 / {data.page} / {data.totalPages}ページ
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              前へ
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= data.totalPages}
              className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              次へ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
