import { cvssScoreToSeverity } from "@vulflare/shared/utils";
import { dispatchNotification } from "../services/notifications.ts";
import {
  getSyncSettings,
  shouldExcludeByCvss,
  shouldExcludeByKeywords,
} from "../services/sync-settings.ts";
import type { Env } from "../types.ts";
import { extractVendorsAndProducts } from "../utils/cpe-parser.ts";

const JVN_API_BASE = "https://jvndb.jvn.jp/myjvn";
const MAX_ITEMS_PER_PAGE = 50;

interface JvnEntry {
  jvnId: string;
  title: string;
  summary: string;
  published: string;
  updated: string;
  link: string;
  cveIds: string[];
  cvssV2: { score: number; vector: string } | undefined;
  cvssV3: { score: number; vector: string } | undefined;
  cpeList: string[];
}

interface JvnApiStatus {
  totalRes: number;
  totalResRet: number;
  firstRes: number;
  retCd: string;
}

function extractAttr(s: string, name: string): string {
  const match = s.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match?.[1] ?? "";
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseStatus(xml: string): JvnApiStatus {
  const match = xml.match(/<(?:\w+:)?Status\s+([^>]+?)(?:\s*\/>|>)/);
  if (!match) return { totalRes: 0, totalResRet: 0, firstRes: 1, retCd: "-1" };
  const attrs = match[1] ?? "";
  return {
    totalRes: Number.parseInt(extractAttr(attrs, "totalRes") || "0"),
    totalResRet: Number.parseInt(extractAttr(attrs, "totalResRet") || "0"),
    firstRes: Number.parseInt(extractAttr(attrs, "firstRes") || "1"),
    retCd: extractAttr(attrs, "retCd"),
  };
}

function parseEntry(itemXml: string): JvnEntry | null {
  // <sec:identifier> から JVNDB ID を抽出
  const jvnIdMatch = itemXml.match(/<sec:identifier>([^<]*)<\/sec:identifier>/);
  if (!jvnIdMatch) return null;
  const jvnId = jvnIdMatch[1]?.trim() ?? "";

  const titleMatch = itemXml.match(/<title>([^<]*)<\/title>/);
  const title = titleMatch?.[1] ? decodeEntities(titleMatch[1].trim()) : jvnId;

  const descMatch = itemXml.match(/<description>([\s\S]*?)<\/description>/);
  const summary = descMatch?.[1] ? decodeEntities(descMatch[1].trim().replace(/<[^>]+>/g, "")) : "";

  const issuedMatch = itemXml.match(/<dcterms:issued>([^<]*)<\/dcterms:issued>/);
  const modifiedMatch = itemXml.match(/<dcterms:modified>([^<]*)<\/dcterms:modified>/);
  const published = issuedMatch?.[1]?.trim() ?? "";
  const updated = modifiedMatch?.[1]?.trim() ?? "";

  const linkMatch = itemXml.match(/<link>([^<]*)<\/link>/);
  const link = linkMatch?.[1]?.trim() ?? "";

  // CVE 識別子 (sec:references で source="CVE")
  const cveIds: string[] = [];
  for (const cveMatch of itemXml.matchAll(/<sec:references\s+source="CVE"\s+id="([^"]*)"/g)) {
    const val = (cveMatch[1] ?? "").trim();
    if (val.startsWith("CVE-")) cveIds.push(val);
  }

  // CVSS スコア
  let cvssV2: { score: number; vector: string } | undefined;
  let cvssV3: { score: number; vector: string } | undefined;
  for (const cvssMatch of itemXml.matchAll(/<sec:cvss\s+([^>]+?)(?:\s*\/>|>)/g)) {
    const attrs = cvssMatch[1] ?? "";
    const version = extractAttr(attrs, "version");
    const score = Number.parseFloat(extractAttr(attrs, "score") || "0");
    const vector = extractAttr(attrs, "vector");
    if (version === "2.0") {
      cvssV2 = { score, vector };
    } else if (version.startsWith("3")) {
      cvssV3 = { score, vector };
    }
  }

  // CPE (影響を受ける製品)
  const cpeList: string[] = [];
  for (const cpeMatch of itemXml.matchAll(/<sec:cpe[^>]*>([^<]*)<\/sec:cpe>/g)) {
    const cpe = (cpeMatch[1] ?? "").trim();
    if (cpe) cpeList.push(cpe);
  }

  return { jvnId, title, summary, published, updated, link, cveIds, cvssV2, cvssV3, cpeList };
}

function parseEntries(xml: string): JvnEntry[] {
  const entries: JvnEntry[] = [];
  for (const match of xml.matchAll(/<item\s+rdf:about="[^"]*">([\s\S]*?)<\/item>/g)) {
    const entry = parseEntry(match[1] ?? "");
    if (entry) entries.push(entry);
  }
  return entries;
}

function buildUpsertStmt(db: D1Database, entry: JvnEntry) {
  // CVE ID があればそれを使用、なければ JVNDB ID を使用
  const cveId = entry.cveIds[0] ?? entry.jvnId;
  const score = entry.cvssV3?.score ?? entry.cvssV2?.score ?? 0;
  const severity = cvssScoreToSeverity(score);

  // 参照情報: JVN ページリンク + 2つ目以降の CVE ID
  const refs = JSON.stringify([
    ...(entry.link ? [{ url: entry.link, source: "JVN iPedia" }] : []),
    ...entry.cveIds.slice(1).map((cid) => ({
      url: `https://cve.mitre.org/cgi-bin/cvename.cgi?name=${cid}`,
      source: cid,
    })),
  ]);

  const affectedProducts = JSON.stringify(entry.cpeList);

  return db
    .prepare(`
    INSERT INTO vulnerabilities
      (id, cve_id, title, description, severity, cvss_v3_score, cvss_v3_vector,
       cvss_v2_score, cvss_v2_vector, cwe_ids, affected_products, vuln_references,
       published_at, modified_at, source)
    VALUES (?,?,?,?,?,?,?,?,?,'[]',?,?,?,?,'jvn')
    ON CONFLICT(cve_id) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      severity = excluded.severity,
      cvss_v3_score = excluded.cvss_v3_score,
      cvss_v3_vector = excluded.cvss_v3_vector,
      cvss_v2_score = excluded.cvss_v2_score,
      cvss_v2_vector = excluded.cvss_v2_vector,
      affected_products = excluded.affected_products,
      vuln_references = excluded.vuln_references,
      modified_at = excluded.modified_at,
      updated_at = datetime('now', '+9 hours')
    WHERE vulnerabilities.source = 'jvn'
  `)
    .bind(
      crypto.randomUUID(),
      cveId,
      entry.title,
      entry.summary,
      severity,
      entry.cvssV3?.score ?? null,
      entry.cvssV3?.vector ?? null,
      entry.cvssV2?.score ?? null,
      entry.cvssV2?.vector ?? null,
      affectedProducts,
      refs,
      entry.published || null,
      entry.updated || null,
    );
}

async function fetchAndUpsertJvn(
  env: Env,
  baseParams: URLSearchParams,
  seenIds: Set<string>,
  excludeKeywords: string[],
  cvssMinScore: number,
): Promise<{ fetched: number; changed: number; cancelled: boolean }> {
  let startItem = 1;
  let totalResults = Number.POSITIVE_INFINITY;
  let totalFetched = 0;
  let totalChanged = 0;

  while (startItem <= totalResults) {
    // キャンセルフラグを確認
    const cancelFlag = await env.VULFLARE_KV_CACHE.get("jvn:cancel_requested");
    if (cancelFlag) {
      await env.VULFLARE_KV_CACHE.delete("jvn:cancel_requested");
      return { fetched: totalFetched, changed: totalChanged, cancelled: true };
    }

    const params = new URLSearchParams(baseParams);
    params.set("startItem", String(startItem));

    const res = await fetch(`${JVN_API_BASE}?${params}`);
    if (!res.ok) throw new Error(`JVN API ${res.status}: ${await res.text()}`);

    const xml = await res.text();
    const status = parseStatus(xml);

    if (status.retCd !== "0") {
      throw new Error(`JVN API error: retCd=${status.retCd}`);
    }

    if (totalResults === Number.POSITIVE_INFINITY) {
      totalResults = status.totalRes;
    }

    const entries = parseEntries(xml);

    // 除外キーワードとCVSS閾値でフィルタリング
    const filteredEntries = entries.filter((entry) => {
      if (shouldExcludeByKeywords(entry.title, entry.summary, excludeKeywords)) return false;
      if (shouldExcludeByCvss(entry.cvssV3?.score, entry.cvssV2?.score, cvssMinScore)) return false;
      return true;
    });

    // 複数キーワード間での重複を除去
    const newEntries = filteredEntries.filter((entry) => {
      const id = entry.cveIds[0] ?? entry.jvnId;
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    totalFetched += newEntries.length;

    if (newEntries.length > 0) {
      const stmts = newEntries.map((entry) => buildUpsertStmt(env.DB, entry));
      for (let i = 0; i < stmts.length; i += 50) {
        const results = await env.DB.batch(stmts.slice(i, i + 50));
        totalChanged += results.filter((r) => (r.meta.changes ?? 0) > 0).length;
      }
    }

    startItem += MAX_ITEMS_PER_PAGE;

    if (entries.length < MAX_ITEMS_PER_PAGE) break;

    // JVN サーバーへの負荷軽減
    await new Promise((r) => setTimeout(r, 1000));
  }

  return { fetched: totalFetched, changed: totalChanged, cancelled: false };
}

/**
 * JVNの脆弱性データからベンダーと製品を抽出してマスターテーブルに保存
 */
async function updateVendorsAndProducts(env: Env): Promise<void> {
  try {
    // JVN由来の脆弱性から affected_products (CPE) を取得
    const rows = await env.DB.prepare(`
      SELECT affected_products
      FROM vulnerabilities
      WHERE source = 'jvn'
        AND affected_products != '[]'
    `).all<{ affected_products: string }>();

    console.log(`Found ${rows.results.length} JVN vulnerabilities with CPE data`);

    // 全てのCPEを集約
    const allCpes: string[] = [];
    for (const row of rows.results) {
      try {
        const cpes = JSON.parse(row.affected_products) as string[];
        allCpes.push(...cpes);
      } catch (err) {
        console.error("Failed to parse affected_products:", err);
      }
    }

    console.log(`Total CPE entries: ${allCpes.length}`);

    // ベンダーと製品を抽出
    const { vendors, products } = extractVendorsAndProducts(allCpes);

    console.log(`Extracted ${vendors.length} vendors and ${products.length} products`);

    // ベンダーを保存
    if (vendors.length > 0) {
      const vendorStmts = vendors.map((vendor) =>
        env.DB.prepare(
          `INSERT INTO jvn_vendors (name, updated_at) VALUES (?, datetime('now', '+9 hours'))
           ON CONFLICT(name) DO UPDATE SET updated_at = datetime('now', '+9 hours')`,
        ).bind(vendor),
      );

      // バッチで実行（50件ずつ）
      for (let i = 0; i < vendorStmts.length; i += 50) {
        await env.DB.batch(vendorStmts.slice(i, i + 50));
      }

      console.log(`Saved ${vendors.length} vendors`);
    }

    // 製品を保存
    if (products.length > 0) {
      const productStmts = products.map((product) =>
        env.DB.prepare(
          `INSERT INTO jvn_products (name, updated_at) VALUES (?, datetime('now', '+9 hours'))
           ON CONFLICT(name) DO UPDATE SET updated_at = datetime('now', '+9 hours')`,
        ).bind(product),
      );

      // バッチで実行（50件ずつ）
      for (let i = 0; i < productStmts.length; i += 50) {
        await env.DB.batch(productStmts.slice(i, i + 50));
      }

      console.log(`Saved ${products.length} products`);
    }
  } catch (error) {
    console.error("Failed to update vendors and products:", error);
    // エラーが発生しても同期処理全体は失敗させない
  }
}

export async function handleJvnSync(env: Env, forceFullSync = false): Promise<void> {
  const settings = await getSyncSettings(env);
  const lastSyncDate = await env.VULFLARE_KV_CACHE.get("jvn:last_sync_date");
  const isFullSync = !lastSyncDate || forceFullSync;
  const syncLogId = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO jvn_sync_logs (id, sync_type, status, started_at) VALUES (?, ?, 'running', datetime('now', '+9 hours'))`,
  )
    .bind(syncLogId, isFullSync ? "full" : "incremental")
    .run();

  let totalFetched = 0;
  let totalChanged = 0;
  const now = new Date();
  // sync開始時刻（UTC）: 新規作成と更新の区別に使用
  const syncStartUtcStr = now.toISOString();
  // JSTに変換 (UTC+9) - ログ表示とKV保存用
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const nowStr = jstNow.toISOString();

  try {
    // 初回同期: 公開日ベースで fullSyncDays 期間のデータを取得
    // 増分同期: 更新日ベースで前回同期以降のデータを取得
    const startDate = isFullSync
      ? new Date(
          Date.now() -
            (settings.fullSyncDays > 0 ? settings.fullSyncDays : 3650) * 24 * 60 * 60 * 1000,
        )
      : new Date(lastSyncDate ?? "");

    const baseParams = new URLSearchParams({
      method: "getVulnOverviewList",
      feed: "hnd",
      lang: "ja",
      maxCountItem: String(MAX_ITEMS_PER_PAGE),
      rangeDatePublic: "n",
      rangeDatePublished: "n",
      rangeDateFirstPublished: "n",
    });

    // 初回同期: 公開日（datePublic）で期間指定
    // 増分同期: 更新日（datePublished）で前回同期以降を指定
    if (isFullSync) {
      baseParams.set("datePublicStartY", String(startDate.getFullYear()));
      baseParams.set("datePublicStartM", String(startDate.getMonth() + 1).padStart(2, "0"));
      baseParams.set("datePublicStartD", String(startDate.getDate()).padStart(2, "0"));
      baseParams.set("datePublicEndY", String(now.getFullYear()));
      baseParams.set("datePublicEndM", String(now.getMonth() + 1).padStart(2, "0"));
      baseParams.set("datePublicEndD", String(now.getDate()).padStart(2, "0"));
    } else {
      baseParams.set("datePublishedStartY", String(startDate.getFullYear()));
      baseParams.set("datePublishedStartM", String(startDate.getMonth() + 1).padStart(2, "0"));
      baseParams.set("datePublishedStartD", String(startDate.getDate()).padStart(2, "0"));
      baseParams.set("datePublishedEndY", String(now.getFullYear()));
      baseParams.set("datePublishedEndM", String(now.getMonth() + 1).padStart(2, "0"));
      baseParams.set("datePublishedEndD", String(now.getDate()).padStart(2, "0"));
    }

    console.log(
      `JVN sync type: ${isFullSync ? "FULL (datePublic)" : "INCREMENTAL (datePublished)"}`,
    );
    console.log(`JVN sync params: ${baseParams.toString()}`);
    // JSTに変換して表示 (UTC+9)
    const jstStartDate = new Date(startDate.getTime() + 9 * 60 * 60 * 1000);
    console.log(
      `Date range: ${jstStartDate.toISOString().replace("Z", "+09:00")} to ${jstNow.toISOString().replace("Z", "+09:00")}`,
    );
    console.log(
      `Vendor selections: ${settings.vendorSelections.length}, Keywords: ${settings.keywords.length}, CVSS min: ${settings.cvssMinScore}`,
    );

    const seenIds = new Set<string>();

    let cancelled = false;

    // === PHASE 1: ベンダー/製品フィルター ===
    if (!cancelled && settings.vendorSelections.length > 0) {
      console.log(`JVN Phase 1: Querying ${settings.vendorSelections.length} selected vendors`);
      for (const vendor of settings.vendorSelections) {
        const cancelCheck = await env.VULFLARE_KV_CACHE.get("jvn:cancel_requested");
        if (cancelCheck) {
          cancelled = true;
          break;
        }

        if (vendor.products.length > 0) {
          // 特定製品が選択されている場合: productId を使用（複数製品は「+」で連結）
          const productIds = vendor.products.map((p) => p.productId).join("+");
          console.log(
            `  Vendor ${vendor.vendorName}: querying ${vendor.products.length} specific products (productId=${productIds})`,
          );
          const params = new URLSearchParams(baseParams);
          params.set("productId", productIds);
          const result = await fetchAndUpsertJvn(
            env,
            params,
            seenIds,
            settings.excludeKeywords,
            settings.cvssMinScore,
          );
          totalFetched += result.fetched;
          totalChanged += result.changed;
          if (result.cancelled) {
            cancelled = true;
          }
        } else {
          // 製品未選択の場合: vendorId を使用
          console.log(
            `  Vendor ${vendor.vendorName}: querying all products (vendorId=${vendor.vendorId})`,
          );
          const params = new URLSearchParams(baseParams);
          params.set("vendorId", vendor.vendorId);
          const result = await fetchAndUpsertJvn(
            env,
            params,
            seenIds,
            settings.excludeKeywords,
            settings.cvssMinScore,
          );
          totalFetched += result.fetched;
          totalChanged += result.changed;
          if (result.cancelled) {
            cancelled = true;
          }
        }
      }
    }

    // === PHASE 2: キーワード検索 ===
    if (!cancelled && settings.keywords.length > 0) {
      console.log(`JVN Phase 2: Querying ${settings.keywords.length} keywords`);
      for (const keyword of settings.keywords) {
        const cancelCheck = await env.VULFLARE_KV_CACHE.get("jvn:cancel_requested");
        if (cancelCheck) {
          cancelled = true;
          break;
        }

        const params = new URLSearchParams(baseParams);
        params.set("keyword", keyword);
        const result = await fetchAndUpsertJvn(
          env,
          params,
          seenIds,
          settings.excludeKeywords,
          settings.cvssMinScore,
        );
        totalFetched += result.fetched;
        totalChanged += result.changed;
        if (result.cancelled) {
          cancelled = true;
          break;
        }
      }
    }

    if (!cancelled) {
      await env.VULFLARE_KV_CACHE.put("jvn:last_sync_date", nowStr, {
        expirationTtl: 90 * 24 * 60 * 60,
      });

      // 古いデータを削除（retentionDaysが設定されている場合のみ、公開日ベース）
      if (settings.retentionDays > 0) {
        const cutoffDate = new Date(
          Date.now() - settings.retentionDays * 24 * 60 * 60 * 1000,
        ).toISOString();
        const deleteResult = await env.DB.prepare(
          `DELETE FROM vulnerabilities WHERE source = 'jvn' AND published_at < ?`,
        )
          .bind(cutoffDate)
          .run();
        const deletedCount = deleteResult.meta.changes ?? 0;
        if (deletedCount > 0) {
          console.log(
            `JVN sync: deleted ${deletedCount} old records (published before ${cutoffDate})`,
          );
        }
      }

      // ベンダーと製品のリストを更新
      console.log("Updating vendors and products from CPE data...");
      await updateVendorsAndProducts(env);
    }

    // 新規作成数をUTC基準でクエリ（created_atはdatetime('now')=UTC）
    const newlyCreatedRow = await env.DB.prepare(`
      SELECT COUNT(*) as total FROM vulnerabilities
      WHERE source = 'jvn' AND created_at >= ?
    `)
      .bind(syncStartUtcStr)
      .first<{ total: number }>();
    const totalNewlyCreated = newlyCreatedRow?.total ?? 0;
    const totalUpdated = totalChanged - totalNewlyCreated;

    await env.DB.prepare(
      `UPDATE jvn_sync_logs SET status=?, completed_at=datetime('now', '+9 hours'),
       total_fetched=?, total_created=? WHERE id=?`,
    )
      .bind(cancelled ? "cancelled" : "completed", totalFetched, totalChanged, syncLogId)
      .run();

    console.log(
      `JVN sync done: fetched=${totalFetched}, created=${totalNewlyCreated}, updated=${totalUpdated}`,
    );

    if (!cancelled) {
      // 新規作成された脆弱性がある場合は通知
      if (totalNewlyCreated > 0) {
        // 同期開始時刻以降に作成されたCritical脆弱性を集計（UTC基準）
        const criticalRows = await env.DB.prepare(`
          SELECT cve_id FROM vulnerabilities
          WHERE source = 'jvn' AND severity = 'critical'
            AND created_at >= ?
        `)
          .bind(syncStartUtcStr)
          .all<{ cve_id: string }>();

        const criticalCount = criticalRows.results.length;
        const criticalCveIds = criticalRows.results.map((r) => r.cve_id);

        await dispatchNotification(env, "vulnerability_created", {
          source: "jvn",
          created_count: totalNewlyCreated,
          critical_count: criticalCount,
        });

        if (criticalCount > 0) {
          await dispatchNotification(env, "vulnerability_critical", {
            source: "jvn",
            critical_count: criticalCount,
            cve_ids: criticalCveIds,
          });
        }
      }

      // 既存脆弱性がJVNで更新された場合は通知
      if (totalUpdated > 0) {
        await dispatchNotification(env, "vulnerability_updated", {
          source: "jvn",
          updated_count: totalUpdated,
        });
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await env.DB.prepare(
      `UPDATE jvn_sync_logs SET status='failed', completed_at=datetime('now', '+9 hours'), error_message=? WHERE id=?`,
    )
      .bind(msg, syncLogId)
      .run();
    console.error("JVN sync failed:", msg);
  }
}
