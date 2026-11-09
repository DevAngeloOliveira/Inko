import Image from 'next/image';
import Link from 'next/link';
import { AppShell } from './app-shell';
import { DemoNotice, InkoIcon, PageHeading, Section } from './inko-kit';

const cards = [
  { label: 'Obras no acervo', value: '3.842', icon: 'acervo' },
  { label: 'Usuários cadastrados', value: '1.286', icon: 'usuarios' },
  { label: 'Empréstimos ativos', value: '412', icon: 'emprestimos' },
  { label: 'Atrasos', value: '4', icon: 'atrasos' },
];

const activity = [
  { work: 'Maré de Tinta · Vol. 3', action: 'Empréstimo', reader: 'Rafael Moura', date: '11/10/2026' },
  { work: 'Capitão Ferrugem · #27', action: 'Empréstimo', reader: 'Helena Vaz', date: '16/10/2026' },
  { work: 'O Último Ronin · Vol. 12', action: 'Empréstimo', reader: 'Beatriz Moraes', date: '28/10/2026' },
  { work: 'Kitsune Express · Vol. 4', action: 'Devolução', reader: 'Davi Nogueira', date: '09/11/2026' },
  { work: 'Jardim de Aço · Vol. 2', action: 'Empréstimo', reader: 'Rafael Moura', date: '08/11/2026' },
];

export function Dashboard() {
  return <AppShell>
    <PageHeading eyebrow="BIBLIOTECA FÍSICA / DADOS DEMONSTRATIVOS" title="Bom dia, Mariana." description="Visão geral das atividades da biblioteca" action={<Link href="/relatorios" className="inko-button inko-button--outline">Ver relatórios</Link>}/>
    <DemoNotice>Os indicadores representam a composição fictícia do Dashboard do Claude. Não são valores obtidos dos microsserviços.</DemoNotice>
    <section className="inko-dashboard-hero inko-motion-enter" aria-label="Introdução ao INKO">
      <div><span className="inko-eyebrow">INKO / BIBLIOTECA FÍSICA</span><h2>Cada volume,<br/>no seu lugar.</h2><p>Gerencie seu acervo com clareza.</p></div>
      <div className="inko-hero-art" aria-hidden="true"><Image src="/inko/svg/elementos/enso-seal.svg" alt="" width={270} height={270}/><Image src="/inko/svg/elementos/pincelada-horizontal-ink.svg" alt="" width={300} height={140}/><Image src="/inko/svg/elementos/retícula-25.svg" alt="" width={165} height={160}/></div>
    </section>
    <div className="inko-dashboard-stats" aria-label="Estatísticas fictícias">{cards.map((card,i)=><article className="inko-dashboard-stat inko-motion-enter" key={card.label} style={{animationDelay:`${140+i*80}ms`}}><div className="inko-manga-card-meta"><span style={{border:0,padding:0,fontSize:12,textTransform:'none',fontWeight:500}}>{card.label}</span><InkoIcon name={card.icon} size={20}/></div><strong>{card.value}</strong><small>Dados demonstrativos</small></article>)}</div>
    <Section title="Visão geral" action={<span className="inko-badge inko-badge--danger">4 empréstimos atrasados</span>}>
      <div className="inko-dashboard-actions">
        <Link href="/emprestimos"><InkoIcon name="emprestimos"/>Novo empréstimo</Link>
        <Link href="/acervo"><InkoIcon name="acervo"/>Consultar acervo</Link>
        <Link href="/relatorios"><InkoIcon name="relatorios"/>Relatório de multas</Link>
      </div>
    </Section>
    <Section title="Últimas movimentações" action={<Link href="/devolucoes" className="inko-text-link">Devoluções →</Link>}><div className="inko-table-wrap"><table className="inko-table"><thead><tr><th>Obra</th><th>Operação</th><th>Leitor</th><th>Data</th></tr></thead><tbody>{activity.map(item=><tr key={item.work}><td><strong>{item.work}</strong></td><td><span className={`inko-badge inko-badge--${item.action==='Devolução'?'success':'info'}`}>{item.action}</span></td><td>{item.reader}</td><td>{item.date}</td></tr>)}</tbody></table></div></Section>
    <Section title="Atalhos"><div className="inko-dashboard-actions"><Link href="/usuarios"><InkoIcon name="usuarios"/>Gerenciar usuários</Link><Link href="/acervo/novo"><InkoIcon name="mais"/>Cadastrar obra</Link><Link href="/motion-lab"><InkoIcon name="mangas"/>Explorar Motion Lab</Link></div></Section>
    <p className="inko-footnote">INKO · Design System v1.0 · <Link href="/design-system">Foundations</Link> · <Link href="/system/status">Diagnóstico técnico</Link></p>
  </AppShell>;
}
