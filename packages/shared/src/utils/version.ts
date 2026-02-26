/**
 * バージョン文字列をセグメント配列にパースする
 */
function parseVersion(version: string): (number | string)[] {
  return version
    .replace(/^[vV]/, '')
    .split(/[.\-+]/)
    .map((seg) => {
      const n = parseInt(seg, 10);
      return isNaN(n) ? seg : n;
    });
}

/**
 * 2つのバージョン文字列を比較する
 * @returns 負数(a < b)、0(a === b)、正数(a > b)
 */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i++) {
    const sa = pa[i] ?? 0;
    const sb = pb[i] ?? 0;

    if (typeof sa === 'number' && typeof sb === 'number') {
      if (sa !== sb) return sa - sb;
    } else {
      const cmp = String(sa).localeCompare(String(sb));
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}

export interface VersionRange {
  introduced?: string;
  fixed?: string;
  lastAffected?: string;
}

/**
 * バージョンが影響範囲内かどうかを判定する
 * OSVのaffected rangesフォーマットに対応
 */
export function isVersionAffected(version: string, ranges: VersionRange[]): boolean {
  if (ranges.length === 0) return false;

  for (const range of ranges) {
    const afterIntroduced = !range.introduced || compareVersions(version, range.introduced) >= 0;
    let beforeFixed = true;
    if (range.fixed) {
      beforeFixed = compareVersions(version, range.fixed) < 0;
    } else if (range.lastAffected) {
      beforeFixed = compareVersions(version, range.lastAffected) <= 0;
    }
    if (afterIntroduced && beforeFixed) return true;
  }
  return false;
}
