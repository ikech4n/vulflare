// EOL管理関連の型定義

export type EolCategory =
  | "os"
  | "programming_language"
  | "runtime"
  | "middleware"
  | "framework"
  | "library"
  | "cloud_service"
  | "database"
  | "container"
  | "ai_model"
  | "security"
  | "hw_server"
  | "hw_network"
  | "hw_storage"
  | "hw_security_appliance"
  | "hw_peripheral"
  | "hw_other";

export type EolSource = "endoflife_date" | "manual";

export type EolSyncStatus = "running" | "completed" | "failed";

export interface EolProduct {
  id: string;
  product_name: string; // endoflife.date slug
  display_name: string;
  category: EolCategory;
  vendor: string | null; // メーカー（ハードウェア用）
  eol_api_id: string | null;
  link: string | null;
  created_at: string;
  updated_at: string;
  // 一覧表示用の集計フィールド（APIから返される場合のみ）
  latest_version?: string | null;
  next_eol_date?: string | null;
  next_eol_version?: string | null;
  // ハードウェア用集計フィールド
  asset_count?: number;
  nearest_support_expiry?: string | null;
}

export interface EolCycle {
  id: string;
  product_id: string;
  cycle: string; // バージョン番号
  codename: string | null;
  release_date: string | null;
  eol_date: string | null;
  support_date: string | null;
  extended_support_date: string | null;
  lts: number; // 0 or 1
  lts_date: string | null;
  latest_version: string | null;
  latest_release_date: string | null;
  is_eol: number; // 0 or 1
  source: EolSource;
  created_at: string;
  updated_at: string;
}

export interface EolSyncLog {
  id: string;
  product_name: string;
  status: EolSyncStatus;
  started_at: string;
  completed_at: string | null;
  cycles_synced: number;
  error_message: string | null;
}

// API レスポンス用の拡張型
export interface EolProductWithCycles extends EolProduct {
  cycles: EolCycle[];
}

export interface EolCycleWithProduct extends EolCycle {
  product: EolProduct;
}

// endoflife.date API レスポンス型
export interface EndoflifeDateCycle {
  cycle: string;
  codename?: string;
  releaseDate?: string;
  eol?: boolean | string; // boolean または日付文字列
  support?: boolean | string;
  extendedSupport?: boolean | string;
  lts?: boolean | string;
  latest?: string;
  latestReleaseDate?: string;
  link?: string;
}

// 統計情報
export interface EolStats {
  total_products: number;
  total_cycles: number;
  eol_count: number;
  approaching_eol_30d: number;
  approaching_eol_90d: number;
  supported_count: number;
}

// ハードウェア資産
export type HardwareAssetStatus = "active" | "decommissioned" | "spare";

export interface HardwareAsset {
  id: string;
  product_id: string;
  identifier: string | null; // サービスタグ等の汎用識別情報
  hostname: string | null; // ホスト名
  device_name: string | null; // 機器名
  support_expiry: string | null; // サポート期限
  serial_number: string | null; // シリアル番号
  asset_number: string | null; // 資産番号
  ip_address: string | null; // IPアドレス
  mac_address: string | null; // MACアドレス
  firmware_version: string | null; // ファームウェアバージョン
  purchase_date: string | null; // 購入日
  location: string | null; // 設置場所
  owner: string | null; // 担当者
  status: HardwareAssetStatus; // ステータス
  notes: string | null; // 備考
  created_at: string;
  updated_at: string;
}

// タイムライン情報
export interface EolTimelineItem {
  product_name: string;
  display_name: string;
  cycle: string;
  eol_date: string;
  days_until_eol: number;
}
