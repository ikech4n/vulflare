/// <reference types="@cloudflare/vitest-pool-workers/types" />
/**
 * GET /api/sync/jvn-vendors 統合テスト
 *
 * - キャッシュ空 → MyJVN API を呼んでキャッシュ・返却
 * - キャッシュ有効 → API を呼ばず直接返す
 * - クエリパラメータ q でフィルタリング
 */

import { env } from "cloudflare:test";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../index.ts";
import { signJwt } from "../services/auth.ts";
import type { Env } from "../types.ts";

const testEnv = env as unknown as Env;

/** テスト用JWTを生成 */
async function makeAuthHeader(role: "admin" | "editor" | "viewer" = "editor") {
  const now = Math.floor(Date.now() / 1000);
  const token = await signJwt(
    { sub: "test-user-id", role, type: "access", iat: now, exp: now + 3600 },
    testEnv.JWT_SECRET,
  );
  return `Bearer ${token}`;
}

/** テスト用 MyJVN ベンダーリスト XML を生成（<Vendor vid="..." vname="..." /> 自己終了タグ形式） */
function makeVendorListXml(vendors: Array<{ vid: string; vname: string }>): string {
  const items = vendors.map((v) => `  <Vendor vid="${v.vid}" vname="${v.vname}" />`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${items}\n</Response>`;
}

const mockFetch = vi.fn();

describe("GET /api/sync/jvn-vendors", () => {
  let authHeader: string;

  beforeAll(async () => {
    // テストに必要なテーブルを作成（migration 025 と同じ定義）
    await testEnv.DB.exec(
      "CREATE TABLE IF NOT EXISTS jvn_vendor_cache (vid TEXT PRIMARY KEY, vname TEXT NOT NULL, fetched_at TEXT NOT NULL DEFAULT (datetime('now', '+9 hours')))",
    );

    vi.stubGlobal("fetch", mockFetch);
    authHeader = await makeAuthHeader("editor");
  });

  beforeEach(() => {
    mockFetch.mockReset();
    // デフォルト: モックされていないリクエストはエラー（disableNetConnect 相当）
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      throw new Error(`Unexpected fetch: ${input.toString()}`);
    });
  });

  afterEach(async () => {
    await testEnv.DB.prepare("DELETE FROM jvn_vendor_cache").run();
  });

  it("キャッシュが空の場合はMyJVN APIを呼んでキャッシュし200を返す", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        makeVendorListXml([
          { vid: "v-msft", vname: "Microsoft" },
          { vid: "v-apch", vname: "Apache" },
        ]),
        { status: 200 },
      ),
    );

    const res = await app.request(
      "/api/sync/jvn-vendors",
      { headers: { Authorization: authHeader } },
      testEnv,
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as { vendors: Array<{ vid: string; vname: string }> };
    expect(data.vendors).toHaveLength(2);
    // DBにキャッシュされていること
    const cached = await testEnv.DB.prepare("SELECT COUNT(*) as cnt FROM jvn_vendor_cache").first<{
      cnt: number;
    }>();
    expect(cached?.cnt).toBe(2);
  });

  it("キャッシュが有効な場合はMyJVN APIを呼ばず直接返す", async () => {
    // fetched_at = 現在時刻 → TTL（24h）内
    await testEnv.DB.prepare(
      "INSERT INTO jvn_vendor_cache (vid, vname, fetched_at) VALUES (?, ?, datetime('now'))",
    )
      .bind("v-oracle", "Oracle")
      .run();

    // mockFetch に何もセットしない → API が呼ばれたらデフォルト実装でエラーになる

    const res = await app.request(
      "/api/sync/jvn-vendors",
      { headers: { Authorization: authHeader } },
      testEnv,
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as { vendors: Array<{ vid: string; vname: string }> };
    expect(data.vendors).toHaveLength(1);
    expect(data.vendors[0]?.vname).toBe("Oracle");
  });

  it("クエリパラメータ q でキャッシュをフィルタリングする", async () => {
    // キャッシュにベンダーを事前投入
    await testEnv.DB.prepare(
      "INSERT INTO jvn_vendor_cache (vid, vname, fetched_at) VALUES (?, ?, datetime('now'))",
    )
      .bind("v-cisco", "Cisco Systems")
      .run();
    await testEnv.DB.prepare(
      "INSERT INTO jvn_vendor_cache (vid, vname, fetched_at) VALUES (?, ?, datetime('now'))",
    )
      .bind("v-redhat", "Red Hat")
      .run();

    // "cisco" でフィルタ → Cisco のみ返るはず
    const res = await app.request(
      "/api/sync/jvn-vendors?q=cisco",
      { headers: { Authorization: authHeader } },
      testEnv,
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as { vendors: Array<{ vid: string; vname: string }> };
    expect(data.vendors).toHaveLength(1);
    expect(data.vendors[0]?.vname).toBe("Cisco Systems");
  });
});
