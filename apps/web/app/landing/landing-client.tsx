'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useId, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../../components/icon';
import { InkoBadge, InkoCover } from '../../components/inko-kit';
import { DEMO_REFERENCE_DATE, availabilityOf, loans, works, type Category } from '../../lib/demo';
import { isValidEmailAddress } from '../../lib/validation';
import styles from './landing.module.css';

/* ---------- Topo: navegação que vira coluna recolhível no celular ---------- */

const SECTIONS = [
  { href: '#acervo', label: 'Acervo' },
  { href: '#recursos', label: 'Recursos' },
  { href: '#como', label: 'Como funciona' },
  { href: '#faq', label: 'Dúvidas' },
] as const;

export function LandingHeader() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const close = () => setOpen(false);

  return <header className={`${styles.dark} ${styles.topbar}`}>
    <div className={`${styles.container} ${styles.topbarInner}`}>
      <Link href="/landing" aria-label="INKO — início" className={styles.logoLink}>
        <Image src="/inko/logo/inko-logo-inverse.png" alt="INKO" width={900} height={665} sizes="124px" priority className={styles.logo}/>
      </Link>
      <button type="button" className={styles.menuButton} aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(value => !value)}>
        <Icon name={open ? 'fechar' : 'menu'} size={20}/>Menu
      </button>
      <div id={menuId} className={open ? `${styles.menu} ${styles.menuOpen}` : styles.menu}>
        <nav aria-label="Seções" className={styles.nav}>
          {SECTIONS.map(section => <a key={section.href} href={section.href} className={styles.navLink} onClick={close}>{section.label}</a>)}
        </nav>
        <div className={styles.topActions}>
          <Link href="/login" className={`${styles.btn} ${styles.btnSm} ${styles.btnGhostLight}`}>Entrar</Link>
          <a href="#demo" className={`${styles.btn} ${styles.btnSm} ${styles.btnPrimary}`} onClick={close}>Pedir demonstração</a>
        </div>
      </div>
    </div>
  </header>;
}

/* ---------- Vitrine do acervo ---------- */

type Filter = 'all' | Category;

const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tudo' },
  { value: 'Mangá', label: 'Mangás' },
  { value: 'HQ', label: 'HQs' },
  { value: 'Graphic novel', label: 'Graphic novels' },
];

/* As oito primeiras obras da semente; a vitrine pública mostra só "na estante" ou "emprestado". */
const SHOWCASE = works.slice(0, 8).map(work => ({
  work,
  onShelf: availabilityOf(loans, work.id, DEMO_REFERENCE_DATE) === 'disp',
}));

export function Showcase() {
  const [filter, setFilter] = useState<Filter>('all');
  const panelId = useId();
  const visible = SHOWCASE.filter(item => filter === 'all' || item.work.category === filter);

  return <section id="acervo" aria-labelledby="ac-t" className={`${styles.container} ${styles.showcase}`}>
    <div className={styles.showcaseHead}>
      <div className={styles.showcaseIntro}>
        <div className={styles.brushLabel}>
          <svg aria-hidden="true" focusable="false" viewBox="0 0 300 48" preserveAspectRatio="none"><g filter="url(#inko-ink-rough)"><path d="M8 12C60 5 150 3 230 6c30 1 52 0 66 5-6 7 2 15-3 22-38 9-120 8-190 10-38 1-74 2-100-3 6-8-2-17 3-23Z"/></g></svg>
          <span>Vitrine do acervo</span>
        </div>
        <h2 id="ac-t" className={styles.h2}>Sua estante, visível de qualquer lugar.</h2>
        <p className={styles.lead}>Cada obra aparece com capa, categoria e disponibilidade em tempo real. O leitor sabe o que está na prateleira antes de sair de casa.</p>
      </div>
      <div role="tablist" aria-label="Filtrar vitrine por categoria" className={styles.cats}>
        {FILTERS.map(item => <button key={item.value} type="button" role="tab" aria-selected={filter === item.value} aria-controls={panelId} onClick={() => setFilter(item.value)}>{item.label}</button>)}
      </div>
    </div>
    <ul id={panelId} className={styles.works} aria-label="Obras da vitrine">
      {visible.map(({ work, onShelf }) => <li key={work.id}><article className={styles.work}>
        <div className={styles.workCover}><InkoCover work={work}/></div>
        <div className={styles.workMeta}>
          <span className="inko-caption">{work.category} · {work.volume || 'Volume único'}</span>
          <h3>{work.title}</h3>
          <span className={styles.workAuthor}>{work.author}</span>
          {onShelf && <InkoBadge tone="success" icon="check-circulo">Na estante</InkoBadge>}
          {!onShelf && <InkoBadge tone="info" icon="emprestimos">Emprestado</InkoBadge>}
        </div>
      </article></li>)}
    </ul>
    <p className={styles.finePrint}>Títulos, autores e capas desta página são fictícios e servem de demonstração. No seu INKO entram as obras e capas do seu acervo.</p>
  </section>;
}

/* ---------- Pedido de demonstração ---------- */

export function LeadForm() {
  const [email, setEmail] = useState('');
  const [tried, setTried] = useState(false);
  const [sent, setSent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const valid = isValidEmailAddress(email.trim());
  const error = tried && !valid;

  // Demonstração: valida localmente e confirma; nada é enviado nem armazenado.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTried(true);
    if (valid) setSent(true);
    else inputRef.current?.focus();
  }

  return <>
    {sent && <output className={styles.leadSent}><Icon name="check-circulo" size={22}/><span>Pedido recebido. Vamos escrever para {email.trim()}.</span></output>}
    {!sent && <form className={styles.leadForm} noValidate onSubmit={submit}>
      <label htmlFor="lead">E-mail de trabalho</label>
      <div className={styles.leadRow}>
        <input ref={inputRef} id="lead" type="email" autoComplete="email" placeholder="voce@biblioteca.org" className={styles.leadInput}
          value={email} onChange={event => setEmail(event.target.value)} aria-invalid={error} aria-describedby={error ? 'lead-e lead-n' : 'lead-n'}/>
        <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>Pedir demonstração</button>
      </div>
      {error && <span id="lead-e" className={styles.leadError}><Icon name="erro-circulo" size={14}/>Informe um e-mail válido, como nome@biblioteca.org.</span>}
      <span id="lead-n" className={styles.leadNote}>Formulário demonstrativo: o e-mail não é enviado nem armazenado.</span>
    </form>}
  </>;
}
