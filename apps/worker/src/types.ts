export interface Env {
  DB: D1Database;
  KV_SESSIONS: KVNamespace;
  KV_CACHE: KVNamespace;
  SEND_EMAIL: SendEmail;
  JWT_SECRET: string;
  NVD_API_KEY?: string;
  PAGES_URL: string;
  NOREPLY_EMAIL: string;
  ENVIRONMENT: 'development' | 'production';
}

export interface JwtVariables {
  userId: string;
  role: 'admin' | 'editor' | 'viewer';
  validatedBody?: unknown;
}
