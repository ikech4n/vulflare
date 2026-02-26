import { useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api.ts';
import { EcosystemBadge } from '@/components/EcosystemBadge.tsx';

const ASSET_TYPES = [
  { value: 'server', label: 'サーバー' },
  { value: 'container', label: 'コンテナ' },
  { value: 'application', label: 'アプリケーション' },
  { value: 'library', label: 'ライブラリ' },
  { value: 'network_device', label: 'ネットワーク機器' },
];

const ENVIRONMENTS = [
  { value: 'production', label: '本番' },
  { value: 'staging', label: 'ステージング' },
  { value: 'development', label: '開発' },
];

const ECOSYSTEMS = ['npm', 'pypi', 'maven', 'go', 'nuget', 'rubygems', 'crates.io', 'packagist', 'cpe'];

export function AssetTemplateFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = id !== 'new';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assetType, setAssetType] = useState('server');
  const [environment, setEnvironment] = useState('production');

  const [packages, setPackages] = useState<Array<{ ecosystem: string; name: string; version: string; vendor?: string }>>([]);
  const [showPkgForm, setShowPkgForm] = useState(false);
  const [pkgEcosystem, setPkgEcosystem] = useState('npm');
  const [pkgName, setPkgName] = useState('');
  const [pkgVersion, setPkgVersion] = useState('');
  const [pkgVendor, setPkgVendor] = useState('');

  const [selectedProductId, setSelectedProductId] = useState('');
  const [eolCycleIds, setEolCycleIds] = useState<string[]>([]);

  const { data: template } = useQuery({
    queryKey: ['asset-template', id],
    queryFn: () => api.get(`/asset-templates/${id}`).then((r) => r.data),
    enabled: isEdit && !!id,
  });

  const { data: eolProducts = [] } = useQuery<Array<{ id: string; display_name: string }>>({
    queryKey: ['eol-products'],
    queryFn: () => api.get('/eol/products').then((r) => r.data),
  });

  const { data: selectedProductDetail } = useQuery<{ cycles: Array<{ id: string; cycle: string; eol_date: string | null }> }>({
    queryKey: ['eol-product-detail', selectedProductId],
    queryFn: () => api.get(`/eol/products/${selectedProductId}`).then((r) => r.data),
    enabled: !!selectedProductId,
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/asset-templates', body),
    onSuccess: () => navigate('/asset-templates'),
  });

  const handleAddPackage = (e: FormEvent) => {
    e.preventDefault();
    setPackages([...packages, {
      ecosystem: pkgEcosystem,
      name: pkgName,
      version: pkgVersion,
      ...(pkgEcosystem === 'cpe' && pkgVendor ? { vendor: pkgVendor } : {}),
    }]);
    setPkgName('');
    setPkgVersion('');
    setPkgVendor('');
    setShowPkgForm(false);
  };

  const handleRemovePackage = (index: number) => {
    setPackages(packages.filter((_, i) => i !== index));
  };

  const handleAddEolCycle = (cycleId: string) => {
    if (!eolCycleIds.includes(cycleId)) {
      setEolCycleIds([...eolCycleIds, cycleId]);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name,
      description: description || undefined,
      assetType,
      environment,
      packages: packages.length > 0 ? packages : undefined,
      eolCycleIds: eolCycleIds.length > 0 ? eolCycleIds : undefined,
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link to="/asset-templates" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">
          {isEdit ? 'テンプレート編集' : 'テンプレート作成'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 基本情報 */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">基本情報</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">テンプレート名 *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="例: Node.js Webサーバー"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="このテンプレートの用途や特徴を入力..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">アセット種別 *</label>
                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ASSET_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">環境 *</label>
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ENVIRONMENTS.map((env) => (
                    <option key={env.value} value={env.value}>{env.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* パッケージ */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">パッケージ ({packages.length}件)</h2>
            <button
              type="button"
              onClick={() => setShowPkgForm(!showPkgForm)}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800"
            >
              <Plus size={14} />
              追加
            </button>
          </div>

          {showPkgForm && (
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-end gap-2 flex-wrap">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">エコシステム</label>
                  <select
                    value={pkgEcosystem}
                    onChange={(e) => setPkgEcosystem(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                  >
                    {ECOSYSTEMS.map((eco) => (
                      <option key={eco} value={eco}>{eco}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-xs font-medium text-gray-500 mb-1">パッケージ名</label>
                  <input
                    type="text"
                    value={pkgName}
                    onChange={(e) => setPkgName(e.target.value)}
                    placeholder="例: express"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="w-28">
                  <label className="block text-xs font-medium text-gray-500 mb-1">バージョン</label>
                  <input
                    type="text"
                    value={pkgVersion}
                    onChange={(e) => setPkgVersion(e.target.value)}
                    placeholder="例: 4.18.2"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                </div>
                {pkgEcosystem === 'cpe' && (
                  <div className="w-28">
                    <label className="block text-xs font-medium text-gray-500 mb-1">ベンダー</label>
                    <input
                      type="text"
                      value={pkgVendor}
                      onChange={(e) => setPkgVendor(e.target.value)}
                      placeholder="例: apache"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleAddPackage}
                  disabled={!pkgName || !pkgVersion}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  追加
                </button>
                <button
                  type="button"
                  onClick={() => setShowPkgForm(false)}
                  className="text-gray-500 hover:text-gray-700 px-2 py-1.5 text-sm"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}

          {packages.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              パッケージが追加されていません
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {packages.map((pkg, index) => (
                <div key={index} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <EcosystemBadge ecosystem={pkg.ecosystem} />
                    <span className="font-medium text-sm text-gray-900">{pkg.name}</span>
                    <span className="text-xs text-gray-500 font-mono">{pkg.version}</span>
                    {pkg.vendor && <span className="text-xs text-gray-400">({pkg.vendor})</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemovePackage(index)}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* EOL情報 */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">EOL情報 ({eolCycleIds.length}件)</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">プロダクト</label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">選択してください</option>
                {eolProducts.map((product: any) => (
                  <option key={product.id} value={product.id}>{product.display_name}</option>
                ))}
              </select>
            </div>
            {selectedProductId && selectedProductDetail && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">サイクル</label>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddEolCycle(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">サイクルを選択して追加...</option>
                  {selectedProductDetail.cycles?.map((cycle) => (
                    <option
                      key={cycle.id}
                      value={cycle.id}
                      disabled={eolCycleIds.includes(cycle.id)}
                    >
                      {cycle.cycle} {cycle.eol_date ? `(EOL: ${cycle.eol_date})` : '(サポート中)'}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {eolCycleIds.length > 0 && (
              <div className="text-xs text-gray-500">
                {eolCycleIds.length}件のEOL情報が追加されています
              </div>
            )}
          </div>
        </div>

        {/* 送信ボタン */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={createMutation.isPending || !name}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending ? '作成中...' : 'テンプレートを作成'}
          </button>
          <Link
            to="/asset-templates"
            className="px-6 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
          >
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  );
}
