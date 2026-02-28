import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import type { Env, JwtVariables } from '../types.ts';
import {
  hashPassword,
  verifyPassword,
  makeAccessToken,
  makeRefreshToken,
  verifyJwt,
  hashToken,
} from '../services/auth.ts';
import { userRepo, tokenRepo, passwordResetTokenRepo, appSettingsRepo } from '../db/repository.ts';
import { authMiddleware } from '../middleware/auth.ts';
import { validate } from '../validation/middleware.ts';
import { registerSchema, loginSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordWithTokenSchema } from '../validation/schemas.ts';
import { sendPasswordResetEmail } from '../services/email.ts';
import { rateLimitPresets } from '../middleware/rateLimit.ts';

const REFRESH_TOKEN_TTL_DAYS = 30;

export const authRoutes = new Hono<{ Bindings: Env; Variables: JwtVariables }>();

authRoutes.get('/initialized', async (c) => {
  const result = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM users').first<{ cnt: number }>();
  return c.json({ initialized: (result?.cnt ?? 0) > 0 });
});

authRoutes.post('/register', rateLimitPresets.register, validate(registerSchema), async (c) => {
  const body = c.get('validatedBody') as { username: string; password: string };

  const countResult = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM users').first<{ cnt: number }>();
  const userCount = countResult?.cnt ?? 0;

  if (userCount > 0) {
    // After first user, require admin authentication
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: '管理者のみがアカウントを作成できます' }, 403);
    }
    const token = authHeader.slice(7);
    const payload = await verifyJwt<{ sub: string; role: string; type: string }>(token, c.env.JWT_SECRET);
    if (!payload || payload.type !== 'access' || payload.role !== 'admin') {
      return c.json({ error: '管理者のみがアカウントを作成できます' }, 403);
    }
  }

  const existing = await userRepo.findByUsername(c.env.DB, body.username);
  if (existing) {
    return c.json({ error: 'Registration failed. Please check your input.' }, 400);
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(body.password);
  const role = userCount === 0 ? 'admin' : 'viewer';

  await userRepo.create(c.env.DB, {
    id,
    username: body.username,
    password_hash: passwordHash,
    role,
    is_active: 1,
  });

  return c.json({ message: 'Registration successful' }, 201);
});

authRoutes.post('/login', rateLimitPresets.login, validate(loginSchema), async (c) => {
  const body = c.get('validatedBody') as { username: string; password: string };

  const user = await userRepo.findByUsername(c.env.DB, body.username);
  if (!user || !user.is_active) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  if (user.locked_at) {
    return c.json({ error: 'Account locked. Contact an administrator.' }, 423);
  }

  const valid = await verifyPassword(body.password, user.password_hash);
  if (!valid) {
    await userRepo.incrementFailedAttempts(c.env.DB, user.id);
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  await userRepo.resetFailedAttempts(c.env.DB, user.id);

  const accessToken = await makeAccessToken(user.id, user.role, c.env.JWT_SECRET);

  const jti = crypto.randomUUID();
  const refreshToken = await makeRefreshToken(user.id, jti, c.env.JWT_SECRET);
  const tokenHash = await hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 86400 * 1000).toISOString();

  await tokenRepo.create(c.env.DB, jti, user.id, tokenHash, expiresAt);

  setCookie(c, 'refreshToken', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    path: '/api/auth',
    maxAge: REFRESH_TOKEN_TTL_DAYS * 86400,
  });

  return c.json({
    accessToken,
    user: { id: user.id, username: user.username, role: user.role },
  });
});

authRoutes.post('/refresh', rateLimitPresets.refresh, async (c) => {
  const cookieHeader = c.req.header('Cookie') ?? '';
  const match = /refreshToken=([^;]+)/.exec(cookieHeader);
  const refreshToken = match?.[1];

  if (!refreshToken) {
    return c.json({ error: 'No refresh token' }, 401);
  }

  const payload = await verifyJwt<{ sub: string; jti: string; type: string }>(
    refreshToken,
    c.env.JWT_SECRET,
  );
  if (!payload || payload.type !== 'refresh') {
    return c.json({ error: 'Invalid refresh token' }, 401);
  }

  const tokenHash = await hashToken(refreshToken);
  const storedToken = await tokenRepo.findByHash(c.env.DB, tokenHash);
  if (!storedToken) {
    return c.json({ error: 'Token revoked or expired' }, 401);
  }

  const user = await userRepo.findById(c.env.DB, storedToken.user_id);
  if (!user || !user.is_active) {
    return c.json({ error: 'User not found' }, 401);
  }

  const accessToken = await makeAccessToken(user.id, user.role, c.env.JWT_SECRET);
  return c.json({ accessToken });
});

authRoutes.post('/logout', async (c) => {
  const cookieHeader = c.req.header('Cookie') ?? '';
  const match = /refreshToken=([^;]+)/.exec(cookieHeader);
  const refreshToken = match?.[1];

  if (refreshToken) {
    const tokenHash = await hashToken(refreshToken);
    const stored = await tokenRepo.findByHash(c.env.DB, tokenHash);
    if (stored) {
      await tokenRepo.revoke(c.env.DB, stored.id);
    }
  }

  deleteCookie(c, 'refreshToken', { path: '/api/auth' });
  return c.json({ message: 'Logged out' });
});

authRoutes.get('/me', authMiddleware, async (c) => {
  const user = await userRepo.findById(c.env.DB, c.get('userId'));
  if (!user) return c.json({ error: 'User not found' }, 404);
  return c.json({
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.created_at,
  });
});

authRoutes.post('/forgot-password', rateLimitPresets.password, validate(forgotPasswordSchema), async (c) => {
  const body = c.get('validatedBody') as { email: string };
  const RESPONSE = { message: 'If the email exists, a reset link has been sent.' };

  const user = await userRepo.findByEmail(c.env.DB, body.email);
  if (user) {
    const token = crypto.randomUUID();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
    const id = crypto.randomUUID();

    await passwordResetTokenRepo.create(c.env.DB, id, user.id, tokenHash, expiresAt);

    const resetUrl = `${c.env.PAGES_URL}/reset-password?token=${token}`;
    const fromSetting = await appSettingsRepo.get(c.env.DB, 'noreply_email');
    const fromEmail = fromSetting?.value ?? c.env.NOREPLY_EMAIL;
    try {
      await sendPasswordResetEmail(c.env, fromEmail, user.email!, resetUrl);
    } catch (err) {
      console.error('Failed to send password reset email:', err);
    }
  }

  return c.json(RESPONSE, 200);
});

authRoutes.post('/reset-password', rateLimitPresets.password, validate(resetPasswordWithTokenSchema), async (c) => {
  const body = c.get('validatedBody') as { token: string; password: string };

  const tokenHash = await hashToken(body.token);
  const resetToken = await passwordResetTokenRepo.findValidByHash(c.env.DB, tokenHash);
  if (!resetToken) {
    return c.json({ error: 'Invalid or expired token' }, 400);
  }

  const user = await userRepo.findById(c.env.DB, resetToken.user_id);
  if (!user) {
    return c.json({ error: 'User not found' }, 400);
  }

  const newHash = await hashPassword(body.password);
  await userRepo.updatePassword(c.env.DB, user.id, newHash);
  await passwordResetTokenRepo.markUsed(c.env.DB, resetToken.id);
  await tokenRepo.revokeAllForUser(c.env.DB, user.id);
  await userRepo.unlock(c.env.DB, user.id);

  return c.json({ message: 'Password has been reset.' }, 200);
});

authRoutes.post('/change-password', authMiddleware, rateLimitPresets.password, validate(changePasswordSchema), async (c) => {
  const body = c.get('validatedBody') as { currentPassword: string; newPassword: string };

  const user = await userRepo.findById(c.env.DB, c.get('userId'));
  if (!user) return c.json({ error: 'User not found' }, 404);

  const valid = await verifyPassword(body.currentPassword, user.password_hash);
  if (!valid) return c.json({ error: 'Current password is incorrect' }, 401);

  const newHash = await hashPassword(body.newPassword);
  await userRepo.updatePassword(c.env.DB, user.id, newHash);
  return c.json({ message: 'Password changed' });
});
