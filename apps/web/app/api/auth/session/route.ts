import type { NextRequest } from 'next/server';
import { clientAddress, isSameOrigin, isStaffRole, sessionMaxAge } from '../../../../lib/server/auth-policy';
import {
  USUARIOS, clearedSessionCookie, currentSession, problem, readToken, sessionCookie,
} from '../../../../lib/server/session';

/**
 * Sessão de operador: `POST` entra, `GET` confere e `DELETE` sai.
 * O token fica só no cookie HttpOnly; o JSON devolve nome, e-mail, papel e validade.
 */
export const dynamic = 'force-dynamic';

const MAX_LOGIN_BYTES = 4_096;
const LOGIN_TIMEOUT_MS = 5_000;
const FORWARDED_LOGIN_HEADERS = ['retry-after'];

interface LoginResponse {
  token: string;
  expiraEm: string;
  operador: { id: string; nome: string; email: string; papel: string };
}

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  const merged = new Headers(headers);
  merged.set('content-type', 'application/json');
  merged.set('cache-control', 'no-store');
  return new Response(JSON.stringify(body), { status, headers: merged });
}

function rejectForeignOrigin(request: NextRequest): Response | null {
  return isSameOrigin(request.headers.get('origin'), request.headers.get('host'))
    ? null
    : problem(403, 'ORIGIN_REJECTED', 'Origem da requisição não permitida');
}

/** Lê o corpo contando bytes e cancela o stream assim que passa do limite. */
async function readLimitedText(request: NextRequest): Promise<string | null> {
  if (Number(request.headers.get('content-length') ?? '0') > MAX_LOGIN_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    total += value.byteLength;
    if (total > MAX_LOGIN_BYTES) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
}

async function readCredentials(request: NextRequest): Promise<{ email: string; senha: string } | Response> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return problem(415, 'UNSUPPORTED_MEDIA_TYPE', 'Envie as credenciais como JSON');
  }
  const text = await readLimitedText(request);
  if (text === null) return problem(413, 'PAYLOAD_TOO_LARGE', 'Corpo excede o limite');
  try {
    const body = JSON.parse(text) as { email?: unknown; senha?: unknown };
    if (typeof body.email === 'string' && typeof body.senha === 'string') return { email: body.email, senha: body.senha };
  } catch {
    // Corpo inválido cai na resposta 400 abaixo.
  }
  return problem(400, 'MALFORMED_REQUEST', 'Informe e-mail e senha');
}

export async function POST(request: NextRequest) {
  const foreign = rejectForeignOrigin(request);
  if (foreign) return foreign;
  const credentials = await readCredentials(request);
  if (credentials instanceof Response) return credentials;

  const headers = new Headers({ accept: 'application/json', 'content-type': 'application/json' });
  const address = clientAddress(request.headers.get('x-forwarded-for'));
  if (address) headers.set('x-forwarded-for', address);
  let upstream: Response;
  try {
    upstream = await fetch(`${USUARIOS}/api/v1/auth/login`, {
      method: 'POST', headers, body: JSON.stringify(credentials),
      cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(LOGIN_TIMEOUT_MS),
    });
  } catch {
    return problem(503, 'AUTH_UNAVAILABLE', 'Serviço de autenticação indisponível');
  }
  if (!upstream.ok) {
    const forwarded = new Headers();
    for (const name of FORWARDED_LOGIN_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) forwarded.set(name, value);
    }
    if (upstream.status === 401) return problem(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos', forwarded);
    if (upstream.status === 429) return problem(429, 'TOO_MANY_ATTEMPTS', 'Muitas tentativas. Aguarde alguns minutos e tente de novo.', forwarded);
    if (upstream.status === 400 || upstream.status === 422) return problem(422, 'VALIDATION_ERROR', 'Informe e-mail e senha válidos');
    return problem(503, 'AUTH_UNAVAILABLE', 'Serviço de autenticação indisponível');
  }
  const session = await upstream.json() as LoginResponse;
  const maxAge = sessionMaxAge(session.expiraEm, Date.now());
  if (!isStaffRole(session.operador?.papel) || maxAge === 0) return problem(403, 'FORBIDDEN', 'Conta sem permissão de operador');
  const { id, nome, email, papel } = session.operador;
  return json({ id, nome, email, papel, expiraEm: session.expiraEm }, 200, { 'set-cookie': sessionCookie(request, session.token, maxAge) });
}

export async function GET(request: NextRequest) {
  const session = await currentSession(request);
  if (session.kind === 'unavailable') return problem(503, 'AUTH_UNAVAILABLE', 'Serviço de autenticação indisponível');
  if (session.kind === 'anonymous') {
    return problem(401, 'UNAUTHENTICATED', 'Sessão ausente ou expirada', { 'set-cookie': clearedSessionCookie(request) });
  }
  const { id, nome, email, papel, expiraEm } = session.operator;
  return json({ id, nome, email, papel, expiraEm });
}

export async function DELETE(request: NextRequest) {
  const foreign = rejectForeignOrigin(request);
  if (foreign) return foreign;
  const token = readToken(request);
  if (token) {
    try {
      const upstream = await fetch(`${USUARIOS}/api/v1/auth/logout`, {
        method: 'POST', headers: { authorization: `Bearer ${token}` },
        cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(LOGIN_TIMEOUT_MS),
      });
      if (!upstream.ok && upstream.status !== 401) return problem(503, 'AUTH_UNAVAILABLE', 'Não foi possível encerrar a sessão no servidor');
    } catch {
      return problem(503, 'AUTH_UNAVAILABLE', 'Não foi possível encerrar a sessão no servidor');
    }
  }
  return new Response(null, { status: 204, headers: { 'set-cookie': clearedSessionCookie(request), 'cache-control': 'no-store' } });
}
