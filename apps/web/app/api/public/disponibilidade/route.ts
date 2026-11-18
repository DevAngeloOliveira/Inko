/**
 * Disponibilidade pública para a vitrine: somente os IDs de obras emprestadas.
 * Empréstimos completos (leitor, datas) continuam privados no BFF autenticado.
 */
export const dynamic = 'force-dynamic';

const GATEWAY = (process.env.GATEWAY_INTERNAL_URL ?? 'http://localhost:8000').replace(/\/+$/, '');
const TIMEOUT_MS = 2_500;

export async function GET() {
  const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };
  try {
    const upstream = await fetch(`${GATEWAY}/api/v1/emprestimos/ativos`, {
      headers: { accept: 'application/json' }, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!upstream.ok) {
      return new Response(JSON.stringify({ code: 'UPSTREAM_ERROR', detail: 'Disponibilidade indisponível' }), { status: 502, headers });
    }
    const loans = await upstream.json() as { livroId?: unknown }[];
    const emprestados = [...new Set(loans.map(loan => loan.livroId).filter((id): id is string => typeof id === 'string'))];
    return new Response(JSON.stringify({ emprestados }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ code: 'GATEWAY_UNREACHABLE', detail: 'Disponibilidade indisponível' }), { status: 503, headers });
  }
}
