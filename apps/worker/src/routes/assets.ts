import { Hono } from 'hono';
import type { Env, JwtVariables } from '../types.ts';
import { authMiddleware } from '../middleware/auth.ts';
import { assetRepo, vulnRepo } from '../db/repository.ts';
import { slaRepo } from '../db/sla-repository.ts';
import { validate } from '../validation/middleware.ts';
import {
  createAssetSchema,
  updateAssetSchema,
  linkVulnerabilitySchema,
  updateAssetVulnerabilitySchema,
} from '../validation/schemas.ts';

export const assetRoutes = new Hono<{ Bindings: Env; Variables: JwtVariables }>();

assetRoutes.use('/*', authMiddleware);

// GET /api/assets
assetRoutes.get('/', async (c) => {
  const page = Math.max(1, Number(c.req.query('page') ?? 1));
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? 20)));
  const environment = c.req.query('environment');
  const assetType = c.req.query('assetType');

  const { countStmt, dataStmt } = assetRepo.list(c.env.DB, {
    page,
    limit,
    ...(environment && { environment }),
    ...(assetType && { assetType }),
  });
  const [countResult, dataResult] = await c.env.DB.batch([countStmt, dataStmt]);

  const total = (countResult!.results[0] as { total: number } | undefined)?.total ?? 0;
  return c.json({
    data: (dataResult!.results ?? []).map((a) => mapAsset(a as Record<string, unknown>)),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

// GET /api/assets/:id
assetRoutes.get('/:id', async (c) => {
  const asset = await assetRepo.findById(c.env.DB, c.req.param('id'));
  if (!asset) return c.json({ error: 'Not found' }, 404);
  return c.json(mapAsset(asset as unknown as Record<string, unknown>));
});

// POST /api/assets
assetRoutes.post('/', validate(createAssetSchema), async (c) => {
  const body = c.get('validatedBody') as {
    name: string;
    assetType: string;
    description?: string;
    environment?: string;
    owner?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  };

  const id = crypto.randomUUID();
  await assetRepo.create(c.env.DB, {
    id,
    name: body.name,
    asset_type: body.assetType,
    description: body.description ?? null,
    environment: body.environment ?? 'production',
    owner: body.owner ?? null,
    tags: JSON.stringify(body.tags ?? []),
    metadata: JSON.stringify(body.metadata ?? {}),
  });

  const created = await assetRepo.findById(c.env.DB, id);
  return c.json(mapAsset(created! as unknown as Record<string, unknown>), 201);
});

// PATCH /api/assets/:id
assetRoutes.patch('/:id', validate(updateAssetSchema), async (c) => {
  const id = c.req.param('id');
  const existing = await assetRepo.findById(c.env.DB, id);
  if (!existing) return c.json({ error: 'Not found' }, 404);

  const body = c.get('validatedBody') as {
    name?: string;
    assetType?: string;
    description?: string;
    environment?: string;
    owner?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  };

  const fields: Record<string, unknown> = {};
  if (body.name !== undefined) fields['name'] = body.name;
  if (body.assetType !== undefined) fields['asset_type'] = body.assetType;
  if (body.description !== undefined) fields['description'] = body.description;
  if (body.environment !== undefined) fields['environment'] = body.environment;
  if (body.owner !== undefined) fields['owner'] = body.owner;
  if (body.tags !== undefined) fields['tags'] = JSON.stringify(body.tags);
  if (body.metadata !== undefined) fields['metadata'] = JSON.stringify(body.metadata);

  await assetRepo.update(c.env.DB, id, fields);
  const updated = await assetRepo.findById(c.env.DB, id);
  return c.json(mapAsset(updated! as unknown as Record<string, unknown>));
});

// DELETE /api/assets/:id
assetRoutes.delete('/:id', async (c) => {
  const existing = await assetRepo.findById(c.env.DB, c.req.param('id'));
  if (!existing) return c.json({ error: 'Not found' }, 404);
  await assetRepo.delete(c.env.DB, c.req.param('id'));
  return c.json({ message: 'Deleted' });
});

// GET /api/assets/:id/vulnerabilities
assetRoutes.get('/:id/vulnerabilities', async (c) => {
  const asset = await assetRepo.findById(c.env.DB, c.req.param('id'));
  if (!asset) return c.json({ error: 'Asset not found' }, 404);
  const result = await assetRepo.listVulnerabilities(c.env.DB, c.req.param('id'));
  return c.json({ data: result.results ?? [] });
});

// POST /api/assets/:id/vulnerabilities
assetRoutes.post('/:id/vulnerabilities', validate(linkVulnerabilitySchema), async (c) => {
  const assetId = c.req.param('id');
  const asset = await assetRepo.findById(c.env.DB, assetId);
  if (!asset) return c.json({ error: 'Asset not found' }, 404);

  const body = c.get('validatedBody') as { vulnerabilityId: string; priority?: string };

  const vuln = await vulnRepo.findById(c.env.DB, body.vulnerabilityId);
  if (!vuln) return c.json({ error: 'Vulnerability not found' }, 404);

  const linkId = crypto.randomUUID();
  await assetRepo.linkVulnerability(
    c.env.DB,
    linkId,
    assetId,
    body.vulnerabilityId,
    body.priority ?? 'medium',
  );

  // SLA期限を自動計算して設定
  const severity = vuln['severity'] as string;
  const policy = await slaRepo.findPolicy(c.env.DB, severity);
  if (policy) {
    const createdAt = new Date().toISOString();
    const deadline = slaRepo.calculateDeadline(createdAt, policy.response_days);
    await c.env.DB.prepare(
      'UPDATE asset_vulnerabilities SET sla_deadline = ? WHERE id = ?'
    ).bind(deadline, linkId).run();
  }

  return c.json({ message: 'Linked' }, 201);
});

// PATCH /api/assets/:assetId/vulnerabilities/:vulnId
assetRoutes.patch('/:assetId/vulnerabilities/:vulnId', validate(updateAssetVulnerabilitySchema), async (c) => {
  const { assetId, vulnId } = c.req.param();
  const body = c.get('validatedBody') as {
    status?: string;
    priority?: string;
    assignedTo?: string;
    dueDate?: string;
    notes?: string;
  };

  const fields: Record<string, unknown> = {};
  if (body.status !== undefined) fields['status'] = body.status;
  if (body.priority !== undefined) fields['priority'] = body.priority;
  if (body.assignedTo !== undefined) fields['assigned_to'] = body.assignedTo;
  if (body.dueDate !== undefined) fields['due_date'] = body.dueDate;
  if (body.notes !== undefined) fields['notes'] = body.notes;
  if (body.status === 'fixed' || body.status === 'accepted_risk' || body.status === 'false_positive') {
    fields['resolved_at'] = new Date().toISOString();
  }

  await assetRepo.updateVulnerabilityLink(c.env.DB, assetId, vulnId, fields);
  return c.json({ message: 'Updated' });
});

// DELETE /api/assets/:assetId/vulnerabilities/:vulnId
assetRoutes.delete('/:assetId/vulnerabilities/:vulnId', async (c) => {
  const { assetId, vulnId } = c.req.param();
  await assetRepo.unlinkVulnerability(c.env.DB, assetId, vulnId);
  return c.json({ message: 'Unlinked' });
});

function mapAsset(a: Record<string, unknown>) {
  return {
    id: a['id'],
    name: a['name'],
    assetType: a['asset_type'],
    description: a['description'],
    environment: a['environment'],
    owner: a['owner'],
    tags: safeParseJson(a['tags'] as string, []),
    metadata: safeParseJson(a['metadata'] as string, {}),
    createdAt: a['created_at'],
    updatedAt: a['updated_at'],
  };
}

function safeParseJson<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback;
  try { return JSON.parse(val) as T; } catch { return fallback; }
}
