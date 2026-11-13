import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { initials, workLabel, type Category, type CirculationStatus, type Work } from '../lib/demo';
import { Icon, type IconName } from './icon';

export { Icon as InkoIcon } from './icon';

/* ---------- Definições SVG compartilhadas (uma vez por página, no layout raiz) ---------- */

export function InkoDefs() {
  return <svg className="inko-defs" aria-hidden="true" width="0" height="0" focusable="false"><defs>
    <filter id="inko-ink-rough"><feTurbulence type="fractalNoise" baseFrequency="0.035 0.6" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="7"/></filter>
    <filter id="inko-washi"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="9"/><feColorMatrix values="0 0 0 0 0.36  0 0 0 0 0.27  0 0 0 0 0.21  0.32 0 0 0 -0.1"/></filter>
    <pattern id="inko-seigaiha" width="40" height="20" patternUnits="userSpaceOnUse"><g fill="#111111" stroke="#F7F3ED" strokeWidth="1.2" strokeOpacity=".3">
      <circle cx="0" cy="10" r="19"/><circle cx="0" cy="10" r="14"/><circle cx="0" cy="10" r="9"/>
      <circle cx="40" cy="10" r="19"/><circle cx="40" cy="10" r="14"/><circle cx="40" cy="10" r="9"/>
      <circle cx="20" cy="20" r="19"/><circle cx="20" cy="20" r="14"/><circle cx="20" cy="20" r="9"/><circle cx="20" cy="20" r="4"/>
    </g></pattern>
  </defs></svg>;
}

/** Textura de papel Washi para superfícies editoriais. Decorativa. */
export function WashiTexture() {
  return <svg className="inko-washi" aria-hidden="true" focusable="false"><rect width="100%" height="100%" filter="url(#inko-washi)"/></svg>;
}

/** Faixa de ondas Seigaiha (rodapé da sidebar e painéis ink). Decorativa. */
export function SeigaihaBand({ className = '' }: Readonly<{ className?: string }>) {
  return <div className={`inko-seigaiha ${className}`.trim()} aria-hidden="true"><svg width="100%" height="100%" focusable="false"><rect width="100%" height="100%" fill="url(#inko-seigaiha)"/></svg></div>;
}

/** Enso — círculo de pincel da marca. `animated` desenha o traço na entrada (900 ms). */
export function Enso({ size = 170, tone = 'seal', strokeWidth = 16, animated = false, className = '' }: Readonly<{ size?: number; tone?: 'seal' | 'ink' | 'paper'; strokeWidth?: number; animated?: boolean; className?: string }>) {
  return <svg className={`inko-enso inko-enso--${tone} ${className}`.trim()} viewBox="0 0 200 200" width={size} height={size} aria-hidden="true" focusable="false">
    <g filter="url(#inko-ink-rough)"><path className={animated ? 'inko-motion-enso-entry' : undefined} d="M151.4 38.7 A80 80 0 1 0 175.2 127.4" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round"/></g>
  </svg>;
}

/* ---------- Botões ---------- */

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

function buttonClass(variant: ButtonVariant, size: ButtonSize, iconOnly: boolean, className: string): string {
  return ['inko-button', `inko-button--${variant}`, `inko-button--${size}`, iconOnly ? 'inko-button--icon' : '', className].filter(Boolean).join(' ');
}

export function InkoButton({ variant = 'primary', size = 'md', loading = false, leftIcon, iconOnly = false, children, className = '', disabled, type = 'button', ...props }: Readonly<ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean; leftIcon?: IconName; iconOnly?: boolean }>) {
  return <button {...props} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={buttonClass(variant, size, iconOnly, className)}>
    {loading && <Icon name="carregando" size={16} className="inko-motion-spin"/>}
    {!loading && leftIcon && <Icon name={leftIcon} size={size === 'sm' ? 16 : 18}/>}
    {children}
  </button>;
}

export function InkoLinkButton({ href, children, variant = 'primary', size = 'md', leftIcon, className = '', ...props }: Readonly<Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string; children: ReactNode; variant?: ButtonVariant; size?: ButtonSize; leftIcon?: IconName }>) {
  return <Link {...props} href={href} className={buttonClass(variant, size, false, className)}>{leftIcon && <Icon name={leftIcon} size={size === 'sm' ? 16 : 18}/>}{children}</Link>;
}

/* ---------- Campos de formulário ---------- */

interface FieldProps {
  id: string;
  label: string;
  help?: string;
  error?: string;
  success?: string;
  required?: boolean;
}

function fieldState(error?: string, success?: string): string {
  if (error) return ' inko-field--error';
  return success ? ' inko-field--success' : '';
}

/** Moldura de campo: rótulo persistente, controle e mensagem ligada por `aria-describedby`. */
export function InkoField({ id, label, help, error, success, required, children, className = '' }: Readonly<FieldProps & { children: ReactNode; className?: string }>) {
  const message = error ?? success ?? help;
  return <div className={`inko-field${fieldState(error, success)} ${className}`.trim()}>
    <label className="inko-label" htmlFor={id}>{label}{required && <span className="inko-required" aria-hidden="true"> *</span>}</label>
    {children}
    {message && <span id={`${id}-help`} className="inko-field-message">
      {error && <Icon name="erro-circulo" size={14}/>}{!error && success && <Icon name="check" size={14}/>}{message}
    </span>}
  </div>;
}

function describedBy(id: string, props: Pick<FieldProps, 'help' | 'error' | 'success'>): string | undefined {
  return props.error || props.success || props.help ? `${id}-help` : undefined;
}

export function InkoInput({ id, label, help, error, success, required, leftIcon, className, ...props }: Readonly<InputHTMLAttributes<HTMLInputElement> & FieldProps & { leftIcon?: IconName }>) {
  return <InkoField id={id} label={label} help={help} error={error} success={success} required={required} className={className}>
    <span className={leftIcon ? 'inko-control inko-control--icon' : 'inko-control'}>
      {leftIcon && <Icon name={leftIcon} size={18}/>}
      <input {...props} id={id} className="inko-input" required={required} aria-invalid={Boolean(error)} aria-describedby={describedBy(id, { help, error, success })}/>
    </span>
  </InkoField>;
}

export function InkoSelect({ id, label, help, error, success, required, className, children, ...props }: Readonly<SelectHTMLAttributes<HTMLSelectElement> & FieldProps>) {
  return <InkoField id={id} label={label} help={help} error={error} success={success} required={required} className={className}>
    <span className="inko-control inko-control--select">
      <select {...props} id={id} className="inko-input" required={required} aria-invalid={Boolean(error)} aria-describedby={describedBy(id, { help, error, success })}>{children}</select>
      <Icon name="chevron-baixo" size={18}/>
    </span>
  </InkoField>;
}

export function InkoTextarea({ id, label, help, error, success, required, className, ...props }: Readonly<TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>) {
  return <InkoField id={id} label={label} help={help} error={error} success={success} required={required} className={className}>
    <textarea {...props} id={id} className="inko-input inko-input--textarea" required={required} aria-invalid={Boolean(error)} aria-describedby={describedBy(id, { help, error, success })}/>
  </InkoField>;
}

/** Campo de busca com lupa; o rótulo é obrigatório e fica só para leitores de tela. */
export function InkoSearch({ label, className = '', ...props }: Readonly<Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string }>) {
  return <search className={`inko-search ${className}`.trim()}><Icon name="pesquisa" size={18}/><input {...props} type="search" className="inko-input" aria-label={label}/></search>;
}

/** Controle segmentado (ex.: Cards | Tabela). */
export function InkoSegmented<T extends string>({ label, options, value, onChange }: Readonly<{ label: string; options: readonly { value: T; label: string; icon?: IconName }[]; value: T; onChange: (value: T) => void }>) {
  return <fieldset className="inko-segmented"><legend className="sr-only">{label}</legend>
    {options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.icon && <Icon name={option.icon} size={16}/>}{option.label}</button>)}
  </fieldset>;
}

/* ---------- Status, badges e tags ---------- */

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export function InkoBadge({ tone = 'neutral', icon, size = 'md', children, className = '' }: Readonly<{ tone?: Tone; icon?: IconName; size?: 'sm' | 'md'; children: ReactNode; className?: string }>) {
  return <span className={`inko-badge inko-badge--${tone}${size === 'sm' ? ' inko-badge--sm' : ''} ${className}`.trim()}>{icon && <Icon name={icon} size={size === 'sm' ? 12 : 13}/>}{children}</span>;
}

const statusMeta: Record<CirculationStatus, { label: string; tone: Tone; icon: IconName }> = {
  disp: { label: 'Disponível', tone: 'success', icon: 'check-circulo' },
  emp: { label: 'Emprestado', tone: 'info', icon: 'emprestimos' },
  atr: { label: 'Atrasado', tone: 'danger', icon: 'relogio' },
  dev: { label: 'Devolvido', tone: 'neutral', icon: 'devolucoes' },
};

/** CirculationStatus: sempre ícone + texto + cor. `detail` acrescenta, por exemplo, "15 d". */
export function InkoStatus({ status, detail, size }: Readonly<{ status: CirculationStatus; detail?: string; size?: 'sm' | 'md' }>) {
  const info = statusMeta[status];
  return <InkoBadge tone={info.tone} icon={info.icon} size={size}>{info.label}{detail && ` · ${detail}`}</InkoBadge>;
}

export function CategoryTag({ category }: Readonly<{ category: Category | string }>) {
  return <span className={category === 'Graphic novel' ? 'inko-tag inko-tag--solid' : 'inko-tag'}>{category}</span>;
}

/** Selo tracejado que identifica conteúdo fictício. */
export function DemoTag({ children = 'Dados demonstrativos' }: Readonly<{ children?: ReactNode }>) {
  return <span className="inko-demo-tag">{children}</span>;
}

export function DemoNotice({ children }: Readonly<{ children?: ReactNode }>) {
  return <output className="inko-demo-notice"><Icon name="info" size={18}/><span><strong>Ambiente demonstrativo. </strong>{children ?? 'Os dados são fictícios e as operações ficam apenas neste navegador, até a integração com o backend.'}</span></output>;
}

export function Avatar({ name, size = 32, tone = 'ink' }: Readonly<{ name: string; size?: number; tone?: 'ink' | 'paper' | 'sand' }>) {
  return <span className={`inko-avatar inko-avatar--${tone}`} style={{ width: size, height: size }} aria-hidden="true">{initials(name)}</span>;
}

export function ProgressBar({ value, label, tone = 'ink' }: Readonly<{ value: number; label: string; tone?: 'ink' | 'seal' }>) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return <div className={`inko-progress inko-progress--${tone}`} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100} aria-label={label}><div style={{ width: `${clamped}%` }}/></div>;
}

/* ---------- Estrutura de página ---------- */

export function Breadcrumb({ items }: Readonly<{ items: readonly { label: string; href?: string }[] }>) {
  return <nav aria-label="Breadcrumb" className="inko-breadcrumb"><ol>
    {items.map((item, index) => <li key={item.label} aria-current={index === items.length - 1 ? 'page' : undefined}>
      {item.href && index < items.length - 1 ? <Link href={item.href}>{item.label}</Link> : item.label}
    </li>)}
  </ol></nav>;
}

export function PageHeading({ eyebrow, title, description, action }: Readonly<{ eyebrow?: string; title: string; description?: ReactNode; action?: ReactNode }>) {
  return <header className="inko-page-heading"><div>{eyebrow && <span className="inko-eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="inko-page-actions">{action}</div>}</header>;
}

/** Painel (card de seção) com título e ação opcionais. `flush` remove o padding para tabelas. */
export function Section({ title, action, children, className = '', flush = false, id }: Readonly<{ title?: string; action?: ReactNode; children: ReactNode; className?: string; flush?: boolean; id?: string }>) {
  return <section className={`inko-section${flush ? ' inko-section--flush' : ''} ${className}`.trim()} aria-labelledby={title && id ? id : undefined}>
    {(title || action) && <div className="inko-section-head">{title && <h2 id={id}>{title}</h2>}{action}</div>}
    {children}
  </section>;
}

/* ---------- Capas e cards de obra ---------- */

/**
 * Capa fictícia em CSS no slot 2:3 onde entrarão capas reais licenciadas.
 * `work.cover === null` mostra o estado "Sem capa".
 */
export function InkoCover({ work, size = 'md' }: Readonly<{ work: Pick<Work, 'title' | 'volume' | 'cover'>; size?: 'xs' | 'sm' | 'md' }>) {
  if (work.cover === null) {
    return <div className={`inko-cover inko-cover--empty inko-cover--${size}`}><Icon name="imagem" size={size === 'md' ? 28 : 16}/>{size === 'md' && <span>Sem capa</span>}</div>;
  }
  return <div className={`inko-cover inko-cover--${work.cover} inko-cover--${size}`} role="img" aria-label={`Capa fictícia de ${workLabel(work)}`}>
    <span className="inko-cover-a"/><span className="inko-cover-b"/><span className="inko-cover-c"/>
    {size === 'md' && <span className="inko-cover-title">{work.title}</span>}
  </div>;
}

export function MangaCard({ work, status, href, footer }: Readonly<{ work: Work; status?: CirculationStatus; href?: string; footer?: ReactNode }>) {
  const target = href ?? `/acervo/${work.id}`;
  return <article className="inko-manga-card">
    <Link href={target} className="inko-manga-card-cover" aria-label={`Abrir ${workLabel(work)}`}><InkoCover work={work}/></Link>
    <div className="inko-manga-card-meta"><CategoryTag category={work.category}/>{work.volume && <span>{work.volume}</span>}</div>
    <div className="inko-manga-card-title"><h3><Link href={target}>{work.title}</Link></h3><span>{work.author}</span></div>
    <div className="inko-manga-card-footer">{status && <InkoStatus status={status}/>}{footer ?? <small>{work.id}</small>}</div>
  </article>;
}

/* ---------- Estados vazios e de erro ---------- */

export function InkoEmpty({ title, text, children }: Readonly<{ title: string; text: string; children?: ReactNode }>) {
  return <div className="inko-empty">
    <svg viewBox="0 0 200 200" width="84" height="84" aria-hidden="true" focusable="false">
      <g filter="url(#inko-ink-rough)"><path d="M151.4 38.7 A80 80 0 1 0 175.2 127.4" fill="none" stroke="#C43B2F" strokeWidth="14" strokeLinecap="round"/></g>
      <g transform="translate(70 62)"><rect width="60" height="76" fill="#FFFDF9" stroke="#111111" strokeWidth="4"/><path d="M0 34h60M30 0v34" stroke="#111111" strokeWidth="3"/></g>
    </svg>
    <h3>{title}</h3><p>{text}</p>{children}
  </div>;
}

export function InkoErrorState({ title = 'Não foi possível carregar', text, onRetry }: Readonly<{ title?: string; text: string; onRetry?: () => void }>) {
  return <div className="inko-empty" role="alert">
    <span className="inko-empty-icon"><Icon name="falha" size={26}/></span>
    <h3>{title}</h3><p>{text}</p>
    {onRetry && <InkoButton size="sm" onClick={onRetry}>Tentar novamente</InkoButton>}
  </div>;
}
