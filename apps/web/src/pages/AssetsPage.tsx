import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Server, X, FileText, Save } from 'lucide-react';
import { api } from '@/lib/api.ts';
import { EcosystemBadge } from '@/components/EcosystemBadge.tsx';
import type { Asset, PaginatedResponse, AssetTemplate } from '@vulflare/shared/types';

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

const ECOSYSTEMS = ['npm', 'pypi', 'maven', 'go', 'nuget', 'rubygems', 'crates.io', 'packagist', 'cpe'];

export function AssetsPage() {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState('server');
  const [environment, setEnvironment] = useState('production');
  const [owner, setOwner] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // Template creation state
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateAssetType, setTemplateAssetType] = useState('server');
  const [templateEnvironment, setTemplateEnvironment] = useState('production');
  const [templatePackages, setTemplatePackages] = useState<Array<{ ecosystem: string; name: string; version: string; vendor?: string }>>([]);
  const [showPkgForm, setShowPkgForm] = useState(false);
  const [pkgEcosystem, setPkgEcosystem] = useState('npm');
  const [pkgName, setPkgName] = useState('');
  const [pkgVersion, setPkgVersion] = useState('');
  const [pkgVendor, setPkgVendor] = useState('');

  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: () => api.get<PaginatedResponse<Asset>>('/assets?limit=100').then((r) => r.data),
  });

  const { data: templatesData } = useQuery({
    queryKey: ['asset-templates'],
    queryFn: () => api.get<{ data: AssetTemplate[] }>('/asset-templates').then((r) => r.data),
    enabled: showTemplateModal,
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Asset>('/assets', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['assets'] });
      setShowCreate(false);
      setName('');
      setOwner('');
    },
  });

  const createFromTemplateMutation = useMutation({
    mutationFn: (body: { templateId: string; name: string; owner?: string }) =>
      api.post(`/asset-templates/${body.templateId}/create-asset`, {
        name: body.name,
        owner: body.owner,
      }),
    onSuccess: (response: any) => {
      void qc.invalidateQueries({ queryKey: ['assets'] });
      setShowTemplateModal(false);
      setSelectedTemplateId('');
      setName('');
      setOwner('');
      // 作成したアセットの詳細ページに遷移
      navigate(`/assets/${response.data.id}`);
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/asset-templates', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['asset-templates'] });
      setShowCreateTemplate(false);
      setTemplateName('');
      setTemplateDescription('');
      setTemplatePackages([]);
      alert('テンプレートを作成しました');
    },
  });

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name, assetType, environment, owner: owner || undefined });
  };

  const handleCreateFromTemplate = (e: FormEvent) => {
    e.preventDefault();
    createFromTemplateMutation.mutate({
      templateId: selectedTemplateId,
      name,
      owner: owner || undefined,
    });
  };

  const handleCreateTemplate = (e: FormEvent) => {
    e.preventDefault();
    createTemplateMutation.mutate({
      name: templateName,
      description: templateDescription || undefined,
      assetType: templateAssetType,
      environment: templateEnvironment,
      packages: templatePackages.length > 0 ? templatePackages : undefined,
    });
  };

  const handleAddPackage = (e: FormEvent) => {
    e.preventDefault();
    setTemplatePackages([...templatePackages, {
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
    setTemplatePackages(templatePackages.filter((_, i) => i !== index));
  };

  const ENV_COLORS: Record<string, string> = {
    production: 'bg-green-100 text-green-800',
    staging: 'bg-yellow-100 text-yellow-800',
    development: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">アセット</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateTemplate(true)}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Save size={16} />
            テンプレートを登録
          </button>
          <button
            onClick={() => setShowTemplateModal(true)}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <FileText size={16} />
            テンプレートから作成
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            新規作成
          </button>
        </div>
      </div>

      {/* Template modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">テンプレートから作成</h2>
              <button onClick={() => setShowTemplateModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateFromTemplate} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">テンプレート *</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">選択してください</option>
                  {(templatesData?.data ?? []).map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                {(templatesData?.data ?? []).length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    テンプレートがありません。
                    <Link to="/asset-templates/new" className="text-blue-600 hover:underline ml-1">
                      新規作成
                    </Link>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">アセット名 *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="web-server-prod-01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">担当者</label>
                <input
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="team-name"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={createFromTemplateMutation.isPending}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  作成
                </button>
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Template creation modal */}
      {showCreateTemplate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 w-full max-w-3xl shadow-xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">アセットテンプレートを登録</h2>
              <button onClick={() => setShowCreateTemplate(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateTemplate} className="space-y-4">
              {/* 基本情報 */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">基本情報</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">テンプレート名 *</label>
                    <input
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      required
                      placeholder="例: Node.js Webサーバー"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                    <textarea
                      value={templateDescription}
                      onChange={(e) => setTemplateDescription(e.target.value)}
                      placeholder="このテンプレートの用途や特徴を入力..."
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">アセット種別 *</label>
                      <select
                        value={templateAssetType}
                        onChange={(e) => setTemplateAssetType(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">環境 *</label>
                      <select
                        value={templateEnvironment}
                        onChange={(e) => setTemplateEnvironment(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {Object.entries(ENV_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* パッケージ */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-white">
                  <h3 className="text-sm font-semibold text-gray-700">パッケージ ({templatePackages.length}件)</h3>
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
                  <div className="px-4 py-3 border-b border-gray-200 bg-white">
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

                {templatePackages.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-500">
                    パッケージが追加されていません
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 bg-white">
                    {templatePackages.map((pkg, index) => (
                      <div key={index} className="px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
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
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={createTemplateMutation.isPending || !templateName}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {createTemplateMutation.isPending ? '作成中...' : 'テンプレートを作成'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateTemplate(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">アセットを追加</h2>
              <button onClick={() => setShowCreate(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名前 *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="web-server-prod"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">種別</label>
                  <select
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">環境</label>
                  <select
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(ENV_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">担当者</label>
                <input
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="team-name"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  作成
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Asset grid */}
      {isLoading ? (
        <div className="text-sm text-gray-500">読み込み中...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data?.data ?? []).map((asset) => (
            <Link
              key={asset.id}
              to={`/assets/${asset.id}`}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Server size={16} className="text-blue-600" />
                </div>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${ENV_COLORS[asset.environment] ?? ''}`}>
                  {ENV_LABELS[asset.environment] ?? asset.environment}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{asset.name}</h3>
              <p className="text-xs text-gray-500">{ASSET_TYPE_LABELS[asset.assetType] ?? asset.assetType}</p>
              {asset.owner && <p className="text-xs text-gray-400 mt-1">担当者: {asset.owner}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
