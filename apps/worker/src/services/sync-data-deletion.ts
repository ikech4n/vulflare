import type { Env } from "../types.ts";

export interface DeletionResult {
  deleted: Record<string, number>;
  totalDeleted: number;
}

type DataSource = "jvn";

/**
 * 指定されたデータソースの同期データを削除する
 * @param env - Cloudflare Worker環境
 * @param source - 削除対象のデータソース ('jvn')
 * @returns 削除結果 (各ソースの削除件数と合計)
 */
export async function deleteSyncData(env: Env, source: "jvn"): Promise<DeletionResult> {
  const deleted: Record<string, number> = {};
  let totalDeleted = 0;

  // 削除対象のデータソースリスト
  const sources: DataSource[] = [source];

  // 各データソースを順次処理
  for (const src of sources) {
    try {
      const count = await deleteSingleSource(env, src);
      deleted[src] = count;
      totalDeleted += count;

      console.log(`[deleteSyncData] Deleted ${count} records from source: ${src}`);
    } catch (error) {
      console.error(`[deleteSyncData] Error deleting source ${src}:`, error);
      // エラーが発生しても他のソースの削除を続行
      deleted[src] = 0;
    }
  }

  return {
    deleted,
    totalDeleted,
  };
}

/**
 * 単一のデータソースの同期データを削除する
 * @param env - Cloudflare Worker環境
 * @param source - 削除対象のデータソース
 * @returns 削除された脆弱性の件数
 */
async function deleteSingleSource(env: Env, source: DataSource): Promise<number> {
  // 1. vulnerabilities テーブルから該当ソースのレコードを削除
  const vulnerabilitiesResult = await env.DB.prepare("DELETE FROM vulnerabilities WHERE source = ?")
    .bind(source)
    .run();

  const deletedCount = vulnerabilitiesResult.meta.changes ?? 0;

  // 2. 同期ログテーブルから該当ソースのレコードを削除
  const syncLogTable = `${source}_sync_logs`;
  try {
    await env.DB.prepare(`DELETE FROM ${syncLogTable}`).run();
  } catch (error) {
    // sync_logs テーブルが存在しない場合はスキップ
    console.warn(`[deleteSingleSource] Sync log table ${syncLogTable} not found or error:`, error);
  }

  // 3. KVキャッシュを削除 (last_sync_date)
  try {
    await env.VULFLARE_KV_CACHE.delete(`${source}:last_sync_date`);
  } catch (error) {
    console.warn(`[deleteSingleSource] Error deleting KV cache for ${source}:`, error);
  }

  // 4. JVN専用: vendor/product キャッシュテーブルも削除
  if (source === "jvn") {
    try {
      await env.DB.prepare("DELETE FROM jvn_vendor_cache").run();
      await env.DB.prepare("DELETE FROM jvn_product_cache").run();
      console.log("[deleteSingleSource] Deleted JVN vendor/product cache");
    } catch (error) {
      console.warn("[deleteSingleSource] Error deleting JVN cache tables:", error);
    }
  }

  return deletedCount;
}
