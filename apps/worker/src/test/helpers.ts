import type { Env } from '../types.ts';
import { hashPassword, makeAccessToken } from '../services/auth.ts';

/**
 * テスト用ユーザーを作成
 */
export async function createTestUser(
  db: D1Database,
  options: {
    email?: string;
    username?: string;
    password?: string;
    role?: 'admin' | 'editor' | 'viewer';
  } = {}
) {
  const id = crypto.randomUUID();
  const email = options.email ?? `test-${id}@example.com`;
  const username = options.username ?? `testuser-${id.slice(0, 8)}`;
  const password = options.password ?? 'TestPassword123!';
  const role = options.role ?? 'viewer';

  const passwordHash = await hashPassword(password);

  await db
    .prepare(
      'INSERT INTO users (id, email, username, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?, 1)'
    )
    .bind(id, email, username, passwordHash, role)
    .run();

  return { id, email, username, password, role };
}

/**
 * テスト用アクセストークンを生成
 */
export async function createTestToken(
  userId: string,
  email: string,
  role: 'admin' | 'editor' | 'viewer',
  jwtSecret: string
): Promise<string> {
  return makeAccessToken(userId, email, role, jwtSecret);
}

/**
 * 認証ヘッダーを生成
 */
export function authHeader(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * テスト用脆弱性を作成
 */
export async function createTestVulnerability(
  db: D1Database,
  options: {
    cveId?: string;
    title?: string;
    severity?: string;
    status?: string;
  } = {}
) {
  const id = crypto.randomUUID();
  const cveId = options.cveId ?? null;
  const title = options.title ?? `Test Vulnerability ${id.slice(0, 8)}`;
  const severity = options.severity ?? 'medium';
  const status = options.status ?? 'active';

  await db
    .prepare(
      `INSERT INTO vulnerabilities (
        id, cve_id, title, description, severity, status, source,
        cvss_v3_score, cvss_v3_vector, cvss_v2_score, cvss_v2_vector,
        cwe_ids, affected_products, vuln_references, published_at, modified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      cveId,
      title,
      'Test description',
      severity,
      status,
      'manual',
      null,
      null,
      null,
      null,
      '[]',
      '[]',
      '[]',
      null,
      null
    )
    .run();

  return { id, cveId, title, severity, status };
}
