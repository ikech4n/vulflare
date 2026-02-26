import { Hono } from 'hono';
import type { Env, JwtVariables } from '../types.ts';
import type { EolCategory, EolStats, EolTimelineItem } from '@vulflare/shared/types';
import { authMiddleware, requireRole } from '../middleware/auth.ts';
import {
  eolProductRepo,
  eolCycleRepo,
  assetEolLinkRepo,
  eolSyncLogRepo,
} from '../db/eol-repository.ts';
import {
  getAvailableProducts,
  syncProductCycles,
} from '../services/eol-sync.ts';

export const eolRoutes = new Hono<{ Bindings: Env; Variables: JwtVariables }>();

eolRoutes.use('/*', authMiddleware);

// --- プロダクト管理 ---

// GET /api/eol/products - プロダクト一覧
eolRoutes.get('/products', async (c) => {
  const category = c.req.query('category') as EolCategory | undefined;
  const products = await eolProductRepo.list(c.env.DB, category ? { category } : {});
  return c.json(products);
});

// GET /api/eol/products/:id - プロダクト詳細（サイクル一覧含む）
eolRoutes.get('/products/:id', async (c) => {
  const id = c.req.param('id');
  const product = await eolProductRepo.findById(c.env.DB, id);

  if (!product) {
    return c.json({ error: 'Product not found' }, 404);
  }

  const cycles = await eolCycleRepo.listByProduct(c.env.DB, id);

  // 影響を受けるアセット数をカウント
  let affectedAssetCount = 0;
  for (const cycle of cycles) {
    const count = await assetEolLinkRepo.countByCycle(c.env.DB, cycle.id);
    affectedAssetCount += count;
  }

  return c.json({
    ...product,
    cycles,
    affected_asset_count: affectedAssetCount,
  });
});

// POST /api/eol/products - プロダクト追加（admin/editor）
eolRoutes.post('/products', requireRole('editor'), async (c) => {
  const body = await c.req.json<{
    product_name: string;
    display_name: string;
    category: EolCategory;
    eol_api_id?: string;
    vendor?: string;
    link?: string;
  }>();

  if (!body.product_name || !body.display_name || !body.category) {
    return c.json({ error: 'product_name, display_name, and category are required' }, 400);
  }

  const validCategories: EolCategory[] = [
    'os',
    'programming_language',
    'runtime',
    'middleware',
    'framework',
    'library',
    'cloud_service',
    'hardware',
  ];

  if (!validCategories.includes(body.category)) {
    return c.json({ error: 'Invalid category' }, 400);
  }

  // 重複チェック
  const existing = await eolProductRepo.findByProductName(c.env.DB, body.product_name);
  if (existing) {
    return c.json({ error: 'Product already exists' }, 409);
  }

  const id = crypto.randomUUID();
  await eolProductRepo.create(c.env.DB, {
    id,
    product_name: body.product_name,
    display_name: body.display_name,
    category: body.category,
    eol_api_id: body.eol_api_id ?? null,
    vendor: body.vendor ?? null,
    link: body.link ?? null,
  });

  // eol_api_idが設定されている場合は初回同期
  if (body.eol_api_id) {
    try {
      await syncProductCycles(c.env, id, body.eol_api_id);
    } catch (err) {
      console.error('Failed to sync cycles:', err);
      // エラーでもプロダクトは作成済みなので成功扱い
    }
  }

  const created = await eolProductRepo.findById(c.env.DB, id);
  return c.json(created, 201);
});

// PATCH /api/eol/products/:id - プロダクト更新（admin/editor）
eolRoutes.patch('/products/:id', requireRole('editor'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{
    display_name?: string;
    category?: EolCategory;
    vendor?: string;
    link?: string;
    eol_api_id?: string;
  }>();

  const product = await eolProductRepo.findById(c.env.DB, id);
  if (!product) {
    return c.json({ error: 'Product not found' }, 404);
  }

  // eol_api_idが既に設定されている場合、変更を禁止
  if (product.eol_api_id !== null && body.eol_api_id !== undefined && body.eol_api_id !== product.eol_api_id) {
    return c.json({ error: 'Cannot change eol_api_id of products synced from endoflife.date' }, 403);
  }

  await eolProductRepo.update(c.env.DB, id, body);

  const updated = await eolProductRepo.findById(c.env.DB, id);
  return c.json(updated);
});

// DELETE /api/eol/products/:id - プロダクト削除（admin）
eolRoutes.delete('/products/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const product = await eolProductRepo.findById(c.env.DB, id);

  if (!product) {
    return c.json({ error: 'Product not found' }, 404);
  }

  await eolProductRepo.delete(c.env.DB, id);
  return c.json({ message: 'Product deleted' });
});

// --- サイクル管理（手動入力用） ---

// POST /api/eol/cycles - サイクル追加（admin/editor）
eolRoutes.post('/cycles', requireRole('editor'), async (c) => {
  const body = await c.req.json<{
    product_id: string;
    cycle: string;
    codename?: string;
    release_date?: string;
    eol_date?: string;
    support_date?: string;
    extended_support_date?: string;
    lts?: boolean;
    latest_version?: string;
  }>();

  if (!body.product_id || !body.cycle) {
    return c.json({ error: 'product_id and cycle are required' }, 400);
  }

  const product = await eolProductRepo.findById(c.env.DB, body.product_id);
  if (!product) {
    return c.json({ error: 'Product not found' }, 404);
  }

  // 手動で追加したプロダクトのみサイクルを追加可能
  if (product.eol_api_id !== null) {
    return c.json({ error: 'Cannot add cycles to products synced from endoflife.date' }, 403);
  }

  // 重複チェック
  const existing = await eolCycleRepo.findByProductAndCycle(
    c.env.DB,
    body.product_id,
    body.cycle,
  );
  if (existing) {
    return c.json({ error: 'Cycle already exists' }, 409);
  }

  const id = crypto.randomUUID();
  const isEol = body.eol_date ? new Date(body.eol_date) < new Date() : false;

  await eolCycleRepo.create(c.env.DB, {
    id,
    product_id: body.product_id,
    cycle: body.cycle,
    codename: body.codename ?? null,
    release_date: body.release_date ?? null,
    eol_date: body.eol_date ?? null,
    support_date: body.support_date ?? null,
    extended_support_date: body.extended_support_date ?? null,
    lts: body.lts ? 1 : 0,
    lts_date: null,
    latest_version: body.latest_version ?? null,
    latest_release_date: null,
    is_eol: isEol ? 1 : 0,
    source: 'manual',
  });

  const created = await eolCycleRepo.findById(c.env.DB, id);
  return c.json(created, 201);
});

// PATCH /api/eol/cycles/:id - サイクル更新（admin/editor）
eolRoutes.patch('/cycles/:id', requireRole('editor'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{
    cycle?: string;
    codename?: string;
    release_date?: string;
    eol_date?: string;
    support_date?: string;
    extended_support_date?: string;
    lts?: boolean;
    latest_version?: string;
  }>();

  const cycle = await eolCycleRepo.findById(c.env.DB, id);
  if (!cycle) {
    return c.json({ error: 'Cycle not found' }, 404);
  }

  // プロダクトを取得して手動追加かチェック
  const product = await eolProductRepo.findById(c.env.DB, cycle.product_id);
  if (!product) {
    return c.json({ error: 'Product not found' }, 404);
  }

  // 手動で追加したプロダクトのサイクルのみ編集可能
  if (product.eol_api_id !== null) {
    return c.json({ error: 'Cannot edit cycles of products synced from endoflife.date' }, 403);
  }

  const updates: Record<string, unknown> = {};
  if (body.cycle !== undefined) updates.cycle = body.cycle;
  if (body.codename !== undefined) updates.codename = body.codename;
  if (body.release_date !== undefined) updates.release_date = body.release_date;
  if (body.eol_date !== undefined) {
    updates.eol_date = body.eol_date;
    updates.is_eol = body.eol_date ? (new Date(body.eol_date) < new Date() ? 1 : 0) : 0;
  }
  if (body.support_date !== undefined) updates.support_date = body.support_date;
  if (body.extended_support_date !== undefined) {
    updates.extended_support_date = body.extended_support_date;
  }
  if (body.lts !== undefined) updates.lts = body.lts ? 1 : 0;
  if (body.latest_version !== undefined) updates.latest_version = body.latest_version;

  await eolCycleRepo.update(c.env.DB, id, updates);

  const updated = await eolCycleRepo.findById(c.env.DB, id);
  return c.json(updated);
});

// DELETE /api/eol/cycles/:id - サイクル削除（admin）
eolRoutes.delete('/cycles/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const cycle = await eolCycleRepo.findById(c.env.DB, id);

  if (!cycle) {
    return c.json({ error: 'Cycle not found' }, 404);
  }

  // プロダクトを取得して手動追加かチェック
  const product = await eolProductRepo.findById(c.env.DB, cycle.product_id);
  if (!product) {
    return c.json({ error: 'Product not found' }, 404);
  }

  // 手動で追加したプロダクトのサイクルのみ削除可能
  if (product.eol_api_id !== null) {
    return c.json({ error: 'Cannot delete cycles of products synced from endoflife.date' }, 403);
  }

  await eolCycleRepo.delete(c.env.DB, id);
  return c.json({ message: 'Cycle deleted' });
});

// --- アセット-EOL紐付け ---

// GET /api/assets/:id/eol - アセットのEOL情報
eolRoutes.get('/assets/:id/eol', async (c) => {
  const assetId = c.req.param('id');
  const links = await assetEolLinkRepo.listByAsset(c.env.DB, assetId);

  const enriched = [];
  for (const link of links) {
    const cycle = await eolCycleRepo.findById(c.env.DB, link.eol_cycle_id);
    if (!cycle) continue;

    const product = await eolProductRepo.findById(c.env.DB, cycle.product_id);
    if (!product) continue;

    enriched.push({
      ...link,
      cycle,
      product,
    });
  }

  return c.json(enriched);
});

// POST /api/assets/:id/eol - 紐付け追加
eolRoutes.post('/assets/:id/eol', requireRole('editor'), async (c) => {
  const assetId = c.req.param('id');
  const body = await c.req.json<{
    eol_cycle_id: string;
    installed_version?: string;
    notes?: string;
  }>();

  if (!body.eol_cycle_id) {
    return c.json({ error: 'eol_cycle_id is required' }, 400);
  }

  const cycle = await eolCycleRepo.findById(c.env.DB, body.eol_cycle_id);
  if (!cycle) {
    return c.json({ error: 'Cycle not found' }, 404);
  }

  const id = crypto.randomUUID();
  try {
    await assetEolLinkRepo.create(c.env.DB, {
      id,
      asset_id: assetId,
      eol_cycle_id: body.eol_cycle_id,
      installed_version: body.installed_version ?? null,
      notes: body.notes ?? null,
    });
  } catch (err) {
    // UNIQUE制約違反の場合
    return c.json({ error: 'Link already exists' }, 409);
  }

  const created = await assetEolLinkRepo.findById(c.env.DB, id);
  return c.json(created, 201);
});

// DELETE /api/assets/:assetId/eol/:linkId - 紐付け解除
eolRoutes.delete('/assets/:assetId/eol/:linkId', requireRole('editor'), async (c) => {
  const linkId = c.req.param('linkId');
  const link = await assetEolLinkRepo.findById(c.env.DB, linkId);

  if (!link) {
    return c.json({ error: 'Link not found' }, 404);
  }

  await assetEolLinkRepo.delete(c.env.DB, linkId);
  return c.json({ message: 'Link deleted' });
});

// --- endoflife.date 同期 ---

// GET /api/eol/available-products - 利用可能プロダクト一覧
eolRoutes.get('/available-products', async (c) => {
  try {
    const products = await getAvailableProducts(c.env);
    return c.json(products);
  } catch (err) {
    console.error('Failed to fetch available products:', err);
    return c.json({ error: 'Failed to fetch available products' }, 500);
  }
});

// POST /api/eol/sync/:productName - 手動同期トリガー（admin）
eolRoutes.post('/sync/:productName', requireRole('admin'), async (c) => {
  const productName = c.req.param('productName');
  const product = await eolProductRepo.findByProductName(c.env.DB, productName);

  if (!product) {
    return c.json({ error: 'Product not found' }, 404);
  }

  if (!product.eol_api_id) {
    return c.json({ error: 'Product does not have eol_api_id set' }, 400);
  }

  try {
    const result = await syncProductCycles(c.env, product.id, product.eol_api_id);
    return c.json({
      message: 'Sync completed',
      synced: result.synced,
      errors: result.errors,
    });
  } catch (err) {
    console.error('Sync failed:', err);
    return c.json({ error: 'Sync failed', details: String(err) }, 500);
  }
});

// GET /api/eol/sync/logs - 同期ログ
eolRoutes.get('/sync/logs', async (c) => {
  const limit = parseInt(c.req.query('limit') ?? '50', 10);
  const logs = await eolSyncLogRepo.list(c.env.DB, limit);
  return c.json(logs);
});

// --- 統計 ---

// GET /api/eol/stats - EOLサマリー統計
eolRoutes.get('/stats', async (c) => {
  const totalProducts = (await eolProductRepo.list(c.env.DB)).length;
  const eolCount = await eolCycleRepo.countEol(c.env.DB);
  const approaching30d = await eolCycleRepo.countApproachingEol(c.env.DB, 30);
  const approaching90d = await eolCycleRepo.countApproachingEol(c.env.DB, 90);

  const allCycles = await c.env.DB.prepare('SELECT COUNT(*) as count FROM eol_cycles').first<{
    count: number;
  }>();
  const totalCycles = allCycles?.count ?? 0;

  const allLinks = await c.env.DB.prepare('SELECT COUNT(*) as count FROM asset_eol_links').first<{
    count: number;
  }>();
  const totalLinks = allLinks?.count ?? 0;

  const supportedCount = totalCycles - eolCount - approaching30d;

  const stats: EolStats = {
    total_products: totalProducts,
    total_cycles: totalCycles,
    total_links: totalLinks,
    eol_count: eolCount,
    approaching_eol_30d: approaching30d,
    approaching_eol_90d: approaching90d,
    supported_count: supportedCount > 0 ? supportedCount : 0,
  };

  return c.json(stats);
});

// GET /api/eol/timeline - 今後のEOLタイムライン
eolRoutes.get('/timeline', async (c) => {
  const result = await c.env.DB
    .prepare(
      `SELECT
        p.product_name,
        p.display_name,
        c.cycle,
        c.eol_date,
        (julianday(c.eol_date) - julianday('now')) as days_until_eol
      FROM eol_cycles c
      JOIN eol_products p ON c.product_id = p.id
      WHERE c.is_eol = 0
        AND c.eol_date IS NOT NULL
        AND c.eol_date > date('now')
      ORDER BY c.eol_date ASC
      LIMIT 50`,
    )
    .all<{
      product_name: string;
      display_name: string;
      cycle: string;
      eol_date: string;
      days_until_eol: number;
    }>();

  const timeline: EolTimelineItem[] = [];

  for (const row of result.results) {
    const count = await c.env.DB
      .prepare(
        `SELECT COUNT(*) as count FROM asset_eol_links WHERE eol_cycle_id IN (
          SELECT id FROM eol_cycles WHERE product_id = (
            SELECT id FROM eol_products WHERE product_name = ?
          ) AND cycle = ?
        )`,
      )
      .bind(row.product_name, row.cycle)
      .first<{ count: number }>();

    timeline.push({
      product_name: row.product_name,
      display_name: row.display_name,
      cycle: row.cycle,
      eol_date: row.eol_date,
      days_until_eol: Math.floor(row.days_until_eol),
      affected_asset_count: count?.count ?? 0,
    });
  }

  return c.json(timeline);
});
