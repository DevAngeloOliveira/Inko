/**
 * Sessão de operador no servidor do Next (BFF). Só roda em Route Handlers.
 *
 * O token opaco vive apenas no cookie HttpOnly e nas chamadas internas ao serviço
 * de Usuários (`USUARIOS_INTERNAL_URL`, origem fixa da rede Docker). Nunca é
 * devolvido em JSON, URL ou armazenamento do navegador.
 */

import type { NextRequest } from 'next/server';
import {
  isMutation, isPlausibleToken, isSameOrigin, isStaffRole, sessionCookieName, type StaffRole,
} from './auth-policy';

export const USUARIOS = (process.env.USUARIOS_INTERNAL_URL ?? 'http://localhost:8082').replace(/\/+$/, '');
const SESSION_TIMEOUT_MS = 1_500;

export interface Operator {
  id: string;
  nome: string;
  email: string;
  papel: StaffRole;
  expiraEm: string;
}

export type SessionCheck =
  | { kind: 'ok'; operator: Operator; token: string }
  | { kind: 'anonymous' }
  | { kind: 'unavailable' };

export function problem(status: number, code: string, detail: string, extra?: HeadersInit): Response {
  const headers = new Headers(extra);
  headers.set('content-type', 'application/problem+json');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify({ type: 'about:blank', title: detail, status, code, detail }), { status, headers });
}

/** `Secure` segue HTTPS real; `INKO_COOKIE_SECURE=true|false` força o modo (ex.: atrás de proxy TLS). */
export function isSecureRequest(request: NextRequest): boolean {
  const forced = process.env.INKO_COOKIE_SECURE;
  if (forced === 'true') return true;
  if (forced === 'false') return false;
  return request.headers.get('x-forwarded-proto') === 'https' || request.nextUrl.protocol === 'https:';
}

export function readToken(request: NextRequest): string | null {
  const value = request.cookies.get(sessionCookieName(isSecureRequest(request)))?.value;
  return isPlausibleToken(value) ? value : null;
}

export function sessionCookie(request: NextRequest, token: string, maxAge: number): string {
  const secure = isSecureRequest(request);
  return [
    `${sessionCookieName(secure)}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

export function clearedSessionCookie(request: NextRequest): string {
  return sessionCookie(request, '', 0);
}

function isOperator(value: unknown): value is Omit<Operator, 'papel'> & { papel: string } {
  const candidate = value as Partial<Operator> | null;
  return typeof candidate?.id === 'string' && typeof candidate.nome === 'string' && typeof candidate.email === 'string'
    && typeof candidate.papel === 'string' && typeof candidate.expiraEm === 'string';
}

/** Valida o cookie contra o PostgreSQL (via serviço de Usuários) a cada requisição privada. */
export async function currentSession(request: NextRequest): Promise<SessionCheck> {
  const token = readToken(request);
  if (!token) return { kind: 'anonymous' };
  try {
    const response = await fetch(`${USUARIOS}/api/v1/auth/session`, {
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
      cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(SESSION_TIMEOUT_MS),
    });
    if (response.status === 401 || response.status === 403) return { kind: 'anonymous' };
    if (!response.ok) return { kind: 'unavailable' };
    const body: unknown = await response.json();
    if (!isOperator(body) || !isStaffRole(body.papel)) return { kind: 'anonymous' };
    return { kind: 'ok', operator: { ...body, papel: body.papel }, token };
  } catch {
    return { kind: 'unavailable' };
  }
}

/**
 * Porta de entrada de toda rota privada: origem (CSRF) em mutações, sessão real e papel.
 * Devolve o operador autenticado ou a resposta 401/403/503 pronta.
 */
export async function requireStaff(request: NextRequest): Promise<Operator | Response> {
  if (isMutation(request.method) && !isSameOrigin(request.headers.get('origin'), request.headers.get('host'))) {
    return problem(403, 'ORIGIN_REJECTED', 'Origem da requisição não permitida');
  }
  const session = await currentSession(request);
  if (session.kind === 'unavailable') return problem(503, 'AUTH_UNAVAILABLE', 'Serviço de autenticação indisponível');
  if (session.kind === 'anonymous') {
    return problem(401, 'UNAUTHENTICATED', 'Sessão ausente ou expirada', { 'set-cookie': clearedSessionCookie(request) });
  }
  if (!isStaffRole(session.operator.papel)) return problem(403, 'FORBIDDEN', 'Papel sem permissão para esta operação');
  return session.operator;
}
