import { Hono } from 'hono';
import type { Env, JwtVariables } from '../types.ts';
import { authMiddleware, requireRole } from '../middleware/auth.ts';
import { notificationRepo } from '../db/notification-repository.ts';
import { sendTestNotification } from '../services/notifications.ts';

export const notificationRoutes = new Hono<{ Bindings: Env; Variables: JwtVariables }>();

notificationRoutes.use('/*', authMiddleware);

// ========================================
// チャネル管理
// ========================================

// GET /api/notifications/channels - チャネル一覧
notificationRoutes.get('/channels', async (c) => {
  const channels = await notificationRepo.listChannels(c.env.DB);
  return c.json(channels);
});

// GET /api/notifications/channels/:id - チャネル詳細
notificationRoutes.get('/channels/:id', async (c) => {
  const channel = await notificationRepo.findChannelById(c.env.DB, c.req.param('id'));
  if (!channel) return c.json({ error: 'Channel not found' }, 404);
  return c.json(channel);
});

// POST /api/notifications/channels - チャネル作成（admin限定）
notificationRoutes.post('/channels', requireRole('admin'), async (c) => {
  const body = await c.req.json<{
    name: string;
    type: 'webhook' | 'email';
    config: Record<string, unknown>;
  }>();

  if (!body.name || !body.type || !body.config) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  if (!['webhook', 'email'].includes(body.type)) {
    return c.json({ error: 'Invalid channel type' }, 400);
  }

  const id = crypto.randomUUID();
  await notificationRepo.createChannel(c.env.DB, {
    id,
    name: body.name,
    type: body.type,
    config: JSON.stringify(body.config),
    is_active: 1,
  });

  return c.json({ id, message: 'Channel created' }, 201);
});

// PATCH /api/notifications/channels/:id - チャネル更新（admin限定）
notificationRoutes.patch('/channels/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{
    name?: string;
    config?: Record<string, unknown>;
    isActive?: boolean;
  }>();

  const channel = await notificationRepo.findChannelById(c.env.DB, id);
  if (!channel) return c.json({ error: 'Channel not found' }, 404);

  await notificationRepo.updateChannel(c.env.DB, id, {
    ...(body.name && { name: body.name }),
    ...(body.config && { config: JSON.stringify(body.config) }),
    ...(body.isActive !== undefined && { is_active: body.isActive ? 1 : 0 }),
  });

  return c.json({ message: 'Channel updated' });
});

// DELETE /api/notifications/channels/:id - チャネル削除（admin限定）
notificationRoutes.delete('/channels/:id', requireRole('admin'), async (c) => {
  const channel = await notificationRepo.findChannelById(c.env.DB, c.req.param('id'));
  if (!channel) return c.json({ error: 'Channel not found' }, 404);

  await notificationRepo.deleteChannel(c.env.DB, c.req.param('id'));
  return c.json({ message: 'Channel deleted' });
});

// POST /api/notifications/channels/:id/test - テスト送信（admin限定）
notificationRoutes.post('/channels/:id/test', requireRole('admin'), async (c) => {
  const channel = await notificationRepo.findChannelById(c.env.DB, c.req.param('id'));
  if (!channel) return c.json({ error: 'Channel not found' }, 404);

  try {
    await sendTestNotification(c.env, channel);
    return c.json({ message: 'Test notification sent' });
  } catch (error) {
    console.error('Test notification error:', error);
    return c.json(
      { error: 'Failed to send test notification', details: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// ========================================
// ルール管理
// ========================================

// GET /api/notifications/rules - ルール一覧
notificationRoutes.get('/rules', async (c) => {
  const channelId = c.req.query('channelId');
  const rules = await notificationRepo.listRules(c.env.DB, channelId);
  return c.json(rules);
});

// POST /api/notifications/rules - ルール作成（admin限定）
notificationRoutes.post('/rules', requireRole('admin'), async (c) => {
  const body = await c.req.json<{
    channelId: string;
    eventType: string;
    filterConfig?: Record<string, unknown>;
  }>();

  if (!body.channelId || !body.eventType) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  const validEvents = [
    'vulnerability_created',
    'vulnerability_updated',
    'vulnerability_critical',
    'eol_approaching',
  ];

  if (!validEvents.includes(body.eventType)) {
    return c.json({ error: 'Invalid event type' }, 400);
  }

  const id = crypto.randomUUID();
  await notificationRepo.createRule(c.env.DB, {
    id,
    channel_id: body.channelId,
    event_type: body.eventType,
    filter_config: body.filterConfig ? JSON.stringify(body.filterConfig) : null,
    is_active: 1,
  });

  return c.json({ id, message: 'Rule created' }, 201);
});

// PATCH /api/notifications/rules/:id - ルール更新（admin限定）
notificationRoutes.patch('/rules/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{
    eventType?: string;
    filterConfig?: Record<string, unknown>;
    isActive?: boolean;
  }>();

  const rule = await notificationRepo.findRuleById(c.env.DB, id);
  if (!rule) return c.json({ error: 'Rule not found' }, 404);

  await notificationRepo.updateRule(c.env.DB, id, {
    ...(body.eventType && { event_type: body.eventType }),
    ...(body.filterConfig && { filter_config: JSON.stringify(body.filterConfig) }),
    ...(body.isActive !== undefined && { is_active: body.isActive ? 1 : 0 }),
  });

  return c.json({ message: 'Rule updated' });
});

// DELETE /api/notifications/rules/:id - ルール削除（admin限定）
notificationRoutes.delete('/rules/:id', requireRole('admin'), async (c) => {
  const rule = await notificationRepo.findRuleById(c.env.DB, c.req.param('id'));
  if (!rule) return c.json({ error: 'Rule not found' }, 404);

  await notificationRepo.deleteRule(c.env.DB, c.req.param('id'));
  return c.json({ message: 'Rule deleted' });
});

// ========================================
// ログ管理
// ========================================

// GET /api/notifications/logs - ログ一覧
notificationRoutes.get('/logs', async (c) => {
  const channelId = c.req.query('channelId');
  const limit = c.req.query('limit') ? Number(c.req.query('limit')) : undefined;

  const logs = await notificationRepo.listLogs(c.env.DB, {
    ...(channelId && { channelId }),
    ...(limit !== undefined && { limit }),
  });
  return c.json(logs);
});
