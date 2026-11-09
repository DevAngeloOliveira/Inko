import Link from 'next/link';
import type { ReactNode } from 'react';
import { InkoIcon, InkoStatus } from './inko-kit';
import { daysOverdue, formatBRL, formatDate, type Loan, type Work } from '../lib/demo';

export function InkoStatistic({ label, value, helper, icon }: { label: string; value: string; helper?: string; icon?: string }) {
  return <article className="inko-dashboard-stat"><div className="inko-manga-card-meta"><span>{label}</span>{icon && <InkoIcon name={icon}/>}</div><strong>{value}</strong>{helper && <small>{helper}</small>}</article>;
}

export function InkoTabs({ items, active, onChange }: { items: readonly string[]; active: string; onChange: (value: string) => void }) {
  return <div className="inko-category-tabs" role="tablist">{items.map(item => <button key={item} role="tab" type="button" aria-selected={active === item} onClick={() => onChange(item)} className={active === item ? 'inko-category--selected' : ''}>{item}</button>)}</div>;
}

export function InkoSkeleton({ lines = 3 }: { lines?: number }) {
  return <div className="inko-skeleton" role="status" aria-label="Carregando conteúdo">{Array.from({ length: lines }, (_, index) => <span key={index} className="inko-skeleton-line" style={{ width: `${100 - index * 17}%` }} />)}</div>;
}

export function InkoAlert({ tone = 'warning', children }: { tone?: 'warning' | 'success' | 'danger'; children: ReactNode }) {
  return <div role={tone === 'danger' ? 'alert' : 'status'} className={`inko-alert inko-alert--${tone}`}>{children}</div>;
}

export function LoanCard({ loan, reference }: { loan: Loan; reference: string }) {
  const overdue = daysOverdue(loan.due, reference);
  return <article className="inko-loan-card"><div><strong>{loan.work}</strong><small>{loan.id} · {loan.user}</small></div><div><span>Prazo: {formatDate(loan.due)}</span><span className={`inko-badge inko-badge--${overdue ? 'danger' : 'info'}`}>{overdue ? `${overdue} dia(s) de atraso` : 'No prazo'}</span></div></article>;
}

export function FineSummary({ totalCents, count, reference }: { totalCents: number; count: number; reference: string }) {
  return <article className="inko-fine-summary"><span>RELATÓRIO DE MULTAS ATIVAS</span><strong>{formatBRL(totalCents)}</strong><small>{count} empréstimo(s) atrasado(s) até {formatDate(reference)}</small></article>;
}

export function CollectionCard({ title, total, href, icon = 'acervo' }: { title: string; total: string; href: string; icon?: string }) {
  return <Link className="inko-collection-card" href={href}><InkoIcon name={icon} size={26}/><div><span>{title}</span><strong>{total}</strong></div><span aria-hidden="true">↗</span></Link>;
}

export function WorkQuickView({ work }: { work: Work }) {
  return <div className="inko-work-quick"><div><strong>{work.title}</strong><small>{work.author} · {work.volume}</small></div><InkoStatus status={work.availability}/><Link href={`/acervo/${work.id}`}>Detalhes →</Link></div>;
}

export function EditorialBanner({ title, subtitle }: { title: string; subtitle: string }) {
  return <section className="inko-editorial-banner"><span>INKO / BIBLIOTECA FÍSICA</span><h2>{title}</h2><p>{subtitle}</p></section>;
}
