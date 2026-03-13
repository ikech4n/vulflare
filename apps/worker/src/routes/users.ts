import { Hono } from "hono";
import { userRepo } from "../db/repository.ts";
import { authMiddleware, requireRole } from "../middleware/auth.ts";
import { hashPassword } from "../services/auth.ts";
import type { Env, JwtVariables } from "../types.ts";
import { validate } from "../validation/middleware.ts";
import { createUserSchema, resetPasswordSchema, updateUserSchema } from "../validation/schemas.ts";

export const userRoutes = new Hono<{ Bindings: Env; Variables: JwtVariables }>();

const VALID_ROLES = ["admin", "editor", "viewer"] as const;

// List all users - admin only
userRoutes.get("/", authMiddleware, requireRole("admin"), async (c) => {
  const result = await userRepo.list(c.env.DB);
  return c.json(
    result.results.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.display_name ?? null,
      role: u.role,
      isActive: u.is_active === 1,
      lockedAt: u.locked_at ?? null,
      email: u.email ?? null,
      createdAt: u.created_at,
    })),
  );
});

// Create user - admin only
userRoutes.post(
  "/",
  authMiddleware,
  requireRole("admin"),
  validate(createUserSchema),
  async (c) => {
    const body = c.get("validatedBody") as {
      username: string;
      password: string;
      role?: string;
      email?: string;
    };

    const existing = await userRepo.findByUsername(c.env.DB, body.username);
    if (existing) {
      return c.json({ error: "Username already registered" }, 409);
    }

    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(body.password);
    const role = VALID_ROLES.includes(body.role as (typeof VALID_ROLES)[number])
      ? (body.role as string)
      : "viewer";

    await userRepo.create(c.env.DB, {
      id,
      username: body.username,
      password_hash: passwordHash,
      role,
      is_active: 1,
      email: body.email ?? null,
    });

    return c.json({ id, username: body.username, role }, 201);
  },
);

// Update user role/status/profile - admin only
userRoutes.patch(
  "/:id",
  authMiddleware,
  requireRole("admin"),
  validate(updateUserSchema),
  async (c) => {
    const id = c.req.param("id") ?? "";
    const body = c.get("validatedBody") as {
      role?: string;
      isActive?: boolean;
      username?: string;
      email?: string | null;
    };

    const user = await userRepo.findById(c.env.DB, id);
    if (!user) return c.json({ error: "User not found" }, 404);

    if (id === c.get("userId") && body.role && body.role !== "admin") {
      return c.json({ error: "自分自身のロールは変更できません" }, 400);
    }

    if (body.role && VALID_ROLES.includes(body.role as (typeof VALID_ROLES)[number])) {
      await userRepo.updateRole(c.env.DB, id, body.role);
    }
    if (body.isActive !== undefined) {
      await userRepo.setActive(c.env.DB, id, body.isActive ? 1 : 0);
    }
    if (body.username || body.email !== undefined) {
      const profileFields: { username?: string; email?: string | null } = {};
      if (body.username) profileFields.username = body.username;
      if (body.email !== undefined) profileFields.email = body.email;
      await userRepo.updateProfile(c.env.DB, id, profileFields);
    }

    return c.json({ message: "Updated" });
  },
);

// Unlock user account - admin only
userRoutes.post("/:id/unlock", authMiddleware, requireRole("admin"), async (c) => {
  const id = c.req.param("id") ?? "";

  const user = await userRepo.findById(c.env.DB, id);
  if (!user) return c.json({ error: "User not found" }, 404);

  await userRepo.unlock(c.env.DB, id);
  return c.json({ message: "User unlocked" });
});

// Reset user password - admin only
userRoutes.post(
  "/:id/reset-password",
  authMiddleware,
  requireRole("admin"),
  validate(resetPasswordSchema),
  async (c) => {
    const id = c.req.param("id") ?? "";
    const body = c.get("validatedBody") as { password: string };

    const user = await userRepo.findById(c.env.DB, id);
    if (!user) return c.json({ error: "User not found" }, 404);

    const passwordHash = await hashPassword(body.password);
    await userRepo.updatePassword(c.env.DB, id, passwordHash);
    return c.json({ message: "Password reset" });
  },
);

// Delete user - admin only
userRoutes.delete("/:id", authMiddleware, requireRole("admin"), async (c) => {
  const id = c.req.param("id") ?? "";

  if (id === c.get("userId")) {
    return c.json({ error: "自分自身は削除できません" }, 400);
  }

  const user = await userRepo.findById(c.env.DB, id);
  if (!user) return c.json({ error: "User not found" }, 404);

  // リフレッシュトークンを先に削除してからユーザーを削除
  await c.env.DB.prepare("DELETE FROM refresh_tokens WHERE user_id = ?").bind(id).run();
  await userRepo.delete(c.env.DB, id);
  return c.json({ message: "User deleted" });
});
