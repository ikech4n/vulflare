import { Hono } from "hono";
import { authMiddleware, requireRole } from "../middleware/auth.ts";
import { handleJvnSync } from "../scheduled/jvn-sync.ts";
import {
  type MyjvnProduct,
  type MyjvnVendor,
  fetchProductList,
  fetchVendorList,
} from "../services/myjvn-api.ts";
import { deleteSyncData } from "../services/sync-data-deletion.ts";
import {
  type SyncSettings,
  getSyncSettings,
  updateSyncSettings,
} from "../services/sync-settings.ts";
import type { Env, JwtVariables } from "../types.ts";
import { validate } from "../validation/middleware.ts";
import { cancelSyncSchema, updateSyncSettingsSchema } from "../validation/schemas.ts";

export const syncRoutes = new Hono<{ Bindings: Env; Variables: JwtVariables }>();

// GET /api/sync/status - JVN同期ステータス取得
syncRoutes.get("/status", authMiddleware, async (c) => {
  const latest = await c.env.DB.prepare(
    "SELECT * FROM jvn_sync_logs ORDER BY started_at DESC LIMIT 1",
  ).first<Record<string, unknown>>();

  return c.json({ latestLog: latest });
});

// GET /api/sync/filter-options - フィルター選択肢取得（旧エンドポイント、互換性のため維持）
syncRoutes.get("/filter-options", authMiddleware, async (c) => {
  try {
    // JVNマスターテーブルからベンダーと製品を取得
    const [vendorRows, productRows] = await Promise.all([
      c.env.DB.prepare("SELECT name FROM jvn_vendors ORDER BY name COLLATE NOCASE").all<{
        name: string;
      }>(),
      c.env.DB.prepare("SELECT name FROM jvn_products ORDER BY name COLLATE NOCASE").all<{
        name: string;
      }>(),
    ]);

    const vendors = vendorRows.results.map((row) => row.name);
    const products = productRows.results.map((row) => row.name);

    console.log(
      `Returning ${vendors.length} vendors and ${products.length} products from JVN master tables`,
    );

    // データがない場合のフォールバック
    if (vendors.length === 0 && products.length === 0) {
      console.warn("No vendors/products in master tables, returning defaults");
      return c.json({
        vendors: [
          "Microsoft",
          "Oracle",
          "Adobe",
          "Apache",
          "Google",
          "Apple",
          "Cisco",
          "IBM",
          "Red Hat",
          "Mozilla",
          "Linux",
          "PHP",
          "WordPress",
          "Jenkins",
          "Atlassian",
          "VMware",
          "Samsung",
        ],
        products: [
          "Windows",
          "Linux Kernel",
          "Chrome",
          "Firefox",
          "Safari",
          "Java",
          "PHP",
          "MySQL",
          "PostgreSQL",
          "Apache HTTP Server",
          "nginx",
          "WordPress",
          "OpenSSL",
          "jQuery",
          "Node.js",
        ],
      });
    }

    return c.json({ vendors, products });
  } catch (error) {
    console.error("Error in filter-options:", error);

    // エラー時はデフォルト候補を返す
    return c.json({
      vendors: [
        "Microsoft",
        "Oracle",
        "Adobe",
        "Apache",
        "Google",
        "Apple",
        "Cisco",
        "IBM",
        "Red Hat",
        "Mozilla",
        "Linux",
        "PHP",
      ],
      products: [
        "Windows",
        "Linux Kernel",
        "Chrome",
        "Firefox",
        "Safari",
        "Java",
        "PHP",
        "MySQL",
        "PostgreSQL",
        "Apache HTTP Server",
      ],
    });
  }
});

// GET /api/sync/jvn-vendors - ベンダー検索（MyJVN APIキャッシュ）
syncRoutes.get("/jvn-vendors", authMiddleware, async (c) => {
  const query = c.req.query("q") || "";
  const CACHE_TTL_HOURS = 24;

  try {
    // キャッシュから検索（大文字小文字を区別しない）
    const cacheResults = await c.env.DB.prepare(
      `SELECT vid, vname, fetched_at FROM jvn_vendor_cache
       WHERE LOWER(vname) LIKE LOWER(?)
       ORDER BY vname COLLATE NOCASE
       LIMIT 1000`,
    )
      .bind(`%${query}%`)
      .all<{ vid: string; vname: string; fetched_at: string }>();

    // キャッシュが空または古い場合、MyJVN APIから取得
    const now = new Date();
    const shouldRefetch =
      cacheResults.results.length === 0 ||
      (cacheResults.results[0] &&
        now.getTime() - new Date(cacheResults.results[0].fetched_at).getTime() >
          CACHE_TTL_HOURS * 60 * 60 * 1000);

    if (shouldRefetch) {
      console.log(`Fetching vendors from MyJVN API with keyword: "${query}"...`);
      const vendors = await fetchVendorList(query);

      // バッチでキャッシュに保存
      if (vendors.length > 0) {
        const stmts = vendors.map((v) =>
          c.env.DB.prepare(
            `INSERT INTO jvn_vendor_cache (vid, vname, fetched_at)
             VALUES (?, ?, datetime('now', '+9 hours'))
             ON CONFLICT(vid) DO UPDATE SET vname = excluded.vname, fetched_at = excluded.fetched_at`,
          ).bind(v.vid, v.vname),
        );

        // 50件ずつバッチ実行
        for (let i = 0; i < stmts.length; i += 50) {
          await c.env.DB.batch(stmts.slice(i, i + 50));
        }

        console.log(`Cached ${vendors.length} vendors`);
      }

      // 再検索
      const refreshed = await c.env.DB.prepare(
        `SELECT vid, vname FROM jvn_vendor_cache
         WHERE LOWER(vname) LIKE LOWER(?)
         ORDER BY vname COLLATE NOCASE
         LIMIT 1000`,
      )
        .bind(`%${query}%`)
        .all<{ vid: string; vname: string }>();

      return c.json({ vendors: refreshed.results });
    }

    return c.json({
      vendors: cacheResults.results.map((r) => ({ vid: r.vid, vname: r.vname })),
    });
  } catch (error) {
    console.error("Error fetching JVN vendors:", error);
    return c.json({ error: "Failed to fetch vendors", vendors: [] }, 500);
  }
});

// GET /api/sync/jvn-vendors/:vid/products - 指定ベンダーの製品一覧
syncRoutes.get("/jvn-vendors/:vid/products", authMiddleware, async (c) => {
  const vendorId = c.req.param("vid") ?? "";
  const CACHE_TTL_HOURS = 24;

  try {
    // キャッシュから取得
    const cacheResults = await c.env.DB.prepare(
      `SELECT pid, pname, cpe, fetched_at FROM jvn_product_cache
       WHERE vendor_vid = ?
       ORDER BY pname COLLATE NOCASE`,
    )
      .bind(vendorId)
      .all<{ pid: string; pname: string; cpe: string; fetched_at: string }>();

    // キャッシュが空または古い場合、MyJVN APIから取得
    const now = new Date();
    const shouldRefetch =
      cacheResults.results.length === 0 ||
      (cacheResults.results[0] &&
        now.getTime() - new Date(cacheResults.results[0].fetched_at).getTime() >
          CACHE_TTL_HOURS * 60 * 60 * 1000);

    if (shouldRefetch) {
      console.log(`Fetching products for vendor ${vendorId} from MyJVN API...`);
      const { vendorName, products } = await fetchProductList(vendorId);

      // 外部キー制約を満たすためベンダーをUPSERT
      await c.env.DB.prepare(
        `INSERT INTO jvn_vendor_cache (vid, vname, fetched_at)
         VALUES (?, ?, datetime('now', '+9 hours'))
         ON CONFLICT(vid) DO NOTHING`,
      )
        .bind(vendorId, vendorName || vendorId)
        .run();

      // バッチでキャッシュに保存
      if (products.length > 0) {
        const stmts = products.map((p) =>
          c.env.DB.prepare(
            `INSERT INTO jvn_product_cache (pid, pname, cpe, vendor_vid, fetched_at)
             VALUES (?, ?, ?, ?, datetime('now', '+9 hours'))
             ON CONFLICT(pid) DO UPDATE SET
               pname = excluded.pname,
               cpe = excluded.cpe,
               vendor_vid = excluded.vendor_vid,
               fetched_at = excluded.fetched_at`,
          ).bind(p.pid, p.pname, p.cpe, vendorId),
        );

        // 50件ずつバッチ実行
        for (let i = 0; i < stmts.length; i += 50) {
          await c.env.DB.batch(stmts.slice(i, i + 50));
        }

        console.log(`Cached ${products.length} products for vendor ${vendorId}`);
      }

      // 再検索
      const refreshed = await c.env.DB.prepare(
        `SELECT pid, pname, cpe FROM jvn_product_cache
         WHERE vendor_vid = ?
         ORDER BY pname COLLATE NOCASE`,
      )
        .bind(vendorId)
        .all<{ pid: string; pname: string; cpe: string }>();

      return c.json({ products: refreshed.results });
    }

    return c.json({
      products: cacheResults.results.map((r) => ({ pid: r.pid, pname: r.pname, cpe: r.cpe })),
    });
  } catch (error) {
    console.error(`Error fetching products for vendor ${vendorId}:`, error);
    return c.json({ error: "Failed to fetch products", products: [] }, 500);
  }
});

// POST /api/sync/jvn-vendors/refresh - ベンダーキャッシュ強制更新（admin）
syncRoutes.post("/jvn-vendors/refresh", authMiddleware, requireRole("admin"), async (c) => {
  try {
    console.log("Force refreshing JVN vendor cache...");
    const vendors = await fetchVendorList();

    // 既存キャッシュをクリア
    await c.env.DB.prepare("DELETE FROM jvn_vendor_cache").run();

    // 新しいデータを保存
    if (vendors.length > 0) {
      const stmts = vendors.map((v) =>
        c.env.DB.prepare(
          `INSERT INTO jvn_vendor_cache (vid, vname, fetched_at)
           VALUES (?, ?, datetime('now', '+9 hours'))`,
        ).bind(v.vid, v.vname),
      );

      // 50件ずつバッチ実行
      for (let i = 0; i < stmts.length; i += 50) {
        await c.env.DB.batch(stmts.slice(i, i + 50));
      }

      console.log(`Refreshed ${vendors.length} vendors`);
    }

    return c.json({ message: "Vendor cache refreshed", count: vendors.length });
  } catch (error) {
    console.error("Error refreshing vendor cache:", error);
    return c.json({ error: "Failed to refresh vendor cache" }, 500);
  }
});

// POST /api/sync/trigger - JVN同期の手動トリガー (editor以上)
syncRoutes.post("/trigger", authMiddleware, requireRole("editor"), async (c) => {
  c.executionCtx.waitUntil(handleJvnSync(c.env));
  return c.json({ message: "JVN sync triggered" }, 202);
});

// POST /api/sync/trigger-full - JVN全件同期の手動トリガー (editor以上)
syncRoutes.post("/trigger-full", authMiddleware, requireRole("editor"), async (c) => {
  c.executionCtx.waitUntil(handleJvnSync(c.env, true));
  return c.json({ message: "JVN full sync triggered" }, 202);
});

// GET /api/sync/settings - 全認証ユーザー参照可能
syncRoutes.get("/settings", authMiddleware, async (c) => {
  const settings = await getSyncSettings(c.env);
  return c.json(settings);
});

// PUT /api/sync/settings - editor以上
syncRoutes.put(
  "/settings",
  authMiddleware,
  requireRole("editor"),
  validate(updateSyncSettingsSchema),
  async (c) => {
    const body = c.get("validatedBody") as SyncSettings;

    console.log("Received sync settings update:", JSON.stringify(body, null, 2));

    await updateSyncSettings(c.env, body);

    return c.json({ message: "Saved" });
  },
);

// POST /api/sync/cancel - admin 限定: 実行中の同期をキャンセル
syncRoutes.post(
  "/cancel",
  authMiddleware,
  requireRole("admin"),
  validate(cancelSyncSchema),
  async (c) => {
    const body = c.get("validatedBody") as { source: "jvn" };

    await c.env.VULFLARE_KV_CACHE.put(`${body.source}:cancel_requested`, "1", {
      expirationTtl: 300,
    });
    return c.json({ message: "Cancel requested" });
  },
);

// DELETE /api/sync/data/:source - データソース別削除 (admin専用)
syncRoutes.delete("/data/:source", authMiddleware, requireRole("admin"), async (c) => {
  const source = c.req.param("source") ?? "";

  if (source !== "jvn") {
    return c.json({ error: "Invalid source. Must be: jvn" }, 400);
  }

  const results = await deleteSyncData(c.env, "jvn");

  return c.json(results);
});

// DELETE /api/sync/reset - JVN削除 (deprecated: /api/sync/data/jvn を使用推奨)
syncRoutes.delete("/reset", authMiddleware, requireRole("admin"), async (c) => {
  console.warn("DEPRECATED: Use DELETE /api/sync/data/:source instead");

  const result = await deleteSyncData(c.env, "jvn");

  return c.json({
    deleted: result.deleted.jvn ?? 0,
    _deprecated: "Use DELETE /api/sync/data/:source instead",
  });
});
