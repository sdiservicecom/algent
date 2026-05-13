import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import { getUser } from './users';
import type { Role, User } from './types';

const COOKIE_NAME = 'algent_session';
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24h

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET is not set');
  return new TextEncoder().encode(s);
}

export interface SessionPayload {
  sub: string;
  username: string;
  role: Role;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      sub: payload.sub as string,
      username: payload.username as string,
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  // Le rôle est lu en base — pas dans le JWT — pour qu'une promotion
  // (ou rétrogradation) côté admin prenne effet immédiatement, sans que
  // l'utilisateur ait à se reconnecter pour récupérer un cookie à jour.
  const user = await getUser(session.sub);
  if (!user || user.role !== 'ADMIN') redirect('/');

  // Si le JWT contient encore l'ancien rôle (USER), on en émet un nouveau
  // au passage pour que les checks ultérieurs basés sur le token soient
  // également cohérents jusqu'à expiration.
  if (session.role !== user.role) {
    try {
      const token = await signSession({
        sub: user.id,
        username: user.username,
        role: user.role,
      });
      await setSessionCookie(token);
    } catch {
      /* refresh best-effort — la garde DB ci-dessus reste l'autorité */
    }
    return { ...session, role: user.role };
  }
  return session;
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;
  return getUser(session.sub);
}
