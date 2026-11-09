import Image from 'next/image';
import Link from 'next/link';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import type { Availability, Work } from '../lib/demo';

export function InkoIcon({ name, size = 20 }: Readonly<{ name: string; size?: number }>) {
  return <Image src={`/inko/svg/icons/icon-${name}.svg`} alt="" width={size} height={size} aria-hidden="true" unoptimized />;
}

export function InkoButton({ variant = 'primary', children, className = '', ...props }: Readonly<ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' }>) {
  return <button {...props} className={`inko-button inko-button--${variant} ${className}`}>{children}</button>;
}

export function InkoLinkButton({ href, children, variant = 'primary' }: Readonly<{ href: string; children: ReactNode; variant?: 'primary' | 'secondary' | 'outline' | 'ghost' }>) {
  return <Link href={href} className={`inko-button inko-button--${variant}`}>{children}</Link>;
}

export function InkoInput({ label, help, error, id, ...props }: Readonly<InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; help?: string; error?: string }>) {
  return <label className="inko-field" htmlFor={id}><span className="inko-label">{label}</span><input {...props} id={id} aria-invalid={Boolean(error)} aria-describedby={error || help ? `${id}-help` : undefined}/>{(error || help) && <span id={`${id}-help`} className={error ? 'inko-field-error' : 'inko-field-help'}>{error || help}</span>}</label>;
}

export function Section({ title, action, children, className = '' }: Readonly<{ title: string; action?: ReactNode; children: ReactNode; className?: string }>) {
  return <section className={`inko-section ${className}`}><div className="inko-section-head"><h2>{title}</h2>{action}</div>{children}</section>;
}

export function PageHeading({ eyebrow, title, description, action }: Readonly<{ eyebrow?: string; title: string; description?: string; action?: ReactNode }>) {
  return <header className="inko-page-heading"><div>{eyebrow && <span className="inko-eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</header>;
}

const statusMeta: Record<Availability, { label: string; className: string }> = {
  disp: { label: 'Disponível', className: 'success' },
  emp: { label: 'Emprestado', className: 'info' },
  atr: { label: 'Atrasado', className: 'danger' },
};
export function InkoStatus({ status }: Readonly<{ status: Availability }>) {
  const info = statusMeta[status];
  return <span className={`inko-badge inko-badge--${info.className}`}><span aria-hidden="true">●</span>{info.label}</span>;
}

export function DemoNotice({ children }: Readonly<{ children?: ReactNode }>) {
  return <output className="inko-demo-notice"><InkoIcon name="info" size={18}/><span className="inko-notice-body"><strong>Ambiente demonstrativo</strong><span>{children ?? 'Conteúdo fictício do protótipo Claude Design. Nenhuma operação é gravada no banco de dados.'}</span></span></output>;
}

export function InkoCover({ work, compact = false }: Readonly<{ work: Work; compact?: boolean }>) {
  return <div className={`inko-cover inko-cover--${work.cover}${compact ? ' inko-cover--compact' : ''}`} role="img" aria-label={`Capa ilustrativa fictícia de ${work.title}`}>
    <div className="inko-cover-shape"/><div className="inko-cover-shape--second"/><span>{work.title}</span>
  </div>;
}

export function MangaCard({ work }: Readonly<{ work: Work }>) {
  return <article className="inko-manga-card"><Link href={`/acervo/${work.id}`} aria-label={`Abrir ${work.title}`}><InkoCover work={work}/></Link><div className="inko-manga-card-meta"><span>{work.category}</span><small>{work.volume}</small></div><Link href={`/acervo/${work.id}`} className="inko-work-title">{work.title}</Link><p>{work.author}</p><div className="inko-manga-card-footer"><InkoStatus status={work.availability}/><small>{work.id}</small></div></article>;
}

export function InkoEmpty({ title, text, children }: Readonly<{ title: string; text: string; children?: ReactNode }>) {
  return <div className="inko-empty"><Image src="/inko/svg/elementos/enso-seal.svg" alt="" width={74} height={74}/><h3>{title}</h3><p>{text}</p>{children}</div>;
}
