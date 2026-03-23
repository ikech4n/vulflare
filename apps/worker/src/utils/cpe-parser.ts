/**
 * CPE (Common Platform Enumeration) をパースしてベンダーと製品を抽出
 *
 * CPE 2.2 形式: cpe:/[part]:vendor:product:version:update:edition:language
 * CPE 2.3 形式: cpe:2.3:[part]:vendor:product:version:update:edition:language:sw_edition:target_sw:target_hw:other
 *
 * part: h (hardware), o (operating system), a (application)
 */

export interface ParsedCPE {
  vendor: string;
  product: string;
  part?: string;
  version?: string;
}

/**
 * CPE文字列をパース
 */
export function parseCPE(cpe: string): ParsedCPE | null {
  if (!cpe || typeof cpe !== "string") return null;

  // CPE 2.3 形式
  if (cpe.startsWith("cpe:2.3:")) {
    const parts = cpe.split(":");
    if (parts.length < 5) return null;

    const part = parts[2]; // h, o, a
    const vendor = decodeURIComponent(parts[3]?.replace(/\\:/g, ":") || "");
    const product = decodeURIComponent(parts[4]?.replace(/\\:/g, ":") || "");
    const version =
      parts[5] && parts[5] !== "*" ? decodeURIComponent(parts[5].replace(/\\:/g, ":")) : undefined;

    if (!vendor || vendor === "*" || !product || product === "*") return null;

    return { vendor, product, part, version } as ParsedCPE;
  }

  // CPE 2.2 形式
  if (cpe.startsWith("cpe:/")) {
    const withoutPrefix = cpe.substring(5); // "cpe:/"を削除
    const parts = withoutPrefix.split(":");
    if (parts.length < 3) return null;

    const part = parts[0]; // h, o, a
    const vendor = decodeURIComponent(parts[1]?.replace(/\\:/g, ":") || "");
    const product = decodeURIComponent(parts[2]?.replace(/\\:/g, ":") || "");
    const version =
      parts[3] && parts[3] !== "*" ? decodeURIComponent(parts[3].replace(/\\:/g, ":")) : undefined;

    if (!vendor || vendor === "*" || !product || product === "*") return null;

    return { vendor, product, part, version } as ParsedCPE;
  }

  return null;
}

/**
 * CPEのリストからユニークなベンダーと製品を抽出
 */
export function extractVendorsAndProducts(cpeList: string[]): {
  vendors: string[];
  products: string[];
} {
  const vendorsSet = new Set<string>();
  const productsSet = new Set<string>();

  for (const cpe of cpeList) {
    const parsed = parseCPE(cpe);
    if (!parsed) continue;

    // ベンダー名を正規化（アンダースコアをスペースに、先頭大文字に）
    const vendor = normalizeString(parsed.vendor);
    const product = normalizeString(parsed.product);

    if (vendor) vendorsSet.add(vendor);
    if (product) productsSet.add(product);
  }

  return {
    vendors: Array.from(vendorsSet).sort(),
    products: Array.from(productsSet).sort(),
  };
}

/**
 * 文字列を正規化（表示用）
 */
function normalizeString(str: string): string {
  if (!str) return "";

  // アンダースコアをスペースに変換
  let normalized = str.replace(/_/g, " ");

  // 各単語の先頭を大文字に（ただし、既に大文字が混在している場合はそのまま）
  if (normalized === normalized.toLowerCase()) {
    normalized = normalized
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  return normalized.trim();
}
