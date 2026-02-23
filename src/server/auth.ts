import jwt from 'jsonwebtoken';
import { getSetting, setSetting } from './db';

const TOKEN_EXPIRY = '24h';

async function getJwtSecret(): Promise<string> {
  let secret = await getSetting('jwt_secret');
  if (!secret) {
    const bytes = new Uint8Array(64);
    crypto.getRandomValues(bytes);
    secret = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    await setSetting('jwt_secret', secret);
  }
  return secret;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function initializePassword(): Promise<void> {
  const existing = await getSetting('admin_password_hash');
  if (!existing) {
    const hash = await hashPassword('admin');
    await setSetting('admin_password_hash', hash);
  }
}

export async function verifyPassword(password: string): Promise<boolean> {
  const stored = await getSetting('admin_password_hash');
  if (!stored) return false;
  const hash = await hashPassword(password);
  return hash === stored;
}

export async function changePassword(newPassword: string): Promise<void> {
  const hash = await hashPassword(newPassword);
  await setSetting('admin_password_hash', hash);
}

export async function signToken(): Promise<string> {
  const secret = await getJwtSecret();
  return jwt.sign({ role: 'admin' }, secret, { expiresIn: TOKEN_EXPIRY });
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    const secret = await getJwtSecret();
    jwt.verify(token, secret);
    return true;
  } catch {
    return false;
  }
}

function getTokenFromRequest(request: Request): string | undefined {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return undefined;
}

export async function requireAuth(request: Request): Promise<Response | null> {
  const token = getTokenFromRequest(request);
  if (!token || !(await verifyToken(token))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
