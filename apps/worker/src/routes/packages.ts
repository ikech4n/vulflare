import { Hono } from 'hono';
import type { Env, JwtVariables } from '../types.ts';
import { authMiddleware, requireRole } from '../middleware/auth.ts';
import { validate } from '../validation/middleware.ts';
import { createAssetPackageSchema, importAssetPackagesSchema } from '../validation/schemas.ts';
import { assetRepo } from '../db/repository.ts';
import { packageRepo, type DbAssetPackage } from '../db/package-repository.ts';
import { matchPackageToVulnerabilities } from '../services/matching-service.ts';

export const packageRoutes = new Hono<{ Bindings: Env; Variables: JwtVariables }>();

packageRoutes.use('/*', authMiddleware);

// GET /api/assets/:id/packages
packageRoutes.get('/:id/packages', async (c) => {
  const assetId = c.req.param('id');
  const asset = await assetRepo.findById(c.env.DB, assetId);
  if (!asset) return c.json({ error: 'Asset not found' }, 404);

  const result = await packageRepo.listByAsset(c.env.DB, assetId);
  return c.json({
    data: (result.results ?? []).map(mapPackage),
  });
});

// POST /api/assets/:id/packages
packageRoutes.post('/:id/packages', requireRole('editor'), validate(createAssetPackageSchema), async (c) => {
  const assetId = c.req.param('id');
  const asset = await assetRepo.findById(c.env.DB, assetId);
  if (!asset) return c.json({ error: 'Asset not found' }, 404);

  const body = c.get('validatedBody') as {
    ecosystem: string;
    name: string;
    version: string;
    vendor?: string;
  };

  const id = crypto.randomUUID();
  const stmt = packageRepo.create(c.env.DB, {
    id,
    asset_id: assetId,
    ecosystem: body.ecosystem,
    name: body.name,
    version: body.version,
    vendor: body.vendor ?? null,
  });
  await stmt.run();

  const created = await packageRepo.findById(c.env.DB, id);
  return c.json(mapPackage(created!), 201);
});

// POST /api/assets/:id/packages/import
packageRoutes.post('/:id/packages/import', requireRole('editor'), validate(importAssetPackagesSchema), async (c) => {
  const assetId = c.req.param('id');
  const asset = await assetRepo.findById(c.env.DB, assetId);
  if (!asset) return c.json({ error: 'Asset not found' }, 404);

  const body = c.get('validatedBody') as {
    packages: Array<{ ecosystem: string; name: string; version: string; vendor?: string }>;
  };

  let totalCreated = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < body.packages.length; i += BATCH_SIZE) {
    const batch = body.packages.slice(i, i + BATCH_SIZE);
    const stmts = batch.map((pkg) =>
      packageRepo.create(c.env.DB, {
        id: crypto.randomUUID(),
        asset_id: assetId,
        ecosystem: pkg.ecosystem,
        name: pkg.name,
        version: pkg.version,
        vendor: pkg.vendor ?? null,
      }),
    );
    const results = await c.env.DB.batch(stmts);
    totalCreated += results.filter((r) => (r.meta.changes ?? 0) > 0).length;
  }

  return c.json({
    message: 'Import completed',
    totalRequested: body.packages.length,
    totalCreated,
  }, 201);
});

// DELETE /api/assets/:id/packages/:pkgId
packageRoutes.delete('/:id/packages/:pkgId', requireRole('editor'), async (c) => {
  const assetId = c.req.param('id');
  const pkgId = c.req.param('pkgId');

  const pkg = await packageRepo.findById(c.env.DB, pkgId);
  if (!pkg || pkg.asset_id !== assetId) {
    return c.json({ error: 'Package not found' }, 404);
  }

  await packageRepo.delete(c.env.DB, pkgId);
  return c.json({ message: 'Deleted' });
});

// POST /api/assets/:id/packages/scan — オンデマンド脆弱性スキャン
packageRoutes.post('/:id/packages/scan', requireRole('editor'), async (c) => {
  const assetId = c.req.param('id');
  const asset = await assetRepo.findById(c.env.DB, assetId);
  if (!asset) return c.json({ error: 'Asset not found' }, 404);

  const packagesResult = await packageRepo.listByAsset(c.env.DB, assetId);
  const packages = packagesResult.results ?? [];

  if (packages.length === 0) {
    return c.json({ message: 'No packages to scan', matchesCreated: 0 });
  }

  const matchesCreated = await matchPackageToVulnerabilities(c.env, packages);

  return c.json({
    message: 'Scan completed',
    packagesScanned: packages.length,
    matchesCreated,
  });
});

function mapPackage(p: DbAssetPackage) {
  return {
    id: p.id,
    assetId: p.asset_id,
    ecosystem: p.ecosystem,
    name: p.name,
    version: p.version,
    vendor: p.vendor,
    cpeString: p.cpe_string,
    purl: p.purl,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}
