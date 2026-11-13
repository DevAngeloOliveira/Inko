import Link from 'next/link';
import type { ReactNode } from 'react';
import { daysOverdue, formatBRL, formatDate, type Loan, type Work } from '../lib/demo';
import { Icon, type IconName } from './icon';
import { Enso, InkoBadge, InkoCover, InkoStatus, ProgressBar, WashiTexture, type Tone } from './inko-kit';

/* ---------- Indicadores ---------- */

export type StatTone = 'ink' | 'sand' | 'info' | 'danger' | 'success' | 'warning';

/** Statistic Card. Com `href`, o card inteiro é o link. */
export function InkoStatistic({ label, value, helper, icon, tone = 'sand', href, emphasis = false }: Readonly<{ label: string; value: string; helper?: string; icon?: IconName; tone?: StatTone; href?: string; emphasis?: boolean }>) {
  const body = <>
    {icon && <span className={`inko-stat-icon inko-stat-icon--${tone}`}><Icon name={icon} size={22}/></span>}
    <span className="inko-stat-body"><span className="inko-caption">{label}</span><strong>{value}</strong>{helper && <small>{helper}</small>}</span>
  </>;
  const className = `inko-stat${emphasis ? ' inko-stat--emphasis' : ''}`;
  return href ? <Link href={href} className={className}>{body}</Link> : <article className={className}>{body}</article>;
}

export function InkoStatisticSkeleton() {
  return <div className="inko-stat" aria-hidden="true">
    <span className="inko-stat-icon inko-motion-shimmer"/>
    <span className="inko-stat-body"><span className="inko-skeleton-line inko-motion-shimmer" style={{ width: '50%' }}/><span className="inko-skeleton-line inko-skeleton-line--lg inko-motion-shimmer" style={{ width: '40%' }}/><span className="inko-skeleton-line inko-motion-shimmer" style={{ width: '70%' }}/></span>
  </div>;
}

export function InkoSkeleton({ lines = 3 }: Readonly<{ lines?: number }>) {
  return <output className="inko-skeleton" aria-label="Carregando conteúdo">{Array.from({ length: lines }, (_, index) => <span key={index} className="inko-skeleton-line inko-motion-shimmer" style={{ width: `${100 - index * 17}%` }}/>)}</output>;
}

/* ---------- Navegação ---------- */

/** Tabs com sublinhado em pincelada seal na aba ativa. */
export function InkoTabs({ label, items, active, onChange }: Readonly<{ label: string; items: readonly string[]; active: string; onChange: (value: string) => void }>) {
  return <div className="inko-tabs" role="tablist" aria-label={label}>{items.map(item => <button key={item} role="tab" type="button" aria-selected={active === item} onClick={() => onChange(item)}>
    {item}{active === item && <svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M1 3C30 1 70 1 99 2v4C70 7 30 7 1 6Z"/></svg>}
  </button>)}</div>;
}

/** Tabs em pílula (filtro de lista), com contagem opcional. */
export function InkoPillTabs<T extends string>({ label, items, active, onChange }: Readonly<{ label: string; items: readonly { value: T; label: string; count?: number }[]; active: T; onChange: (value: T) => void }>) {
  return <div className="inko-pill-tabs" role="tablist" aria-label={label}>{items.map(item => <button key={item.value} role="tab" type="button" aria-selected={active === item.value} onClick={() => onChange(item.value)}>
    {item.label}{item.count !== undefined && <span> {item.count}</span>}
  </button>)}</div>;
}

export function Pagination({ page, pages, onChange }: Readonly<{ page: number; pages: number; onChange: (page: number) => void }>) {
  if (pages <= 1) return null;
  return <nav aria-label="Paginação" className="inko-pagination">
    <button type="button" aria-label="Página anterior" disabled={page <= 1} onClick={() => onChange(page - 1)}><Icon name="chevron-esquerda" size={16}/></button>
    {Array.from({ length: pages }, (_, index) => index + 1).map(number => <button key={number} type="button" aria-current={number === page ? 'page' : undefined} onClick={() => onChange(number)}>{number}</button>)}
    <button type="button" aria-label="Próxima página" disabled={page >= pages} onClick={() => onChange(page + 1)}><Icon name="chevron-direita" size={16}/></button>
  </nav>;
}

/* ---------- Feedback ---------- */

const alertIcon: Record<Exclude<Tone, 'neutral'>, IconName> = { success: 'check-circulo', warning: 'relogio', danger: 'alerta', info: 'info' };

/** Alert inline. `danger` é anunciado como alerta; os demais como status. */
export function InkoAlert({ tone = 'warning', title, children, action }: Readonly<{ tone?: Exclude<Tone, 'neutral'>; title?: string; children?: ReactNode; action?: ReactNode }>) {
  return <output role={tone === 'danger' ? 'alert' : undefined} className={`inko-alert inko-alert--${tone}`}>
    <Icon name={alertIcon[tone]} size={20}/>
    <span className="inko-alert-body">{title && <strong>{title}</strong>}{children && <span>{children}</span>}</span>
    {action}
  </output>;
}

/* ---------- Domínio ---------- */

/** LoanCard: substitui a linha de tabela abaixo de 768 px. */
export function LoanCard({ loan, reference, work, action }: Readonly<{ loan: Loan; reference: string; work?: Pick<Work, 'title' | 'volume' | 'cover'>; action?: ReactNode }>) {
  const overdue = loan.returnedAt ? 0 : daysOverdue(loan.due, reference);
  return <article className="inko-loan-card">
    {work && <InkoCover work={work} size="sm"/>}
    <div className="inko-loan-card-body">
      <div className="inko-loan-card-head"><strong>{loan.work}</strong>
        {loan.returnedAt && <InkoStatus status="dev" size="sm"/>}
        {!loan.returnedAt && overdue > 0 && <InkoBadge tone="danger" icon="relogio" size="sm">{overdue} d</InkoBadge>}
        {!loan.returnedAt && overdue === 0 && <InkoBadge tone="info" size="sm">Ativo</InkoBadge>}
      </div>
      <span className="inko-loan-card-user"><Icon name="usuario" size={14}/>{loan.user}</span>
      <dl className="inko-loan-card-dates"><div><dt>Empréstimo</dt><dd>{formatDate(loan.start)}</dd></div><div><dt>Prazo</dt><dd className={overdue > 0 ? 'inko-text-danger' : undefined}>{formatDate(loan.due)}</dd></div></dl>
      {action}
    </div>
  </article>;
}

export interface FineRow {
  id: string;
  work: string;
  days: number;
  fineCents: number;
}

/** FineSummary: total de multas dos empréstimos ativos atrasados, com os maiores atrasos. */
export function FineSummary({ rows, reference, href, limit = 2 }: Readonly<{ rows: readonly FineRow[]; reference: string; href?: string; limit?: number }>) {
  const total = rows.reduce((sum, row) => sum + row.fineCents, 0);
  const top = rows.slice(0, limit);
  const rest = rows.slice(limit);
  return <article className="inko-fine-summary">
    <div className="inko-fine-summary-meta"><span>Referência · {formatDate(reference)}</span><span>R$ 2,00 / dia</span></div>
    <div className="inko-fine-summary-total"><strong>{formatBRL(total)}</strong><span>em {rows.length} {rows.length === 1 ? 'empréstimo' : 'empréstimos'}</span></div>
    {rows.length > 0 && <ul>
      {top.map(row => <li key={row.id}><span>{row.days} {row.days === 1 ? 'dia' : 'dias'} · {row.work}</span><span>{formatBRL(row.fineCents)}</span></li>)}
      {rest.length > 0 && <li className="inko-fine-summary-rest"><span>+ {rest.length} {rest.length === 1 ? 'empréstimo' : 'empréstimos'}</span><span>{formatBRL(rest.reduce((sum, row) => sum + row.fineCents, 0))}</span></li>}
    </ul>}
    <small>Apenas empréstimos ativos e atrasados · dados demonstrativos</small>
    {href && <Link href={href} className="inko-fine-summary-link">Abrir relatório<Icon name="seta" size={16}/></Link>}
  </article>;
}

/** CollectionCard: resumo de uma categoria; o card inteiro é o link. */
export function CollectionCard({ title, titles, loaned, href, icon = 'mangas' }: Readonly<{ title: string; titles: number; loaned: number; href: string; icon?: IconName }>) {
  const share = titles > 0 ? (loaned / titles) * 100 : 0;
  return <Link className="inko-collection-card" href={href}>
    <Enso size={140} tone="ink" className="inko-collection-card-enso"/>
    <span className="inko-collection-card-head"><span className="inko-stat-icon inko-stat-icon--ink"><Icon name={icon} size={18}/></span><strong>{title}</strong></span>
    <span className="inko-collection-card-counts"><span><strong>{titles}</strong>títulos</span><span><strong>{loaned}</strong>emprestados</span></span>
    <ProgressBar value={share} label={`${title} emprestados`} tone="seal"/>
    <span className="inko-collection-card-link">Ver categoria<Icon name="seta" size={16}/></span>
  </Link>;
}

const cycle = [
  { tone: 'success', icon: 'check', title: 'Disponível', text: 'Pode ser emprestado.' },
  { tone: 'info', icon: 'emprestimos', title: 'Emprestado', text: 'Dentro do prazo. Aviso em 2 dias.' },
  { tone: 'danger', icon: 'relogio', title: 'Atrasado', text: 'Prazo vencido · multa R$ 2,00/dia.' },
  { tone: 'neutral', icon: 'devolucoes', title: 'Devolvido', text: 'Encerrado; sai do relatório de multas.' },
] as const;

/** Ciclo de circulação de uma obra. */
export function CirculationCycle() {
  return <ol className="inko-cycle">{cycle.map(step => <li key={step.title}><span className={`inko-cycle-icon inko-cycle-icon--${step.tone}`}><Icon name={step.icon} size={16}/></span><div><strong>{step.title}</strong><p>{step.text}</p></div></li>)}</ol>;
}

/** EditorialBanner: painel de mangá com Washi, quadro inclinado e Enso. Texto nunca sobre retícula. */
export function EditorialBanner({ eyebrow, title, subtitle, action, variant = 'compact', headingLevel = 'h3', children }: Readonly<{ eyebrow?: string; title: string; subtitle?: ReactNode; action?: ReactNode; variant?: 'hero' | 'compact'; headingLevel?: 'h1' | 'h2' | 'h3'; children?: ReactNode }>) {
  const Heading = headingLevel;
  return <section className={`inko-editorial-banner inko-editorial-banner--${variant}`}>
    <WashiTexture/>
    <div className="inko-editorial-banner-art" aria-hidden="true"><span className="inko-panel-frame inko-panel-frame--rays"/><span className="inko-panel-frame inko-panel-frame--dots"/><Enso size={variant === 'hero' ? 240 : 170} animated={variant === 'hero'}/></div>
    <div className="inko-editorial-banner-text">
      {eyebrow && <span className="inko-eyebrow inko-eyebrow--brown">{eyebrow}</span>}
      <Heading>{title}</Heading>
      {subtitle && <p>{subtitle}</p>}
      {(action || children) && <div className="inko-actions">{action}{children}</div>}
    </div>
  </section>;
}
