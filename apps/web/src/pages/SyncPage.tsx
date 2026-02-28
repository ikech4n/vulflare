import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, ChevronDown, ChevronUp, Save, Search, X, Trash2, Database } from 'lucide-react';
import { api } from '@/lib/api.ts';
import { useAuthStore } from '@/store/authStore.ts';
import { useState, useEffect } from 'react';

interface JvnSyncLog {
  id: string;
  sync_type: 'full' | 'incremental';
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at: string | null;
  total_fetched: number;
  total_created: number;
  error_message: string | null;
}

interface JvnVendor {
  vid: string;
  vname: string;
}

interface JvnProduct {
  pid: string;
  pname: string;
  cpe: string;
}

interface JvnProductSelection {
  productId: string;
  productName: string;
  cpe: string;
}

interface JvnVendorSelection {
  vendorId: string;
  vendorName: string;
  products: JvnProductSelection[];
}

interface SyncSettings {
  vendorSelections: JvnVendorSelection[];
  keywords: string[];
  excludeKeywords: string[];
  cvssMinScore: number;
  fullSyncDays: number;
  retentionDays: number;
}

export function SyncPage() {
  const { user } = useAuthStore();
  const isEditorOrAbove = user?.role === 'admin' || user?.role === 'editor';
  const queryClient = useQueryClient();
  const [showSettings, setShowSettings] = useState(false);
  const [showFullSyncConfirm, setShowFullSyncConfirm] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState('');

  // 設定の状態
  const [vendorSelections, setVendorSelections] = useState<JvnVendorSelection[]>([]);
  const [syncKeywords, setSyncKeywords] = useState<string[]>([]);
  const [syncExcludeKeywords, setSyncExcludeKeywords] = useState<string[]>([]);
  const [cvssMinScore, setCvssMinScore] = useState(0);
  const [syncFullSyncDays, setSyncFullSyncDays] = useState(365);
  const [syncRetentionDays, setSyncRetentionDays] = useState(0);
  const [keywordInput, setKeywordInput] = useState('');
  const [excludeKeywordInput, setExcludeKeywordInput] = useState('');

  // ベンダー検索状態
  const [vendorSearchQuery, setVendorSearchQuery] = useState('');
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null);

  // 製品検索状態（ベンダーIDごと）
  const [productSearchQueries, setProductSearchQueries] = useState<Record<string, string>>({});

  const { data: syncStatus, isLoading } = useQuery({
    queryKey: ['sync-status'],
    queryFn: () => api.get<{ latestLog: JvnSyncLog | null }>('/sync/status').then((r) => r.data),
    refetchInterval: 10000, // 10秒ごとに自動更新
  });

  const { data: syncSettingsData } = useQuery({
    queryKey: ['sync-settings'],
    queryFn: () => api.get<SyncSettings>('/sync/settings').then((r) => r.data),
  });

  // ベンダー検索
  const { data: vendorSearchResults } = useQuery({
    queryKey: ['jvn-vendors', vendorSearchQuery],
    queryFn: () => api.get<{ vendors: JvnVendor[] }>(`/sync/jvn-vendors?q=${vendorSearchQuery}`).then(r => r.data),
    enabled: showVendorDropdown,
  });

  // 展開されたベンダーの製品一覧
  const { data: vendorProducts } = useQuery({
    queryKey: ['jvn-products', expandedVendorId],
    queryFn: () => api.get<{ products: JvnProduct[] }>(`/sync/jvn-vendors/${expandedVendorId}/products`).then(r => r.data),
    enabled: !!expandedVendorId,
  });

  const triggerSyncMutation = useMutation({
    mutationFn: () => api.post('/sync/trigger'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });

  const triggerFullSyncMutation = useMutation({
    mutationFn: () => api.post('/sync/trigger-full'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      setShowFullSyncConfirm(false);
    },
  });

  const deleteSyncDataMutation = useMutation({
    mutationFn: (source: string) =>
      api.delete(`/sync/data/${source}`),
    onSuccess: (response) => {
      const data = response.data;
      const count = data.totalDeleted ?? data.deleted ?? 0;
      setDeleteSuccess(`${count}件のデータを削除しました`);
      setTimeout(() => setDeleteSuccess(''), 5000);
      void queryClient.invalidateQueries({ queryKey: ['vulnerabilities'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(`削除に失敗しました: ${msg ?? '不明なエラー'}`);
    },
  });

  const updateSyncSettingsMut = useMutation({
    mutationFn: (settings: SyncSettings) =>
      api.put('/sync/settings', {
        ...settings,
        dataSources: { jvn: true },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sync-settings'] });
      alert('設定を保存しました');
    },
  });

  // 設定データの反映
  useEffect(() => {
    if (syncSettingsData) {
      setVendorSelections(syncSettingsData.vendorSelections);
      setSyncKeywords(syncSettingsData.keywords);
      setSyncExcludeKeywords(syncSettingsData.excludeKeywords);
      setCvssMinScore(syncSettingsData.cvssMinScore);
      setSyncFullSyncDays(syncSettingsData.fullSyncDays);
      setSyncRetentionDays(syncSettingsData.retentionDays);
    }
  }, [syncSettingsData]);

  if (user?.role === 'viewer') {
    return (
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">データソース</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">この画面は編集者以上のみ利用できます。</p>
      </div>
    );
  }

  // ベンダー追加
  const addVendor = (vendor: JvnVendor) => {
    if (!vendorSelections.some(v => v.vendorId === vendor.vid)) {
      setVendorSelections([...vendorSelections, {
        vendorId: vendor.vid,
        vendorName: vendor.vname,
        products: []
      }]);
    }
    setVendorSearchQuery('');
    setShowVendorDropdown(false);
  };

  // ベンダー削除
  const removeVendor = (vendorId: string) => {
    setVendorSelections(vendorSelections.filter(v => v.vendorId !== vendorId));
  };

  // 製品選択トグル
  const toggleProduct = (vendorId: string, product: JvnProduct) => {
    setVendorSelections(vendorSelections.map(v => {
      if (v.vendorId !== vendorId) return v;

      const hasProduct = v.products.some(p => p.productId === product.pid);
      if (hasProduct) {
        // 製品を削除
        return { ...v, products: v.products.filter(p => p.productId !== product.pid) };
      } else {
        // 製品を追加
        return {
          ...v,
          products: [...v.products, {
            productId: product.pid,
            productName: product.pname,
            cpe: product.cpe
          }]
        };
      }
    }));
  };

  // キーワード追加
  const addKeyword = () => {
    const trimmed = keywordInput.trim();
    if (trimmed && !syncKeywords.includes(trimmed)) {
      setSyncKeywords([...syncKeywords, trimmed]);
      setKeywordInput('');
    }
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword();
    }
  };

  // 除外キーワード追加
  const addExcludeKeyword = () => {
    const trimmed = excludeKeywordInput.trim();
    if (trimmed && !syncExcludeKeywords.includes(trimmed)) {
      setSyncExcludeKeywords([...syncExcludeKeywords, trimmed]);
      setExcludeKeywordInput('');
    }
  };

  const handleExcludeKeywordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addExcludeKeyword();
    }
  };

  // 設定保存
  const handleSaveSettings = () => {
    updateSyncSettingsMut.mutate({
      vendorSelections,
      keywords: syncKeywords,
      excludeKeywords: syncExcludeKeywords,
      cvssMinScore,
      fullSyncDays: syncFullSyncDays,
      retentionDays: syncRetentionDays,
    });
  };

  const latestLog = syncStatus?.latestLog;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Clock className="text-blue-500 animate-spin" size={20} />;
      case 'completed':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'failed':
        return <XCircle className="text-red-500" size={20} />;
      default:
        return <AlertCircle className="text-gray-400" size={20} />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running':
        return '取得中';
      case 'completed':
        return '完了';
      case 'failed':
        return '失敗';
      default:
        return '不明';
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('ja-JP');
  };

  const getSyncTypeText = (syncType: string) => {
    switch (syncType) {
      case 'full':
        return '全件取得';
      case 'incremental':
        return '増分取得';
      default:
        return syncType;
    }
  };

  if (isLoading) {
    return <div className="text-sm text-gray-500 dark:text-gray-400">読み込み中...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">データソース</h1>
      </div>

      {/* 全体ステータス */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">ステータス</h2>
          {isEditorOrAbove && (
            <div className="flex gap-2">
              <button
                onClick={() => triggerSyncMutation.mutate()}
                disabled={triggerSyncMutation.isPending || triggerFullSyncMutation.isPending || latestLog?.status === 'running'}
                className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw size={16} className={triggerSyncMutation.isPending ? 'animate-spin' : ''} />
                増分取得
              </button>
              <button
                onClick={() => setShowFullSyncConfirm(true)}
                disabled={triggerSyncMutation.isPending || triggerFullSyncMutation.isPending || latestLog?.status === 'running'}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw size={16} className={triggerFullSyncMutation.isPending ? 'animate-spin' : ''} />
                全件取得
              </button>
            </div>
          )}
        </div>

        {latestLog ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {getStatusIcon(latestLog.status)}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {getStatusText(latestLog.status)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({getSyncTypeText(latestLog.sync_type)})
                  </span>
                  {latestLog.status === 'completed' && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      - {latestLog.total_fetched.toLocaleString()} 件取得、
                      {latestLog.total_created.toLocaleString()} 件新規作成
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  開始: {formatDateTime(latestLog.started_at)}
                  {latestLog.completed_at && (
                    <span className="ml-3">完了: {formatDateTime(latestLog.completed_at)}</span>
                  )}
                </div>
                {latestLog.error_message && (
                  <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                    <p className="font-medium">エラー:</p>
                    <p className="text-xs mt-1">{latestLog.error_message}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">取得履歴がありません</p>
        )}
      </div>

      {/* 同期設定 */}
      {isEditorOrAbove && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center justify-between w-full text-left"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">設定</h2>
            {showSettings ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {showSettings && (
            <div className="mt-6 space-y-6">
              {/* ベンダー/製品選択 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  ベンダー/製品選択
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  MyJVN APIから取得したベンダーと製品を選択できます。製品未選択の場合はそのベンダーの全製品が対象になります。
                </p>

                {/* 検索入力 */}
                <div className="relative mb-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type="text"
                        value={vendorSearchQuery}
                        onChange={(e) => {
                          setVendorSearchQuery(e.target.value);
                          setShowVendorDropdown(true);
                        }}
                        onFocus={() => setShowVendorDropdown(true)}
                        placeholder="ベンダーを検索またはスクロール..."
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                      />
                    </div>
                  </div>

                  {/* 検索結果ドロップダウン */}
                  {showVendorDropdown && vendorSearchResults && vendorSearchResults.vendors.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                      {vendorSearchResults.vendors.map(vendor => (
                        <button
                          key={vendor.vid}
                          onClick={() => addVendor(vendor)}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200 flex items-center justify-between"
                        >
                          <span>{vendor.vname}</span>
                          {vendorSelections.some(v => v.vendorId === vendor.vid) && (
                            <CheckCircle size={16} className="text-green-500" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 選択済みベンダー */}
                {vendorSelections.length > 0 && (
                  <div className="space-y-2">
                    {vendorSelections.map(vendor => (
                      <div key={vendor.vendorId} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <button
                              onClick={() => setExpandedVendorId(
                                expandedVendorId === vendor.vendorId ? null : vendor.vendorId
                              )}
                              className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600"
                            >
                              {vendor.vendorName}
                            </button>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {vendor.products.length > 0
                                ? `${vendor.products.length}製品選択中`
                                : '全製品対象'}
                            </span>
                          </div>
                          <button
                            onClick={() => removeVendor(vendor.vendorId)}
                            className="text-gray-400 hover:text-red-600"
                          >
                            <X size={16} />
                          </button>
                        </div>

                        {/* 製品一覧（展開時） */}
                        {expandedVendorId === vendor.vendorId && vendorProducts && (
                          <div className="mt-3 pl-4 space-y-2">
                            {/* 製品検索 */}
                            {vendorProducts.products.length > 10 && (
                              <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                <input
                                  type="text"
                                  value={productSearchQueries[vendor.vendorId] || ''}
                                  onChange={(e) => setProductSearchQueries({
                                    ...productSearchQueries,
                                    [vendor.vendorId]: e.target.value
                                  })}
                                  placeholder="製品を検索..."
                                  className="w-full pl-7 pr-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                />
                              </div>
                            )}

                            {/* 製品リスト */}
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {vendorProducts.products
                                .filter(product => {
                                  const query = productSearchQueries[vendor.vendorId] || '';
                                  if (!query) return true;
                                  return product.pname.toLowerCase().includes(query.toLowerCase());
                                })
                                .map(product => (
                                  <label key={product.pid} className="flex items-center gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={vendor.products.some(p => p.productId === product.pid)}
                                      onChange={() => toggleProduct(vendor.vendorId, product)}
                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-gray-700 dark:text-gray-300">{product.pname}</span>
                                  </label>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* キーワードフィルター */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  キーワードフィルター
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  追加のキーワードで脆弱性を検索します。ベンダー/製品選択と併用できます。
                </p>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={handleKeywordKeyDown}
                    placeholder="例: Apache, MySQL, PHP"
                    className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={addKeyword}
                    className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    追加
                  </button>
                </div>
                {syncKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {syncKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2 py-1 rounded-full"
                      >
                        {kw}
                        <button
                          type="button"
                          onClick={() => setSyncKeywords((prev) => prev.filter((k) => k !== kw))}
                          className="hover:text-blue-900"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* CVSS閾値 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  CVSS最小スコア
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  指定スコア以上の脆弱性のみをインポートします。0で無効（全て取得）。
                </p>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={cvssMinScore}
                    onChange={(e) => setCvssMinScore(parseFloat(e.target.value) || 0)}
                    className="w-24 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {cvssMinScore === 0 ? '無効（全て取得）' :
                     cvssMinScore >= 9 ? 'Critical のみ' :
                     cvssMinScore >= 7 ? 'High 以上' :
                     cvssMinScore >= 4 ? 'Medium 以上' :
                     'Low 以上'}
                  </span>
                </div>
              </div>

              {/* 除外キーワード */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  除外キーワードフィルター
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  タイトルまたは説明文に除外キーワードが含まれる脆弱性を除外します。
                </p>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={excludeKeywordInput}
                    onChange={(e) => setExcludeKeywordInput(e.target.value)}
                    onKeyDown={handleExcludeKeywordKeyDown}
                    placeholder="例: WordPress, Drupal"
                    className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={addExcludeKeyword}
                    className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    追加
                  </button>
                </div>
                {syncExcludeKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {syncExcludeKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs font-medium px-2 py-1 rounded-full"
                      >
                        {kw}
                        <button
                          type="button"
                          onClick={() => setSyncExcludeKeywords((prev) => prev.filter((k) => k !== kw))}
                          className="hover:text-red-900"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 初回同期期間 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  初回取得期間
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  初回取得時に取得する過去の期間を指定します。2回目以降は前回取得以降の更新のみを取得します。
                </p>
                <input
                  type="number"
                  min="1"
                  max="3650"
                  value={syncFullSyncDays}
                  onChange={(e) => setSyncFullSyncDays(parseInt(e.target.value) || 365)}
                  className="w-32 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">日</span>
              </div>

              {/* 保持期間 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  データ保持期間
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  指定日数より古いデータを自動削除します。0で無効化（削除しない）。
                </p>
                <input
                  type="number"
                  min="0"
                  max="3650"
                  value={syncRetentionDays}
                  onChange={(e) => setSyncRetentionDays(parseInt(e.target.value) || 0)}
                  className="w-32 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">日（0=無効）</span>
              </div>

              {/* 保存ボタン */}
              <div className="flex justify-end pt-4 border-t dark:border-gray-700">
                <button
                  onClick={handleSaveSettings}
                  disabled={updateSyncSettingsMut.isPending}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save size={16} />
                  {updateSyncSettingsMut.isPending ? '保存中...' : '設定を保存'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* データ管理 */}
      {user?.role === 'admin' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
            <Database size={16} />
            データ管理
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            JVNから取得した脆弱性情報を削除します。この操作は元に戻せません。
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">JVN (Japan Vulnerability Notes)</span>
              <button
                onClick={() => {
                  if (confirm('JVN のデータを削除しますか？\n\nこの操作は元に戻せません。削除後、再度同期を実行することで最新データを取得できます。')) {
                    deleteSyncDataMutation.mutate('jvn');
                  }
                }}
                disabled={deleteSyncDataMutation.isPending}
                className="flex items-center gap-1.5 text-red-600 hover:text-red-700 text-sm disabled:opacity-50"
              >
                <Trash2 size={14} />
                削除
              </button>
            </div>
          </div>

          {deleteSuccess && (
            <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-700">
                {deleteSuccess}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 説明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">データソースについて</h3>
        <div className="text-sm text-blue-800 space-y-1">
          <p>• JVN (Japan Vulnerability Notes) から脆弱性情報を取得します</p>
          <p>• 自動取得は毎日10:00 (JST) に実行されます</p>
          <p>• <strong>増分取得</strong>: 前回取得以降の更新データのみ取得（通常運用）</p>
          <p>• <strong>全件取得</strong>: 設定期間の全データを再取得（製品追加時や過去データ補完に使用）</p>
          <p>• ベンダー/製品選択、キーワード、CVSS閾値を組み合わせてフィルタリングできます</p>
          <p>• 登録済みアセットパッケージ（CPE）は自動的に検知対象になります</p>
        </div>
      </div>

      {/* 全件同期確認モーダル */}
      {showFullSyncConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">全件取得の実行</h3>
            <div className="space-y-3 mb-6">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                過去 <strong className="text-blue-600">{syncFullSyncDays}日分</strong> のデータを取得します。
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  <strong>注意:</strong> 全件取得は通常の取得より時間がかかります。実行してよろしいですか？
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowFullSyncConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                キャンセル
              </button>
              <button
                onClick={() => triggerFullSyncMutation.mutate()}
                disabled={triggerFullSyncMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {triggerFullSyncMutation.isPending ? '実行中...' : '実行'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
