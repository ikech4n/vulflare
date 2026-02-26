import { useState, type FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Search, Upload, X } from 'lucide-react';
import { api } from '@/lib/api.ts';
import { SeverityBadge } from '@/components/SeverityBadge.tsx';
import { StatusBadge } from '@/components/StatusBadge.tsx';
import { EolStatusBadge } from '@/components/EolStatusBadge.tsx';
import { EcosystemBadge } from '@/components/EcosystemBadge.tsx';
import { PackageImportModal } from '@/components/PackageImportModal.tsx';
import type { Asset, AssetPackage, AssetEolLinkWithDetails } from '@vulflare/shared/types';
import { useAuthStore } from '@/store/authStore.ts';

interface AssetVulnRow {
  id: string;
  vulnerability_id: string;
  av_status: string;
  av_priority: string;
  cve_id: string | null;
  title: string;
  severity: string;
  cvss_v3_score: number | null;
}

const ECOSYSTEMS = ['npm', 'pypi', 'maven', 'go', 'nuget', 'rubygems', 'crates.io', 'packagist', 'cpe'] as const;

// よく使われるパッケージのプリセット
const PACKAGE_PRESETS: Record<string, Array<{ name: string; vendor?: string; description: string }>> = {
  npm: [
    { name: 'express', description: 'Webフレームワーク' },
    { name: 'react', description: 'UIライブラリ' },
    { name: 'vue', description: 'UIフレームワーク' },
    { name: 'next', description: 'Reactフレームワーク' },
    { name: 'axios', description: 'HTTPクライアント' },
    { name: 'lodash', description: 'ユーティリティライブラリ' },
    { name: 'typescript', description: 'TypeScript' },
    { name: 'webpack', description: 'バンドラー' },
    { name: 'eslint', description: 'Linter' },
    { name: 'jest', description: 'テストフレームワーク' },
    { name: '@nestjs/core', description: 'NestJSフレームワーク' },
  ],
  pypi: [
    { name: 'Django', description: 'Webフレームワーク' },
    { name: 'Flask', description: 'Webフレームワーク' },
    { name: 'FastAPI', description: 'Webフレームワーク' },
    { name: 'requests', description: 'HTTPライブラリ' },
    { name: 'numpy', description: '数値計算ライブラリ' },
    { name: 'pandas', description: 'データ分析ライブラリ' },
    { name: 'SQLAlchemy', description: 'ORM' },
    { name: 'pytest', description: 'テストフレームワーク' },
    { name: 'Pillow', description: '画像処理ライブラリ' },
    { name: 'celery', description: 'タスクキュー' },
  ],
  maven: [
    { name: 'org.springframework.boot:spring-boot-starter', description: 'Spring Boot' },
    { name: 'org.apache.commons:commons-lang3', description: 'Apache Commons Lang' },
    { name: 'com.fasterxml.jackson.core:jackson-databind', description: 'Jackson JSON' },
    { name: 'org.hibernate:hibernate-core', description: 'Hibernate ORM' },
  ],
  go: [
    { name: 'github.com/gin-gonic/gin', description: 'Webフレームワーク' },
    { name: 'github.com/gorilla/mux', description: 'HTTPルーター' },
    { name: 'github.com/stretchr/testify', description: 'テストライブラリ' },
    { name: 'github.com/go-sql-driver/mysql', description: 'MySQLドライバー' },
    { name: 'github.com/lib/pq', description: 'PostgreSQLドライバー' },
    { name: 'gorm.io/gorm', description: 'ORM' },
  ],
  nuget: [
    { name: 'Newtonsoft.Json', description: 'JSON処理' },
    { name: 'Microsoft.EntityFrameworkCore', description: 'Entity Framework Core' },
    { name: 'Serilog', description: 'ログライブラリ' },
  ],
  rubygems: [
    { name: 'rails', description: 'Ruby on Rails' },
    { name: 'sinatra', description: 'Webフレームワーク' },
    { name: 'devise', description: '認証ライブラリ' },
  ],
  'crates.io': [
    { name: 'tokio', description: '非同期ランタイム' },
    { name: 'serde', description: 'シリアライゼーション' },
    { name: 'axum', description: 'Webフレームワーク' },
  ],
  packagist: [
    { name: 'symfony/symfony', description: 'Symfonyフレームワーク' },
    { name: 'laravel/framework', description: 'Laravelフレームワーク' },
    { name: 'guzzlehttp/guzzle', description: 'HTTPクライアント' },
  ],
  cpe: [
    { name: 'php', vendor: 'php', description: 'PHP言語' },
    { name: 'apache', vendor: 'apache', description: 'Apache HTTPサーバー' },
    { name: 'nginx', vendor: 'nginx', description: 'Nginx Webサーバー' },
    { name: 'mysql', vendor: 'mysql', description: 'MySQLデータベース' },
    { name: 'postgresql', vendor: 'postgresql', description: 'PostgreSQLデータベース' },
    { name: 'mariadb', vendor: 'mariadb', description: 'MariaDBデータベース' },
    { name: 'redis', vendor: 'redis', description: 'Redisキャッシュ' },
    { name: 'mongodb', vendor: 'mongodb', description: 'MongoDBデータベース' },
    { name: 'node.js', vendor: 'nodejs', description: 'Node.js' },
    { name: 'python', vendor: 'python', description: 'Python言語' },
    { name: 'ruby', vendor: 'ruby-lang', description: 'Ruby言語' },
    { name: 'java', vendor: 'oracle', description: 'Java (Oracle)' },
    { name: 'openjdk', vendor: 'openjdk', description: 'OpenJDK' },
    { name: 'tomcat', vendor: 'apache', description: 'Apache Tomcat' },
    { name: 'wordpress', vendor: 'wordpress', description: 'WordPress CMS' },
    { name: 'drupal', vendor: 'drupal', description: 'Drupal CMS' },
    { name: 'joomla', vendor: 'joomla', description: 'Joomla CMS' },
    { name: 'linux_kernel', vendor: 'linux', description: 'Linuxカーネル' },
    { name: 'openssh', vendor: 'openbsd', description: 'OpenSSH' },
    { name: 'openssl', vendor: 'openssl', description: 'OpenSSL' },
    { name: 'curl', vendor: 'haxx', description: 'cURL' },
    { name: 'git', vendor: 'git-scm', description: 'Git' },
    { name: 'docker', vendor: 'docker', description: 'Docker' },
    { name: 'kubernetes', vendor: 'kubernetes', description: 'Kubernetes' },
    { name: 'elasticsearch', vendor: 'elastic', description: 'Elasticsearch' },
    { name: 'rabbitmq', vendor: 'rabbitmq', description: 'RabbitMQ' },
    { name: 'haproxy', vendor: 'haproxy', description: 'HAProxy' },
    { name: 'varnish', vendor: 'varnish-cache', description: 'Varnish Cache' },
  ],
};

export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const canEdit = user?.role === 'admin' || user?.role === 'editor';

  // パッケージ追加フォーム
  const [showPkgForm, setShowPkgForm] = useState(false);
  const [pkgEcosystem, setPkgEcosystem] = useState<string>('npm');
  const [pkgName, setPkgName] = useState('');
  const [pkgVersion, setPkgVersion] = useState('');
  const [pkgVendor, setPkgVendor] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);

  // EOL追加モーダル
  const [showEolModal, setShowEolModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [eolInstalledVersion, setEolInstalledVersion] = useState('');

  // 脆弱性追加モーダル
  const [showVulnModal, setShowVulnModal] = useState(false);
  const [vulnSearchQuery, setVulnSearchQuery] = useState('');
  const [selectedVulnId, setSelectedVulnId] = useState('');

  const { data: asset } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => api.get<Asset>(`/assets/${id!}`).then((r) => r.data),
    enabled: !!id,
  });

  const { data: vulnsData } = useQuery({
    queryKey: ['asset-vulns', id],
    queryFn: () =>
      api
        .get<{ data: AssetVulnRow[] }>(`/assets/${id!}/vulnerabilities`)
        .then((r) => r.data),
    enabled: !!id,
  });

  const { data: eolData = [] } = useQuery<AssetEolLinkWithDetails[]>({
    queryKey: ['asset-eol', id],
    queryFn: () => api.get(`/eol/assets/${id!}/eol`).then((r) => r.data),
    enabled: !!id,
  });

  const { data: packagesData } = useQuery({
    queryKey: ['asset-packages', id],
    queryFn: () =>
      api
        .get<{ data: AssetPackage[] }>(`/assets/${id!}/packages`)
        .then((r) => r.data),
    enabled: !!id,
  });

  // EOLプロダクト一覧を取得（パッケージ追加時にも使用）
  const { data: eolProducts = [] } = useQuery<Array<{ id: string; display_name: string; product_name: string }>>({
    queryKey: ['eol-products'],
    queryFn: () => api.get('/eol/products').then((r) => r.data),
    enabled: showEolModal || (showPkgForm && pkgEcosystem === 'cpe'),
  });

  // 選択されたプロダクトの詳細（サイクル含む）を取得
  const { data: selectedProductDetail } = useQuery<{ id: string; display_name: string; cycles: Array<{ id: string; cycle: string; eol_date: string | null; is_eol: number }> }>({
    queryKey: ['eol-product-detail', selectedProductId],
    queryFn: () => api.get(`/eol/products/${selectedProductId}`).then((r) => r.data),
    enabled: !!selectedProductId,
  });

  // 脆弱性検索
  const { data: vulnSearchResults } = useQuery({
    queryKey: ['vuln-search', vulnSearchQuery],
    queryFn: () =>
      api.get(`/vulnerabilities?q=${encodeURIComponent(vulnSearchQuery)}&limit=20`).then((r) => r.data),
    enabled: showVulnModal && vulnSearchQuery.length > 2,
  });

  const updateLinkMutation = useMutation({
    mutationFn: ({ vulnId, status }: { vulnId: string; status: string }) =>
      api.patch(`/assets/${id!}/vulnerabilities/${vulnId}`, { status }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['asset-vulns', id] }),
  });

  const addPackageMutation = useMutation({
    mutationFn: (body: { ecosystem: string; name: string; version: string; vendor?: string }) =>
      api.post(`/assets/${id!}/packages`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['asset-packages', id] });
      setShowPkgForm(false);
      setPkgName('');
      setPkgVersion('');
      setPkgVendor('');
    },
  });

  const deletePackageMutation = useMutation({
    mutationFn: (pkgId: string) =>
      api.delete(`/assets/${id!}/packages/${pkgId}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['asset-packages', id] }),
  });

  const importPackagesMutation = useMutation({
    mutationFn: (packages: Array<{ ecosystem: string; name: string; version: string; vendor?: string }>) =>
      api.post(`/assets/${id!}/packages/import`, { packages }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['asset-packages', id] });
      setShowImportModal(false);
    },
  });

  const scanMutation = useMutation({
    mutationFn: () => api.post(`/assets/${id!}/packages/scan`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['asset-vulns', id] });
      void qc.invalidateQueries({ queryKey: ['asset-packages', id] });
    },
  });

  const addEolMutation = useMutation({
    mutationFn: (body: { eol_cycle_id: string; installed_version?: string }) =>
      api.post(`/eol/assets/${id!}/eol`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['asset-eol', id] });
      setShowEolModal(false);
      setSelectedCycleId('');
      setEolInstalledVersion('');
    },
  });

  const deleteEolMutation = useMutation({
    mutationFn: (linkId: string) => api.delete(`/eol/assets/${id!}/eol/${linkId}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['asset-eol', id] }),
  });

  const addVulnMutation = useMutation({
    mutationFn: (body: { vulnerabilityId: string }) =>
      api.post(`/assets/${id!}/vulnerabilities`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['asset-vulns', id] });
      setShowVulnModal(false);
      setSelectedVulnId('');
      setVulnSearchQuery('');
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: () => api.delete(`/assets/${id!}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['assets'] });
      navigate('/assets');
    },
  });

  if (!asset) return <div className="text-sm text-gray-500">読み込み中...</div>;

  const vulns = vulnsData?.data ?? [];
  const packages = packagesData?.data ?? [];

  const handleAddPackage = (e: FormEvent) => {
    e.preventDefault();
    addPackageMutation.mutate({
      ecosystem: pkgEcosystem,
      name: pkgName,
      version: pkgVersion,
      ...(pkgEcosystem === 'cpe' && pkgVendor ? { vendor: pkgVendor } : {}),
    });
  };

  const handlePackageSelect = (selectedName: string) => {
    setPkgName(selectedName);

    // CPEの場合、プリセットまたはEOL製品からベンダー名を自動入力
    if (pkgEcosystem === 'cpe') {
      // プリセットから検索
      const preset = PACKAGE_PRESETS.cpe.find(p => p.name === selectedName);
      if (preset?.vendor) {
        setPkgVendor(preset.vendor);
        return;
      }

      // EOL製品から検索（product_nameをベンダー名として使用）
      const eolProduct = eolProducts.find(p => p.product_name === selectedName);
      if (eolProduct) {
        setPkgVendor(eolProduct.product_name);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PackageImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={(pkgs) => importPackagesMutation.mutate(pkgs)}
        isPending={importPackagesMutation.isPending}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/assets" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{asset.name}</h1>
            <p className="text-sm text-gray-500 capitalize">
              {asset.assetType} &middot; {asset.environment}
              {asset.owner && ` · ${asset.owner}`}
            </p>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              if (confirm(`アセット「${asset.name}」を削除しますか？\n\n関連するパッケージ、脆弱性の紐づけ、EOL情報もすべて削除されます。`)) {
                deleteAssetMutation.mutate();
              }
            }}
            disabled={deleteAssetMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            <Trash2 size={16} />
            {deleteAssetMutation.isPending ? '削除中...' : 'アセットを削除'}
          </button>
        )}
      </div>

      {/* EOL追加モーダル */}
      {showEolModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">EOL情報を追加</h2>
              <button onClick={() => setShowEolModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">プロダクト *</label>
                {eolProducts.length === 0 ? (
                  <p className="text-sm text-gray-500">読み込み中...</p>
                ) : (
                  <select
                    value={selectedProductId}
                    onChange={(e) => {
                      setSelectedProductId(e.target.value);
                      setSelectedCycleId('');
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">選択してください</option>
                    {eolProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.display_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {selectedProductId && selectedProductDetail && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">バージョン/サイクル *</label>
                  <select
                    value={selectedCycleId}
                    onChange={(e) => setSelectedCycleId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">選択してください</option>
                    {selectedProductDetail.cycles?.map((cycle) => (
                      <option key={cycle.id} value={cycle.id}>
                        {cycle.cycle} {cycle.eol_date ? `(EOL: ${cycle.eol_date})` : '(サポート中)'}
                        {cycle.is_eol === 1 ? ' ⚠️' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">インストール済みバージョン（任意）</label>
                <input
                  type="text"
                  value={eolInstalledVersion}
                  onChange={(e) => setEolInstalledVersion(e.target.value)}
                  placeholder="例: 20.04.5"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    if (selectedCycleId) {
                      addEolMutation.mutate({
                        eol_cycle_id: selectedCycleId,
                        installed_version: eolInstalledVersion || undefined,
                      });
                    }
                  }}
                  disabled={!selectedCycleId || addEolMutation.isPending}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {addEolMutation.isPending ? '追加中...' : '追加'}
                </button>
                <button
                  onClick={() => {
                    setShowEolModal(false);
                    setSelectedProductId('');
                    setSelectedCycleId('');
                    setEolInstalledVersion('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EOL Information */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            EOL情報 ({eolData.length}件)
          </h2>
          {canEdit && (
            <button
              onClick={() => setShowEolModal(true)}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800"
            >
              <Plus size={14} />
              追加
            </button>
          )}
        </div>

        {eolData.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            このアセットにEOL情報が登録されていません。
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">プロダクト</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">バージョン</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">インストール版</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">EOL日</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ステータス</th>
                {canEdit && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {eolData.map((link) => (
                <tr key={link.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link to={`/eol/products/${link.product.id}`} className="text-blue-600 hover:underline">
                      {link.product.display_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{link.cycle.cycle}</td>
                  <td className="px-4 py-3 text-gray-700">{link.installed_version || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {link.cycle.eol_date || '未定'}
                  </td>
                  <td className="px-4 py-3">
                    <EolStatusBadge eolDate={link.cycle.eol_date} isEol={link.cycle.is_eol === 1} />
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          if (confirm(`${link.product.display_name} の紐づけを解除しますか？`)) {
                            deleteEolMutation.mutate(link.id);
                          }
                        }}
                        disabled={deleteEolMutation.isPending}
                        className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                        title="削除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Packages */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            パッケージ ({packages.length}件)
          </h2>
          {canEdit && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => scanMutation.mutate()}
                disabled={scanMutation.isPending || packages.length === 0}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Search size={14} />
                {scanMutation.isPending ? 'スキャン中...' : '脆弱性スキャン'}
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800"
              >
                <Upload size={14} />
                インポート
              </button>
              <button
                onClick={() => setShowPkgForm(!showPkgForm)}
                className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800"
              >
                <Plus size={14} />
                追加
              </button>
            </div>
          )}
        </div>

        {showPkgForm && canEdit && (
          <form onSubmit={handleAddPackage} className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-end gap-2 flex-wrap">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">エコシステム</label>
                <select
                  value={pkgEcosystem}
                  onChange={(e) => {
                    setPkgEcosystem(e.target.value);
                    setPkgName('');
                    setPkgVendor('');
                  }}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ECOSYSTEMS.map((eco) => (
                    <option key={eco} value={eco}>{eco}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  パッケージ名
                  {pkgEcosystem === 'cpe' && eolProducts.length > 0 && (
                    <span className="ml-1 text-xs text-gray-400">({PACKAGE_PRESETS.cpe.length + eolProducts.length}件)</span>
                  )}
                </label>
                <input
                  type="text"
                  list={`package-list-${pkgEcosystem}`}
                  value={pkgName}
                  onChange={(e) => handlePackageSelect(e.target.value)}
                  required
                  placeholder={pkgEcosystem === 'cpe' ? '選択または入力' : '例: express'}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <datalist id={`package-list-${pkgEcosystem}`}>
                  {PACKAGE_PRESETS[pkgEcosystem]?.map((pkg) => (
                    <option key={pkg.name} value={pkg.name}>
                      {pkg.description}
                    </option>
                  ))}
                  {pkgEcosystem === 'cpe' && eolProducts.map((product) => (
                    <option key={product.id} value={product.product_name}>
                      {product.display_name}
                    </option>
                  ))}
                </datalist>
              </div>
              <div className="w-28">
                <label className="block text-xs font-medium text-gray-500 mb-1">バージョン</label>
                <input
                  type="text"
                  value={pkgVersion}
                  onChange={(e) => setPkgVersion(e.target.value)}
                  required
                  placeholder="例: 4.18.2"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {pkgEcosystem === 'cpe' && (
                <div className="w-32">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    ベンダー
                    {(() => {
                      const presetVendors = new Set(PACKAGE_PRESETS.cpe.map(p => p.vendor).filter(Boolean));
                      const eolVendors = new Set(eolProducts.map(p => p.product_name));
                      const totalVendors = new Set([...presetVendors, ...eolVendors]);
                      return totalVendors.size > 0 && (
                        <span className="ml-1 text-xs text-gray-400">({totalVendors.size}件)</span>
                      );
                    })()}
                  </label>
                  <input
                    type="text"
                    list="vendor-list"
                    value={pkgVendor}
                    onChange={(e) => setPkgVendor(e.target.value)}
                    placeholder="選択または入力"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <datalist id="vendor-list">
                    {Array.from(new Set([
                      ...PACKAGE_PRESETS.cpe.map(p => p.vendor).filter(Boolean),
                      ...eolProducts.map(p => p.product_name)
                    ])).sort().map((vendor) => (
                      <option key={vendor} value={vendor} />
                    ))}
                  </datalist>
                </div>
              )}
              <button
                type="submit"
                disabled={addPackageMutation.isPending}
                className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {addPackageMutation.isPending ? '追加中...' : '追加'}
              </button>
              <button
                type="button"
                onClick={() => setShowPkgForm(false)}
                className="text-gray-500 hover:text-gray-700 px-2 py-1.5 text-sm"
              >
                キャンセル
              </button>
            </div>
          </form>
        )}

        {packages.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            このアセットにパッケージが登録されていません。
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">エコシステム</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">パッケージ名</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">バージョン</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ベンダー</th>
                {canEdit && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {packages.map((pkg) => (
                <tr key={pkg.id}>
                  <td className="px-4 py-3"><EcosystemBadge ecosystem={pkg.ecosystem} /></td>
                  <td className="px-4 py-3 font-medium text-gray-900">{pkg.name}</td>
                  <td className="px-4 py-3 text-gray-700 font-mono text-xs">{pkg.version}</td>
                  <td className="px-4 py-3 text-gray-500">{pkg.vendor ?? '—'}</td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          if (confirm(`${pkg.name}@${pkg.version} を削除しますか？`)) {
                            deletePackageMutation.mutate(pkg.id);
                          }
                        }}
                        disabled={deletePackageMutation.isPending}
                        className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                        title="削除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 脆弱性追加モーダル */}
      {showVulnModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">脆弱性を追加</h2>
              <button onClick={() => setShowVulnModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">脆弱性を検索</label>
                <input
                  type="text"
                  value={vulnSearchQuery}
                  onChange={(e) => setVulnSearchQuery(e.target.value)}
                  placeholder="CVE ID、タイトルで検索..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {vulnSearchQuery.length > 2 && vulnSearchResults?.data && (
                <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                  {vulnSearchResults.data.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500 text-center">該当する脆弱性が見つかりません</p>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {vulnSearchResults.data.map((vuln: any) => (
                        <button
                          key={vuln.id}
                          onClick={() => setSelectedVulnId(vuln.id)}
                          className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${
                            selectedVulnId === vuln.id ? 'bg-blue-50 border-l-2 border-blue-600' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-gray-900">{vuln.cveId || '(CVE IDなし)'}</div>
                              <div className="text-xs text-gray-500 line-clamp-2">{vuln.title}</div>
                            </div>
                            <SeverityBadge severity={vuln.severity} />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    if (selectedVulnId) {
                      addVulnMutation.mutate({ vulnerabilityId: selectedVulnId });
                    }
                  }}
                  disabled={!selectedVulnId || addVulnMutation.isPending}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {addVulnMutation.isPending ? '追加中...' : '追加'}
                </button>
                <button
                  onClick={() => setShowVulnModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vulnerabilities */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            脆弱性 ({vulns.length}件)
          </h2>
          {canEdit && (
            <button
              onClick={() => setShowVulnModal(true)}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800"
            >
              <Plus size={14} />
              追加
            </button>
          )}
        </div>

        {vulns.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            このアセットに紐づく脆弱性はありません。
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CVE / タイトル</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">深刻度</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CVSS</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ステータス</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vulns.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <Link
                      to={`/vulnerabilities/${row.vulnerability_id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {row.cve_id ?? '—'}
                    </Link>
                    <div className="text-xs text-gray-500 line-clamp-1">{row.title}</div>
                  </td>
                  <td className="px-4 py-3"><SeverityBadge severity={row.severity} /></td>
                  <td className="px-4 py-3 text-gray-700">
                    {row.cvss_v3_score != null ? row.cvss_v3_score.toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={row.av_status} /></td>
                  <td className="px-4 py-3">
                    <select
                      value={row.av_status}
                      onChange={(e) =>
                        updateLinkMutation.mutate({
                          vulnId: row.vulnerability_id,
                          status: e.target.value,
                        })
                      }
                      className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none"
                    >
                      <option value="open">未対応</option>
                      <option value="in_progress">対応中</option>
                      <option value="fixed">解決済み</option>
                      <option value="accepted_risk">リスク受容</option>
                      <option value="false_positive">誤検知</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
