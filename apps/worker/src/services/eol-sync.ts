import type { Env } from '../types.ts';
import type { EndoflifeDateCycle, EolCycle } from '@vulflare/shared/types';
import { eolProductRepo, eolCycleRepo, eolSyncLogRepo } from '../db/eol-repository.ts';

const ENDOFLIFE_API_BASE = 'https://endoflife.date/api';
const CACHE_TTL = 24 * 60 * 60; // 24時間

/**
 * endoflife.date から利用可能なプロダクト一覧を取得
 */
export async function getAvailableProducts(env: Env): Promise<string[]> {
  const cacheKey = 'eol:available_products';
  const cached = await env.KV_CACHE.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const res = await fetch(`${ENDOFLIFE_API_BASE}/all.json`);
  if (!res.ok) {
    throw new Error(`endoflife.date API error: ${res.status}`);
  }

  const products = (await res.json()) as string[];
  await env.KV_CACHE.put(cacheKey, JSON.stringify(products), {
    expirationTtl: CACHE_TTL,
  });

  return products;
}

/**
 * 特定のプロダクトのサイクル情報を endoflife.date から取得
 */
export async function fetchProductCycles(
  env: Env,
  productName: string,
): Promise<EndoflifeDateCycle[]> {
  const cacheKey = `eol:product:${productName}`;
  const cached = await env.KV_CACHE.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const res = await fetch(`${ENDOFLIFE_API_BASE}/${productName}.json`);
  if (!res.ok) {
    throw new Error(`endoflife.date API error for ${productName}: ${res.status}`);
  }

  const cycles = (await res.json()) as EndoflifeDateCycle[];
  await env.KV_CACHE.put(cacheKey, JSON.stringify(cycles), {
    expirationTtl: CACHE_TTL,
  });

  return cycles;
}

/**
 * endoflife.date のレスポンスからEOL日付を正規化
 * boolean | string の混合型をstring | nullに変換
 */
function normalizeDate(value: boolean | string | undefined): string | null {
  if (value === undefined || value === false) return null;
  if (value === true) return null; // trueは未定と扱う
  return value; // 日付文字列
}

/**
 * EOL日付が過ぎているかチェック
 */
function isEolExpired(eolDate: string | null): boolean {
  if (!eolDate) return false;
  const now = new Date();
  const eol = new Date(eolDate);
  return eol < now;
}

/**
 * 特定のプロダクトのサイクル情報を同期
 */
export async function syncProductCycles(
  env: Env,
  productId: string,
  productName: string,
): Promise<{ synced: number; errors: string[] }> {
  const logId = crypto.randomUUID();
  await eolSyncLogRepo.create(env.DB, { id: logId, product_name: productName });

  try {
    const cycles = await fetchProductCycles(env, productName);
    let synced = 0;
    const errors: string[] = [];

    for (const apiCycle of cycles) {
      try {
        const eolDate = normalizeDate(apiCycle.eol);
        const supportDate = normalizeDate(apiCycle.support);
        const extendedSupportDate = normalizeDate(apiCycle.extendedSupport);
        const ltsDate = normalizeDate(apiCycle.lts);

        const cycle: Omit<EolCycle, 'created_at' | 'updated_at'> = {
          id: crypto.randomUUID(),
          product_id: productId,
          cycle: apiCycle.cycle,
          codename: apiCycle.codename ?? null,
          release_date: apiCycle.releaseDate ?? null,
          eol_date: eolDate,
          support_date: supportDate,
          extended_support_date: extendedSupportDate,
          lts: ltsDate !== null || apiCycle.lts === true ? 1 : 0,
          lts_date: ltsDate,
          latest_version: apiCycle.latest ?? null,
          latest_release_date: apiCycle.latestReleaseDate ?? null,
          is_eol: isEolExpired(eolDate) ? 1 : 0,
          source: 'endoflife_date',
        };

        await eolCycleRepo.upsert(env.DB, cycle);
        synced++;
      } catch (err) {
        errors.push(`Cycle ${apiCycle.cycle}: ${err}`);
      }
    }

    await eolSyncLogRepo.updateStatus(env.DB, logId, 'completed', {
      cycles_synced: synced,
      ...(errors.length > 0 && { error_message: errors.join('; ') }),
    });

    return { synced, errors };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await eolSyncLogRepo.updateStatus(env.DB, logId, 'failed', {
      error_message: errorMsg,
    });
    throw err;
  }
}

/**
 * すべての登録済みプロダクト（eol_api_id が設定されているもの）を同期
 */
export async function syncAllProducts(env: Env): Promise<{
  total: number;
  synced: number;
  failed: string[];
}> {
  const products = await eolProductRepo.listWithApiId(env.DB);
  let totalSynced = 0;
  const failed: string[] = [];

  for (const product of products) {
    if (!product.eol_api_id) continue;

    try {
      const result = await syncProductCycles(env, product.id, product.eol_api_id);
      totalSynced += result.synced;
      if (result.errors.length > 0) {
        console.warn(`Partial sync for ${product.product_name}:`, result.errors);
      }
    } catch (err) {
      failed.push(product.product_name);
      console.error(`Failed to sync ${product.product_name}:`, err);
    }
  }

  return { total: products.length, synced: totalSynced, failed };
}
