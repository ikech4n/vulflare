// EOL管理関連の型定義

export type EolCategory =
  | 'os'
  | 'programming_language'
  | 'runtime'
  | 'middleware'
  | 'framework'
  | 'library'
  | 'cloud_service'
  | 'hardware';

export type EolSource = 'endoflife_date' | 'manual';

export type EolSyncStatus = 'running' | 'completed' | 'failed';

export interface EolProduct {
  id: string;
  product_name: string; // endoflife.date slug
  display_name: string;
  category: EolCategory;
  eol_api_id: string | null;
  vendor: string | null;
  link: string | null;
  created_at: string;
  updated_at: string;
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

export interface AssetEolLink {
  id: string;
  asset_id: string;
  eol_cycle_id: string;
  installed_version: string | null;
  notes: string | null;
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
  affected_asset_count?: number;
}

export interface EolCycleWithProduct extends EolCycle {
  product: EolProduct;
}

export interface AssetEolLinkWithDetails extends AssetEolLink {
  cycle: EolCycle;
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
  total_links: number;
  eol_count: number;
  approaching_eol_30d: number;
  approaching_eol_90d: number;
  supported_count: number;
}

// タイムライン情報
export interface EolTimelineItem {
  product_name: string;
  display_name: string;
  cycle: string;
  eol_date: string;
  days_until_eol: number;
  affected_asset_count: number;
}
