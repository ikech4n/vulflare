const ALGORITHM = { name: 'HMAC', hash: 'SHA-256' } as const;
const PBKDF2_ITERATIONS = 100_000;

// --- JWT ---

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    ALGORITHM,
    false,
    ['sign', 'verify'],
  );
}

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function encodeJson(obj: unknown): string {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decodeJson<T>(str: string): T {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  return JSON.parse(atob(pad ? padded + '===='.slice(pad) : padded)) as T;
}

export async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
  const body = encodeJson(payload);
  const data = `${header}.${body}`;
  const sig = base64url(await crypto.subtle.sign(ALGORITHM, key, new TextEncoder().encode(data)));
  return `${data}.${sig}`;
}

export async function verifyJwt<T extends Record<string, unknown>>(
  token: string,
  secret: string,
): Promise<T | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts as [string, string, string];
    const key = await importHmacKey(secret);
    const data = `${header}.${body}`;
    const rawSig = Uint8Array.from(
      atob(sig.replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0),
    );
    const valid = await crypto.subtle.verify(
      ALGORITHM,
      key,
      rawSig,
      new TextEncoder().encode(data),
    );
    if (!valid) return null;
    const payload = decodeJson<T & { exp: number }>(body);
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function makeAccessToken(
  userId: string,
  role: string,
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return signJwt(
    { sub: userId, role, type: 'access', iat: now, exp: now + 15 * 60 },
    secret,
  );
}

export function makeRefreshToken(
  userId: string,
  jti: string,
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return signJwt(
    { sub: userId, jti, type: 'refresh', iat: now, exp: now + 30 * 24 * 60 * 60 },
    secret,
  );
}

// --- Password hashing (PBKDF2 via Web Crypto) ---

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(derived)));
  return `${saltB64}:${hashB64}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltB64, hashB64] = stored.split(':');
  if (!saltB64 || !hashB64) return false;
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  const candidate = btoa(String.fromCharCode(...new Uint8Array(derived)));
  return candidate === hashB64;
}

// --- Token hash for D1 storage ---
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}
