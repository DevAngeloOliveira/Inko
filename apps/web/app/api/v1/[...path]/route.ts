import type { NextRequest } from 'next/server';
import { accessFor } from '../../../../lib/server/auth-policy';
import { problem, requireStaff } from '../../../../lib/server/session';

/**
 * BFF mínimo: o navegador fala só com a própria origem e este handler repassa a
 * chamada ao Gateway (`GATEWAY_INTERNAL_URL`). Não há lógica de negócio, retry ou
 * fan-out aqui; o Gateway continua responsável por rotas, limites e capacidade.
 *
 * Autorização (SDD-002): só leituras do catálogo são anônimas. Todo o resto exige
 * sessão real de operador, validada no serviço de Usuários, e mutações exigem
 * `Origin` da própria aplicação. O cookie de sessão nunca é repassado ao Gateway.
 */
export const dynamic = 'force-dynamic';

const GATEWAY = (process.env.GATEWAY_INTERNAL_URL ?? 'http://localhost:8000').replace(/\/+$/, '');
const MAX_BODY_BYTES = 65_536;
const TIMEOUT_MS = 2_500;
const SEGMENT = /^[A-Za-z0-9-]{1,40}$/;
const RESOURCES = new Set(['livros', 'usuarios', 'emprestimos', 'relatorios', 'system']);
const FORWARDED_HEADERS = ['content-type', 'x-request-id', 'retry-after'];

async function forward(request: NextRequest, path: readonly string[]): Promise<Response> {
  if (path.length === 0 || path.length > 4 || !RESOURCES.has(path[0]) || !path.every(segment => SEGMENT.test(segment))) {
    return problem(404, 'ROUTE_NOT_FOUND', 'Rota indisponível');
  }
  if (accessFor(request.method, path) === 'staff') {
    const operator = await requireStaff(request);
    if (operator instanceof Response) return operator;
  }
  let body: ArrayBuffer | undefined;
  if (request.method === 'POST') {
    const declared = Number(request.headers.get('content-length') ?? '0');
    if (declared > MAX_BODY_BYTES) return problem(413, 'PAYLOAD_TOO_LARGE', 'Corpo excede o limite');
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY_BYTES) return problem(413, 'PAYLOAD_TOO_LARGE', 'Corpo excede o limite');
  }
  const headers = new Headers({ accept: 'application/json' });
  if (body && body.byteLength > 0) headers.set('content-type', request.headers.get('content-type') ?? 'application/json');
  const requestId = request.headers.get('x-request-id');
  if (requestId) headers.set('x-request-id', requestId);

  const target = `${GATEWAY}/api/v1/${path.join('/')}${request.nextUrl.search}`;
  try {
    const upstream = await fetch(target, {
      method: request.method, headers, body: body && body.byteLength > 0 ? body : undefined,
      cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const responseHeaders = new Headers({ 'cache-control': 'no-store' });
    for (const name of FORWARDED_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers: responseHeaders });
  } catch {
    return problem(503, 'GATEWAY_UNREACHABLE', 'Não foi possível contatar o Gateway INKO');
  }
}

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: Context) {
  return forward(request, (await context.params).path);
}

export async function POST(request: NextRequest, context: Context) {
  return forward(request, (await context.params).path);
}
