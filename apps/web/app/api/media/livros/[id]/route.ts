import type { NextRequest } from 'next/server';
import { COVER_MAX_BYTES, COVER_MULTIPART_OVERHEAD, isBookId } from '../../../../../lib/server/auth-policy';
import { problem, requireStaff } from '../../../../../lib/server/session';

/**
 * Capas de obra (SDD-002 §4.3). Binários não passam pelo Gateway de negócios
 * (contrato JSON de 64 KiB, ADR-004): este handler fala direto com o Catálogo
 * pela origem fixa `CATALOGO_INTERNAL_URL`, sem retry e com concorrência limitada.
 * Leitura é pública; envio e remoção exigem operador autenticado e mesma origem.
 */
export const dynamic = 'force-dynamic';

const CATALOGO = (process.env.CATALOGO_INTERNAL_URL ?? 'http://localhost:8081').replace(/\/+$/, '');
const READ_TIMEOUT_MS = 2_500;
const WRITE_TIMEOUT_MS = 10_000;
const MAX_CONCURRENT_UPLOADS = 4;
const MAX_REQUEST_BYTES = COVER_MAX_BYTES + COVER_MULTIPART_OVERHEAD;
const READ_HEADERS = ['content-type', 'content-length', 'etag', 'cache-control', 'last-modified'];

let uploadsInFlight = 0;

type Context = { params: Promise<{ id: string }> };

function coverUrl(id: string): string {
  return `${CATALOGO}/api/v1/livros/${encodeURIComponent(id)}/capa`;
}

async function relayJson(upstream: Response): Promise<Response> {
  const headers = new Headers({ 'cache-control': 'no-store' });
  const type = upstream.headers.get('content-type');
  if (type) headers.set('content-type', type);
  return new Response(upstream.status === 204 ? null : await upstream.arrayBuffer(), { status: upstream.status, headers });
}

/** Lê o corpo contando bytes durante o stream e aborta assim que passa do limite. */
async function readLimited(request: NextRequest): Promise<ArrayBuffer | Response> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_REQUEST_BYTES) return problem(413, 'PAYLOAD_TOO_LARGE', 'A capa deve ter no máximo 2 MiB');
  const reader = request.body?.getReader();
  if (!reader) return problem(400, 'EMPTY_UPLOAD', 'Selecione um arquivo de imagem');
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_REQUEST_BYTES) {
      await reader.cancel();
      return problem(413, 'PAYLOAD_TOO_LARGE', 'A capa deve ter no máximo 2 MiB');
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

export async function GET(request: NextRequest, context: Context) {
  const { id } = await context.params;
  if (!isBookId(id)) return problem(404, 'COVER_NOT_FOUND', 'Capa não encontrada');
  const headers = new Headers({ accept: 'image/jpeg, image/png' });
  const etag = request.headers.get('if-none-match');
  if (etag) headers.set('if-none-match', etag);
  try {
    const upstream = await fetch(coverUrl(id), { headers, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(READ_TIMEOUT_MS) });
    if (upstream.status !== 200 && upstream.status !== 304) {
      return problem(upstream.status === 404 ? 404 : 502, upstream.status === 404 ? 'COVER_NOT_FOUND' : 'UPSTREAM_ERROR', 'Capa não encontrada');
    }
    const type = upstream.headers.get('content-type') ?? '';
    if (upstream.status === 200 && type !== 'image/jpeg' && type !== 'image/png') return problem(502, 'UPSTREAM_ERROR', 'Formato de capa inesperado');
    const responseHeaders = new Headers({ 'x-content-type-options': 'nosniff', 'content-disposition': 'inline' });
    for (const name of READ_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    if (request.nextUrl.searchParams.has('v')) responseHeaders.set('cache-control', 'public, max-age=31536000, immutable');
    return new Response(upstream.status === 304 ? null : upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return problem(503, 'CATALOG_UNREACHABLE', 'Catálogo indisponível');
  }
}

export async function PUT(request: NextRequest, context: Context) {
  const { id } = await context.params;
  if (!isBookId(id)) return problem(404, 'NOT_FOUND', 'Obra não encontrada');
  const operator = await requireStaff(request);
  if (operator instanceof Response) return operator;
  const type = request.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('multipart/form-data; boundary=')) return problem(415, 'UNSUPPORTED_MEDIA_TYPE', 'Envie a capa como multipart/form-data');
  if (uploadsInFlight >= MAX_CONCURRENT_UPLOADS) return problem(429, 'TOO_MANY_UPLOADS', 'Muitos envios simultâneos. Tente de novo em instantes.', { 'retry-after': '2' });
  uploadsInFlight += 1;
  try {
    const body = await readLimited(request);
    if (body instanceof Response) return body;
    const upstream = await fetch(coverUrl(id), {
      method: 'PUT', headers: { accept: 'application/json', 'content-type': type }, body,
      cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
    });
    return relayJson(upstream);
  } catch {
    return problem(503, 'CATALOG_UNREACHABLE', 'Catálogo indisponível');
  } finally {
    uploadsInFlight -= 1;
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const { id } = await context.params;
  if (!isBookId(id)) return problem(404, 'NOT_FOUND', 'Obra não encontrada');
  const operator = await requireStaff(request);
  if (operator instanceof Response) return operator;
  try {
    const upstream = await fetch(coverUrl(id), {
      method: 'DELETE', headers: { accept: 'application/json' }, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(READ_TIMEOUT_MS),
    });
    return relayJson(upstream);
  } catch {
    return problem(503, 'CATALOG_UNREACHABLE', 'Catálogo indisponível');
  }
}
