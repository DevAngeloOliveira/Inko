export const dynamic = 'force-dynamic';

type Service = { service: string; status: string };

type StatusResponse = { services: Service[]; stale?: boolean };

async function getStatus(): Promise<StatusResponse | null> {
  try {
    const gateway = process.env.GATEWAY_INTERNAL_URL ?? 'http://localhost:8000';
    const response = await fetch(`${gateway}/api/v1/system/status`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as StatusResponse;
    return Array.isArray(data?.services) ? data : null;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const snapshot = await getStatus();
  const services = snapshot?.services ?? [];
  const stale = snapshot?.stale;
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">INKO<span className="brand-dot">.</span></div>
        <p className="sidebar-subtitle">Gestão de mangás e HQs</p>
        <nav aria-label="Navegação principal">
          <div className="nav-item current">Visão geral</div>
          <div className="nav-item muted">Acervo — em breve</div>
          <div className="nav-item muted">Usuários — em breve</div>
          <div className="nav-item muted">Circulação — em breve</div>
          <div className="nav-item muted">Relatórios — em breve</div>
        </nav>
      </aside>
      <section className="main-content">
        <div className="eyebrow inko-motion-enter">SISTEMA / SPRINT 00</div>
        <h1 className="inko-motion-enter inko-motion-stagger-1">O universo INKO começa aqui.</h1>
        <p className="description inko-motion-enter inko-motion-stagger-2">
          Infraestrutura preparada para catálogo, leitores, empréstimos e análises funcionais.
          Os componentes definitivos serão incorporados do Design System aprovado.
        </p>
        <div className="section-title">Estado dos microsserviços</div>
        {services.length > 0 && stale !== false && (
          <p className="description">
            {stale ? 'Dados desatualizados. Os estados abaixo são da última observação.' : 'Horário da última atualização indisponível.'}
          </p>
        )}
        <div className="service-grid inko-motion-enter inko-motion-stagger-3">
          {services.length ? services.map(({ service, status }) => (
            <article className="service-card" key={service}>
              <span className={`status ${status}`} aria-hidden="true" />
              <div><strong>{service}</strong><small>
                {stale === false ? '' : 'Última observação: '}{status === 'up' ? 'Operacional' : 'Indisponível'}
              </small></div>
            </article>
          )) : <article className="service-card">Gateway não disponível ou indisponível para consulta.</article>}
        </div>
      </section>
    </main>
  );
}
