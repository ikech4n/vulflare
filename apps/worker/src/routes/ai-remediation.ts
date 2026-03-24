import { Hono } from "hono";
import { aiRemediationRepo, vulnRepo } from "../db/repository.ts";
import { authMiddleware } from "../middleware/auth.ts";
import { buildPrompt, computePromptHash, generateRemediation } from "../services/ai-remediation.ts";
import type { Env, JwtVariables } from "../types.ts";

export const aiRemediationRoutes = new Hono<{ Bindings: Env; Variables: JwtVariables }>();

aiRemediationRoutes.use("/*", authMiddleware);

// GET /api/vulnerabilities/:id/ai-remediation
aiRemediationRoutes.get("/:id/ai-remediation", async (c) => {
  const id = c.req.param("id");

  const vuln = await vulnRepo.findById(c.env.DB, id);
  if (!vuln) return c.json({ error: "Vulnerability not found" }, 404);

  const cached = await aiRemediationRepo.findByVulnId(c.env.DB, id);
  if (!cached) {
    return c.json({ content: null });
  }

  const currentPrompt = buildPrompt(vuln);
  const currentHash = await computePromptHash(currentPrompt);
  const isStale = currentHash !== cached.prompt_hash;

  return c.json({
    content: cached.content,
    model: cached.model,
    generatedAt: cached.generated_at,
    isStale,
  });
});

// POST /api/vulnerabilities/:id/ai-remediation
aiRemediationRoutes.post("/:id/ai-remediation", async (c) => {
  const id = c.req.param("id");

  const vuln = await vulnRepo.findById(c.env.DB, id);
  if (!vuln) return c.json({ error: "Vulnerability not found" }, 404);

  const body = await c.req.json<{ regenerate?: boolean }>().catch(() => ({ regenerate: false }));
  const regenerate = (body as { regenerate?: boolean }).regenerate === true;

  const currentPrompt = buildPrompt(vuln);
  const currentHash = await computePromptHash(currentPrompt);

  if (!regenerate) {
    const cached = await aiRemediationRepo.findByVulnId(c.env.DB, id);
    if (cached) {
      const isStale = currentHash !== cached.prompt_hash;
      return c.json({
        content: cached.content,
        model: cached.model,
        generatedAt: cached.generated_at,
        isStale,
      });
    }
  }

  const { content, model } = await generateRemediation(c.env.AI, vuln);
  const generatedAt = new Date().toISOString();

  await aiRemediationRepo.upsert(c.env.DB, {
    id: crypto.randomUUID(),
    vulnerability_id: id,
    content,
    model,
    prompt_hash: currentHash,
    generated_at: generatedAt,
  });

  return c.json({ content, model, generatedAt, isStale: false });
});
