import { eolCycleRepo } from "../db/eol-repository.ts";
import { syncAllProducts } from "../services/eol-sync.ts";
import { dispatchNotification } from "../services/notifications.ts";
import type { Env } from "../types.ts";

// 通知を送るマイルストーン（日前）
const EOL_MILESTONES = [180, 90, 30] as const;
// マイルストーンぴったりの日のみ通知
const MILESTONE_WINDOW_DAYS = 0;
// 重複チェック対象期間（日）
const DEDUP_WINDOW_DAYS = 7;

/**
 * 日次Cronで実行: 登録済みプロダクトのEOL情報を同期
 */
export async function handleEolSync(env: Env): Promise<void> {
  console.log("[EOL Sync] Starting daily EOL sync...");

  try {
    // 1. EOL情報の同期
    const result = await syncAllProducts(env);

    console.log(`[EOL Sync] Completed. Products: ${result.total}, Cycles synced: ${result.synced}`);

    if (result.failed.length > 0) {
      console.warn("[EOL Sync] Failed products:", result.failed);
    }

    // 2. EOL期限の確認と通知
    await checkEolDatesAndNotify(env);

    // 3. ハードウェア保守期限の確認と通知
    await checkHwSupportDatesAndNotify(env);
  } catch (err) {
    console.error("[EOL Sync] Fatal error:", err);
  }
}

/**
 * daysUntilEol が milestone ±MILESTONE_WINDOW_DAYS の範囲内かどうか判定
 */
function isAtMilestone(daysUntilEol: number, milestone: number): boolean {
  return Math.abs(daysUntilEol - milestone) <= MILESTONE_WINDOW_DAYS;
}

/**
 * EOL期限が近づいているサイクルをチェックして通知
 * 通知は 180日前 / 90日前 / 30日前 のマイルストーンのみ送信（重複チェックあり）
 */
async function checkEolDatesAndNotify(env: Env): Promise<void> {
  console.log("[EOL Check] Checking EOL dates for notifications...");

  try {
    const now = new Date();

    // 180日以内にEOLを迎えるサイクルを取得
    const approachingCycles = await env.DB.prepare(
      `SELECT c.*, p.display_name, p.product_name, p.category
       FROM eol_cycles c
       JOIN eol_products p ON c.product_id = p.id
       WHERE c.is_eol = 0
         AND c.eol_date IS NOT NULL
         AND c.eol_date > date('now')
         AND c.eol_date <= date('now', '+180 days')
       ORDER BY c.eol_date ASC`,
    ).all();

    // 既にEOL済みのサイクル（is_eolフラグが更新されていない可能性がある）
    const expiredCycles = await env.DB.prepare(
      `SELECT c.*, p.display_name, p.product_name, p.category
       FROM eol_cycles c
       JOIN eol_products p ON c.product_id = p.id
       WHERE c.eol_date IS NOT NULL
         AND c.eol_date < date('now')
         AND c.is_eol = 0`,
    ).all();

    // EOL期限が近いサイクルの通知（マイルストーンのみ）
    let notifiedCount = 0;
    for (const cycle of approachingCycles.results) {
      const eolDate = new Date(cycle.eol_date as string);
      const daysUntilEol = Math.ceil((eolDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

      // 最初にヒットしたマイルストーンのみ通知（複数同時ヒット時は上位を優先）
      for (const milestone of EOL_MILESTONES) {
        if (!isAtMilestone(daysUntilEol, milestone)) continue;

        // 重複チェック: 同サイクル×同マイルストーンの通知が直近7日以内に送信済みか
        const dedupResult = await env.DB.prepare(
          `SELECT COUNT(*) as cnt FROM notification_logs
           WHERE event_type = 'eol_approaching'
             AND json_extract(payload, '$.data.cycle_id') = ?
             AND json_extract(payload, '$.data.milestone_days') = ?
             AND status = 'sent'
             AND sent_at >= date('now', '-${DEDUP_WINDOW_DAYS} days')`,
        )
          .bind(cycle.id, milestone)
          .first<{ cnt: number }>();

        if (dedupResult && dedupResult.cnt > 0) {
          console.log(`[EOL Check] Skip duplicate: cycle=${cycle.id} milestone=${milestone}d`);
          break;
        }

        const severity = milestone === 30 ? "high" : milestone === 90 ? "medium" : "low";

        await dispatchNotification(env, "eol_approaching", {
          product_name: cycle.product_name,
          display_name: cycle.display_name,
          category: cycle.category,
          cycle: cycle.cycle,
          eol_date: cycle.eol_date,
          days_until_eol: daysUntilEol,
          cycle_id: cycle.id,
          milestone_days: milestone,
          severity,
        });
        notifiedCount++;
        break; // 1サイクルにつき1マイルストーンのみ通知
      }
    }

    // EOL期限切れサイクルの通知とフラグ更新
    for (const cycle of expiredCycles.results) {
      await dispatchNotification(env, "eol_expired", {
        product_name: cycle.product_name,
        display_name: cycle.display_name,
        category: cycle.category,
        cycle: cycle.cycle,
        eol_date: cycle.eol_date,
      });

      // is_eolフラグを更新
      await eolCycleRepo.update(env.DB, cycle.id as string, { is_eol: 1 });
    }

    console.log(
      `[EOL Check] Notified ${notifiedCount} milestone(s), ${expiredCycles.results.length} expired`,
    );
  } catch (err) {
    console.error("[EOL Check] Error checking EOL dates:", err);
  }
}

/**
 * ハードウェア保守期限が近づいている機器をチェックして通知
 */
async function checkHwSupportDatesAndNotify(env: Env): Promise<void> {
  console.log("[HW Support Check] Checking hardware support expiry dates...");

  try {
    const now = new Date();

    // 180日以内に保守期限を迎える稼働中・予備の機器
    const approachingAssets = await env.DB.prepare(
      `SELECT a.*, p.display_name as product_display_name, p.category
       FROM hardware_assets a
       JOIN eol_products p ON a.product_id = p.id
       WHERE a.support_expiry IS NOT NULL
         AND a.status != 'decommissioned'
         AND a.support_expiry > date('now')
         AND a.support_expiry <= date('now', '+180 days')
       ORDER BY a.support_expiry ASC`,
    ).all();

    // 期限切れ（まだ通知していない）
    const expiredAssets = await env.DB.prepare(
      `SELECT a.*, p.display_name as product_display_name, p.category
       FROM hardware_assets a
       JOIN eol_products p ON a.product_id = p.id
       WHERE a.support_expiry IS NOT NULL
         AND a.status != 'decommissioned'
         AND a.support_expiry < date('now')`,
    ).all();

    let notifiedCount = 0;
    for (const asset of approachingAssets.results) {
      const expiryDate = new Date(asset.support_expiry as string);
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
      );

      for (const milestone of EOL_MILESTONES) {
        if (!isAtMilestone(daysUntilExpiry, milestone)) continue;

        const dedupResult = await env.DB.prepare(
          `SELECT COUNT(*) as cnt FROM notification_logs
           WHERE event_type = 'hw_support_approaching'
             AND json_extract(payload, '$.data.asset_id') = ?
             AND json_extract(payload, '$.data.milestone_days') = ?
             AND status = 'sent'
             AND sent_at >= date('now', '-${DEDUP_WINDOW_DAYS} days')`,
        )
          .bind(asset.id, milestone)
          .first<{ cnt: number }>();

        if (dedupResult && dedupResult.cnt > 0) break;

        const severity = milestone === 30 ? "high" : milestone === 90 ? "medium" : "low";

        await dispatchNotification(env, "hw_support_approaching", {
          asset_id: asset.id,
          product_display_name: asset.product_display_name,
          category: asset.category,
          device_name: asset.device_name,
          identifier: asset.identifier,
          support_expiry: asset.support_expiry,
          days_until_expiry: daysUntilExpiry,
          milestone_days: milestone,
          severity,
        });
        notifiedCount++;
        break;
      }
    }

    // 期限切れ通知（重複チェックあり）
    let expiredCount = 0;
    for (const asset of expiredAssets.results) {
      const dedupResult = await env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM notification_logs
         WHERE event_type = 'hw_support_expired'
           AND json_extract(payload, '$.data.asset_id') = ?
           AND status = 'sent'
           AND sent_at >= date('now', '-${DEDUP_WINDOW_DAYS} days')`,
      )
        .bind(asset.id)
        .first<{ cnt: number }>();

      if (dedupResult && dedupResult.cnt > 0) continue;

      await dispatchNotification(env, "hw_support_expired", {
        asset_id: asset.id,
        product_display_name: asset.product_display_name,
        category: asset.category,
        device_name: asset.device_name,
        identifier: asset.identifier,
        support_expiry: asset.support_expiry,
      });
      expiredCount++;
    }

    console.log(
      `[HW Support Check] Notified ${notifiedCount} milestone(s), ${expiredCount} expired`,
    );
  } catch (err) {
    console.error("[HW Support Check] Error:", err);
  }
}
