import type {
  EolCategory,
  EolStats,
  EolTimelineItem,
  HardwareAssetStatus,
} from "@vulflare/shared/types";
import { Hono } from "hono";
import {
  eolCycleRepo,
  eolProductRepo,
  eolSyncLogRepo,
  hardwareAssetRepo,
} from "../db/eol-repository.ts";
import { authMiddleware, requireRole } from "../middleware/auth.ts";
import { getAvailableProducts, syncAllProducts, syncProductCycles } from "../services/eol-sync.ts";
import type { Env, JwtVariables } from "../types.ts";

export const eolRoutes = new Hono<{ Bindings: Env; Variables: JwtVariables }>();

eolRoutes.use("/*", authMiddleware);

// --- プロダクト管理 ---

// GET /api/eol/products - プロダクト一覧
eolRoutes.get("/products", async (c) => {
  const category = c.req.query("category") as EolCategory | undefined;
  const status = c.req.query("status") as "eol" | "approaching_30d" | "approaching_90d" | undefined;
  const products = await eolProductRepo.list(c.env.DB, {
    ...(category && { category }),
    ...(status && { status }),
  });
  return c.json(products);
});

// GET /api/eol/products/:id - プロダクト詳細（サイクル一覧含む）
eolRoutes.get("/products/:id", async (c) => {
  const id = c.req.param("id") ?? "";
  const product = await eolProductRepo.findById(c.env.DB, id);

  if (!product) {
    return c.json({ error: "Product not found" }, 404);
  }

  const cycles = await eolCycleRepo.listByProduct(c.env.DB, id);

  return c.json({
    ...product,
    cycles,
  });
});

// POST /api/eol/products - プロダクト追加（admin/editor）
eolRoutes.post("/products", requireRole("editor"), async (c) => {
  const body = await c.req.json<{
    product_name?: string;
    display_name: string;
    category: EolCategory;
    vendor?: string;
    eol_api_id?: string;
    link?: string;
  }>();

  if (!body.display_name || !body.category) {
    return c.json({ error: "display_name and category are required" }, 400);
  }

  const validCategories: EolCategory[] = [
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
    "hw_server",
    "hw_network",
    "hw_storage",
    "hw_security_appliance",
    "hw_peripheral",
    "hw_other",
  ];

  if (!validCategories.includes(body.category)) {
    return c.json({ error: "Invalid category" }, 400);
  }

  // 表示名の重複チェック
  const existingByName = await eolProductRepo.findByDisplayName(c.env.DB, body.display_name);
  if (existingByName) {
    return c.json({ error: "同じ表示名の製品がすでに存在します" }, 409);
  }

  // product_name の解決（省略時はdisplay_nameからスラッグを自動生成）
  let productName = body.product_name;
  if (!productName) {
    const baseSlug =
      body.display_name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^\u0020-\u007E]/g, "")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "product";
    let slug = baseSlug;
    let counter = 2;
    while (await eolProductRepo.findByProductName(c.env.DB, slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    productName = slug;
  } else {
    const existing = await eolProductRepo.findByProductName(c.env.DB, productName);
    if (existing) {
      return c.json({ error: "Product already exists" }, 409);
    }
  }

  const id = crypto.randomUUID();
  await eolProductRepo.create(c.env.DB, {
    id,
    product_name: productName,
    display_name: body.display_name,
    category: body.category,
    vendor: body.vendor ?? null,
    eol_api_id: body.eol_api_id ?? null,
    link: body.link ?? null,
  });

  // eol_api_idが設定されている場合は初回同期
  if (body.eol_api_id) {
    try {
      await syncProductCycles(c.env, id, body.eol_api_id);
    } catch (err) {
      console.error("Failed to sync cycles:", err);
      // エラーでもプロダクトは作成済みなので成功扱い
    }
  }

  const created = await eolProductRepo.findById(c.env.DB, id);
  return c.json(created, 201);
});

// PATCH /api/eol/products/:id - プロダクト更新（admin/editor）
eolRoutes.patch("/products/:id", requireRole("editor"), async (c) => {
  const id = c.req.param("id") ?? "";
  const body = await c.req.json<{
    display_name?: string;
    category?: EolCategory;
    vendor?: string;
    link?: string;
    eol_api_id?: string;
  }>();

  const product = await eolProductRepo.findById(c.env.DB, id);
  if (!product) {
    return c.json({ error: "Product not found" }, 404);
  }

  // eol_api_idが既に設定されている場合、変更を禁止
  if (
    product.eol_api_id !== null &&
    body.eol_api_id !== undefined &&
    body.eol_api_id !== product.eol_api_id
  ) {
    return c.json(
      { error: "Cannot change eol_api_id of products synced from endoflife.date" },
      403,
    );
  }

  await eolProductRepo.update(c.env.DB, id, body);

  const updated = await eolProductRepo.findById(c.env.DB, id);
  return c.json(updated);
});

// DELETE /api/eol/products/:id - プロダクト削除（admin）
eolRoutes.delete("/products/:id", requireRole("admin"), async (c) => {
  const id = c.req.param("id") ?? "";
  const product = await eolProductRepo.findById(c.env.DB, id);

  if (!product) {
    return c.json({ error: "Product not found" }, 404);
  }

  await eolProductRepo.delete(c.env.DB, id);
  return c.json({ message: "Product deleted" });
});

// --- サイクル管理（手動入力用） ---

// POST /api/eol/cycles - サイクル追加（admin/editor）
eolRoutes.post("/cycles", requireRole("editor"), async (c) => {
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
    return c.json({ error: "product_id and cycle are required" }, 400);
  }

  const product = await eolProductRepo.findById(c.env.DB, body.product_id);
  if (!product) {
    return c.json({ error: "Product not found" }, 404);
  }

  // 手動で追加したプロダクトのみサイクルを追加可能
  if (product.eol_api_id !== null) {
    return c.json({ error: "Cannot add cycles to products synced from endoflife.date" }, 403);
  }

  // 重複チェック
  const existing = await eolCycleRepo.findByProductAndCycle(c.env.DB, body.product_id, body.cycle);
  if (existing) {
    return c.json({ error: "Cycle already exists" }, 409);
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
    source: "manual",
  });

  const created = await eolCycleRepo.findById(c.env.DB, id);
  return c.json(created, 201);
});

// PATCH /api/eol/cycles/:id - サイクル更新（admin/editor）
eolRoutes.patch("/cycles/:id", requireRole("editor"), async (c) => {
  const id = c.req.param("id") ?? "";
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
    return c.json({ error: "Cycle not found" }, 404);
  }

  // プロダクトを取得して手動追加かチェック
  const product = await eolProductRepo.findById(c.env.DB, cycle.product_id);
  if (!product) {
    return c.json({ error: "Product not found" }, 404);
  }

  // 手動で追加したプロダクトのサイクルのみ編集可能
  if (product.eol_api_id !== null) {
    return c.json({ error: "Cannot edit cycles of products synced from endoflife.date" }, 403);
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
eolRoutes.delete("/cycles/:id", requireRole("admin"), async (c) => {
  const id = c.req.param("id") ?? "";
  const cycle = await eolCycleRepo.findById(c.env.DB, id);

  if (!cycle) {
    return c.json({ error: "Cycle not found" }, 404);
  }

  // プロダクトを取得して手動追加かチェック
  const product = await eolProductRepo.findById(c.env.DB, cycle.product_id);
  if (!product) {
    return c.json({ error: "Product not found" }, 404);
  }

  // 手動で追加したプロダクトのサイクルのみ削除可能
  if (product.eol_api_id !== null) {
    return c.json({ error: "Cannot delete cycles of products synced from endoflife.date" }, 403);
  }

  await eolCycleRepo.delete(c.env.DB, id);
  return c.json({ message: "Cycle deleted" });
});

// --- endoflife.date 同期 ---

// GET /api/eol/available-products - 利用可能プロダクト一覧
eolRoutes.get("/available-products", async (c) => {
  try {
    const products = await getAvailableProducts(c.env);
    return c.json(products);
  } catch (err) {
    console.error("Failed to fetch available products:", err);
    return c.json({ error: "Failed to fetch available products" }, 500);
  }
});

// POST /api/eol/sync/:productName - 手動同期トリガー（admin）
eolRoutes.post("/sync/:productName", requireRole("admin"), async (c) => {
  const productName = c.req.param("productName") ?? "";
  const product = await eolProductRepo.findByProductName(c.env.DB, productName);

  if (!product) {
    return c.json({ error: "Product not found" }, 404);
  }

  if (!product.eol_api_id) {
    return c.json({ error: "Product does not have eol_api_id set" }, 400);
  }

  try {
    const result = await syncProductCycles(c.env, product.id, product.eol_api_id);
    return c.json({
      message: "Sync completed",
      synced: result.synced,
      errors: result.errors,
    });
  } catch (err) {
    console.error("Sync failed:", err);
    return c.json({ error: "Sync failed", details: String(err) }, 500);
  }
});

// POST /api/eol/sync-all - 全プロダクト一括同期（admin）
eolRoutes.post("/sync-all", requireRole("admin"), async (c) => {
  try {
    const result = await syncAllProducts(c.env);
    return c.json({
      message: "Sync completed",
      total: result.total,
      synced: result.synced,
      failed: result.failed,
    });
  } catch (err) {
    console.error("Bulk sync failed:", err);
    return c.json({ error: "Bulk sync failed", details: String(err) }, 500);
  }
});

// GET /api/eol/sync/logs - 同期ログ
eolRoutes.get("/sync/logs", async (c) => {
  const limit = Number.parseInt(c.req.query("limit") ?? "50", 10);
  const logs = await eolSyncLogRepo.list(c.env.DB, limit);
  return c.json(logs);
});

// --- 統計 ---

// GET /api/eol/stats - EOLサマリー統計
eolRoutes.get("/stats", async (c) => {
  const totalProducts = (await eolProductRepo.list(c.env.DB)).length;
  const eolCount = await eolCycleRepo.countEol(c.env.DB);
  const approaching30d = await eolCycleRepo.countApproachingEol(c.env.DB, 30);
  const approaching90d = await eolCycleRepo.countApproachingEol(c.env.DB, 90);

  const allCycles = await c.env.DB.prepare("SELECT COUNT(*) as count FROM eol_cycles").first<{
    count: number;
  }>();
  const totalCycles = allCycles?.count ?? 0;

  const supportedCount = totalCycles - eolCount - approaching30d;

  const stats: EolStats = {
    total_products: totalProducts,
    total_cycles: totalCycles,
    eol_count: eolCount,
    approaching_eol_30d: approaching30d,
    approaching_eol_90d: approaching90d,
    supported_count: supportedCount > 0 ? supportedCount : 0,
  };

  return c.json(stats);
});

// GET /api/eol/timeline - 今後のEOLタイムライン
eolRoutes.get("/timeline", async (c) => {
  const result = await c.env.DB.prepare(
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
        AND c.eol_date <= date('now', '+30 days')
      ORDER BY c.eol_date ASC
      LIMIT 50`,
  ).all<{
    product_name: string;
    display_name: string;
    cycle: string;
    eol_date: string;
    days_until_eol: number;
  }>();

  const timeline: EolTimelineItem[] = result.results.map((row) => ({
    product_name: row.product_name,
    display_name: row.display_name,
    cycle: row.cycle,
    eol_date: row.eol_date,
    days_until_eol: Math.floor(row.days_until_eol),
  }));

  return c.json(timeline);
});

// --- ハードウェアプロダクト ---

// GET /api/eol/hardware-products - ハードウェアプロダクト一覧（集計付き）
eolRoutes.get("/hardware-products", async (c) => {
  const products = await eolProductRepo.listHardware(c.env.DB);
  return c.json(products);
});

// POST /api/eol/hardware-with-asset - プロダクト+資産一括作成（editor以上）
eolRoutes.post("/hardware-with-asset", requireRole("editor"), async (c) => {
  const body = await c.req.json<{
    // Product fields
    product_name?: string;
    display_name: string;
    category: EolCategory;
    vendor?: string;
    link?: string;
    // Optional asset fields
    identifier?: string;
    hostname?: string;
    device_name?: string;
    support_expiry?: string;
    serial_number?: string;
    asset_number?: string;
    ip_address?: string;
    mac_address?: string;
    firmware_version?: string;
    purchase_date?: string;
    location?: string;
    owner?: string;
    mgmt_url?: string;
    notes?: string;
  }>();

  if (!body.display_name || !body.category) {
    return c.json({ error: "display_name and category are required" }, 400);
  }

  if (!body.category.startsWith("hw_")) {
    return c.json({ error: "category must be a hardware category (hw_*)" }, 400);
  }

  // product_name未指定時はdisplay_nameからslugを自動生成
  let productName = body.product_name;
  if (!productName) {
    const baseSlug =
      body.display_name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^\u0020-\u007E]/g, "")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "hardware";

    let slug = baseSlug;
    let counter = 2;
    while (await eolProductRepo.findByProductName(c.env.DB, slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    productName = slug;
  }

  const hasAssetFields = !!(
    body.device_name ||
    body.identifier ||
    body.hostname ||
    body.support_expiry ||
    body.serial_number ||
    body.location
  );

  // 既存プロダクトチェック
  let product = await eolProductRepo.findByProductName(c.env.DB, productName);
  let productCreated = false;

  if (!product) {
    const existingByName = await eolProductRepo.findByDisplayName(c.env.DB, body.display_name);
    if (existingByName) {
      return c.json({ error: "同じ表示名の製品がすでに存在します" }, 409);
    }

    const productId = crypto.randomUUID();
    await eolProductRepo.create(c.env.DB, {
      id: productId,
      product_name: productName,
      display_name: body.display_name,
      category: body.category,
      vendor: body.vendor ?? null,
      eol_api_id: null,
      link: body.link ?? null,
    });
    product = await eolProductRepo.findById(c.env.DB, productId);
    if (!product) {
      return c.json({ error: "Failed to create product" }, 500);
    }
    productCreated = true;
  }

  let asset = null;
  if (hasAssetFields) {
    const assetId = crypto.randomUUID();
    await hardwareAssetRepo.create(c.env.DB, {
      id: assetId,
      product_id: product.id,
      identifier: body.identifier ?? null,
      hostname: body.hostname ?? null,
      device_name: body.device_name ?? null,
      support_expiry: body.support_expiry ?? null,
      serial_number: body.serial_number ?? null,
      asset_number: body.asset_number ?? null,
      ip_address: body.ip_address ?? null,
      mac_address: body.mac_address ?? null,
      firmware_version: body.firmware_version ?? null,
      purchase_date: body.purchase_date ?? null,
      location: body.location ?? null,
      owner: body.owner ?? null,
      mgmt_url: body.mgmt_url ?? null,
      status: "active",
      notes: body.notes ?? null,
    });
    asset = await hardwareAssetRepo.findById(c.env.DB, assetId);
  }

  return c.json({ product, asset, productCreated }, 201);
});

// --- ハードウェア資産管理 ---

// GET /api/eol/assets?product_id=xxx - 資産一覧
eolRoutes.get("/assets", async (c) => {
  const productId = c.req.query("product_id");
  if (!productId) {
    return c.json({ error: "product_id is required" }, 400);
  }
  const assets = await hardwareAssetRepo.listByProduct(c.env.DB, productId);
  return c.json(assets);
});

// GET /api/eol/assets/:id - 資産詳細
eolRoutes.get("/assets/:id", async (c) => {
  const id = c.req.param("id") ?? "";
  const asset = await hardwareAssetRepo.findById(c.env.DB, id);
  if (!asset) {
    return c.json({ error: "Asset not found" }, 404);
  }
  return c.json(asset);
});

// POST /api/eol/assets - 資産追加（editor以上）
eolRoutes.post("/assets", requireRole("editor"), async (c) => {
  const body = await c.req.json<{
    product_id: string;
    identifier?: string;
    hostname?: string;
    device_name?: string;
    support_expiry?: string;
    serial_number?: string;
    asset_number?: string;
    ip_address?: string;
    mac_address?: string;
    firmware_version?: string;
    purchase_date?: string;
    location?: string;
    owner?: string;
    mgmt_url?: string;
    status?: HardwareAssetStatus;
    notes?: string;
  }>();

  if (!body.product_id) {
    return c.json({ error: "product_id is required" }, 400);
  }

  const product = await eolProductRepo.findById(c.env.DB, body.product_id);
  if (!product) {
    return c.json({ error: "Product not found" }, 404);
  }
  if (!product.category.startsWith("hw_")) {
    return c.json({ error: "Product is not a hardware product" }, 400);
  }

  const id = crypto.randomUUID();
  await hardwareAssetRepo.create(c.env.DB, {
    id,
    product_id: body.product_id,
    identifier: body.identifier ?? null,
    hostname: body.hostname ?? null,
    device_name: body.device_name ?? null,
    support_expiry: body.support_expiry ?? null,
    serial_number: body.serial_number ?? null,
    asset_number: body.asset_number ?? null,
    ip_address: body.ip_address ?? null,
    mac_address: body.mac_address ?? null,
    firmware_version: body.firmware_version ?? null,
    purchase_date: body.purchase_date ?? null,
    location: body.location ?? null,
    owner: body.owner ?? null,
    mgmt_url: body.mgmt_url ?? null,
    status: body.status ?? "active",
    notes: body.notes ?? null,
  });

  const created = await hardwareAssetRepo.findById(c.env.DB, id);
  return c.json(created, 201);
});

// PATCH /api/eol/assets/:id - 資産更新（editor以上）
eolRoutes.patch("/assets/:id", requireRole("editor"), async (c) => {
  const id = c.req.param("id") ?? "";
  const asset = await hardwareAssetRepo.findById(c.env.DB, id);
  if (!asset) {
    return c.json({ error: "Asset not found" }, 404);
  }

  const body = await c.req.json<{
    identifier?: string | null;
    hostname?: string | null;
    device_name?: string | null;
    support_expiry?: string | null;
    serial_number?: string | null;
    asset_number?: string | null;
    ip_address?: string | null;
    mac_address?: string | null;
    firmware_version?: string | null;
    purchase_date?: string | null;
    location?: string | null;
    owner?: string | null;
    mgmt_url?: string | null;
    status?: HardwareAssetStatus;
    notes?: string | null;
  }>();

  const updates: Record<string, unknown> = {};
  const fields = [
    "identifier",
    "hostname",
    "device_name",
    "support_expiry",
    "serial_number",
    "asset_number",
    "ip_address",
    "mac_address",
    "firmware_version",
    "purchase_date",
    "location",
    "owner",
    "mgmt_url",
    "status",
    "notes",
  ] as const;

  for (const field of fields) {
    if (field in body) updates[field] = body[field];
  }

  await hardwareAssetRepo.update(c.env.DB, id, updates);
  const updated = await hardwareAssetRepo.findById(c.env.DB, id);
  return c.json(updated);
});

// DELETE /api/eol/assets/:id - 資産削除（admin）
eolRoutes.delete("/assets/:id", requireRole("admin"), async (c) => {
  const id = c.req.param("id") ?? "";
  const asset = await hardwareAssetRepo.findById(c.env.DB, id);
  if (!asset) {
    return c.json({ error: "Asset not found" }, 404);
  }
  await hardwareAssetRepo.delete(c.env.DB, id);
  return c.json({ message: "Asset deleted" });
});
