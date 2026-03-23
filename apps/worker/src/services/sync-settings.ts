import type { Env } from "../types.ts";

export interface DataSourceSettings {
  jvn: boolean;
}

// ベンダー/製品選択（MyJVN APIから取得したデータ）
export interface JvnProductSelection {
  productId: string; // MyJVN product ID (pid)
  productName: string; // 製品名（表示用）
  cpe: string; // CPE文字列（JVN APIクエリに使用）
}

export interface JvnVendorSelection {
  vendorId: string; // MyJVN vendor ID (vid)
  vendorName: string; // ベンダー名（表示用）
  products: JvnProductSelection[]; // 空 = そのベンダーの全製品を対象
}

export interface SyncSettings {
  vendorSelections: JvnVendorSelection[]; // ベンダー/製品フィルター（新規）
  keywords: string[]; // キーワード検索（維持）
  excludeKeywords: string[]; // 除外キーワード（維持）
  cvssMinScore: number; // CVSS最小スコア（新規、0=無効）
  fullSyncDays: number; // 同期期間（維持）
  retentionDays: number; // データ保持期間（維持）
  dataSources: DataSourceSettings; // データソース設定（維持）
}

const DEFAULT_SETTINGS: SyncSettings = {
  vendorSelections: [],
  keywords: [],
  excludeKeywords: [],
  cvssMinScore: 0,
  fullSyncDays: 365,
  retentionDays: 0,
  dataSources: {
    jvn: true,
  },
};

export async function getSyncSettings(env: Env): Promise<SyncSettings> {
  try {
    const rows = await env.DB.prepare(
      `SELECT key, value FROM sync_settings WHERE key IN (
        'detection_mode', 'vendor_selections', 'keywords', 'exclude_keywords',
        'cvss_min_score', 'full_sync_days', 'retention_days', 'data_sources'
      )`,
    ).all<{ key: string; value: string }>();

    const map = new Map(rows.results.map((r) => [r.key, r.value]));

    // 後方互換性: 旧 detection_mode が残っている場合の処理
    const legacyMode = map.get("detection_mode");
    if (legacyMode) {
      console.log(
        `[getSyncSettings] Legacy detection_mode found: ${legacyMode} (migrating gracefully)`,
      );
      // vendorSelections は空にし、keywords は維持
      // アセットパッケージは常時自動検知されるため、旧 package-based と同等の動作
    }

    const vendorSelections = map.get("vendor_selections");
    const keywords = map.get("keywords");
    const excludeKeywords = map.get("exclude_keywords");
    const cvssMinScore = map.get("cvss_min_score");
    const fullSyncDays = map.get("full_sync_days");
    const retentionDays = map.get("retention_days");
    const dataSources = map.get("data_sources");

    // dataSources を取得し、数値をブール値に変換
    let parsedDataSources = DEFAULT_SETTINGS.dataSources;
    if (dataSources) {
      const raw = JSON.parse(dataSources);
      parsedDataSources = {
        jvn: Boolean(raw.jvn ?? true),
      };
    }

    return {
      vendorSelections: vendorSelections
        ? JSON.parse(vendorSelections)
        : DEFAULT_SETTINGS.vendorSelections,
      keywords: keywords ? JSON.parse(keywords) : DEFAULT_SETTINGS.keywords,
      excludeKeywords: excludeKeywords
        ? JSON.parse(excludeKeywords)
        : DEFAULT_SETTINGS.excludeKeywords,
      cvssMinScore: cvssMinScore ? Number.parseFloat(cvssMinScore) : DEFAULT_SETTINGS.cvssMinScore,
      fullSyncDays: fullSyncDays
        ? Number.parseInt(fullSyncDays, 10)
        : DEFAULT_SETTINGS.fullSyncDays,
      retentionDays: retentionDays
        ? Number.parseInt(retentionDays, 10)
        : DEFAULT_SETTINGS.retentionDays,
      dataSources: parsedDataSources,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function updateSyncSettings(env: Env, settings: SyncSettings): Promise<void> {
  // JSTに変換 (UTC+9)
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const now = jstNow.toISOString();

  console.log("updateSyncSettings called with:", {
    vendorSelections: settings.vendorSelections,
    keywords: settings.keywords,
    excludeKeywords: settings.excludeKeywords,
    cvssMinScore: settings.cvssMinScore,
    fullSyncDays: settings.fullSyncDays,
    retentionDays: settings.retentionDays,
    dataSources: settings.dataSources,
  });

  const result = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO sync_settings (key, value, updated_at) VALUES ('vendor_selections', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    ).bind(JSON.stringify(settings.vendorSelections), now),
    env.DB.prepare(
      `INSERT INTO sync_settings (key, value, updated_at) VALUES ('keywords', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    ).bind(JSON.stringify(settings.keywords), now),
    env.DB.prepare(
      `INSERT INTO sync_settings (key, value, updated_at) VALUES ('exclude_keywords', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    ).bind(JSON.stringify(settings.excludeKeywords), now),
    env.DB.prepare(
      `INSERT INTO sync_settings (key, value, updated_at) VALUES ('cvss_min_score', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    ).bind(String(settings.cvssMinScore), now),
    env.DB.prepare(
      `INSERT INTO sync_settings (key, value, updated_at) VALUES ('full_sync_days', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    ).bind(String(settings.fullSyncDays), now),
    env.DB.prepare(
      `INSERT INTO sync_settings (key, value, updated_at) VALUES ('retention_days', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    ).bind(String(settings.retentionDays), now),
    env.DB.prepare(
      `INSERT INTO sync_settings (key, value, updated_at) VALUES ('data_sources', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    ).bind(JSON.stringify(settings.dataSources), now),
  ]);

  console.log("Batch result:", JSON.stringify(result));
}

/**
 * 除外キーワードによるフィルタリング
 * タイトルまたは説明文に除外キーワードが含まれている場合はtrueを返す
 */
export function shouldExcludeByKeywords(
  title: string,
  description: string,
  excludeKeywords: string[],
): boolean {
  if (excludeKeywords.length === 0) return false;

  const titleLower = title.toLowerCase();
  const descLower = description.toLowerCase();

  return excludeKeywords.some((keyword) => {
    const keywordLower = keyword.toLowerCase();
    return titleLower.includes(keywordLower) || descLower.includes(keywordLower);
  });
}

/**
 * CVSSスコアによるフィルタリング
 * CVSSスコアが指定された最小スコア未満の場合はtrueを返す（除外対象）
 */
export function shouldExcludeByCvss(
  cvssV3Score: number | undefined,
  cvssV2Score: number | undefined,
  minScore: number,
): boolean {
  if (minScore <= 0) return false; // 閾値が0以下の場合はフィルタリング無効
  const score = cvssV3Score ?? cvssV2Score ?? 0;
  return score < minScore;
}
