import Image from 'next/image';
import Link from 'next/link';

const nav = [
  ['Visão geral', 'icon-dashboard'],
  ['Acervo', 'icon-acervo'],
  ['Usuários', 'icon-usuarios'],
  ['Empréstimos', 'icon-emprestimos'],
  ['Devoluções', 'icon-devolucoes'],
  ['Relatórios', 'icon-relatorios'],
] as const;

const indicators = [
  { label: 'Obras no acervo', value: '248', icon: 'icon-acervo' },
  { label: 'Usuários cadastrados', value: '1.286', icon: 'icon-usuarios' },
  { label: 'Empréstimos ativos', value: '412', icon: 'icon-emprestimos' },
  { label: 'Atrasos', value: '27', icon: 'icon-atrasos' },
];

const examples = [
  { title: 'A cidade de papel', user: 'Ana Costa', action: 'Empréstimo', date: '09/11/2026' },
  { title: 'Maré de tinta', user: 'Bruno Lima', action: 'Devolução', date: '09/11/2026' },
  { title: 'Jardim dos ecos', user: 'Clara Aoki', action: 'Empréstimo', date: '08/11/2026' },
];

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <Image src={`/inko/svg/icons/${name}.svg`} alt="" width={size} height={size} aria-hidden="true" />;
}

function Navigation() {
  return <nav className="ds-nav" aria-label="Navegação do INKO">
    {nav.map(([title, icon], index) => index === 0
      ? <Link key={title} className="ds-nav-link ds-selected" href="/" aria-current="page"><Icon name={icon}/>{title}</Link>
      : <span key={title} className="ds-nav-link ds-pending" aria-label={`${title} em desenvolvimento`}><Icon name={icon}/>{title}<small>Em breve</small></span>
    )}
  </nav>;
}

export function Dashboard() {
  return <div className="ds-shell">
    <aside className="ds-sidebar">
      <Image src="/inko/logo/inko-logo-inverse.png" alt="INKO" width={132} height={99} priority className="ds-logo" />
      <span className="ds-sidebar-caption">BIBLIOTECA / ADMIN</span>
      <Navigation />
      <div className="ds-sidebar-end">
        <Image src="/inko/svg/elementos/seigaiha-tile.svg" alt="" width={170} height={80} aria-hidden="true"/>
        <span>Acervo físico<br/>Ambiente demonstrativo</span>
      </div>
    </aside>
    <div className="ds-main">
      <header className="ds-topbar">
        <details className="ds-mobile-nav">
          <summary aria-label="Abrir navegação"><Icon name="icon-menu" size={24}/></summary>
          <div><Navigation/></div>
        </details>
        <div>Biblioteca <span>/</span> Visão geral</div>
        <div className="ds-top-actions">
          <label className="ds-search"><Icon name="icon-pesquisa"/><input type="search" disabled placeholder="Pesquisa em breve" aria-label="Pesquisa em desenvolvimento"/></label>
          <span aria-label="Notificações em desenvolvimento"><Icon name="icon-notificacoes"/></span>
          <span className="ds-avatar" aria-label="Administrador">A</span>
        </div>
      </header>
      <main className="ds-content">
        <div className="ds-heading inko-motion-enter">
          <div><span className="ds-kicker">BIBLIOTECA FÍSICA / DADOS DEMONSTRATIVOS</span><h1>Visão geral</h1></div>
          <time dateTime="2026-11-09">09 de novembro de 2026</time>
        </div>
        <section className="ds-hero inko-motion-enter inko-motion-stagger-1" aria-label="Apresentação da biblioteca">
          <div><span className="ds-kicker">INKO / BIBLIOTECA FÍSICA</span><h2>Cada volume,<br/>no seu lugar.</h2><p>Gerencie seu acervo com clareza.</p></div>
          <div className="ds-hero-art" aria-hidden="true">
            <Image src="/inko/svg/elementos/enso-seal.svg" width={200} height={200} alt="" className="ds-hero-enso"/>
            <Image src="/inko/svg/elementos/pincelada-horizontal-ink.svg" width={260} height={66} alt="" className="ds-hero-brush"/>
            <Image src="/inko/svg/elementos/retícula-25.svg" width={150} height={145} alt="" className="ds-hero-dots"/>
          </div>
        </section>
        <section className="ds-indicators" aria-label="Indicadores de exemplo">
          {indicators.map(({label,value,icon},i) =>
            <article className="ds-stat inko-motion-enter" key={label} style={{animationDelay:`${140+i*90}ms`}}>
              <div><span>{label}</span><Icon name={icon}/></div><strong>{value}</strong><small>Dados demonstrativos</small>
            </article>)}
        </section>
        <section className="ds-module">
          <div className="ds-section-header"><h2>Atalhos de operação</h2><span>Disponíveis nas próximas sprints</span></div>
          <div className="ds-shortcuts">
            <span><Icon name="icon-emprestimos"/>Novo empréstimo<small>Em breve</small></span>
            <span><Icon name="icon-devolucoes"/>Registrar devolução<small>Em breve</small></span>
            <Link href="/motion-lab"><Icon name="icon-mangas"/>Explorar Motion Lab<small>Abrir</small></Link>
          </div>
        </section>
        <section className="ds-activity" aria-labelledby="activity-title">
          <div className="ds-section-header"><h2 id="activity-title">Movimentações recentes</h2><span>Registros fictícios para validação visual</span></div>
          <div className="ds-table" role="table" aria-label="Movimentações demonstrativas">
            <div className="ds-table-head" role="row"><span>Obra</span><span>Operação</span><span>Usuário</span><span>Data</span></div>
            {examples.map(item=><div className="ds-table-row" role="row" key={item.title}>
              <strong>{item.title}</strong>
              <span className={item.action==='Devolução'?'ds-status ds-return':'ds-status ds-loan'}>{item.action}</span>
              <span>{item.user}</span><time>{item.date}</time>
            </div>)}
          </div>
          <p className="ds-note">Dados inteiramente demonstrativos. Integração com APIs e banco nas sprints de domínio.</p>
        </section>
        <footer className="ds-footer"><span>INKO · Design System v1.0</span><Link href="/system/status">Diagnóstico dos microsserviços</Link></footer>
      </main>
    </div>
  </div>;
}
