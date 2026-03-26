import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  EolCategory,
  EolProduct,
  EolStats,
  HardwareAsset,
  HardwareAssetStatus,
} from "@vulflare/shared/types";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Edit,
  Package,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api.ts";
import { useAuthStore } from "@/store/authStore.ts";

const CATEGORY_LABELS: Record<EolCategory, string> = {
  os: "OS",
  programming_language: "プログラミング言語",
  runtime: "ランタイム",
  middleware: "ミドルウェア",
  framework: "フレームワーク",
  library: "ライブラリ",
  cloud_service: "クラウドサービス",
  database: "データベース",
  container: "コンテナ",
  ai_model: "AI モデル",
  security: "セキュリティ",
  hw_server: "サーバー",
  hw_network: "ネットワーク機器",
  hw_storage: "ストレージ",
  hw_security_appliance: "セキュリティアプライアンス",
  hw_peripheral: "周辺機器",
  hw_other: "その他",
};

type EolStatusFilter = "eol" | "approaching_30d" | "approaching_90d";

const STATUS_LABELS: Record<EolStatusFilter, string> = {
  eol: "EOL済み",
  approaching_30d: "30日以内EOL",
  approaching_90d: "90日以内EOL",
};

type HardwareCategory =
  | "hw_server"
  | "hw_network"
  | "hw_storage"
  | "hw_security_appliance"
  | "hw_peripheral"
  | "hw_other";

const SOFTWARE_CATEGORIES = [
  "os",
  "programming_language",
  "runtime",
  "middleware",
  "framework",
  "library",
  "cloud_service",
  "database",
  "container",
  "ai_model",
  "security",
] as Exclude<EolCategory, HardwareCategory>[];

const HARDWARE_CATEGORIES: HardwareCategory[] = [
  "hw_server",
  "hw_network",
  "hw_storage",
  "hw_security_appliance",
  "hw_peripheral",
  "hw_other",
];

export function EolPage() {
  const { user } = useAuthStore();
  const isViewer = user?.role === "viewer";
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"software" | "hardware">("software");
  const [selectedCategory, setSelectedCategory] = useState<EolCategory | "">("");
  const [selectedHardwareProductId, setSelectedHardwareProductId] = useState<string | null>(null);
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<HardwareAsset | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddHardwareModal, setShowAddHardwareModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const selectedStatus = searchParams.get("status") as EolStatusFilter | null;

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const bulkSyncMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/eol/sync-all");
      return res.data as { total: number; synced: number; failed: string[] };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["eol"] });
      const msg =
        data.failed.length > 0
          ? `同期完了 (${data.total}件中 ${data.failed.length}件失敗)`
          : `全${data.total}件の同期が完了しました`;
      showToast(msg, data.failed.length > 0 ? "error" : "success");
    },
    onError: () => {
      showToast("一括同期に失敗しました", "error");
    },
  });

  // 統計情報
  const { data: stats } = useQuery<EolStats>({
    queryKey: ["eol", "stats"],
    queryFn: async () => {
      const res = await api.get("/eol/stats");
      return res.data;
    },
  });

  // ソフトウェアプロダクト一覧
  const { data: allProducts = [], isLoading } = useQuery<EolProduct[]>({
    queryKey: ["eol", "products", selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStatus) params.set("status", selectedStatus);
      const query = params.toString() ? `?${params.toString()}` : "";
      const res = await api.get(`/eol/products${query}`);
      return res.data;
    },
  });

  // ハードウェアプロダクト一覧（集計付き）
  const { data: hardwareProducts = [], isLoading: isHardwareLoading } = useQuery<EolProduct[]>({
    queryKey: ["eol", "hardware-products"],
    queryFn: async () => {
      const res = await api.get("/eol/hardware-products");
      return res.data;
    },
    enabled: activeTab === "hardware",
  });

  const products =
    activeTab === "hardware"
      ? hardwareProducts
      : allProducts.filter(
          (p) =>
            !p.category.startsWith("hw_") &&
            (selectedCategory === "" || p.category === selectedCategory),
        );

  const selectedHardwareProduct = products.find((p) => p.id === selectedHardwareProductId) ?? null;

  const { data: hardwareAssets = [], isLoading: isAssetsLoading } = useQuery<HardwareAsset[]>({
    queryKey: ["eol", "assets", selectedHardwareProductId],
    queryFn: async () => {
      if (!selectedHardwareProductId) return [];
      const res = await api.get(`/eol/assets?product_id=${selectedHardwareProductId}`);
      return res.data;
    },
    enabled: !!selectedHardwareProductId,
  });

  const handleStatusFilter = (status: EolStatusFilter) => {
    if (selectedStatus === status) {
      setSearchParams({});
    } else {
      setSearchParams({ status });
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}
        >
          {toast.message}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">EOL 管理</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            ソフトウェア・ハードウェアの EOL（サポート終了）を管理します
          </p>
        </div>
      </div>

      {/* 統計サマリー */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-left transition-all hover:shadow-md ${!selectedStatus ? "ring-2 ring-blue-400" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">登録プロダクト</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.total_products}
                </p>
              </div>
              <Package className="w-8 h-8 text-gray-400" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleStatusFilter("eol")}
            className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-left transition-all hover:shadow-md ${selectedStatus === "eol" ? "ring-2 ring-red-400" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">EOL済み</p>
                <p className="text-2xl font-bold text-red-600">{stats.eol_count}</p>
              </div>
              <Calendar className="w-8 h-8 text-red-400" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleStatusFilter("approaching_30d")}
            className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-left transition-all hover:shadow-md ${selectedStatus === "approaching_30d" ? "ring-2 ring-orange-400" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">30日以内EOL</p>
                <p className="text-2xl font-bold text-orange-600">{stats.approaching_eol_30d}</p>
              </div>
              <Calendar className="w-8 h-8 text-orange-400" />
            </div>
          </button>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">サポート中</p>
                <p className="text-2xl font-bold text-green-600">{stats.supported_count}</p>
              </div>
              <Calendar className="w-8 h-8 text-green-400" />
            </div>
          </div>
        </div>
      )}

      {/* タブ */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab("software");
              setSelectedCategory("");
            }}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "software"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            ソフトウェア
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("hardware");
              setSelectedCategory("");
              setSelectedHardwareProductId(null);
            }}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "hardware"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            ハードウェア
          </button>
        </nav>
      </div>

      {/* タブ共通：フィルタ・ボタン群 */}
      <div className="flex items-center gap-3 flex-wrap justify-between">
        <div className="flex items-center gap-2">
          {activeTab === "software" && (
            <>
              <label
                htmlFor="category-filter"
                className="text-sm font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap"
              >
                カテゴリ:
              </label>
              <select
                id="category-filter"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as EolCategory | "")}
                className="min-w-0 flex-1 sm:flex-none px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-gray-200"
              >
                <option value="">すべて</option>
                {SOFTWARE_CATEGORIES.map((key) => (
                  <option key={key} value={key}>
                    {CATEGORY_LABELS[key]}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
        {!isViewer && (
          <div className="flex items-center gap-2">
            {activeTab === "software" && user?.role === "admin" && (
              <button
                type="button"
                onClick={() => bulkSyncMutation.mutate()}
                disabled={bulkSyncMutation.isPending}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${bulkSyncMutation.isPending ? "animate-spin" : ""}`}
                />
                {bulkSyncMutation.isPending ? "同期中..." : "一括同期"}
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                activeTab === "software" ? setShowAddModal(true) : setShowAddHardwareModal(true)
              }
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
            >
              <Plus className="w-3.5 h-3.5" />
              プロダクト追加
            </button>
          </div>
        )}
      </div>

      {/* プロダクト一覧 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">プロダクト一覧</h2>
          {selectedStatus && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
              {STATUS_LABELS[selectedStatus]}
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className="ml-0.5 hover:text-orange-600"
                aria-label="フィルター解除"
              >
                ×
              </button>
            </span>
          )}
        </div>

        <div className="p-6">
          {(activeTab === "hardware" ? isHardwareLoading : isLoading) ? (
            <p className="text-center text-gray-500 dark:text-gray-400">読み込み中...</p>
          ) : products.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400">プロダクトがありません</p>
          ) : activeTab === "hardware" ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    {["プロダクト名", "カテゴリ", "資産数", "最寄りサポート期限", "操作"].map(
                      (h) => (
                        <th
                          key={h}
                          className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase ${h === "操作" ? "text-right" : "text-left"}`}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {products.map((product) => (
                    <tr
                      key={product.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${selectedHardwareProductId === product.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                      onClick={() =>
                        setSelectedHardwareProductId(
                          selectedHardwareProductId === product.id ? null : product.id,
                        )
                      }
                    >
                      <td className="px-4 py-4">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {product.display_name}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 whitespace-nowrap">
                          {CATEGORY_LABELS[product.category]}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
                        {product.asset_count ?? 0}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {product.nearest_support_expiry ? (
                          <span
                            className={
                              new Date(product.nearest_support_expiry) <= new Date()
                                ? "text-red-600 font-medium"
                                : new Date(product.nearest_support_expiry) <=
                                    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                                  ? "text-yellow-600"
                                  : "text-gray-900 dark:text-gray-100"
                            }
                          >
                            {product.nearest_support_expiry}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <ProductActions product={product} onToast={showToast} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      プロダクト名
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      カテゴリ
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      最新バージョン
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      次のEOLバージョン
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-4">
                        <Link
                          to={`/eol/products/${product.id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {product.display_name}
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 whitespace-nowrap">
                          {CATEGORY_LABELS[product.category]}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
                        {product.latest_version ?? "-"}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {product.next_eol_version ? (
                          <span
                            className={
                              product.next_eol_date &&
                              new Date(product.next_eol_date) <=
                                new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                                ? "text-red-600 font-medium"
                                : product.next_eol_date &&
                                    new Date(product.next_eol_date) <=
                                      new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                                  ? "text-yellow-600"
                                  : "text-gray-900 dark:text-gray-100"
                            }
                          >
                            {product.next_eol_version}
                            {product.next_eol_date && (
                              <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                                ({product.next_eol_date})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <ProductActions product={product} onToast={showToast} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ハードウェア資産一覧 */}
      {activeTab === "hardware" && selectedHardwareProduct && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {selectedHardwareProduct.display_name} の資産一覧
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {hardwareAssets.length} 台登録済み
              </p>
            </div>
            {!isViewer && (
              <button
                type="button"
                onClick={() => setShowAddAssetModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
              >
                <Plus className="w-3.5 h-3.5" />
                資産追加
              </button>
            )}
          </div>
          <div className="p-6">
            {isAssetsLoading ? (
              <p className="text-center text-gray-500 dark:text-gray-400">読み込み中...</p>
            ) : hardwareAssets.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400">
                資産が登録されていません
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead>
                    <tr>
                      {[
                        "識別情報",
                        "ホスト名",
                        "機器名",
                        "ステータス",
                        "サポート期限",
                        "保証期限",
                        "設置場所",
                        "担当者",
                        "操作",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {hardwareAssets.map((asset) => (
                      <tr key={asset.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {asset.identifier ?? "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {asset.hostname ?? "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {asset.device_name ?? "-"}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <HardwareAssetStatusBadge status={asset.status} />
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {asset.support_expiry ? (
                            <span
                              className={
                                new Date(asset.support_expiry) <= new Date()
                                  ? "text-red-600 font-medium"
                                  : new Date(asset.support_expiry) <=
                                      new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                                    ? "text-yellow-600"
                                    : "text-gray-900 dark:text-gray-100"
                              }
                            >
                              {asset.support_expiry}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {asset.warranty_expiry ? (
                            <span
                              className={
                                new Date(asset.warranty_expiry) <= new Date()
                                  ? "text-red-600 font-medium"
                                  : "text-gray-900 dark:text-gray-100"
                              }
                            >
                              {asset.warranty_expiry}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {asset.location ?? "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {asset.owner ?? "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!isViewer && (
                              <button
                                type="button"
                                onClick={() => setEditingAsset(asset)}
                                className="p-1 text-gray-600 hover:text-gray-800"
                                title="編集"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {user?.role === "admin" && (
                              <AssetDeleteButton
                                assetId={asset.id}
                                productId={asset.product_id}
                                onToast={showToast}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {showAddModal && <AddProductModal onClose={() => setShowAddModal(false)} />}
      {showAddHardwareModal && <AddHardwareModal onClose={() => setShowAddHardwareModal(false)} />}
      {showAddAssetModal && selectedHardwareProductId && (
        <HardwareAssetModal
          productId={selectedHardwareProductId}
          onClose={() => setShowAddAssetModal(false)}
          onToast={showToast}
        />
      )}
      {editingAsset && (
        <HardwareAssetModal
          productId={editingAsset.product_id}
          asset={editingAsset}
          onClose={() => setEditingAsset(null)}
          onToast={showToast}
        />
      )}
    </div>
  );
}

function ProductActions({
  product,
  onToast,
}: {
  product: EolProduct;
  onToast: (message: string, type: "success" | "error") => void;
}) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showEditModal, setShowEditModal] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/eol/products/${product.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eol"] });
    },
    onError: () => {
      onToast("削除に失敗しました", "error");
    },
  });

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        {user?.role !== "viewer" && (
          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="p-1 text-gray-600 hover:text-gray-800"
            title="編集"
          >
            <Edit className="w-4 h-4" />
          </button>
        )}
        {user?.role === "admin" && (
          <button
            type="button"
            onClick={() => {
              if (confirm("本当に削除しますか?")) {
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
        <EditProductModal product={product} onClose={() => setShowEditModal(false)} />
      )}
    </>
  );
}

function AddProductModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    product_name: "",
    display_name: "",
    category: "os" as EolCategory,
    eol_api_id: "",
    link: "",
  });

  // 利用可能な製品一覧を取得
  const { data: availableProducts = [] } = useQuery<string[]>({
    queryKey: ["eol", "available-products"],
    queryFn: async () => {
      const res = await api.get("/eol/available-products");
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
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    setFormData({
      ...formData,
      product_name: productId,
      display_name: displayName,
      eol_api_id: eolApiId,
    });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/eol/products", {
        ...formData,
        eol_api_id: formData.eol_api_id || undefined,
        link: formData.link || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eol"] });
      onClose();
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg || "作成に失敗しました");
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">プロダクト追加</h2>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="create-product-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
            >
              プロダクト名（英語）*
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                ({availableProducts.length}個の製品から選択可能)
              </span>
            </label>
            <input
              id="create-product-name"
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              placeholder="例: ubuntu, nodejs, python"
            />
            <datalist id="available-products">
              {availableProducts.map((product) => (
                <option key={product} value={product} />
              ))}
            </datalist>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              endoflife.date APIに対応している製品から選択すると自動入力されます
            </p>
          </div>

          <div>
            <label
              htmlFor="create-display-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
            >
              表示名*
            </label>
            <input
              id="create-display-name"
              type="text"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              placeholder="例: Ubuntu"
            />
          </div>

          <div>
            <label
              htmlFor="create-category"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
            >
              カテゴリ*
            </label>
            <select
              id="create-category"
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value as EolCategory })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            >
              {SOFTWARE_CATEGORIES.map((key) => (
                <option key={key} value={key}>
                  {CATEGORY_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="create-eol-api-id"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
            >
              endoflife.date API ID
            </label>
            <input
              id="create-eol-api-id"
              type="text"
              value={formData.eol_api_id}
              onChange={(e) => setFormData({ ...formData, eol_api_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              placeholder="例: ubuntu"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              設定すると自動同期されます（任意）
            </p>
          </div>

          <div>
            <label
              htmlFor="create-link"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
            >
              公式URL
            </label>
            <input
              id="create-link"
              type="url"
              value={formData.link}
              onChange={(e) => setFormData({ ...formData, link: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={!formData.product_name || !formData.display_name || createMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending ? "作成中..." : "作成"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddHardwareModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [showAssetFields, setShowAssetFields] = useState(false);
  const [formData, setFormData] = useState({
    product_name: "",
    display_name: "",
    category: "hw_other" as HardwareCategory,
    link: "",
    // Asset fields
    device_name: "",
    identifier: "",
    support_expiry: "",
    vendor: "",
    model_number: "",
    serial_number: "",
    location: "",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/eol/hardware-with-asset", {
        product_name: formData.product_name,
        display_name: formData.display_name,
        category: formData.category,
        link: formData.link || undefined,
        device_name: formData.device_name || undefined,
        identifier: formData.identifier || undefined,
        support_expiry: formData.support_expiry || undefined,
        vendor: formData.vendor || undefined,
        model_number: formData.model_number || undefined,
        serial_number: formData.serial_number || undefined,
        location: formData.location || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eol"] });
      onClose();
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg || "作成に失敗しました");
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">ハードウェア登録</h2>
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 -mt-2">
            プロダクトと資産を同時に登録できます
          </p>

          <div>
            <label
              htmlFor="hw-category"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
            >
              カテゴリ*
            </label>
            <select
              id="hw-category"
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value as HardwareCategory })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            >
              {HARDWARE_CATEGORIES.map((key) => (
                <option key={key} value={key}>
                  {CATEGORY_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="hw-display-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
            >
              プロダクト表示名*
            </label>
            <input
              id="hw-display-name"
              type="text"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              placeholder="例: Cisco Catalyst 9300"
            />
          </div>

          <div>
            <label
              htmlFor="hw-product-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
            >
              プロダクト識別子（英語）*
            </label>
            <input
              id="hw-product-name"
              type="text"
              value={formData.product_name}
              onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              placeholder="例: cisco-catalyst-9300"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              同一機種の資産をまとめる識別子です
            </p>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <button
              type="button"
              onClick={() => setShowAssetFields(!showAssetFields)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
            >
              {showAssetFields ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              {showAssetFields ? "資産情報を閉じる" : "資産情報を入力する（任意）"}
            </button>
          </div>

          {showAssetFields && (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="hw-device-name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                >
                  機器名
                </label>
                <input
                  id="hw-device-name"
                  type="text"
                  value={formData.device_name}
                  onChange={(e) => setFormData({ ...formData, device_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  placeholder="例: Dell PowerEdge R740 #1"
                />
              </div>
              <div>
                <label
                  htmlFor="hw-identifier"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                >
                  識別情報
                </label>
                <input
                  id="hw-identifier"
                  type="text"
                  value={formData.identifier}
                  onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  placeholder="例: SVC-001234 (サービスタグ等)"
                />
              </div>
              <div>
                <label
                  htmlFor="hw-vendor"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                >
                  メーカー/ベンダー
                </label>
                <input
                  id="hw-vendor"
                  type="text"
                  value={formData.vendor}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  placeholder="例: Dell, Cisco"
                />
              </div>
              <div>
                <label
                  htmlFor="hw-model-number"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                >
                  モデル番号
                </label>
                <input
                  id="hw-model-number"
                  type="text"
                  value={formData.model_number}
                  onChange={(e) => setFormData({ ...formData, model_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  placeholder="例: PowerEdge R740"
                />
              </div>
              <div>
                <label
                  htmlFor="hw-serial-number"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                >
                  シリアル番号
                </label>
                <input
                  id="hw-serial-number"
                  type="text"
                  value={formData.serial_number}
                  onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  placeholder="例: ABC1234567"
                />
              </div>
              <div>
                <label
                  htmlFor="hw-support-expiry"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                >
                  サポート期限
                </label>
                <input
                  id="hw-support-expiry"
                  type="date"
                  value={formData.support_expiry}
                  onChange={(e) => setFormData({ ...formData, support_expiry: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="hw-location"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                >
                  設置場所
                </label>
                <input
                  id="hw-location"
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  placeholder="例: 東京DC / ラック A-01"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={!formData.product_name || !formData.display_name || createMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending ? "登録中..." : "登録"}
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
    eol_api_id: product.eol_api_id || "",
    link: product.link || "",
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/eol/products/${product.id}`, {
        display_name: formData.display_name,
        category: formData.category,
        eol_api_id: formData.eol_api_id || undefined,
        link: formData.link || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eol"] });
      onClose();
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg || "更新に失敗しました");
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">プロダクト編集</h2>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="edit-product-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
            >
              プロダクト名（英語）
            </label>
            <input
              id="edit-product-name"
              type="text"
              value={product.product_name}
              disabled
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              プロダクト名は変更できません
            </p>
          </div>

          <div>
            <label
              htmlFor="edit-display-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
            >
              表示名*
            </label>
            <input
              id="edit-display-name"
              type="text"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              placeholder="例: Ubuntu"
            />
          </div>

          <div>
            <label
              htmlFor="edit-category"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
            >
              カテゴリ*
            </label>
            <select
              id="edit-category"
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value as EolCategory })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            >
              {(product.category.startsWith("hw_") ? HARDWARE_CATEGORIES : SOFTWARE_CATEGORIES).map(
                (key) => (
                  <option key={key} value={key}>
                    {CATEGORY_LABELS[key]}
                  </option>
                ),
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="edit-eol-api-id"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
            >
              endoflife.date API ID
            </label>
            <input
              id="edit-eol-api-id"
              type="text"
              value={formData.eol_api_id}
              onChange={(e) => setFormData({ ...formData, eol_api_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              placeholder="例: ubuntu"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              設定すると自動同期されます（任意）
            </p>
          </div>

          <div>
            <label
              htmlFor="edit-link"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
            >
              公式URL
            </label>
            <input
              id="edit-link"
              type="url"
              value={formData.link}
              onChange={(e) => setFormData({ ...formData, link: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => updateMutation.mutate()}
            disabled={!formData.display_name || updateMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {updateMutation.isPending ? "更新中..." : "更新"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- ハードウェア資産関連コンポーネント ---

const STATUS_BADGE: Record<HardwareAssetStatus, { label: string; className: string }> = {
  active: {
    label: "稼働中",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  retired: {
    label: "退役済み",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400",
  },
  spare: {
    label: "予備",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
};

function HardwareAssetStatusBadge({ status }: { status: HardwareAssetStatus }) {
  const badge = STATUS_BADGE[status];
  return (
    <span className={`px-2 py-0.5 text-xs font-semibold rounded ${badge.className}`}>
      {badge.label}
    </span>
  );
}

function AssetDeleteButton({
  assetId,
  productId,
  onToast,
}: {
  assetId: string;
  productId: string;
  onToast: (message: string, type: "success" | "error") => void;
}) {
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/eol/assets/${assetId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eol", "assets", productId] });
      onToast("資産を削除しました", "success");
    },
    onError: () => {
      onToast("削除に失敗しました", "error");
    },
  });

  return (
    <button
      type="button"
      onClick={() => {
        if (confirm("本当に削除しますか?")) {
          deleteMutation.mutate();
        }
      }}
      className="p-1 text-red-600 hover:text-red-800"
      title="削除"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}

const ASSET_FIELDS: {
  key: keyof HardwareAsset;
  label: string;
  type?: string;
  placeholder?: string;
}[] = [
  { key: "identifier", label: "識別情報", placeholder: "例: SVC-001234 (サービスタグ等)" },
  { key: "hostname", label: "ホスト名", placeholder: "例: web-server-01" },
  { key: "device_name", label: "機器名", placeholder: "例: Dell PowerEdge R740" },
  { key: "serial_number", label: "シリアル番号", placeholder: "例: ABC1234567" },
  { key: "asset_number", label: "資産番号", placeholder: "例: IT-2024-0001" },
  { key: "vendor", label: "メーカー/ベンダー", placeholder: "例: Dell, Cisco" },
  { key: "model_number", label: "モデル番号", placeholder: "例: PowerEdge R740" },
  { key: "firmware_version", label: "ファームウェアバージョン", placeholder: "例: 2.8.1" },
  { key: "ip_address", label: "IPアドレス", placeholder: "例: 192.168.1.100" },
  { key: "mac_address", label: "MACアドレス", placeholder: "例: AA:BB:CC:DD:EE:FF" },
  { key: "location", label: "設置場所", placeholder: "例: 東京DC / ラック A-01" },
  { key: "owner", label: "担当者", placeholder: "例: 山田 太郎" },
  { key: "support_expiry", label: "サポート期限", type: "date" },
  { key: "warranty_expiry", label: "保証期限", type: "date" },
  { key: "purchase_date", label: "購入日", type: "date" },
];

function HardwareAssetModal({
  productId,
  asset,
  onClose,
  onToast,
}: {
  productId: string;
  asset?: HardwareAsset;
  onClose: () => void;
  onToast: (message: string, type: "success" | "error") => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!asset;
  const [showOptional, setShowOptional] = useState(false);

  const initialForm = {
    identifier: asset?.identifier ?? "",
    hostname: asset?.hostname ?? "",
    device_name: asset?.device_name ?? "",
    support_expiry: asset?.support_expiry ?? "",
    serial_number: asset?.serial_number ?? "",
    asset_number: asset?.asset_number ?? "",
    ip_address: asset?.ip_address ?? "",
    mac_address: asset?.mac_address ?? "",
    vendor: asset?.vendor ?? "",
    model_number: asset?.model_number ?? "",
    firmware_version: asset?.firmware_version ?? "",
    warranty_expiry: asset?.warranty_expiry ?? "",
    purchase_date: asset?.purchase_date ?? "",
    location: asset?.location ?? "",
    owner: asset?.owner ?? "",
    status: asset?.status ?? ("active" as HardwareAssetStatus),
    notes: asset?.notes ?? "",
  };

  const [formData, setFormData] = useState(initialForm);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = Object.fromEntries(
        Object.entries(formData).map(([k, v]) => [k, v === "" ? null : v]),
      );
      if (isEdit) {
        await api.patch(`/eol/assets/${asset.id}`, payload);
      } else {
        await api.post("/eol/assets", { ...payload, product_id: productId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eol", "assets", productId] });
      onToast(isEdit ? "資産を更新しました" : "資産を登録しました", "success");
      onClose();
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      onToast(msg || (isEdit ? "更新に失敗しました" : "登録に失敗しました"), "error");
    },
  });

  const primaryFields = ASSET_FIELDS.slice(0, 7);
  const optionalFields = ASSET_FIELDS.slice(7);

  const renderField = (field: (typeof ASSET_FIELDS)[number]) => (
    <div key={field.key}>
      <label
        htmlFor={`asset-${field.key}`}
        className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
      >
        {field.label}
      </label>
      <input
        id={`asset-${field.key}`}
        type={field.type ?? "text"}
        value={formData[field.key as keyof typeof formData] as string}
        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
        placeholder={field.placeholder}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          {isEdit ? "資産編集" : "資産追加"}
        </h2>

        <div className="space-y-4">
          {primaryFields.map(renderField)}

          {/* ステータス */}
          <div>
            <label
              htmlFor="asset-status"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
            >
              ステータス
            </label>
            <select
              id="asset-status"
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value as HardwareAssetStatus })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            >
              {Object.entries(STATUS_BADGE).map(([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* 任意項目（折りたたみ） */}
          <div>
            <button
              type="button"
              onClick={() => setShowOptional(!showOptional)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
            >
              {showOptional ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              {showOptional ? "詳細項目を閉じる" : "詳細項目を入力する"}
            </button>
          </div>

          {showOptional && (
            <div className="space-y-4 pt-2 border-t border-gray-200 dark:border-gray-700">
              {optionalFields.map(renderField)}

              {/* 備考 */}
              <div>
                <label
                  htmlFor="asset-notes"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                >
                  備考
                </label>
                <textarea
                  id="asset-notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  placeholder="自由記述"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? (isEdit ? "更新中..." : "登録中...") : isEdit ? "更新" : "登録"}
          </button>
        </div>
      </div>
    </div>
  );
}
