import type { CreateWebScanTargetRequest } from "@vulflare/shared/types";
import { Hono } from "hono";
import {
  webScanFindingRepo,
  webScanRepo,
  webScanTargetRepo,
} from "../db/web-scanner-repository.ts";
import { authMiddleware, requireRole } from "../middleware/auth.ts";
import { runWebScan } from "../services/web-scanner/scanner.ts";
import type { Env, JwtVariables } from "../types.ts";

export const webScannerRoutes = new Hono<{ Bindings: Env; Variables: JwtVariables }>();

webScannerRoutes.use("/*", authMiddleware);

function mapTarget(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapScan(row: Record<string, unknown>) {
  return {
    id: row.id,
    targetId: row.target_id,
    status: row.status,
    checksRun: row.checks_run,
    findingsCount: row.findings_count,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    errorMessage: row.error_message,
  };
}

function mapFinding(row: Record<string, unknown>) {
  return {
    id: row.id,
    scanId: row.scan_id,
    checkId: row.check_id,
    severity: row.severity,
    title: row.title,
    description: row.description,
    evidence: row.evidence,
    remediation: row.remediation,
    createdAt: row.created_at,
  };
}

// GET /api/web-scanner/targets
webScannerRoutes.get("/targets", async (c) => {
  const result = await webScanTargetRepo.list(c.env.DB);
  const targets = result.results ?? [];

  const enriched = await Promise.all(
    targets.map(async (t) => {
      const latestScan = await webScanRepo.findLatestByTarget(c.env.DB, t.id);
      const findingsCount = await webScanFindingRepo.countByTarget(c.env.DB, t.id);
      return {
        ...mapTarget(t as unknown as Record<string, unknown>),
        latestScan: latestScan ? mapScan(latestScan as unknown as Record<string, unknown>) : null,
        findingsCount: findingsCount?.count ?? 0,
      };
    }),
  );

  return c.json(enriched);
});

// POST /api/web-scanner/targets
webScannerRoutes.post("/targets", requireRole("editor"), async (c) => {
  const body = await c.req.json<CreateWebScanTargetRequest>();

  if (!body.name || !body.url) {
    return c.json({ error: "name and url are required" }, 400);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(body.url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return c.json({ error: "url must start with http:// or https://" }, 400);
    }
  } catch {
    return c.json({ error: "Invalid URL format" }, 400);
  }

  const targetId = crypto.randomUUID();
  const userId = c.get("userId");

  await webScanTargetRepo.create(c.env.DB, {
    id: targetId,
    name: body.name,
    url: parsedUrl.toString(),
    created_by: userId,
  });

  // 非同期スキャン開始
  c.executionCtx.waitUntil(runWebScan(c.env, targetId).catch(console.error));

  const target = await webScanTargetRepo.findById(c.env.DB, targetId);
  return c.json(mapTarget(target as unknown as Record<string, unknown>), 202);
});

// GET /api/web-scanner/targets/:id
webScannerRoutes.get("/targets/:id", async (c) => {
  const target = await webScanTargetRepo.findById(c.env.DB, c.req.param("id") ?? "");
  if (!target) return c.json({ error: "Not found" }, 404);

  const latestScan = await webScanRepo.findLatestByTarget(c.env.DB, target.id);
  const findingsCount = await webScanFindingRepo.countByTarget(c.env.DB, target.id);

  return c.json({
    ...mapTarget(target as unknown as Record<string, unknown>),
    latestScan: latestScan ? mapScan(latestScan as unknown as Record<string, unknown>) : null,
    findingsCount: findingsCount?.count ?? 0,
  });
});

// PATCH /api/web-scanner/targets/:id
webScannerRoutes.patch("/targets/:id", requireRole("editor"), async (c) => {
  const target = await webScanTargetRepo.findById(c.env.DB, c.req.param("id") ?? "");
  if (!target) return c.json({ error: "Not found" }, 404);

  const body = await c.req.json<{ name?: string; url?: string }>();

  if (body.url) {
    try {
      const parsed = new URL(body.url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return c.json({ error: "url must start with http:// or https://" }, 400);
      }
      body.url = parsed.toString();
    } catch {
      return c.json({ error: "Invalid URL format" }, 400);
    }
  }

  await webScanTargetRepo.update(c.env.DB, target.id, body);

  const updated = await webScanTargetRepo.findById(c.env.DB, target.id);
  return c.json(mapTarget(updated as unknown as Record<string, unknown>));
});

// DELETE /api/web-scanner/targets/:id
webScannerRoutes.delete("/targets/:id", requireRole("admin"), async (c) => {
  const target = await webScanTargetRepo.findById(c.env.DB, c.req.param("id") ?? "");
  if (!target) return c.json({ error: "Not found" }, 404);

  await webScanTargetRepo.delete(c.env.DB, target.id);
  return c.json({ success: true });
});

// POST /api/web-scanner/targets/:id/scan
webScannerRoutes.post("/targets/:id/scan", requireRole("editor"), async (c) => {
  const target = await webScanTargetRepo.findById(c.env.DB, c.req.param("id") ?? "");
  if (!target) return c.json({ error: "Not found" }, 404);

  c.executionCtx.waitUntil(runWebScan(c.env, target.id).catch(console.error));

  return c.json({ success: true, message: "Scan started" }, 202);
});

// GET /api/web-scanner/targets/:id/scans
webScannerRoutes.get("/targets/:id/scans", async (c) => {
  const target = await webScanTargetRepo.findById(c.env.DB, c.req.param("id") ?? "");
  if (!target) return c.json({ error: "Not found" }, 404);

  const result = await webScanRepo.listByTarget(c.env.DB, target.id);
  return c.json(
    (result.results ?? []).map((s) => mapScan(s as unknown as Record<string, unknown>)),
  );
});

// GET /api/web-scanner/targets/:id/findings
webScannerRoutes.get("/targets/:id/findings", async (c) => {
  const target = await webScanTargetRepo.findById(c.env.DB, c.req.param("id") ?? "");
  if (!target) return c.json({ error: "Not found" }, 404);

  // 最新の完了スキャンIDを取得
  const latestScan = await webScanRepo.findLatestByTarget(c.env.DB, target.id);
  if (!latestScan || latestScan.status !== "completed") {
    return c.json({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });
  }

  const page = Math.max(1, Number(c.req.query("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 20)));
  const severity = c.req.query("severity");
  const checkId = c.req.query("checkId");

  const { countStmt, dataStmt } = webScanFindingRepo.listByScan(
    c.env.DB,
    latestScan.id,
    page,
    limit,
    severity,
    checkId,
  );
  const [countResult, dataResult] = await c.env.DB.batch([countStmt, dataStmt]);

  const total = (countResult?.results[0] as { total: number } | undefined)?.total ?? 0;

  return c.json({
    data: (dataResult?.results ?? []).map((f) => mapFinding(f as Record<string, unknown>)),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});
