import type { Env } from "../types.ts";

type DB = Env["DB"];

// --- Users ---

export interface DbUser {
  id: string;
  username: string;
  display_name: string | null;
  password_hash: string;
  role: string;
  is_active: number;
  failed_login_attempts: number;
  locked_at: string | null;
  email: string | null;
  theme: string;
  created_at: string;
  updated_at: string;
}

export const userRepo = {
  findByUsername(db: DB, username: string) {
    return db.prepare("SELECT * FROM users WHERE username = ?").bind(username).first<DbUser>();
  },
  findById(db: DB, id: string) {
    return db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<DbUser>();
  },
  create(
    db: DB,
    user: Omit<
      DbUser,
      | "created_at"
      | "updated_at"
      | "failed_login_attempts"
      | "locked_at"
      | "email"
      | "theme"
      | "display_name"
    > & { email?: string | null; display_name?: string | null },
  ) {
    return db
      .prepare(
        "INSERT INTO users (id, username, display_name, password_hash, role, is_active, email) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        user.id,
        user.username,
        user.display_name ?? null,
        user.password_hash,
        user.role,
        user.is_active,
        user.email ?? null,
      )
      .run();
  },
  list(db: DB) {
    return db
      .prepare(
        "SELECT id, username, display_name, role, is_active, failed_login_attempts, locked_at, email, created_at FROM users ORDER BY created_at ASC",
      )
      .all<Omit<DbUser, "password_hash" | "updated_at">>();
  },
  findByEmail(db: DB, email: string) {
    return db
      .prepare("SELECT * FROM users WHERE email = ? AND is_active = 1")
      .bind(email)
      .first<DbUser>();
  },
  updatePassword(db: DB, id: string, passwordHash: string) {
    return db
      .prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(passwordHash, id)
      .run();
  },
  updateRole(db: DB, id: string, role: string) {
    return db
      .prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(role, id)
      .run();
  },
  setActive(db: DB, id: string, isActive: number) {
    return db
      .prepare("UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(isActive, id)
      .run();
  },
  updateProfile(
    db: DB,
    id: string,
    fields: {
      username?: string;
      email?: string | null;
      theme?: string;
      display_name?: string | null;
    },
  ) {
    const sets: string[] = ["updated_at = datetime('now')"];
    const params: unknown[] = [];
    if (fields.username) {
      sets.push("username = ?");
      params.push(fields.username);
    }
    if (fields.email !== undefined) {
      sets.push("email = ?");
      params.push(fields.email);
    }
    if (fields.theme !== undefined) {
      sets.push("theme = ?");
      params.push(fields.theme);
    }
    if (fields.display_name !== undefined) {
      sets.push("display_name = ?");
      params.push(fields.display_name);
    }
    params.push(id);
    return db
      .prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();
  },
  delete(db: DB, id: string) {
    return db.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
  },
  incrementFailedAttempts(db: DB, id: string) {
    return db
      .prepare(
        `UPDATE users
         SET failed_login_attempts = failed_login_attempts + 1,
             locked_at = CASE WHEN failed_login_attempts + 1 >= 5 THEN datetime('now') ELSE locked_at END,
             updated_at = datetime('now')
         WHERE id = ?`,
      )
      .bind(id)
      .run();
  },
  resetFailedAttempts(db: DB, id: string) {
    return db
      .prepare(
        "UPDATE users SET failed_login_attempts = 0, locked_at = NULL, updated_at = datetime('now') WHERE id = ?",
      )
      .bind(id)
      .run();
  },
  unlock(db: DB, id: string) {
    return db
      .prepare(
        "UPDATE users SET failed_login_attempts = 0, locked_at = NULL, updated_at = datetime('now') WHERE id = ?",
      )
      .bind(id)
      .run();
  },
};

// --- Session Tokens (KV) ---

type KV = KVNamespace;

interface SessionTokenData {
  userId: string;
  jti: string;
}

interface UserTokenEntry {
  jti: string;
  tokenHash: string;
}

export const sessionTokenRepo = {
  async create(kv: KV, jti: string, userId: string, tokenHash: string, ttlSeconds: number) {
    await kv.put(`token:${tokenHash}`, JSON.stringify({ userId, jti }), {
      expirationTtl: ttlSeconds,
    });
    const userKey = `user:${userId}`;
    const existing = (await kv.get<UserTokenEntry[]>(userKey, "json")) ?? [];
    existing.push({ jti, tokenHash });
    await kv.put(userKey, JSON.stringify(existing));
  },

  findByHash(kv: KV, tokenHash: string): Promise<SessionTokenData | null> {
    return kv.get<SessionTokenData>(`token:${tokenHash}`, "json");
  },

  async revoke(kv: KV, tokenHash: string) {
    await kv.delete(`token:${tokenHash}`);
  },

  async revokeAllForUser(kv: KV, userId: string) {
    const userKey = `user:${userId}`;
    const tokens = (await kv.get<UserTokenEntry[]>(userKey, "json")) ?? [];
    await Promise.all(tokens.map(({ tokenHash }) => kv.delete(`token:${tokenHash}`)));
    await kv.delete(userKey);
  },
};

// --- App Settings ---

export const appSettingsRepo = {
  get(db: DB, key: string) {
    return db
      .prepare("SELECT value FROM sync_settings WHERE key = ?")
      .bind(key)
      .first<{ value: string }>();
  },
  set(db: DB, key: string, value: string) {
    return db
      .prepare(
        "INSERT INTO sync_settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
      )
      .bind(key, value)
      .run();
  },
};

// --- Password Reset Tokens ---

export const passwordResetTokenRepo = {
  create(db: DB, id: string, userId: string, tokenHash: string, expiresAt: string) {
    return db
      .prepare(
        "INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
      )
      .bind(id, userId, tokenHash, expiresAt)
      .run();
  },
  findValidByHash(db: DB, tokenHash: string) {
    return db
      .prepare(
        "SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')",
      )
      .bind(tokenHash)
      .first<{ id: string; user_id: string; token_hash: string; expires_at: string }>();
  },
  markUsed(db: DB, id: string) {
    return db
      .prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?")
      .bind(id)
      .run();
  },
};

// --- Vulnerabilities ---

export interface DbVulnerability {
  id: string;
  cve_id: string | null;
  title: string;
  description: string | null;
  severity: string;
  cvss_v3_score: number | null;
  cvss_v3_vector: string | null;
  cvss_v2_score: number | null;
  cvss_v2_vector: string | null;
  cvss_v4_score: number | null;
  cvss_v4_vector: string | null;
  cwe_ids: string;
  affected_products: string;
  vuln_references: string;
  published_at: string | null;
  modified_at: string | null;
  source: string;
  status: string;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export const vulnRepo = {
  list(
    db: DB,
    {
      page,
      limit,
      severity,
      status,
      source,
      q,
      sort,
      order,
    }: {
      page: number;
      limit: number;
      severity?: string;
      status?: string;
      source?: string;
      q?: string;
      sort?: string;
      order?: string;
    },
  ) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (severity) {
      const severities = severity.split(",").filter(Boolean);
      if (severities.length === 1) {
        conditions.push("v.severity = ?");
        params.push(severities[0]);
      } else {
        conditions.push(`v.severity IN (${severities.map(() => "?").join(",")})`);
        params.push(...severities);
      }
    }
    if (status) {
      const statuses = status.split(",").filter(Boolean);
      if (statuses.length === 1) {
        conditions.push("v.status = ?");
        params.push(statuses[0]);
      } else {
        conditions.push(`v.status IN (${statuses.map(() => "?").join(",")})`);
        params.push(...statuses);
      }
    }
    if (source) {
      conditions.push("v.source = ?");
      params.push(source);
    }
    if (q) {
      conditions.push("(v.cve_id LIKE ? OR v.title LIKE ?)");
      params.push(`%${q}%`, `%${q}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const offset = (page - 1) * limit;
    const dir = order === "asc" ? "ASC" : "DESC";

    const sortClause = (() => {
      switch (sort) {
        case "severity":
          return `CASE v.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 WHEN 'informational' THEN 5 ELSE 6 END ${dir}`;
        case "cvss":
          return dir === "ASC"
            ? "v.cvss_v3_score ASC NULLS LAST"
            : "v.cvss_v3_score DESC NULLS LAST";
        case "status":
          return `CASE v.status WHEN 'new' THEN 1 WHEN 'open' THEN 2 WHEN 'fixed' THEN 3 WHEN 'accepted_risk' THEN 4 WHEN 'false_positive' THEN 5 ELSE 6 END ${dir}`;
        case "published_at":
          return dir === "ASC" ? "v.published_at ASC NULLS LAST" : "v.published_at DESC NULLS LAST";
        case "modified_at":
          return dir === "ASC" ? "v.modified_at ASC NULLS LAST" : "v.modified_at DESC NULLS LAST";
        default:
          return "v.created_at DESC";
      }
    })();

    const countStmt = db
      .prepare(`SELECT COUNT(*) as total FROM vulnerabilities v ${where}`)
      .bind(...params);
    const dataStmt = db
      .prepare(
        `SELECT v.*
         FROM vulnerabilities v
         ${where}
         ORDER BY ${sortClause} LIMIT ? OFFSET ?`,
      )
      .bind(...params, limit, offset);

    return { countStmt, dataStmt };
  },

  findById(db: DB, id: string) {
    return db
      .prepare("SELECT * FROM vulnerabilities WHERE id = ?")
      .bind(id)
      .first<DbVulnerability>();
  },

  findByCveId(db: DB, cveId: string) {
    return db
      .prepare("SELECT * FROM vulnerabilities WHERE cve_id = ?")
      .bind(cveId)
      .first<DbVulnerability>();
  },

  create(db: DB, v: Omit<DbVulnerability, "created_at" | "updated_at">) {
    return db
      .prepare(
        `INSERT INTO vulnerabilities
          (id, cve_id, title, description, severity, cvss_v3_score, cvss_v3_vector,
           cvss_v2_score, cvss_v2_vector, cvss_v4_score, cvss_v4_vector,
           cwe_ids, affected_products, vuln_references,
           published_at, modified_at, source, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        v.id,
        v.cve_id,
        v.title,
        v.description,
        v.severity,
        v.cvss_v3_score,
        v.cvss_v3_vector,
        v.cvss_v2_score,
        v.cvss_v2_vector,
        v.cvss_v4_score,
        v.cvss_v4_vector,
        v.cwe_ids,
        v.affected_products,
        v.vuln_references,
        v.published_at,
        v.modified_at,
        v.source,
        v.status,
      )
      .run();
  },

  update(
    db: DB,
    id: string,
    fields: Partial<
      Pick<
        DbVulnerability,
        | "title"
        | "description"
        | "severity"
        | "status"
        | "cvss_v3_score"
        | "cvss_v3_vector"
        | "cvss_v4_score"
        | "cvss_v4_vector"
        | "cwe_ids"
        | "vuln_references"
        | "published_at"
        | "modified_at"
        | "memo"
      >
    >,
  ) {
    const sets: string[] = ["updated_at = datetime('now')"];
    const params: unknown[] = [];
    for (const [k, v] of Object.entries(fields)) {
      sets.push(`${k} = ?`);
      params.push(v);
    }
    params.push(id);
    return db
      .prepare(`UPDATE vulnerabilities SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();
  },

  delete(db: DB, id: string) {
    return db.prepare("DELETE FROM vulnerabilities WHERE id = ?").bind(id).run();
  },

  stats(db: DB) {
    return db
      .prepare(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
           SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high,
           SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium,
           SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low,
           SUM(CASE WHEN severity = 'informational' THEN 1 ELSE 0 END) as informational,
           SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new,
           SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
           SUM(CASE WHEN status = 'fixed' THEN 1 ELSE 0 END) as fixed,
           SUM(CASE WHEN status = 'accepted_risk' THEN 1 ELSE 0 END) as accepted_risk,
           SUM(CASE WHEN status = 'false_positive' THEN 1 ELSE 0 END) as false_positive,
           SUM(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) as recently_added
         FROM vulnerabilities`,
      )
      .first<Record<string, number>>();
  },

  upsertByCveId(db: DB, v: Omit<DbVulnerability, "created_at" | "updated_at">) {
    return db
      .prepare(
        `INSERT INTO vulnerabilities
          (id, cve_id, title, description, severity, cvss_v3_score, cvss_v3_vector,
           cvss_v2_score, cvss_v2_vector, cvss_v4_score, cvss_v4_vector,
           cwe_ids, affected_products, vuln_references,
           published_at, modified_at, source, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(cve_id) DO UPDATE SET
           title = excluded.title,
           description = excluded.description,
           severity = excluded.severity,
           cvss_v3_score = excluded.cvss_v3_score,
           cvss_v3_vector = excluded.cvss_v3_vector,
           cvss_v2_score = excluded.cvss_v2_score,
           cvss_v2_vector = excluded.cvss_v2_vector,
           cvss_v4_score = excluded.cvss_v4_score,
           cvss_v4_vector = excluded.cvss_v4_vector,
           cwe_ids = excluded.cwe_ids,
           affected_products = excluded.affected_products,
           vuln_references = excluded.vuln_references,
           published_at = excluded.published_at,
           modified_at = excluded.modified_at,
           source = excluded.source,
           status = excluded.status,
           updated_at = datetime('now')`,
      )
      .bind(
        v.id,
        v.cve_id,
        v.title,
        v.description,
        v.severity,
        v.cvss_v3_score,
        v.cvss_v3_vector,
        v.cvss_v2_score,
        v.cvss_v2_vector,
        v.cvss_v4_score,
        v.cvss_v4_vector,
        v.cwe_ids,
        v.affected_products,
        v.vuln_references,
        v.published_at,
        v.modified_at,
        v.source,
        v.status,
      )
      .run();
  },

  batchUpdate(
    db: DB,
    ids: string[],
    fields: Partial<Pick<DbVulnerability, "severity" | "status">>,
  ) {
    if (ids.length === 0) {
      return { success: true, meta: { changes: 0 } };
    }

    const sets: string[] = ["updated_at = datetime('now')"];
    const params: unknown[] = [];

    for (const [k, v] of Object.entries(fields)) {
      sets.push(`${k} = ?`);
      params.push(v);
    }

    const placeholders = ids.map(() => "?").join(",");
    params.push(...ids);

    const sql = `UPDATE vulnerabilities SET ${sets.join(", ")} WHERE id IN (${placeholders})`;
    return db
      .prepare(sql)
      .bind(...params)
      .run();
  },
};

// --- Vulnerability History ---

export interface DbVulnerabilityHistory {
  id: string;
  vulnerability_id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  changes: string | null;
  created_at: string;
}

export const vulnHistoryRepo = {
  create(
    db: DB,
    entry: {
      id: string;
      vulnerability_id: string;
      user_id: string | null;
      user_name: string | null;
      action: string;
      changes: Record<string, { old: unknown; new: unknown }> | null;
    },
  ) {
    return db
      .prepare(
        `INSERT INTO vulnerability_history (id, vulnerability_id, user_id, user_name, action, changes)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        entry.id,
        entry.vulnerability_id,
        entry.user_id,
        entry.user_name,
        entry.action,
        entry.changes ? JSON.stringify(entry.changes) : null,
      )
      .run();
  },

  listByVulnId(db: DB, vulnId: string, { page, limit }: { page: number; limit: number }) {
    const offset = (page - 1) * limit;
    const countStmt = db
      .prepare("SELECT COUNT(*) as total FROM vulnerability_history WHERE vulnerability_id = ?")
      .bind(vulnId);
    const dataStmt = db
      .prepare(
        `SELECT * FROM vulnerability_history WHERE vulnerability_id = ?
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .bind(vulnId, limit, offset);
    return { countStmt, dataStmt };
  },
};
