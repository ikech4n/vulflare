import { Hono } from "hono";
import { appSettingsRepo } from "../db/repository.ts";
import { authMiddleware, requireRole } from "../middleware/auth.ts";
import type { Env, JwtVariables } from "../types.ts";
import { validate } from "../validation/middleware.ts";
import { updateAppSettingsSchema } from "../validation/schemas.ts";

export const appSettingsRoutes = new Hono<{ Bindings: Env; Variables: JwtVariables }>();

// GET /api/app-settings - admin のみ
appSettingsRoutes.get("/", authMiddleware, requireRole("admin"), async (c) => {
  const row = await appSettingsRepo.get(c.env.DB, "noreply_email");
  return c.json({ noreplyEmail: row?.value ?? null });
});

// PATCH /api/app-settings - admin のみ
appSettingsRoutes.patch(
  "/",
  authMiddleware,
  requireRole("admin"),
  validate(updateAppSettingsSchema),
  async (c) => {
    const body = c.get("validatedBody") as { noreplyEmail: string };
    await appSettingsRepo.set(c.env.DB, "noreply_email", body.noreplyEmail);
    return c.json({ message: "Updated" });
  },
);
