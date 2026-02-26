export interface Env {
  DB: D1Database;
  KV_SESSIONS: KVNamespace;
  KV_CACHE: KVNamespace;
  R2_BUCKET: R2Bucket;
  SEND_EMAIL: SendEmail;
  JWT_SECRET: string;
  NVD_API_KEY?: string;
  PAGES_URL: string;
  ENVIRONMENT: 'development' | 'production';
}

export interface JwtVariables {
  userId: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  validatedBody?: unknown;
}
