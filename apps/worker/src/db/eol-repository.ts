import type { EolCycle, EolProduct, EolSyncLog } from "@vulflare/shared/types";

type DB = D1Database;

// --- EOL Products ---

export const eolProductRepo = {
  async list(
    db: DB,
    filters?: { category?: string; status?: "eol" | "approaching_30d" | "approaching_90d" },
  ): Promise<EolProduct[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.category) {
      conditions.push("p.category = ?");
      params.push(filters.category);
    }

    if (filters?.status === "eol") {
      conditions.push(
        "EXISTS (SELECT 1 FROM eol_cycles c WHERE c.product_id = p.id AND c.is_eol = 1)",
      );
    } else if (filters?.status === "approaching_30d") {
      conditions.push(
        `EXISTS (SELECT 1 FROM eol_cycles c WHERE c.product_id = p.id
          AND c.is_eol = 0 AND c.eol_date IS NOT NULL
          AND c.eol_date > date('now') AND c.eol_date <= date('now', '+30 days'))`,
      );
    } else if (filters?.status === "approaching_90d") {
      conditions.push(
        `EXISTS (SELECT 1 FROM eol_cycles c WHERE c.product_id = p.id
          AND c.is_eol = 0 AND c.eol_date IS NOT NULL
          AND c.eol_date > date('now') AND c.eol_date <= date('now', '+90 days'))`,
      );
    }

    let sql = "SELECT p.* FROM eol_products p";
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }
    sql += " ORDER BY p.display_name ASC";

    const result = await db
      .prepare(sql)
      .bind(...params)
      .all();
    return result.results as unknown as EolProduct[];
  },

  async findById(db: DB, id: string): Promise<EolProduct | null> {
    const result = await db.prepare("SELECT * FROM eol_products WHERE id = ?").bind(id).first();
    return result as EolProduct | null;
  },

  async findByProductName(db: DB, productName: string): Promise<EolProduct | null> {
    const result = await db
      .prepare("SELECT * FROM eol_products WHERE product_name = ?")
      .bind(productName)
      .first();
    return result as EolProduct | null;
  },

  async create(db: DB, product: Omit<EolProduct, "created_at" | "updated_at">): Promise<void> {
    await db
      .prepare(
        `INSERT INTO eol_products
         (id, product_name, display_name, category, eol_api_id, vendor, link)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        product.id,
        product.product_name,
        product.display_name,
        product.category,
        product.eol_api_id,
        product.vendor,
        product.link,
      )
      .run();
  },

  async update(
    db: DB,
    id: string,
    fields: Partial<
      Pick<EolProduct, "display_name" | "category" | "vendor" | "link" | "eol_api_id">
    >,
  ): Promise<void> {
    const sets: string[] = ["updated_at = datetime('now')"];
    const params: unknown[] = [];

    for (const [k, v] of Object.entries(fields)) {
      sets.push(`${k} = ?`);
      params.push(v);
    }
    params.push(id);

    await db
      .prepare(`UPDATE eol_products SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();
  },

  async delete(db: DB, id: string): Promise<void> {
    await db.prepare("DELETE FROM eol_products WHERE id = ?").bind(id).run();
  },

  async listWithApiId(db: DB): Promise<EolProduct[]> {
    const result = await db
      .prepare("SELECT * FROM eol_products WHERE eol_api_id IS NOT NULL ORDER BY product_name ASC")
      .all();
    return result.results as unknown as EolProduct[];
  },
};

// --- EOL Cycles ---

export const eolCycleRepo = {
  async listByProduct(db: DB, productId: string): Promise<EolCycle[]> {
    const result = await db
      .prepare(
        "SELECT * FROM eol_cycles WHERE product_id = ? ORDER BY release_date DESC, cycle DESC",
      )
      .bind(productId)
      .all();
    return result.results as unknown as EolCycle[];
  },

  async findById(db: DB, id: string): Promise<EolCycle | null> {
    const result = await db.prepare("SELECT * FROM eol_cycles WHERE id = ?").bind(id).first();
    return result as EolCycle | null;
  },

  async findByProductAndCycle(db: DB, productId: string, cycle: string): Promise<EolCycle | null> {
    const result = await db
      .prepare("SELECT * FROM eol_cycles WHERE product_id = ? AND cycle = ?")
      .bind(productId, cycle)
      .first();
    return result as EolCycle | null;
  },

  async create(db: DB, cycle: Omit<EolCycle, "created_at" | "updated_at">): Promise<void> {
    await db
      .prepare(
        `INSERT INTO eol_cycles
         (id, product_id, cycle, codename, release_date, eol_date, support_date,
          extended_support_date, lts, lts_date, latest_version, latest_release_date,
          is_eol, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        cycle.id,
        cycle.product_id,
        cycle.cycle,
        cycle.codename,
        cycle.release_date,
        cycle.eol_date,
        cycle.support_date,
        cycle.extended_support_date,
        cycle.lts,
        cycle.lts_date,
        cycle.latest_version,
        cycle.latest_release_date,
        cycle.is_eol,
        cycle.source,
      )
      .run();
  },

  async update(
    db: DB,
    id: string,
    fields: Partial<Omit<EolCycle, "id" | "product_id" | "created_at" | "updated_at">>,
  ): Promise<void> {
    const sets: string[] = ["updated_at = datetime('now')"];
    const params: unknown[] = [];

    for (const [k, v] of Object.entries(fields)) {
      sets.push(`${k} = ?`);
      params.push(v);
    }
    params.push(id);

    await db
      .prepare(`UPDATE eol_cycles SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();
  },

  async upsert(db: DB, cycle: Omit<EolCycle, "created_at" | "updated_at">): Promise<void> {
    await db
      .prepare(
        `INSERT INTO eol_cycles
         (id, product_id, cycle, codename, release_date, eol_date, support_date,
          extended_support_date, lts, lts_date, latest_version, latest_release_date,
          is_eol, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(product_id, cycle) DO UPDATE SET
           codename = excluded.codename,
           release_date = excluded.release_date,
           eol_date = excluded.eol_date,
           support_date = excluded.support_date,
           extended_support_date = excluded.extended_support_date,
           lts = excluded.lts,
           lts_date = excluded.lts_date,
           latest_version = excluded.latest_version,
           latest_release_date = excluded.latest_release_date,
           is_eol = excluded.is_eol,
           source = excluded.source,
           updated_at = datetime('now')`,
      )
      .bind(
        cycle.id,
        cycle.product_id,
        cycle.cycle,
        cycle.codename,
        cycle.release_date,
        cycle.eol_date,
        cycle.support_date,
        cycle.extended_support_date,
        cycle.lts,
        cycle.lts_date,
        cycle.latest_version,
        cycle.latest_release_date,
        cycle.is_eol,
        cycle.source,
      )
      .run();
  },

  async delete(db: DB, id: string): Promise<void> {
    await db.prepare("DELETE FROM eol_cycles WHERE id = ?").bind(id).run();
  },

  async countEol(db: DB): Promise<number> {
    const result = await db
      .prepare("SELECT COUNT(*) as count FROM eol_cycles WHERE is_eol = 1")
      .first<{ count: number }>();
    return result?.count ?? 0;
  },

  async countApproachingEol(db: DB, days: number): Promise<number> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    const futureDateStr = futureDate.toISOString().split("T")[0];

    const result = await db
      .prepare(
        `SELECT COUNT(*) as count FROM eol_cycles
         WHERE is_eol = 0
         AND eol_date IS NOT NULL
         AND eol_date > date('now')
         AND eol_date <= ?`,
      )
      .bind(futureDateStr)
      .first<{ count: number }>();
    return result?.count ?? 0;
  },
};

// --- EOL Sync Logs ---

export const eolSyncLogRepo = {
  async list(db: DB, limit = 50): Promise<EolSyncLog[]> {
    const result = await db
      .prepare("SELECT * FROM eol_sync_logs ORDER BY started_at DESC LIMIT ?")
      .bind(limit)
      .all();
    return result.results as unknown as EolSyncLog[];
  },

  async findById(db: DB, id: string): Promise<EolSyncLog | null> {
    const result = await db.prepare("SELECT * FROM eol_sync_logs WHERE id = ?").bind(id).first();
    return result as EolSyncLog | null;
  },

  async create(db: DB, log: Pick<EolSyncLog, "id" | "product_name">): Promise<void> {
    await db
      .prepare(`INSERT INTO eol_sync_logs (id, product_name, status) VALUES (?, ?, 'running')`)
      .bind(log.id, log.product_name)
      .run();
  },

  async updateStatus(
    db: DB,
    id: string,
    status: "completed" | "failed",
    fields?: {
      cycles_synced?: number;
      error_message?: string;
    },
  ): Promise<void> {
    const sets: string[] = ["status = ?", "completed_at = datetime('now')"];
    const params: unknown[] = [status];

    if (fields?.cycles_synced !== undefined) {
      sets.push("cycles_synced = ?");
      params.push(fields.cycles_synced);
    }
    if (fields?.error_message !== undefined) {
      sets.push("error_message = ?");
      params.push(fields.error_message);
    }

    params.push(id);

    await db
      .prepare(`UPDATE eol_sync_logs SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();
  },
};
