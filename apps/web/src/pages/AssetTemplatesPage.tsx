import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, FileText, Search } from 'lucide-react';
import { api } from '@/lib/api.ts';
import type { AssetTemplate, PaginatedResponse } from '@vulflare/shared/types';
import { useAuthStore } from '@/store/authStore.ts';

const ASSET_TYPE_LABELS: Record<string, string> = {
  server: 'サーバー',
  container: 'コンテナ',
  application: 'アプリケーション',
  library: 'ライブラリ',
  network_device: 'ネットワーク機器',
};

const ENV_LABELS: Record<string, string> = {
  production: '本番',
  staging: 'ステージング',
  development: '開発',
};

const PAGE_SIZE = 20;

export function AssetTemplatesPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const canEdit = user?.role === 'admin' || user?.role === 'editor';

  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const page = Number(searchParams.get('page') ?? 1);
  const assetType = searchParams.get('assetType') ?? '';
  const environment = searchParams.get('environment') ?? '';
  const sortBy = searchParams.get('sortBy') ?? 'created_at';
  const sortOrder = searchParams.get('sortOrder') ?? 'desc';

  const { data, isLoading } = useQuery({
    queryKey: ['asset-templates', page, assetType, environment, sortBy, sortOrder, q],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        sortBy,
        sortOrder,
      });
      if (q) params.set('q', q);
      if (assetType) params.set('assetType', assetType);
      if (environment) params.set('environment', environment);
      return api.get<PaginatedResponse<AssetTemplate>>(`/asset-templates?${params}`).then((r) => r.data);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/asset-templates/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['asset-templates'] }),
  });

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    next.delete('page'); // フィルター変更時はページ1に戻る
    setSearchParams(next);
  };

  const setPage = (p: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p));
    setSearchParams(next);
  };

  const templates = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">アセットテンプレート</h1>
          <p className="text-sm text-gray-500 mt-1">
            よく使うアセット構成をテンプレートとして保存し、簡単に再利用できます
          </p>
        </div>
        {canEdit && (
          <Link
            to="/asset-templates/new"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            テンプレートを作成
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="テンプレート名または説明で検索..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setFilter('q', q); }}
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={assetType}
            onChange={(e) => setFilter('assetType', e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">すべてのアセットタイプ</option>
            {Object.entries(ASSET_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select
            value={environment}
            onChange={(e) => setFilter('environment', e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">すべての環境</option>
            {Object.entries(ENV_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <select
            value={sortBy}
            onChange={(e) => setFilter('sortBy', e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="created_at">作成日時</option>
            <option value="name">名前</option>
          </select>

          <select
            value={sortOrder}
            onChange={(e) => setFilter('sortOrder', e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="desc">降順</option>
            <option value="asc">昇順</option>
          </select>

          {(q || assetType || environment || sortBy !== 'created_at' || sortOrder !== 'desc') && (
            <button
              onClick={() => {
                setQ('');
                setSearchParams({});
              }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              リセット
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-500">読み込み中...</div>
      ) : templates.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <FileText size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">
            {q || assetType || environment
              ? 'テンプレートが見つかりませんでした'
              : 'テンプレートがまだ作成されていません'}
          </p>
          {canEdit && !q && !assetType && !environment && (
            <Link
              to="/asset-templates/new"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Plus size={16} />
              最初のテンプレートを作成
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <FileText size={16} className="text-blue-600" />
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => {
                        if (confirm(`テンプレート「${template.name}」を削除しますか？`)) {
                          deleteMutation.mutate(template.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                      title="削除"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <Link to={`/asset-templates/${template.id}`} className="block">
                  <h3 className="font-semibold text-gray-900 mb-1">{template.name}</h3>
                  <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                    {template.description || '説明なし'}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span>{ASSET_TYPE_LABELS[template.assetType] ?? template.assetType}</span>
                    <span>•</span>
                    <span>{ENV_LABELS[template.environment] ?? template.environment}</span>
                  </div>
                </Link>
              </div>
            ))}
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
        </>
      )}
    </div>
  );
}
