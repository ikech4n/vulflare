import { cvssScoreToSeverity } from "@vulflare/shared/utils";
import { Hono } from "hono";
import { vulnRepo } from "../db/repository.ts";
import { authMiddleware, requireRole } from "../middleware/auth.ts";
import { dispatchNotification } from "../services/notifications.ts";
import type { Env, JwtVariables } from "../types.ts";
import { validate } from "../validation/middleware.ts";
import {
  batchUpdateVulnerabilitiesSchema,
  createVulnerabilitySchema,
  updateVulnerabilitySchema,
} from "../validation/schemas.ts";

export const vulnerabilityRoutes = new Hono<{ Bindings: Env; Variables: JwtVariables }>();

vulnerabilityRoutes.use("/*", authMiddleware);

// GET /api/vulnerabilities
vulnerabilityRoutes.get("/", async (c) => {
  const page = Math.max(1, Number(c.req.query("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 20)));
  const severity = c.req.query("severity");
  const status = c.req.query("status");
  const source = c.req.query("source");
  const q = c.req.query("q");

  const { countStmt, dataStmt } = vulnRepo.list(c.env.DB, {
    page,
    limit,
    ...(severity && { severity }),
    ...(status && { status }),
    ...(source && { source }),
    ...(q && { q }),
  });
  const [countResult, dataResult] = await c.env.DB.batch([countStmt, dataStmt]);

  const total = (countResult?.results[0] as { total: number } | undefined)?.total ?? 0;

  return c.json({
    data: (dataResult?.results ?? []).map((v) => mapVuln(v as Record<string, unknown>)),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

// GET /api/vulnerabilities/stats
vulnerabilityRoutes.get("/stats", async (c) => {
  const row = await vulnRepo.stats(c.env.DB);
  if (!row) return c.json({ error: "Failed to fetch stats" }, 500);
  return c.json({
    total: row.total ?? 0,
    bySeverity: {
      critical: row.critical ?? 0,
      high: row.high ?? 0,
      medium: row.medium ?? 0,
      low: row.low ?? 0,
      informational: row.informational ?? 0,
    },
    byStatus: {
      new: row.new ?? 0,
      open: row.open ?? 0,
      fixed: row.fixed ?? 0,
      accepted_risk: row.accepted_risk ?? 0,
      false_positive: row.false_positive ?? 0,
    },
    recentlyAdded: row.recently_added ?? 0,
  });
});

// GET /api/vulnerabilities/:id
vulnerabilityRoutes.get("/:id", async (c) => {
  const vuln = await vulnRepo.findById(c.env.DB, c.req.param("id")!);
  if (!vuln) return c.json({ error: "Not found" }, 404);
  return c.json(mapVuln(vuln as unknown as Record<string, unknown>));
});

// POST /api/vulnerabilities
vulnerabilityRoutes.post(
  "/",
  requireRole("editor"),
  validate(createVulnerabilitySchema),
  async (c) => {
    const body = c.get("validatedBody") as {
      cveId?: string;
      title: string;
      description?: string;
      severity?: string;
      cvssV3Score?: number;
      cvssV3Vector?: string;
      cvssV4Score?: number;
      cvssV4Vector?: string;
      cweIds?: string[];
      references?: unknown[];
      publishedAt?: string;
      modifiedAt?: string;
    };

    if (body.cveId) {
      const existing = await vulnRepo.findByCveId(c.env.DB, body.cveId);
      if (existing) return c.json({ error: "CVE ID already exists" }, 409);
    }

    const severity =
      body.severity ??
      (body.cvssV4Score != null
        ? cvssScoreToSeverity(body.cvssV4Score)
        : body.cvssV3Score != null
          ? cvssScoreToSeverity(body.cvssV3Score)
          : "informational");

    const id = crypto.randomUUID();
    await vulnRepo.create(c.env.DB, {
      id,
      cve_id: body.cveId ?? null,
      title: body.title,
      description: body.description ?? null,
      severity,
      cvss_v3_score: body.cvssV3Score ?? null,
      cvss_v3_vector: body.cvssV3Vector ?? null,
      cvss_v2_score: null,
      cvss_v2_vector: null,
      cvss_v4_score: body.cvssV4Score ?? null,
      cvss_v4_vector: body.cvssV4Vector ?? null,
      cwe_ids: JSON.stringify(body.cweIds ?? []),
      affected_products: "[]",
      vuln_references: JSON.stringify(body.references ?? []),
      published_at: body.publishedAt ?? null,
      modified_at: body.modifiedAt ?? null,
      source: "manual",
      status: "new",
      memo: null,
    });

    const created = await vulnRepo.findById(c.env.DB, id);
    const mapped = mapVuln(created! as unknown as Record<string, unknown>);

    const notifData = {
      vuln_id: mapped.cveId ?? id,
      title: mapped.title,
      severity: mapped.severity,
    };
    c.executionCtx.waitUntil(dispatchNotification(c.env, "vulnerability_created", notifData));
    if (severity === "critical") {
      c.executionCtx.waitUntil(dispatchNotification(c.env, "vulnerability_critical", notifData));
    }

    return c.json(mapped, 201);
  },
);

// PATCH /api/vulnerabilities/batch
vulnerabilityRoutes.patch(
  "/batch",
  requireRole("editor"),
  validate(batchUpdateVulnerabilitiesSchema),
  async (c) => {
    const body = c.get("validatedBody") as {
      ids: string[];
      updates: {
        severity?: string;
        status?: string;
      };
    };

    // 存在確認
    const placeholders = body.ids.map(() => "?").join(",");
    const existing = await c.env.DB.prepare(
      `SELECT id FROM vulnerabilities WHERE id IN (${placeholders})`,
    )
      .bind(...body.ids)
      .all();

    if (existing.results.length !== body.ids.length) {
      return c.json(
        {
          error: "Some vulnerability IDs not found",
          found: existing.results.length,
          requested: body.ids.length,
        },
        404,
      );
    }

    const result = await vulnRepo.batchUpdate(c.env.DB, body.ids, {
      ...(body.updates.severity !== undefined && { severity: body.updates.severity }),
      ...(body.updates.status !== undefined && { status: body.updates.status }),
    });

    const affectedRows = result.meta?.changes ?? 0;

    c.executionCtx.waitUntil(
      dispatchNotification(c.env, "vulnerability_updated", {
        count: affectedRows,
        ids: body.ids,
        updates: body.updates,
      }),
    );

    return c.json({
      message: "Batch update successful",
      affectedRows,
      updatedIds: body.ids,
    });
  },
);

// PATCH /api/vulnerabilities/:id
vulnerabilityRoutes.patch(
  "/:id",
  requireRole("editor"),
  validate(updateVulnerabilitySchema),
  async (c) => {
    const id = c.req.param("id")!;
    const existing = await vulnRepo.findById(c.env.DB, id);
    if (!existing) return c.json({ error: "Not found" }, 404);

    const body = c.get("validatedBody") as {
      title?: string;
      description?: string;
      severity?: string;
      status?: string;
      cvssV3Score?: number;
      cvssV3Vector?: string;
      cvssV4Score?: number;
      cvssV4Vector?: string;
      cweIds?: string[];
      references?: unknown[];
      publishedAt?: string | null;
      modifiedAt?: string | null;
      memo?: string | null;
    };

    await vulnRepo.update(c.env.DB, id, {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.severity !== undefined && { severity: body.severity }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.cvssV3Score !== undefined && { cvss_v3_score: body.cvssV3Score }),
      ...(body.cvssV3Vector !== undefined && { cvss_v3_vector: body.cvssV3Vector }),
      ...(body.cvssV4Score !== undefined && { cvss_v4_score: body.cvssV4Score }),
      ...(body.cvssV4Vector !== undefined && { cvss_v4_vector: body.cvssV4Vector }),
      ...(body.cweIds !== undefined && { cwe_ids: JSON.stringify(body.cweIds) }),
      ...(body.references !== undefined && { vuln_references: JSON.stringify(body.references) }),
      ...(body.publishedAt !== undefined && { published_at: body.publishedAt }),
      ...(body.modifiedAt !== undefined && { modified_at: body.modifiedAt }),
      ...(body.memo !== undefined && { memo: body.memo }),
    });

    const updated = await vulnRepo.findById(c.env.DB, id);
    const mappedUpdated = mapVuln(updated! as unknown as Record<string, unknown>);

    c.executionCtx.waitUntil(
      dispatchNotification(c.env, "vulnerability_updated", {
        vuln_id: mappedUpdated.cveId ?? id,
        title: mappedUpdated.title,
        severity: mappedUpdated.severity,
        status: mappedUpdated.status,
      }),
    );

    return c.json(mappedUpdated);
  },
);

// DELETE /api/vulnerabilities/:id
vulnerabilityRoutes.delete("/:id", requireRole("admin"), async (c) => {
  const existing = await vulnRepo.findById(c.env.DB, c.req.param("id")!);
  if (!existing) return c.json({ error: "Not found" }, 404);
  await vulnRepo.delete(c.env.DB, c.req.param("id")!);
  return c.json({ message: "Deleted" });
});

function mapVuln(v: Record<string, unknown>) {
  return {
    id: v.id,
    cveId: v.cve_id,
    title: v.title,
    description: v.description,
    severity: v.severity,
    cvssV3Score: v.cvss_v3_score,
    cvssV3Vector: v.cvss_v3_vector,
    cvssV2Score: v.cvss_v2_score,
    cvssV2Vector: v.cvss_v2_vector,
    cvssV4Score: v.cvss_v4_score ?? null,
    cvssV4Vector: v.cvss_v4_vector ?? null,
    cweIds: safeParseJson(v.cwe_ids as string, []),
    affectedProducts: safeParseJson(v.affected_products as string, []),
    references: safeParseJson(v.vuln_references as string, []),
    publishedAt: v.published_at,
    modifiedAt: v.modified_at,
    source: v.source,
    status: v.status,
    memo: v.memo ?? null,
    createdAt: v.created_at,
    updatedAt: v.updated_at,
  };
}

function safeParseJson<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}
