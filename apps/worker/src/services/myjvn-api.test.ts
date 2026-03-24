/// <reference types="@cloudflare/vitest-pool-workers/types" />
/**
 * myjvn-api ユニットテスト
 *
 * fetchVendorList / fetchProductList の XML パース・HTMLエンティティデコード・
 * エラーハンドリングを検証する。
 * vi.fn() で MyJVN API への HTTP リクエストをインターセプト。
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchProductList, fetchVendorList } from "./myjvn-api.ts";

const MYJVN_HOST = "https://jvndb.jvn.jp";

/** fetchVendorList 用 XML を生成（<Vendor ... /> 自己終了タグ形式） */
function makeVendorListXml(vendors: Array<{ vid: string; vname: string }>): string {
  const items = vendors.map((v) => `  <Vendor vid="${v.vid}" vname="${v.vname}" />`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${items}\n</Response>`;
}

/** fetchProductList 用 XML を生成（<Vendor>...<Product />...</Vendor> 形式） */
function makeProductListXml(
  vendorId: string,
  vendorName: string,
  products: Array<{ pid: string; pname: string; cpe?: string }>,
): string {
  const items = products
    .map((p) => `    <Product pid="${p.pid}" pname="${p.pname}" cpe="${p.cpe ?? ""}" />`)
    .join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    `  <Vendor vid="${vendorId}" vname="${vendorName}">`,
    items,
    "  </Vendor>",
    "</Response>",
  ].join("\n");
}

const mockFetch = vi.fn();

beforeAll(() => {
  vi.stubGlobal("fetch", mockFetch);
});

beforeEach(() => {
  mockFetch.mockReset();
  // デフォルト: モックされていないURLへのリクエストはエラー
  mockFetch.mockImplementation((input: RequestInfo | URL) => {
    throw new Error(`Unexpected fetch: ${input.toString()}`);
  });
});

afterEach(() => {
  // 未消費のモックがないことを確認
  expect(mockFetch.mock.calls.length).toBe(mockFetch.mock.results.length);
});

// ─────────────────────────────────────────────
// fetchVendorList
// ─────────────────────────────────────────────
describe("fetchVendorList", () => {
  it("有効なXMLからベンダーリストを返す", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        makeVendorListXml([
          { vid: "v001", vname: "Microsoft" },
          { vid: "v002", vname: "Apache" },
        ]),
        { status: 200 },
      ),
    );

    const vendors = await fetchVendorList();
    expect(vendors).toHaveLength(2);
    expect(vendors[0]).toEqual({ vid: "v001", vname: "Microsoft" });
    expect(vendors[1]).toEqual({ vid: "v002", vname: "Apache" });
  });

  it("HTMLエンティティ（&amp; &lt; &gt; &quot; &apos;）をデコードする", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(makeVendorListXml([{ vid: "v001", vname: "AT&amp;T &lt;Corp&gt;" }]), {
        status: 200,
      }),
    );

    const vendors = await fetchVendorList();
    expect(vendors[0]?.vname).toBe("AT&T <Corp>");
  });

  it("vendorが0件 → 空配列を返す", async () => {
    mockFetch.mockResolvedValueOnce(new Response("<Response></Response>", { status: 200 }));

    const vendors = await fetchVendorList();
    expect(vendors).toHaveLength(0);
  });

  it("非200レスポンス → エラーをthrowする", async () => {
    mockFetch.mockResolvedValueOnce(new Response("Internal Server Error", { status: 500 }));

    await expect(fetchVendorList()).rejects.toThrow("MyJVN getVendorList failed: 500");
  });

  it("keyword指定あり → URLにkeywordパラメータを追加する", async () => {
    mockFetch.mockImplementationOnce(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (/keyword=microsoft/.test(url)) {
        return new Response(makeVendorListXml([{ vid: "v001", vname: "Microsoft" }]), {
          status: 200,
        });
      }
      throw new Error(`URL did not match keyword pattern: ${url}`);
    });

    const vendors = await fetchVendorList("microsoft");
    expect(vendors).toHaveLength(1);
  });

  it("keyword未指定/空文字/空白のみ → URLにkeywordを追加しない", async () => {
    // 3回分のレスポンスを用意（keyword= を含まないURLのみ許可）
    for (let i = 0; i < 3; i++) {
      mockFetch.mockImplementationOnce(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (/keyword=/.test(url)) {
          throw new Error(`Unexpected keyword in URL: ${url}`);
        }
        return new Response("<Response></Response>", { status: 200 });
      });
    }

    await fetchVendorList(undefined);
    await fetchVendorList("");
    await fetchVendorList("   ");
  });

  it("vid または vname が空のvendorをスキップする", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        [
          '<?xml version="1.0" encoding="UTF-8"?>',
          "<Response>",
          '  <Vendor vid="v001" vname="Valid Vendor" />',
          '  <Vendor vid="" vname="No VID" />',
          '  <Vendor vid="v003" vname="" />',
          '  <Vendor vname="No VID attr" />',
          "</Response>",
        ].join("\n"),
        { status: 200 },
      ),
    );

    const vendors = await fetchVendorList();
    expect(vendors).toHaveLength(1);
    expect(vendors[0]?.vid).toBe("v001");
  });
});

// ─────────────────────────────────────────────
// fetchProductList
// ─────────────────────────────────────────────
describe("fetchProductList", () => {
  it("有効なXMLからベンダー名と製品リストを返す", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        makeProductListXml("v001", "Microsoft", [
          { pid: "p001", pname: "Windows 11", cpe: "cpe:/o:microsoft:windows_11" },
          { pid: "p002", pname: "Edge Browser", cpe: "cpe:/a:microsoft:edge" },
        ]),
        { status: 200 },
      ),
    );

    const result = await fetchProductList("v001");
    expect(result.vendorName).toBe("Microsoft");
    expect(result.products).toHaveLength(2);
    expect(result.products[0]).toEqual({
      pid: "p001",
      pname: "Windows 11",
      cpe: "cpe:/o:microsoft:windows_11",
    });
  });

  it("HTMLエンティティをデコードする（ベンダー名・製品名）", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        makeProductListXml("v001", "AT&amp;T", [
          { pid: "p001", pname: "AT&amp;T Software", cpe: "" },
        ]),
        { status: 200 },
      ),
    );

    const result = await fetchProductList("v001");
    expect(result.vendorName).toBe("AT&T");
    expect(result.products[0]?.pname).toBe("AT&T Software");
  });

  it("cpe属性が存在しない → 空文字列をデフォルト値として使用", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        '<Response><Vendor vid="v001" vname="Test"><Product pid="p001" pname="No CPE" /></Vendor></Response>',
        { status: 200 },
      ),
    );

    const result = await fetchProductList("v001");
    expect(result.products[0]?.cpe).toBe("");
  });

  it("製品が0件 → vendorNameは取得し、productsは空配列を返す", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('<Response><Vendor vid="v001" vname="Empty Vendor"></Vendor></Response>', {
        status: 200,
      }),
    );

    const result = await fetchProductList("v001");
    expect(result.vendorName).toBe("Empty Vendor");
    expect(result.products).toHaveLength(0);
  });

  it("非200レスポンス → エラーをthrowする", async () => {
    mockFetch.mockResolvedValueOnce(new Response("Not Found", { status: 404 }));

    await expect(fetchProductList("v999")).rejects.toThrow("MyJVN getProductList failed: 404");
  });

  it("pid または pname が空の製品をスキップする", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        [
          "<Response>",
          '  <Vendor vid="v001" vname="Test Vendor">',
          '    <Product pid="p001" pname="Valid Product" cpe="cpe:/a:test" />',
          '    <Product pid="" pname="No PID" cpe="" />',
          '    <Product pid="p003" pname="" cpe="" />',
          "  </Vendor>",
          "</Response>",
        ].join("\n"),
        { status: 200 },
      ),
    );

    const result = await fetchProductList("v001");
    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.pid).toBe("p001");
  });
});
