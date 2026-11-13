'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEMO_REFERENCE_DATE, activeLateLoans, availabilityOf, normalize, workLabel } from '../lib/demo';
import { buildNotifications, markNotificationsRead, resetDemoData, signOut, useLibrary, type LibraryState, type Session } from '../lib/mock-api';
import { Icon, type IconName } from './icon';
import { useDismiss, useToast } from './inko-interactions';
import { Avatar, Breadcrumb, SeigaihaBand } from './inko-kit';

interface NavigationItem {
  href: string;
  icon: IconName;
  label: string;
}

const navigation: readonly NavigationItem[] = [
  { href: '/', icon: 'dashboard', label: 'Dashboard' },
  { href: '/acervo', icon: 'acervo', label: 'Acervo' },
  { href: '/usuarios', icon: 'usuarios', label: 'Usuários' },
  { href: '/emprestimos', icon: 'emprestimos', label: 'Empréstimos' },
  { href: '/devolucoes', icon: 'devolucoes', label: 'Devoluções' },
  { href: '/relatorios', icon: 'relatorios', label: 'Relatórios' },
];

const statusLabel = { disp: 'Disponível', emp: 'Emprestado', atr: 'Atrasado' } as const;

function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
}

function Navigation({ current, lateCount, onNavigate }: Readonly<{ current: string; lateCount: number; onNavigate?: () => void }>) {
  return <nav className="inko-navigation" aria-label="Principal">
    <span className="inko-nav-eyebrow">Operação</span>
    {navigation.map(item => <Link key={item.href} href={item.href} onClick={onNavigate} title={item.label}
      className={isActiveRoute(current, item.href) ? 'inko-nav-link inko-nav-link--active' : 'inko-nav-link'}
      aria-current={isActiveRoute(current, item.href) ? 'page' : undefined}>
      <Icon name={item.icon}/><span className="inko-nav-label">{item.label}</span>
      {item.href === '/relatorios' && lateCount > 0 && <span className="inko-nav-badge" aria-label={`${lateCount} atrasados`}>{lateCount}</span>}
    </Link>)}
  </nav>;
}

/* ---------- Busca global ---------- */

interface SearchResult {
  key: string;
  label: string;
  meta: string;
  kind: 'Obra' | 'Usuário';
  href: string;
  icon: IconName;
}

function searchLibrary(library: LibraryState, query: string): SearchResult[] {
  const term = normalize(query.trim());
  if (!term) return [];
  const late = activeLateLoans(library.loans, DEMO_REFERENCE_DATE);
  const worksFound = library.works.map<SearchResult>(work => ({
    key: work.id, label: workLabel(work), kind: 'Obra', href: `/acervo/${work.id}`, icon: 'acervo',
    meta: `${work.author} · ${work.id} · ${statusLabel[availabilityOf(library.loans, work.id, DEMO_REFERENCE_DATE)]}`,
  }));
  const usersFound = library.users.map<SearchResult>(user => {
    const overdue = late.filter(loan => loan.userId === user.id).length;
    return { key: user.id, label: user.name, kind: 'Usuário', href: `/usuarios?u=${user.id}`, icon: 'usuario', meta: `${user.id} · ${overdue > 0 ? `${overdue} atrasado(s)` : 'em dia'}` };
  });
  return [...worksFound, ...usersFound].filter(result => normalize(`${result.label} ${result.meta}`).includes(term)).slice(0, 6);
}

function GlobalSearch({ library }: Readonly<{ library: LibraryState }>) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const router = useRouter();
  const results = useMemo(() => searchLibrary(library, query), [library, query]);
  const open = query.trim().length > 0;
  const ref = useDismiss<HTMLElement>(open, () => setQuery(''));

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(index => (index + 1) % results.length); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => (index - 1 + results.length) % results.length); }
    if (event.key === 'Enter') { event.preventDefault(); const target = results[Math.min(active, results.length - 1)]; setQuery(''); router.push(target.href); }
  }

  return <search className="inko-search inko-global-search" ref={ref}>
    <Icon name="pesquisa" size={18}/>
    <input className="inko-input" role="combobox" aria-expanded={open} aria-controls="inko-search-results" aria-autocomplete="list"
      aria-activedescendant={open && results.length > 0 ? `inko-search-option-${Math.min(active, results.length - 1)}` : undefined}
      aria-label="Buscar obras ou usuários" placeholder="Buscar obras ou usuários…" value={query}
      onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={onKeyDown}/>
    {open && <button type="button" className="inko-search-clear" aria-label="Limpar busca" onClick={() => setQuery('')}><Icon name="fechar" size={16}/></button>}
    {open && <div id="inko-search-results" role="listbox" aria-label="Resultados da busca" className="inko-popover inko-search-results inko-motion-pop">
      {results.map((result, index) => <Link key={result.key} id={`inko-search-option-${index}`} role="option" aria-selected={index === Math.min(active, results.length - 1)} href={result.href} className="inko-menu-item" onClick={() => setQuery('')}>
        <span className="inko-menu-item-icon"><Icon name={result.icon} size={16}/></span>
        <span className="inko-menu-item-text"><strong>{result.label}</strong><small>{result.meta}</small></span>
        <span className="inko-caption">{result.kind}</span>
      </Link>)}
      {results.length === 0 && <span className="inko-popover-empty">Nada encontrado para “{query.trim()}”.</span>}
    </div>}
  </search>;
}

/* ---------- Notificações e menu do usuário ---------- */

const notificationIcon = { danger: 'relogio', warning: 'relogio', success: 'check-circulo' } as const;

function Notifications({ library }: Readonly<{ library: LibraryState }>) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  const items = useMemo(() => buildNotifications(library), [library]);
  const unread = library.notificationsRead ? 0 : items.length;

  return <div className="inko-popover-anchor" ref={ref}>
    <button type="button" className="inko-icon-button" aria-expanded={open} aria-label={unread > 0 ? `Notificações (${unread} não lidas)` : 'Notificações'} onClick={() => setOpen(value => !value)}>
      <Icon name="notificacoes"/>{unread > 0 && <span className="inko-icon-button-badge" aria-hidden="true">{unread}</span>}
    </button>
    {open && <section aria-label="Notificações" className="inko-popover inko-popover--notifications inko-motion-pop">
      <div className="inko-popover-head"><strong>Notificações</strong><button type="button" disabled={unread === 0} onClick={markNotificationsRead}>Marcar todas como lidas</button></div>
      {items.length === 0 && <span className="inko-popover-empty">Nenhum aviso no momento.</span>}
      <ul>{items.map(item => <li key={`${item.tone}-${item.id}`}>
        <Link href={item.href} className={unread > 0 ? 'inko-menu-item inko-menu-item--unread' : 'inko-menu-item'} onClick={() => setOpen(false)}>
          <span className={`inko-menu-item-icon inko-menu-item-icon--${item.tone}`}><Icon name={notificationIcon[item.tone]} size={16}/></span>
          <span className="inko-menu-item-text"><span>{item.text}</span><small>{item.when}</small></span>
          {unread > 0 && <span className="inko-unread-dot"><span className="sr-only">não lida</span></span>}
        </Link>
      </li>)}</ul>
    </section>}
  </div>;
}

function UserMenu({ session, onSignOut }: Readonly<{ session: Session; onSignOut: () => void }>) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  const toast = useToast();

  function restore() {
    resetDemoData();
    setOpen(false);
    toast({ title: 'Dados demonstrativos restaurados', text: 'Obras, usuários e empréstimos voltaram ao estado inicial.' });
  }

  return <div className="inko-popover-anchor" ref={ref}>
    <button type="button" className="inko-user-button" aria-expanded={open} aria-haspopup="menu" aria-label={`Menu do usuário: ${session.name}`} onClick={() => setOpen(value => !value)}>
      <Avatar name={session.name}/><span className="inko-user-button-text">{session.name}<small>{session.role}</small></span><Icon name="chevron-baixo" size={16}/>
    </button>
    {open && <div role="menu" className="inko-popover inko-popover--menu inko-motion-pop">
      <Link role="menuitem" href="/usuarios" className="inko-menu-item" onClick={() => setOpen(false)}><Icon name="usuario" size={16}/>Meu perfil</Link>
      <Link role="menuitem" href="/design-system" className="inko-menu-item" onClick={() => setOpen(false)}><Icon name="configuracoes" size={16}/>Design System</Link>
      <button role="menuitem" type="button" className="inko-menu-item" onClick={restore}><Icon name="atualizar" size={16}/>Restaurar dados demo</button>
      <hr/>
      <button role="menuitem" type="button" className="inko-menu-item inko-menu-item--danger" onClick={onSignOut}><Icon name="sair" size={16}/>Sair</button>
    </div>}
  </div>;
}

/* ---------- Drawer mobile ---------- */

function MobileDrawer({ open, onClose, pathname, lateCount, session, onSignOut }: Readonly<{ open: boolean; onClose: () => void; pathname: string; lateCount: number; session: Session; onSignOut: () => void }>) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return <dialog ref={dialogRef} className="inko-drawer" aria-label="Menu principal" onClose={onClose}>
    <div className="inko-drawer-panel">
      <div className="inko-drawer-head">
        <Image src="/inko/logo/inko-logo-inverse.png" alt="INKO" width={110} height={81}/>
        <button type="button" className="inko-drawer-close" aria-label="Fechar menu" onClick={onClose}><Icon name="fechar" size={22}/></button>
      </div>
      <Navigation current={pathname} lateCount={lateCount} onNavigate={onClose}/>
      <div className="inko-drawer-foot">
        <SeigaihaBand/>
        <div className="inko-drawer-user">
          <Avatar name={session.name} size={36} tone="paper"/>
          <span>{session.name}<small>{session.role}</small></span>
          <button type="button" aria-label="Sair" onClick={onSignOut}><Icon name="sair"/></button>
        </div>
      </div>
    </div>
    <button type="button" className="inko-drawer-backdrop" aria-label="Fechar menu" tabIndex={-1} onClick={onClose}/>
  </dialog>;
}

/* ---------- Shell ---------- */

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Moldura das telas autenticadas: sidebar (248 px ≥ 1024, rail 72 px em tablet,
 * drawer abaixo de 768), topbar com busca global ou breadcrumb, avisos e menu do usuário.
 * Sem sessão mockada, redireciona para `/login`.
 */
export function AppShell({ children, breadcrumb }: Readonly<{ children: ReactNode; breadcrumb?: readonly Crumb[] }>) {
  const pathname = usePathname();
  const router = useRouter();
  const library = useLibrary();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { ready, session } = library;
  const lateCount = useMemo(() => activeLateLoans(library.loans, DEMO_REFERENCE_DATE).length, [library.loans]);

  useEffect(() => {
    if (ready && !session) router.replace('/login');
  }, [ready, session, router]);

  function handleSignOut() {
    setDrawerOpen(false);
    signOut();
  }

  return <div className="inko-app-layout">
    <aside className="inko-app-sidebar">
      <Link href="/" className="inko-sidebar-logo" aria-label="INKO — Dashboard"><Image src="/inko/logo/inko-logo-inverse.png" alt="" width={132} height={98} priority/></Link>
      <Navigation current={pathname} lateCount={lateCount}/>
      <SeigaihaBand className="inko-sidebar-waves"/>
    </aside>
    <div className="inko-app-main">
      <header className="inko-app-topbar">
        <button type="button" className="inko-icon-button inko-menu-button" aria-label="Abrir menu" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}><Icon name="menu" size={24}/></button>
        {breadcrumb ? <Breadcrumb items={breadcrumb}/> : <GlobalSearch library={library}/>}
        {session && <div className="inko-app-user"><Notifications library={library}/><UserMenu session={session} onSignOut={handleSignOut}/></div>}
      </header>
      <main className="inko-app-content">
        {session ? children : <output className="inko-app-loading" aria-label="Carregando"><Icon name="carregando" size={24} className="inko-motion-spin"/></output>}
      </main>
    </div>
    {session && <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} pathname={pathname} lateCount={lateCount} session={session} onSignOut={handleSignOut}/>}
  </div>;
}
