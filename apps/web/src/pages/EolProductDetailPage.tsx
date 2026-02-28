import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, ExternalLink, Plus, Edit, Trash2 } from 'lucide-react';
import { api } from '@/lib/api.ts';
import { useAuthStore } from '@/store/authStore.ts';
import type { EolProductWithCycles, EolCycle } from '@vulflare/shared/types';
import { EolStatusBadge } from '@/components/EolStatusBadge.tsx';

export function EolProductDetailPage() {
  const { user } = useAuthStore();
  const isViewer = user?.role === 'viewer';
  const { id } = useParams<{ id: string }>();
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: product, isLoading } = useQuery<EolProductWithCycles>({
    queryKey: ['eol', 'products', id],
    queryFn: async () => {
      const res = await api.get(`/eol/products/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="text-center py-8">読み込み中...</div>;
  }

  if (!product) {
    return <div className="text-center py-8">プロダクトが見つかりません</div>;
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <Link to="/eol" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4">
          <ArrowLeft className="w-4 h-4" />
          EOL管理に戻る
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{product.display_name}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{product.product_name}</p>
          </div>
          {product.link && /^https?:\/\//i.test(product.link) && (
            <a
              href={product.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-800"
            >
              公式サイト
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* プロダクト情報 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">プロダクト情報</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">カテゴリ</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{product.category}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">ベンダー</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{product.vendor || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">データソース</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {product.eol_api_id ? (
                <span className="text-green-600">endoflife.date ({product.eol_api_id})</span>
              ) : (
                <span className="text-gray-500">手動管理</span>
              )}
            </dd>
          </div>
        </dl>
      </div>

      {/* バージョンサイクル一覧 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">バージョンサイクル</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {product.cycles.length} 件のバージョン
            </p>
          </div>
          {!product.eol_api_id && !isViewer && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              サイクル追加
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">バージョン</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">コードネーム</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">リリース日</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">EOL日</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">ステータス</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">LTS</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">最新版</th>
                {!product.eol_api_id && !isViewer && (
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">操作</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {product.cycles.length === 0 ? (
                <tr>
                  <td colSpan={!product.eol_api_id && !isViewer ? 8 : 7} className="px-4 py-8 text-center text-gray-500">
                    バージョン情報がありません
                  </td>
                </tr>
              ) : (
                product.cycles.map((cycle) => (
                  <tr key={cycle.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-4">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{cycle.cycle}</span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {cycle.codename || '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {cycle.release_date ? formatDate(cycle.release_date) : '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {cycle.eol_date ? (
                        <span className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {formatDate(cycle.eol_date)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <EolStatusBadge eolDate={cycle.eol_date} isEol={cycle.is_eol === 1} />
                    </td>
                    <td className="px-4 py-4 text-sm">
                      {cycle.lts === 1 ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                          LTS
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {cycle.latest_version || '-'}
                    </td>
                    {!product.eol_api_id && !isViewer && (
                      <td className="px-4 py-4">
                        <CycleActions cycle={cycle} productId={product.id} />
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <AddCycleModal productId={product.id} onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}

function CycleActions({ cycle, productId }: { cycle: EolCycle; productId: string }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showEditModal, setShowEditModal] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/eol/cycles/${cycle.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eol', 'products', productId] });
    },
  });

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setShowEditModal(true)}
          className="p-1 text-gray-600 hover:text-gray-800"
          title="編集"
        >
          <Edit className="w-4 h-4" />
        </button>
        {user?.role === 'admin' && (
          <button
            onClick={() => {
              if (confirm('本当に削除しますか?')) {
                deleteMutation.mutate();
              }
            }}
            className="p-1 text-red-600 hover:text-red-800"
            title="削除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      {showEditModal && (
        <EditCycleModal cycle={cycle} productId={productId} onClose={() => setShowEditModal(false)} />
      )}
    </>
  );
}

function AddCycleModal({ productId, onClose }: { productId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    cycle: '',
    codename: '',
    release_date: '',
    eol_date: '',
    support_date: '',
    extended_support_date: '',
    lts: false,
    latest_version: '',
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/eol/cycles', {
        product_id: productId,
        cycle: formData.cycle,
        codename: formData.codename || undefined,
        release_date: formData.release_date || undefined,
        eol_date: formData.eol_date || undefined,
        support_date: formData.support_date || undefined,
        extended_support_date: formData.extended_support_date || undefined,
        lts: formData.lts,
        latest_version: formData.latest_version || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eol', 'products', productId] });
      onClose();
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || '作成に失敗しました');
    },
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">サイクル追加</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">バージョン*</label>
            <input
              type="text"
              value={formData.cycle}
              onChange={(e) => setFormData({ ...formData, cycle: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              placeholder="例: 22.04"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">コードネーム</label>
            <input
              type="text"
              value={formData.codename}
              onChange={(e) => setFormData({ ...formData, codename: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              placeholder="例: Jammy Jellyfish"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">リリース日</label>
            <input
              type="date"
              value={formData.release_date}
              onChange={(e) => setFormData({ ...formData, release_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">EOL日</label>
            <input
              type="date"
              value={formData.eol_date}
              onChange={(e) => setFormData({ ...formData, eol_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">サポート終了日</label>
            <input
              type="date"
              value={formData.support_date}
              onChange={(e) => setFormData({ ...formData, support_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">延長サポート終了日</label>
            <input
              type="date"
              value={formData.extended_support_date}
              onChange={(e) => setFormData({ ...formData, extended_support_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">最新バージョン</label>
            <input
              type="text"
              value={formData.latest_version}
              onChange={(e) => setFormData({ ...formData, latest_version: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              placeholder="例: 22.04.3"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="lts"
              checked={formData.lts}
              onChange={(e) => setFormData({ ...formData, lts: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded"
            />
            <label htmlFor="lts" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              LTS版
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            キャンセル
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!formData.cycle || createMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending ? '作成中...' : '作成'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditCycleModal({ cycle, productId, onClose }: { cycle: EolCycle; productId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    cycle: cycle.cycle,
    codename: cycle.codename || '',
    release_date: cycle.release_date || '',
    eol_date: cycle.eol_date || '',
    support_date: cycle.support_date || '',
    extended_support_date: cycle.extended_support_date || '',
    lts: cycle.lts === 1,
    latest_version: cycle.latest_version || '',
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/eol/cycles/${cycle.id}`, {
        cycle: formData.cycle,
        codename: formData.codename || undefined,
        release_date: formData.release_date || undefined,
        eol_date: formData.eol_date || undefined,
        support_date: formData.support_date || undefined,
        extended_support_date: formData.extended_support_date || undefined,
        lts: formData.lts,
        latest_version: formData.latest_version || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eol', 'products', productId] });
      onClose();
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || '更新に失敗しました');
    },
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">サイクル編集</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">バージョン*</label>
            <input
              type="text"
              value={formData.cycle}
              onChange={(e) => setFormData({ ...formData, cycle: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              placeholder="例: 22.04"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">コードネーム</label>
            <input
              type="text"
              value={formData.codename}
              onChange={(e) => setFormData({ ...formData, codename: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              placeholder="例: Jammy Jellyfish"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">リリース日</label>
            <input
              type="date"
              value={formData.release_date}
              onChange={(e) => setFormData({ ...formData, release_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">EOL日</label>
            <input
              type="date"
              value={formData.eol_date}
              onChange={(e) => setFormData({ ...formData, eol_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">サポート終了日</label>
            <input
              type="date"
              value={formData.support_date}
              onChange={(e) => setFormData({ ...formData, support_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">延長サポート終了日</label>
            <input
              type="date"
              value={formData.extended_support_date}
              onChange={(e) => setFormData({ ...formData, extended_support_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">最新バージョン</label>
            <input
              type="text"
              value={formData.latest_version}
              onChange={(e) => setFormData({ ...formData, latest_version: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              placeholder="例: 22.04.3"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="edit-lts"
              checked={formData.lts}
              onChange={(e) => setFormData({ ...formData, lts: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded"
            />
            <label htmlFor="edit-lts" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              LTS版
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            キャンセル
          </button>
          <button
            onClick={() => updateMutation.mutate()}
            disabled={!formData.cycle || updateMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {updateMutation.isPending ? '更新中...' : '更新'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateStr;
  }
}
