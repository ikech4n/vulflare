import type { AuditEcosystem, AuditLockfileType } from "@vulflare/shared/types";

export interface ParsedPackage {
  name: string;
  version: string;
}

/**
 * package-lock.json (npm v2/v3) をパース
 */
export function parsePackageLockJson(content: string): ParsedPackage[] {
  const data = JSON.parse(content) as Record<string, unknown>;
  const packages = data.packages as Record<string, { version?: string; dev?: boolean }> | undefined;
  if (!packages) return [];

  const result: ParsedPackage[] = [];
  for (const [key, pkg] of Object.entries(packages)) {
    if (!key || key === "") continue; // root package
    const name = key.startsWith("node_modules/") ? key.slice("node_modules/".length) : key;
    // handle scoped packages with nested node_modules
    const finalName = name.includes("node_modules/")
      ? name.slice(name.lastIndexOf("node_modules/") + "node_modules/".length)
      : name;
    if (pkg.version) {
      result.push({ name: finalName, version: pkg.version });
    }
  }
  return result;
}

/**
 * pnpm-lock.yaml をパース（正規表現ベース）
 * pnpm-lock.yaml v6+ の形式:
 *   packages:
 *     /lodash@4.17.21:
 *       ...
 * または
 *     lodash@4.17.21:
 */
export function parsePnpmLockYaml(content: string): ParsedPackage[] {
  const result: ParsedPackage[] = [];
  const lines = content.split("\n");

  let inPackagesSection = false;
  // Match package entries like "/lodash@4.17.21:" or "lodash@4.17.21:" (2-space indented)
  const packageLineRe = /^ {2}(?:\/)?(@?[^@/\s][^@\s]*)@([^\s:]+):?\s*$/;

  for (const line of lines) {
    if (line.startsWith("packages:")) {
      inPackagesSection = true;
      continue;
    }
    // New top-level section
    if (inPackagesSection && /^\S/.test(line) && !line.startsWith("packages:")) {
      inPackagesSection = false;
    }
    if (!inPackagesSection) continue;

    const match = packageLineRe.exec(line);
    if (match) {
      const name = match[1];
      const version = match[2];
      if (name && version) {
        result.push({ name, version });
      }
    }
  }
  return result;
}

/**
 * yarn.lock (v1) をパース
 */
export function parseYarnLock(content: string): ParsedPackage[] {
  const result: ParsedPackage[] = [];
  const lines = content.split("\n");

  // yarn.lock v1 format:
  // "lodash@^4.17.0":
  //   version "4.17.21"
  const nameRe = /^"?(@?[^@"\s]+)@/;
  const versionRe = /^\s+version\s+"([^"]+)"/;

  let currentName: string | null = null;
  for (const line of lines) {
    if (line.startsWith("#") || line.trim() === "") continue;

    const nameMatch = nameRe.exec(line);
    if (nameMatch && !line.startsWith(" ")) {
      // Extract just the first name (multiple aliases separated by ", ")
      currentName = nameMatch[1] ?? null;
      continue;
    }

    if (currentName) {
      const versionMatch = versionRe.exec(line);
      if (versionMatch?.[1]) {
        result.push({ name: currentName, version: versionMatch[1] });
        currentName = null;
      }
    }
  }
  return result;
}

/**
 * composer.lock をパース
 */
export function parseComposerLock(content: string): ParsedPackage[] {
  const data = JSON.parse(content) as {
    packages?: Array<{ name: string; version: string }>;
    "packages-dev"?: Array<{ name: string; version: string }>;
  };

  const pkgs = [...(data.packages ?? []), ...(data["packages-dev"] ?? [])];

  return pkgs
    .filter((p) => p.name && p.version)
    .map((p) => ({
      name: p.name,
      version: p.version.replace(/^v/, ""), // strip leading "v"
    }));
}

/**
 * ファイル名からlockfileタイプとecosystemを判定
 */
export function detectLockfileType(filename: string): {
  lockfileType: AuditLockfileType;
  ecosystem: AuditEcosystem;
} | null {
  const base = filename.split("/").pop() ?? filename;
  if (base === "package-lock.json") return { lockfileType: "package-lock.json", ecosystem: "npm" };
  if (base === "pnpm-lock.yaml") return { lockfileType: "pnpm-lock.yaml", ecosystem: "npm" };
  if (base === "yarn.lock") return { lockfileType: "yarn.lock", ecosystem: "npm" };
  if (base === "composer.lock") return { lockfileType: "composer.lock", ecosystem: "Packagist" };
  return null;
}

/**
 * lockfile内容をパースして packages 配列を返す
 */
export function parseLockfile(content: string, lockfileType: AuditLockfileType): ParsedPackage[] {
  switch (lockfileType) {
    case "package-lock.json":
      return parsePackageLockJson(content);
    case "pnpm-lock.yaml":
      return parsePnpmLockYaml(content);
    case "yarn.lock":
      return parseYarnLock(content);
    case "composer.lock":
      return parseComposerLock(content);
  }
}
