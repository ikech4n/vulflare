/**
 * MyJVN API クライアント
 * ベンダーリストと製品リストの取得機能を提供
 */

const MYJVN_BASE = 'https://jvndb.jvn.jp/myjvn';

export interface MyjvnVendor {
  vid: string;    // MyJVN vendor ID
  vname: string;  // ベンダー名
}

export interface MyjvnProduct {
  pid: string;    // MyJVN product ID
  pname: string;  // 製品名
  cpe: string;    // CPE文字列
}

/**
 * XML属性値を抽出するヘルパー関数
 */
function extractAttr(s: string, name: string): string {
  const match = s.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match?.[1] ?? '';
}

/**
 * HTMLエンティティをデコード
 */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * MyJVN API からベンダー一覧を取得
 * @param keyword - 検索キーワード（オプション）。指定するとベンダー名でフィルタリングされる
 * @returns ベンダーオブジェクトの配列
 */
export async function fetchVendorList(keyword?: string): Promise<MyjvnVendor[]> {
  const params = new URLSearchParams({
    method: 'getVendorList',
    feed: 'hnd',
  });

  // keywordが指定されている場合は追加（空文字列の場合は追加しない）
  if (keyword && keyword.trim()) {
    params.set('keyword', keyword.trim());
  }

  const res = await fetch(`${MYJVN_BASE}?${params}`);
  if (!res.ok) {
    throw new Error(`MyJVN getVendorList failed: ${res.status} ${await res.text()}`);
  }

  const xml = await res.text();

  // <Vendor vid="..." vname="..." /> 形式の要素をパース
  const vendors: MyjvnVendor[] = [];
  const vendorRegex = /<Vendor\s+([^>]+?)\s*\/>/g;
  let match;

  while ((match = vendorRegex.exec(xml)) !== null) {
    const attrs = match[1] ?? '';
    const vid = extractAttr(attrs, 'vid');
    const vname = decodeEntities(extractAttr(attrs, 'vname'));

    if (vid && vname) {
      vendors.push({ vid, vname });
    }
  }

  return vendors;
}

/**
 * MyJVN API から指定ベンダーの製品一覧を取得
 * @param vendorId - ベンダーID (vid)
 * @returns 製品オブジェクトの配列
 */
export async function fetchProductList(vendorId: string): Promise<MyjvnProduct[]> {
  const params = new URLSearchParams({
    method: 'getProductList',
    feed: 'hnd',
    vendorId,
  });

  const res = await fetch(`${MYJVN_BASE}?${params}`);
  if (!res.ok) {
    throw new Error(`MyJVN getProductList failed: ${res.status} ${await res.text()}`);
  }

  const xml = await res.text();

  // <Product pid="..." pname="..." cpe="..." /> 形式の要素をパース
  const products: MyjvnProduct[] = [];
  const productRegex = /<Product\s+([^>]+?)\s*\/>/g;
  let match;

  while ((match = productRegex.exec(xml)) !== null) {
    const attrs = match[1] ?? '';
    const pid = extractAttr(attrs, 'pid');
    const pname = decodeEntities(extractAttr(attrs, 'pname'));
    const cpe = extractAttr(attrs, 'cpe');

    if (pid && pname) {
      products.push({ pid, pname, cpe: cpe || '' });
    }
  }

  return products;
}
