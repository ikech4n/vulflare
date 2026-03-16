/// <reference types="@cloudflare/vitest-pool-workers" />
/**
 * sync ルート統合テスト
 *
 * D1 FK制約バグ（jvn_product_cache.vendor_vid → jvn_vendor_cache.vid）の
 * 再発防止を目的としたクリーンDBでのAPIテスト。
 *
 * テスト環境:
 * - D1はminiflareが migrations/ を適用したクリーンなインメモリDB
 * - 外部API（MyJVN）はfetchMockでインターセプト
 * - JWT_SECRETはvitest.config.tsのminiflare.bindingsで注入
 */

import { env, fetchMock } from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { app } from "../index.ts";
import { signJwt } from "../services/auth.ts";
import type { Env } from "../types.ts";

const testEnv = env as unknown as Env;

/** テスト用アクセストークンを生成（JWTはDBユーザー不要） */
async function makeAuthHeader(role: "admin" | "editor" | "viewer" = "editor") {
  const now = Math.floor(Date.now() / 1000);
  const token = await signJwt(
    { sub: "test-user-id", role, type: "access", iat: now, exp: now + 3600 },
    testEnv.JWT_SECRET,
  );
  return `Bearer ${token}`;
}

/** テスト用MyJVN製品一覧XMLを生成 */
function makeProductListXml(
  vendorId: string,
  vendorName: string,
  products: Array<{ pid: string; pname: string; cpe: string }>,
): string {
  const productXml = products
    .map((p) => `    <Product pid="${p.pid}" pname="${p.pname}" cpe="${p.cpe}" />`)
    .join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    `  <Vendor vid="${vendorId}" vname="${vendorName}">`,
    productXml,
    "  </Vendor>",
    "</Response>",
  ].join("\n");
}

describe("GET /api/sync/jvn-vendors/:vid/products", () => {
  let authHeader: string;

  beforeAll(async () => {
    // テストに必要なテーブルのみ作成（migration 025 と同じ定義）
    // FK制約のテストが目的なので、実際のスキーマをここで再現する
    // D1のexec()は1文ずつ実行する
    await testEnv.DB.exec(
      "CREATE TABLE IF NOT EXISTS jvn_vendor_cache (vid TEXT PRIMARY KEY, vname TEXT NOT NULL, fetched_at TEXT NOT NULL DEFAULT (datetime('now', '+9 hours')))",
    );
    await testEnv.DB.exec(
      "CREATE TABLE IF NOT EXISTS jvn_product_cache (pid TEXT PRIMARY KEY, pname TEXT NOT NULL, cpe TEXT NOT NULL DEFAULT '', vendor_vid TEXT NOT NULL, fetched_at TEXT NOT NULL DEFAULT (datetime('now', '+9 hours')), FOREIGN KEY (vendor_vid) REFERENCES jvn_vendor_cache(vid) ON DELETE CASCADE)",
    );

    fetchMock.activate();
    fetchMock.disableNetConnect();
    authHeader = await makeAuthHeader("editor");
  });

  afterEach(async () => {
    fetchMock.assertNoPendingInterceptors();
    // テスト間のDB状態を隔離するためキャッシュをクリア
    await testEnv.DB.prepare("DELETE FROM jvn_product_cache").run();
    await testEnv.DB.prepare("DELETE FROM jvn_vendor_cache").run();
  });

  it("ベンダーキャッシュが空の状態でも200を返す（FK制約バグ再発防止）", async () => {
    // このテストは以下のバグを再現・防止する:
    // jvn_vendor_cache が空のまま jvn_product_cache への INSERT を試みると
    // FK制約違反で500エラーになっていた問題
    // 修正後はベンダーUPSERTを先に実行するため正常に動作する
    fetchMock
      .get("https://jvndb.jvn.jp")
      .intercept({ path: /getProductList/, method: "GET" })
      .reply(
        200,
        makeProductListXml("vid-test", "Test Vendor", [
          { pid: "p001", pname: "Test Product", cpe: "cpe:/a:test:product:1.0" },
        ]),
      );

    const res = await app.request(
      "/api/sync/jvn-vendors/vid-test/products",
      { headers: { Authorization: authHeader } },
      testEnv,
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      products: Array<{ pid: string; pname: string; cpe: string }>;
    };
    expect(data.products).toHaveLength(1);
    expect(data.products[0]?.pname).toBe("Test Product");
  });

  it("MyJVN APIレスポンスがベンダー・製品ともにDBにキャッシュされる", async () => {
    fetchMock
      .get("https://jvndb.jvn.jp")
      .intercept({ path: /getProductList/, method: "GET" })
      .reply(
        200,
        makeProductListXml("vid-microsoft", "Microsoft Corporation", [
          { pid: "p-windows", pname: "Windows 11", cpe: "cpe:/o:microsoft:windows_11" },
          { pid: "p-edge", pname: "Microsoft Edge", cpe: "cpe:/a:microsoft:edge" },
        ]),
      );

    await app.request(
      "/api/sync/jvn-vendors/vid-microsoft/products",
      { headers: { Authorization: authHeader } },
      testEnv,
    );

    // ベンダーキャッシュに保存されていること
    const vendor = await testEnv.DB.prepare("SELECT vid, vname FROM jvn_vendor_cache WHERE vid = ?")
      .bind("vid-microsoft")
      .first<{ vid: string; vname: string }>();
    expect(vendor).not.toBeNull();
    expect(vendor?.vname).toBe("Microsoft Corporation");

    // 製品キャッシュに保存されていること
    const products = await testEnv.DB.prepare(
      "SELECT pid, pname FROM jvn_product_cache WHERE vendor_vid = ? ORDER BY pid",
    )
      .bind("vid-microsoft")
      .all<{ pid: string; pname: string }>();
    expect(products.results).toHaveLength(2);
    expect(products.results[0]?.pname).toBe("Microsoft Edge");
    expect(products.results[1]?.pname).toBe("Windows 11");
  });

  it("キャッシュ済みデータがある場合はMyJVN APIを呼ばず直接返す", async () => {
    // キャッシュをセットアップ（fetched_at = 現在時刻 → TTL内）
    await testEnv.DB.prepare(
      "INSERT INTO jvn_vendor_cache (vid, vname, fetched_at) VALUES (?, ?, datetime('now'))",
    )
      .bind("vid-apache", "Apache Software Foundation")
      .run();
    await testEnv.DB.prepare(
      `INSERT INTO jvn_product_cache (pid, pname, cpe, vendor_vid, fetched_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
    )
      .bind("p-httpd", "Apache HTTP Server", "cpe:/a:apache:http_server", "vid-apache")
      .run();

    // fetchMockに何もセットしない → APIが呼ばれたらエラーになる

    const res = await app.request(
      "/api/sync/jvn-vendors/vid-apache/products",
      { headers: { Authorization: authHeader } },
      testEnv,
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as { products: Array<{ pname: string }> };
    expect(data.products).toHaveLength(1);
    expect(data.products[0]?.pname).toBe("Apache HTTP Server");
  });
});
