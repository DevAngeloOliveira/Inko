/**
 * Regras puras de autorização do BFF (sem I/O), testadas diretamente pelo Node.
 *
 * O BFF é o único ponto público autenticado do MVP: decide quais leituras do
 * catálogo podem ser anônimas, exige sessão real para todo o resto e confere a
 * origem das mutações (CSRF). Os serviços Java continuam só na rede interna.
 */

export type StaffRole = 'ADMIN' | 'BIBLIOTECARIO';
export type Access = 'public' | 'staff';

export const STAFF_ROLES: ReadonlySet<string> = new Set<StaffRole>(['ADMIN', 'BIBLIOTECARIO']);
export const SESSION_COOKIE_SECURE = '__Host-inko_session';
export const SESSION_COOKIE_LOCAL = 'inko_session';
export const MAX_SESSION_SECONDS = 8 * 60 * 60;
export const COVER_MAX_BYTES = 2 * 1024 * 1024;
export const COVER_MULTIPART_OVERHEAD = 16 * 1024;

const TOKEN = /^[A-Za-z0-9_-]{32,128}$/;
const BOOK_ID = /^[A-Za-z0-9-]{1,16}$/;
const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Somente leituras do catálogo (obra, lista e disponibilidade) são públicas. */
export function accessFor(method: string, path: readonly string[]): Access {
  if (method !== 'GET' || path[0] !== 'livros') return 'staff';
  if (path.length <= 2) return 'public';
  return path.length === 3 && path[2] === 'disponibilidade' ? 'public' : 'staff';
}

export function isMutation(method: string): boolean {
  return MUTATIONS.has(method.toUpperCase());
}

/** CSRF: mutações precisam de `Origin` igual ao host atendido. Sem `Origin`, recusa. */
export function isSameOrigin(origin: string | null, host: string | null): boolean {
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.host === host.toLowerCase();
  } catch {
    return false;
  }
}

export function isStaffRole(role: unknown): role is StaffRole {
  return typeof role === 'string' && STAFF_ROLES.has(role);
}

export function isPlausibleToken(token: string | undefined | null): token is string {
  return typeof token === 'string' && TOKEN.test(token);
}

export function isBookId(id: string): boolean {
  return BOOK_ID.test(id);
}

export function sessionCookieName(secure: boolean): string {
  return secure ? SESSION_COOKIE_SECURE : SESSION_COOKIE_LOCAL;
}

/** `Max-Age` do cookie: nunca maior que a validade da sessão no servidor nem que oito horas. */
export function sessionMaxAge(expiresAt: string, now: number): number {
  const remaining = Math.floor((Date.parse(expiresAt) - now) / 1000);
  if (!Number.isFinite(remaining) || remaining <= 0) return 0;
  return Math.min(remaining, MAX_SESSION_SECONDS);
}

/** Último endereço de `X-Forwarded-For` (o anexado pelo servidor mais próximo). */
export function clientAddress(forwardedFor: string | null): string | null {
  const last = forwardedFor?.split(',').map(part => part.trim()).filter(Boolean).at(-1);
  return last && /^[0-9A-Fa-f.:]{2,45}$/.test(last) ? last : null;
}
