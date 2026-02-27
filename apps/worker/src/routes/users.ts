import { Hono } from 'hono';
import type { Env, JwtVariables } from '../types.ts';
import { userRepo } from '../db/repository.ts';
import { authMiddleware, requireRole } from '../middleware/auth.ts';
import { hashPassword } from '../services/auth.ts';
import { validate } from '../validation/middleware.ts';
import { createUserSchema, updateUserSchema, resetPasswordSchema } from '../validation/schemas.ts';

export const userRoutes = new Hono<{ Bindings: Env; Variables: JwtVariables }>();

const VALID_ROLES = ['admin', 'editor', 'viewer'] as const;

// List all users - admin only
userRoutes.get('/', authMiddleware, requireRole('admin'), async (c) => {
  const result = await userRepo.list(c.env.DB);
  return c.json(result.results.map((u) => ({
    id: u.id,
    email: u.email,
    username: u.username,
    role: u.role,
    isActive: u.is_active === 1,
    createdAt: u.created_at,
  })));
});

// Create user - admin only
userRoutes.post('/', authMiddleware, requireRole('admin'), validate(createUserSchema), async (c) => {
  const body = c.get('validatedBody') as { email: string; username: string; password: string; role?: string };

  const existing = await userRepo.findByEmail(c.env.DB, body.email);
  if (existing) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(body.password);
  const role = VALID_ROLES.includes(body.role as typeof VALID_ROLES[number]) ? body.role! : 'viewer';

  await userRepo.create(c.env.DB, {
    id,
    email: body.email,
    username: body.username,
    password_hash: passwordHash,
    role,
    is_active: 1,
  });

  return c.json({ id, email: body.email, username: body.username, role }, 201);
});

// Update user role/status/profile - admin only
userRoutes.patch('/:id', authMiddleware, requireRole('admin'), validate(updateUserSchema), async (c) => {
  const id = c.req.param('id');
  const body = c.get('validatedBody') as { role?: string; isActive?: boolean; username?: string; email?: string };

  const user = await userRepo.findById(c.env.DB, id);
  if (!user) return c.json({ error: 'User not found' }, 404);

  if (id === c.get('userId') && body.role && body.role !== 'admin') {
    return c.json({ error: '自分自身のロールは変更できません' }, 400);
  }

  if (body.role && VALID_ROLES.includes(body.role as typeof VALID_ROLES[number])) {
    await userRepo.updateRole(c.env.DB, id, body.role);
  }
  if (body.isActive !== undefined) {
    await userRepo.setActive(c.env.DB, id, body.isActive ? 1 : 0);
  }
  if (body.username || body.email) {
    if (body.email && body.email !== user.email) {
      const existing = await userRepo.findByEmail(c.env.DB, body.email);
      if (existing) return c.json({ error: 'このメールアドレスはすでに使用されています' }, 409);
    }
    await userRepo.updateProfile(c.env.DB, id, {
      ...(body.username !== undefined && { username: body.username }),
      ...(body.email !== undefined && { email: body.email }),
    });
  }

  return c.json({ message: 'Updated' });
});

// Reset user password - admin only
userRoutes.post('/:id/reset-password', authMiddleware, requireRole('admin'), validate(resetPasswordSchema), async (c) => {
  const id = c.req.param('id');
  const body = c.get('validatedBody') as { password: string };

  const user = await userRepo.findById(c.env.DB, id);
  if (!user) return c.json({ error: 'User not found' }, 404);

  const passwordHash = await hashPassword(body.password);
  await userRepo.updatePassword(c.env.DB, id, passwordHash);
  return c.json({ message: 'Password reset' });
});

// Delete user - admin only
userRoutes.delete('/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');

  if (id === c.get('userId')) {
    return c.json({ error: '自分自身は削除できません' }, 400);
  }

  const user = await userRepo.findById(c.env.DB, id);
  if (!user) return c.json({ error: 'User not found' }, 404);

  // リフレッシュトークンを先に削除してからユーザーを削除
  await c.env.DB.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').bind(id).run();
  await userRepo.delete(c.env.DB, id);
  return c.json({ message: 'User deleted' });
});
