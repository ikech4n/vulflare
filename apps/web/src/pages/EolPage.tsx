import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Trash2, Package, Calendar, Edit } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api.ts';
import type { EolProduct, EolCategory, EolStats } from '@vulflare/shared/types';

const CATEGORY_LABELS: Record<EolCategory, string> = {
  os: 'OS',
  programming_language: 'プログラミング言語',
  runtime: 'ランタイム',
  middleware: 'ミドルウェア',
  framework: 'フレームワーク',
  library: 'ライブラリ',
  cloud_service: 'クラウドサービス',
  hardware: 'ハードウェア',
};

export function EolPage() {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<EolCategory | ''>('');
  const [showAddModal, setShowAddModal] = useState(false);

  // 統計情報
  const { data: stats } = useQuery<EolStats>({
    queryKey: ['eol', 'stats'],
    queryFn: async () => {
      const res = await api.get('/eol/stats');
      return res.data;
    },
  });

  // プロダクト一覧
  const { data: products = [], isLoading } = useQuery<EolProduct[]>({
    queryKey: ['eol', 'products', selectedCategory],
    queryFn: async () => {
      const params = selectedCategory ? `?category=${selectedCategory}` : '';
      const res = await api.get(`/eol/products${params}`);
      return res.data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">EOL 管理</h1>
          <p className="text-gray-600 mt-1">ソフトウェア・ハードウェアの EOL（サポート終了）を管理します</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          プロダクト追加
        </button>
      </div>

      {/* 統計サマリー */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">登録プロダクト</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_products}</p>
              </div>
              <Package className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">EOL済み</p>
                <p className="text-2xl font-bold text-red-600">{stats.eol_count}</p>
              </div>
              <Calendar className="w-8 h-8 text-red-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">30日以内EOL</p>
                <p className="text-2xl font-bold text-orange-600">{stats.approaching_eol_30d}</p>
              </div>
              <Calendar className="w-8 h-8 text-orange-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">サポート中</p>
                <p className="text-2xl font-bold text-green-600">{stats.supported_count}</p>
              </div>
              <Calendar className="w-8 h-8 text-green-400" />
            </div>
          </div>
        </div>
      )}

      {/* カテゴリフィルタ */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">カテゴリ:</label>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value as EolCategory | '')}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
        >
          <option value="">すべて</option>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* プロダクト一覧 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">プロダクト一覧</h2>
        </div>

        <div className="p-6">
          {isLoading ? (
            <p className="text-center text-gray-500">読み込み中...</p>
          ) : products.length === 0 ? (
            <p className="text-center text-gray-500">プロダクトがありません</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">プロダクト名</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">カテゴリ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ベンダー</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">データソース</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <Link
                        to={`/eol/products/${product.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {product.display_name}
                      </Link>
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-800">
                        {CATEGORY_LABELS[product.category]}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">{product.vendor || '-'}</td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {product.eol_api_id ? (
                        <span className="text-green-600">endoflife.date</span>
                      ) : (
                        <span className="text-gray-500">手動</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <ProductActions product={product} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showAddModal && <AddProductModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}

function ProductActions({ product }: { product: EolProduct }) {
  const queryClient = useQueryClient();
  const [showEditModal, setShowEditModal] = useState(false);

  const syncMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/eol/sync/${product.product_name}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eol'] });
      alert('同期が完了しました');
    },
    onError: () => {
      alert('同期に失敗しました');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/eol/products/${product.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eol'] });
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
        {product.eol_api_id && (
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="p-1 text-blue-600 hover:text-blue-800"
            title="同期"
          >
            <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          </button>
        )}
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
      </div>
      {showEditModal && (
        <EditProductModal product={product} onClose={() => setShowEditModal(false)} />
      )}
    </>
  );
}

function AddProductModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    product_name: '',
    display_name: '',
    category: 'os' as EolCategory,
    eol_api_id: '',
    vendor: '',
    link: '',
  });

  // 利用可能な製品一覧を取得
  const { data: availableProducts = [] } = useQuery<string[]>({
    queryKey: ['eol', 'available-products'],
    queryFn: async () => {
      const res = await api.get('/eol/available-products');
      return res.data;
    },
  });

  // 製品選択時に自動入力
  const handleProductSelect = (productId: string) => {
    if (!productId) return;

    // API IDをそのまま使用
    const eolApiId = productId;

    // 表示名を生成（最初の文字を大文字に）
    const displayName = productId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    setFormData({
      ...formData,
      product_name: productId,
      display_name: displayName,
      eol_api_id: eolApiId,
    });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/eol/products', {
        ...formData,
        eol_api_id: formData.eol_api_id || undefined,
        vendor: formData.vendor || undefined,
        link: formData.link || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eol'] });
      onClose();
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || '作成に失敗しました');
    },
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">プロダクト追加</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              プロダクト名（英語）*
              <span className="ml-2 text-xs text-gray-500">
                ({availableProducts.length}個の製品から選択可能)
              </span>
            </label>
            <input
              type="text"
              list="available-products"
              value={formData.product_name}
              onChange={(e) => {
                const value = e.target.value;
                setFormData({ ...formData, product_name: value });
                // リストから選択された場合は自動入力
                if (availableProducts.includes(value)) {
                  handleProductSelect(value);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="例: ubuntu, nodejs, python"
            />
            <datalist id="available-products">
              {availableProducts.map((product) => (
                <option key={product} value={product} />
              ))}
            </datalist>
            <p className="text-xs text-gray-500 mt-1">
              endoflife.date APIに対応している製品から選択すると自動入力されます
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">表示名*</label>
            <input
              type="text"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="例: Ubuntu"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ*</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as EolCategory })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">endoflife.date API ID</label>
            <input
              type="text"
              value={formData.eol_api_id}
              onChange={(e) => setFormData({ ...formData, eol_api_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="例: ubuntu"
            />
            <p className="text-xs text-gray-500 mt-1">
              設定すると自動同期されます（任意）
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ベンダー</label>
            <input
              type="text"
              value={formData.vendor}
              onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="例: Canonical"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">公式URL</label>
            <input
              type="url"
              value={formData.link}
              onChange={(e) => setFormData({ ...formData, link: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            キャンセル
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!formData.product_name || !formData.display_name || createMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending ? '作成中...' : '作成'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditProductModal({ product, onClose }: { product: EolProduct; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    display_name: product.display_name,
    category: product.category,
    eol_api_id: product.eol_api_id || '',
    vendor: product.vendor || '',
    link: product.link || '',
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/eol/products/${product.id}`, {
        display_name: formData.display_name,
        category: formData.category,
        eol_api_id: formData.eol_api_id || undefined,
        vendor: formData.vendor || undefined,
        link: formData.link || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eol'] });
      onClose();
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || '更新に失敗しました');
    },
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">プロダクト編集</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              プロダクト名（英語）
            </label>
            <input
              type="text"
              value={product.product_name}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1">プロダクト名は変更できません</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">表示名*</label>
            <input
              type="text"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="例: Ubuntu"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ*</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as EolCategory })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">endoflife.date API ID</label>
            <input
              type="text"
              value={formData.eol_api_id}
              onChange={(e) => setFormData({ ...formData, eol_api_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="例: ubuntu"
            />
            <p className="text-xs text-gray-500 mt-1">
              設定すると自動同期されます（任意）
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ベンダー</label>
            <input
              type="text"
              value={formData.vendor}
              onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="例: Canonical"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">公式URL</label>
            <input
              type="url"
              value={formData.link}
              onChange={(e) => setFormData({ ...formData, link: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            キャンセル
          </button>
          <button
            onClick={() => updateMutation.mutate()}
            disabled={!formData.display_name || updateMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {updateMutation.isPending ? '更新中...' : '更新'}
          </button>
        </div>
      </div>
    </div>
  );
}
