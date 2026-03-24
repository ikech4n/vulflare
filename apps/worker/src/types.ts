export interface Env {
  DB: D1Database;
  VULFLARE_KV_SESSIONS: KVNamespace;
  VULFLARE_KV_CACHE: KVNamespace;
  SEND_EMAIL: SendEmail;
  AI: Ai;
  JWT_SECRET: string;
  PAGES_URL: string;
  NOREPLY_EMAIL: string;
  ENVIRONMENT: "development" | "production";
  AI_MODEL?: string;
}

export interface JwtVariables {
  userId: string;
  role: "admin" | "editor" | "viewer";
  validatedBody?: unknown;
}
