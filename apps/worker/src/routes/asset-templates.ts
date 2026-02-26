import { Hono } from 'hono';
import type { Env, JwtVariables } from '../types.ts';
import { authMiddleware, requireRole } from '../middleware/auth.ts';
import {
  assetTemplateRepo,
  assetTemplatePackageRepo,
  assetTemplateEolLinkRepo,
  type DbAssetTemplate,
  type DbAssetTemplatePackage,
  type DbAssetTemplateEolLink,
} from '../db/asset-template-repository.ts';
import { assetRepo } from '../db/repository.ts';
import { packageRepo } from '../db/package-repository.ts';
import { assetEolLinkRepo } from '../db/eol-repository.ts';

export const assetTemplateRoutes = new Hono<{ Bindings: Env; Variables: JwtVariables }>();

assetTemplateRoutes.use('/*', authMiddleware);

// GET /api/asset-templates - テンプレート一覧
assetTemplateRoutes.get('/', async (c) => {
  const q = c.req.query('q');
  const assetType = c.req.query('assetType');
  const environment = c.req.query('environment');
  const sortBy = c.req.query('sortBy') ?? 'created_at';
  const sortOrder = c.req.query('sortOrder') ?? 'desc';
  const page = Math.max(1, Number(c.req.query('page') ?? 1));
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? 20)));

  const options: {
    q?: string;
    assetType?: string;
    environment?: string;
    sortBy: string;
    sortOrder: string;
    page: number;
    limit: number;
  } = {
    sortBy,
    sortOrder,
    page,
    limit,
  };
  if (q) options.q = q;
  if (assetType) options.assetType = assetType;
  if (environment) options.environment = environment;

  const { countStmt, dataStmt } = assetTemplateRepo.list(c.env.DB, options);

  const [countResult, dataResult] = await c.env.DB.batch([countStmt, dataStmt]);

  const total = (countResult?.results?.[0] as { total: number } | undefined)?.total ?? 0;
  const templates = ((dataResult?.results ?? []) as DbAssetTemplate[]).map(mapTemplate);

  return c.json({
    data: templates,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

// GET /api/asset-templates/:id - テンプレート詳細
assetTemplateRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const template = await assetTemplateRepo.findById(c.env.DB, id);

  if (!template) {
    return c.json({ error: 'Template not found' }, 404);
  }

  const packagesResult = await assetTemplatePackageRepo.listByTemplate(c.env.DB, id).all<DbAssetTemplatePackage>();
  const eolLinksResult = await assetTemplateEolLinkRepo.listByTemplate(c.env.DB, id).all<DbAssetTemplateEolLink>();

  return c.json({
    ...mapTemplate(template),
    packages: (packagesResult.results ?? []).map(mapPackage),
    eolLinks: (eolLinksResult.results ?? []).map(mapEolLink),
  });
});

// POST /api/asset-templates - テンプレート作成
assetTemplateRoutes.post('/', requireRole('editor'), async (c) => {
  const body = await c.req.json<{
    name: string;
    description?: string;
    assetType: string;
    environment?: string;
    packages?: Array<{ ecosystem: string; name: string; version: string; vendor?: string }>;
    eolCycleIds?: string[];
  }>();

  const userId = c.get('userId');
  const id = crypto.randomUUID();

  // テンプレート作成
  await assetTemplateRepo.create(c.env.DB, {
    id,
    name: body.name,
    description: body.description ?? null,
    asset_type: body.assetType,
    environment: body.environment ?? 'production',
    created_by: userId,
  }).run();

  // パッケージ追加
  if (body.packages && body.packages.length > 0) {
    const pkgStmts = body.packages.map((pkg) =>
      assetTemplatePackageRepo.create(c.env.DB, {
        id: crypto.randomUUID(),
        template_id: id,
        ecosystem: pkg.ecosystem,
        name: pkg.name,
        version: pkg.version,
        vendor: pkg.vendor ?? null,
      })
    );
    await c.env.DB.batch(pkgStmts);
  }

  // EOLリンク追加
  if (body.eolCycleIds && body.eolCycleIds.length > 0) {
    const eolStmts = body.eolCycleIds.map((cycleId) =>
      assetTemplateEolLinkRepo.create(c.env.DB, {
        id: crypto.randomUUID(),
        template_id: id,
        eol_cycle_id: cycleId,
      })
    );
    await c.env.DB.batch(eolStmts);
  }

  const created = await assetTemplateRepo.findById(c.env.DB, id);
  return c.json(mapTemplate(created!), 201);
});

// PATCH /api/asset-templates/:id - テンプレート更新
assetTemplateRoutes.patch('/:id', requireRole('editor'), async (c) => {
  const id = c.req.param('id');
  const template = await assetTemplateRepo.findById(c.env.DB, id);

  if (!template) {
    return c.json({ error: 'Template not found' }, 404);
  }

  const body = await c.req.json<{
    name?: string;
    description?: string;
    assetType?: string;
    environment?: string;
  }>();

  const fields: Record<string, unknown> = {};
  if (body.name !== undefined) fields['name'] = body.name;
  if (body.description !== undefined) fields['description'] = body.description;
  if (body.assetType !== undefined) fields['asset_type'] = body.assetType;
  if (body.environment !== undefined) fields['environment'] = body.environment;

  await assetTemplateRepo.update(c.env.DB, id, fields).run();

  const updated = await assetTemplateRepo.findById(c.env.DB, id);
  return c.json(mapTemplate(updated!));
});

// DELETE /api/asset-templates/:id - テンプレート削除
assetTemplateRoutes.delete('/:id', requireRole('editor'), async (c) => {
  const id = c.req.param('id');
  const template = await assetTemplateRepo.findById(c.env.DB, id);

  if (!template) {
    return c.json({ error: 'Template not found' }, 404);
  }

  await assetTemplateRepo.delete(c.env.DB, id).run();
  return c.json({ message: 'Template deleted' });
});

// POST /api/asset-templates/:id/create-asset - テンプレートからアセット作成
assetTemplateRoutes.post('/:id/create-asset', requireRole('editor'), async (c) => {
  const templateId = c.req.param('id');
  const template = await assetTemplateRepo.findById(c.env.DB, templateId);

  if (!template) {
    return c.json({ error: 'Template not found' }, 404);
  }

  const body = await c.req.json<{
    name: string;
    owner?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }>();

  const assetId = crypto.randomUUID();

  // アセット作成
  await assetRepo.create(c.env.DB, {
    id: assetId,
    name: body.name,
    asset_type: template.asset_type,
    description: template.description,
    environment: template.environment,
    owner: body.owner ?? null,
    tags: JSON.stringify(body.tags ?? []),
    metadata: JSON.stringify(body.metadata ?? {}),
  });

  // パッケージをコピー
  const packagesResult = await assetTemplatePackageRepo.listByTemplate(c.env.DB, templateId).all<DbAssetTemplatePackage>();
  const packages = packagesResult.results ?? [];

  if (packages.length > 0) {
    const pkgStmts = packages.map((pkg) =>
      packageRepo.create(c.env.DB, {
        id: crypto.randomUUID(),
        asset_id: assetId,
        ecosystem: pkg.ecosystem,
        name: pkg.name,
        version: pkg.version,
        vendor: pkg.vendor,
      })
    );
    await c.env.DB.batch(pkgStmts);
  }

  // EOLリンクをコピー
  const eolLinksResult = await assetTemplateEolLinkRepo.listByTemplate(c.env.DB, templateId).all<DbAssetTemplateEolLink>();
  const eolLinks = eolLinksResult.results ?? [];

  if (eolLinks.length > 0) {
    const eolStmts = eolLinks.map((link) =>
      assetEolLinkRepo.create(c.env.DB, {
        id: crypto.randomUUID(),
        asset_id: assetId,
        eol_cycle_id: link.eol_cycle_id,
        installed_version: null,
        notes: null,
      })
    );
    await c.env.DB.batch(eolStmts);
  }

  const createdAsset = await assetRepo.findById(c.env.DB, assetId);
  return c.json({
    id: createdAsset!['id'],
    name: createdAsset!['name'],
    assetType: createdAsset!['asset_type'],
    packagesCreated: packages.length,
    eolLinksCreated: eolLinks.length,
  }, 201);
});

function mapTemplate(t: DbAssetTemplate) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    assetType: t.asset_type,
    environment: t.environment,
    createdBy: t.created_by,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

function mapPackage(p: DbAssetTemplatePackage) {
  return {
    id: p.id,
    templateId: p.template_id,
    ecosystem: p.ecosystem,
    name: p.name,
    version: p.version,
    vendor: p.vendor,
    createdAt: p.created_at,
  };
}

function mapEolLink(l: DbAssetTemplateEolLink) {
  return {
    id: l.id,
    templateId: l.template_id,
    eolCycleId: l.eol_cycle_id,
    createdAt: l.created_at,
  };
}
