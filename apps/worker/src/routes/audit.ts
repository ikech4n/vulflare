import { Hono } from "hono";
import {
  auditFindingRepo,
  auditPackageRepo,
  auditProjectRepo,
  auditScanRepo,
} from "../db/audit-repository.ts";
import { authMiddleware, requireRole } from "../middleware/auth.ts";
import { runPackageAuditScan } from "../services/audit-scan.ts";
import { detectLockfileType, parseLockfile } from "../services/lockfile-parsers.ts";
import type { Env, JwtVariables } from "../types.ts";
import type { AuditLockfileType } from "@vulflare/shared/types";

export const auditRoutes = new Hono<{ Bindings: Env; Variables: JwtVariables }>();

auditRoutes.use("/*", authMiddleware);

// Helper: DB row -> camelCase
function mapProject(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    ecosystem: row.ecosystem,
    lockfileType: row.lockfile_type,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapScan(row: Record<string, unknown>) {
  return {
    id: row.id,
    projectId: row.project_id,
    status: row.status,
    packagesCount: row.packages_count,
    vulnsFound: row.vulns_found,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    errorMessage: row.error_message,
  };
}

function mapFinding(row: Record<string, unknown>) {
  return {
    id: row.id,
    scanId: row.scan_id,
    packageId: row.package_id,
    vulnerabilityId: row.vulnerability_id,
    fixedVersion: row.fixed_version,
    createdAt: row.created_at,
    packageName: row.package_name,
    packageVersion: row.package_version,
    cveId: row.cve_id,
    title: row.title,
    severity: row.severity,
    cvssV3Score: row.cvss_v3_score,
  };
}

// GET /api/audit/projects
auditRoutes.get("/projects", async (c) => {
  const result = await auditProjectRepo.list(c.env.DB);
  const projects = result.results ?? [];

  // 各プロジェクトの最新スキャンと統計を取得
  const enriched = await Promise.all(
    projects.map(async (p) => {
      const latestScan = await auditScanRepo.findLatestByProject(c.env.DB, p.id);
      const pkgCount = await auditPackageRepo.countByProject(c.env.DB, p.id);
      return {
        ...mapProject(p as unknown as Record<string, unknown>),
        packagesCount: pkgCount?.count ?? 0,
        latestScan: latestScan ? mapScan(latestScan as unknown as Record<string, unknown>) : null,
        vulnsFound: latestScan?.vulns_found ?? 0,
      };
    }),
  );

  return c.json(enriched);
});

// POST /api/audit/projects
auditRoutes.post("/projects", requireRole("editor"), async (c) => {
  const body = await c.req.json<{
    name: string;
    lockfileContent: string;
    lockfileType: AuditLockfileType;
  }>();

  if (!body.name || !body.lockfileContent || !body.lockfileType) {
    return c.json({ error: "name, lockfileContent, lockfileType are required" }, 400);
  }

  const detected = detectLockfileType(body.lockfileType);
  if (!detected) {
    return c.json({ error: "Unsupported lockfile type" }, 400);
  }

  let packages: Array<{ name: string; version: string }>;
  try {
    packages = parseLockfile(body.lockfileContent, body.lockfileType);
  } catch (e) {
    return c.json(
      { error: `Failed to parse lockfile: ${e instanceof Error ? e.message : "unknown"}` },
      400,
    );
  }

  const projectId = crypto.randomUUID();
  const userId = c.get("userId");

  await auditProjectRepo.create(c.env.DB, {
    id: projectId,
    name: body.name,
    ecosystem: detected.ecosystem,
    lockfile_type: body.lockfileType,
    created_by: userId,
  });

  // パッケージを保存
  const pkgRecords = packages.map((p) => ({
    id: crypto.randomUUID(),
    name: p.name,
    version: p.version,
  }));
  await auditPackageRepo.replaceProjectPackages(c.env.DB, projectId, pkgRecords);

  // 非同期スキャン開始
  c.executionCtx.waitUntil(runPackageAuditScan(c.env, projectId).catch(console.error));

  const project = await auditProjectRepo.findById(c.env.DB, projectId);
  return c.json(mapProject(project as unknown as Record<string, unknown>), 202);
});

// GET /api/audit/projects/:id
auditRoutes.get("/projects/:id", async (c) => {
  const project = await auditProjectRepo.findById(c.env.DB, c.req.param("id") ?? "");
  if (!project) return c.json({ error: "Not found" }, 404);

  const latestScan = await auditScanRepo.findLatestByProject(c.env.DB, project.id);
  const pkgCount = await auditPackageRepo.countByProject(c.env.DB, project.id);

  return c.json({
    ...mapProject(project as unknown as Record<string, unknown>),
    packagesCount: pkgCount?.count ?? 0,
    latestScan: latestScan ? mapScan(latestScan as unknown as Record<string, unknown>) : null,
    vulnsFound: latestScan?.vulns_found ?? 0,
  });
});

// PATCH /api/audit/projects/:id
auditRoutes.patch("/projects/:id", requireRole("editor"), async (c) => {
  const project = await auditProjectRepo.findById(c.env.DB, c.req.param("id") ?? "");
  if (!project) return c.json({ error: "Not found" }, 404);

  const body = await c.req.json<{ name?: string }>();
  if (body.name) {
    await auditProjectRepo.updateName(c.env.DB, project.id, body.name);
  }

  const updated = await auditProjectRepo.findById(c.env.DB, project.id);
  return c.json(mapProject(updated as unknown as Record<string, unknown>));
});

// DELETE /api/audit/projects/:id
auditRoutes.delete("/projects/:id", requireRole("admin"), async (c) => {
  const project = await auditProjectRepo.findById(c.env.DB, c.req.param("id") ?? "");
  if (!project) return c.json({ error: "Not found" }, 404);

  await auditProjectRepo.delete(c.env.DB, project.id);
  return c.json({ success: true });
});

// POST /api/audit/projects/:id/upload (lockfile再アップロード)
auditRoutes.post("/projects/:id/upload", requireRole("editor"), async (c) => {
  const project = await auditProjectRepo.findById(c.env.DB, c.req.param("id") ?? "");
  if (!project) return c.json({ error: "Not found" }, 404);

  const body = await c.req.json<{
    lockfileContent: string;
    lockfileType?: AuditLockfileType;
  }>();

  if (!body.lockfileContent) {
    return c.json({ error: "lockfileContent is required" }, 400);
  }

  const lockfileType = (body.lockfileType ?? project.lockfile_type) as AuditLockfileType;

  let packages: Array<{ name: string; version: string }>;
  try {
    packages = parseLockfile(body.lockfileContent, lockfileType);
  } catch (e) {
    return c.json(
      { error: `Failed to parse lockfile: ${e instanceof Error ? e.message : "unknown"}` },
      400,
    );
  }

  const pkgRecords = packages.map((p) => ({
    id: crypto.randomUUID(),
    name: p.name,
    version: p.version,
  }));
  await auditPackageRepo.replaceProjectPackages(c.env.DB, project.id, pkgRecords);
  await auditProjectRepo.updateName(c.env.DB, project.id, project.name); // updated_at を更新

  c.executionCtx.waitUntil(runPackageAuditScan(c.env, project.id).catch(console.error));

  return c.json({ success: true, packagesCount: packages.length }, 202);
});

// POST /api/audit/projects/:id/scan (手動再スキャン)
auditRoutes.post("/projects/:id/scan", requireRole("editor"), async (c) => {
  const project = await auditProjectRepo.findById(c.env.DB, c.req.param("id") ?? "");
  if (!project) return c.json({ error: "Not found" }, 404);

  c.executionCtx.waitUntil(runPackageAuditScan(c.env, project.id).catch(console.error));

  return c.json({ success: true, message: "Scan started" }, 202);
});

// GET /api/audit/projects/:id/packages
auditRoutes.get("/projects/:id/packages", async (c) => {
  const project = await auditProjectRepo.findById(c.env.DB, c.req.param("id") ?? "");
  if (!project) return c.json({ error: "Not found" }, 404);

  const result = await auditPackageRepo.listByProject(c.env.DB, project.id);
  return c.json(
    (result.results ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      version: p.version,
    })),
  );
});

// GET /api/audit/projects/:id/scans
auditRoutes.get("/projects/:id/scans", async (c) => {
  const project = await auditProjectRepo.findById(c.env.DB, c.req.param("id") ?? "");
  if (!project) return c.json({ error: "Not found" }, 404);

  const result = await auditScanRepo.listByProject(c.env.DB, project.id);
  return c.json(
    (result.results ?? []).map((s) => mapScan(s as unknown as Record<string, unknown>)),
  );
});

// GET /api/audit/projects/:id/findings
auditRoutes.get("/projects/:id/findings", async (c) => {
  const project = await auditProjectRepo.findById(c.env.DB, c.req.param("id") ?? "");
  if (!project) return c.json({ error: "Not found" }, 404);

  const page = Math.max(1, Number(c.req.query("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 20)));
  const severity = c.req.query("severity");

  const { countStmt, dataStmt } = auditFindingRepo.listByProject(
    c.env.DB,
    project.id,
    page,
    limit,
    severity,
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
