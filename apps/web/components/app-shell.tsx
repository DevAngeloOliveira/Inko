'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { InkoIcon } from './inko-kit';

const navigation = [
  { href: '/', icon: 'dashboard', label: 'Visão geral' },
  { href: '/acervo', icon: 'acervo', label: 'Acervo' },
  { href: '/usuarios', icon: 'usuarios', label: 'Usuários' },
  { href: '/emprestimos', icon: 'emprestimos', label: 'Empréstimos' },
  { href: '/devolucoes', icon: 'devolucoes', label: 'Devoluções' },
  { href: '/relatorios', icon: 'relatorios', label: 'Relatórios' },
] as const;

function Navigation({ current, onNavigate }: { current: string; onNavigate?: () => void }) {
  return <nav className="inko-navigation" aria-label="Navegação principal">
    <span className="inko-nav-eyebrow">OPERAÇÃO</span>
    {navigation.map(item => <Link key={item.href} href={item.href} onClick={onNavigate}
      className={`inko-nav-link ${current === item.href || (item.href !== '/' && current.startsWith(`${item.href}/`)) ? 'inko-nav-link--active' : ''}`}
      aria-current={current === item.href ? 'page' : undefined}><InkoIcon name={item.icon}/>{item.label}</Link>)}
  </nav>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const current = navigation.find(item => item.href === pathname || (item.href !== '/' && pathname.startsWith(`${item.href}/`)))?.label ?? 'INKO';
  return <div className="inko-app-layout">
    <aside className="inko-app-sidebar">
      <Link href="/" className="inko-sidebar-logo" aria-label="INKO — início"><Image src="/inko/logo/inko-logo-inverse.png" alt="INKO" width={132} height={99} priority/></Link>
      <Navigation current={pathname}/>
      <div className="inko-sidebar-bottom"><Image src="/inko/svg/elementos/seigaiha-tile.svg" alt="" width={184} height={100}/><span>INKO · ACERVO FÍSICO<br/>Versão demonstrativa</span></div>
    </aside>
    <div className="inko-app-main">
      <header className="inko-app-topbar">
        <details className="inko-mobile-menu"><summary><InkoIcon name="menu" size={24}/><span className="sr-only">Abrir menu</span></summary><div className="inko-mobile-menu-content"><Navigation current={pathname}/></div></details>
        <span>Biblioteca <span className="inko-crumb">/</span> {current}</span>
        <div className="inko-app-user"><Link href="/acervo" aria-label="Buscar no acervo"><InkoIcon name="pesquisa"/></Link><span title="Notificações ainda não disponíveis"><InkoIcon name="notificacoes"/></span><span className="inko-user-avatar" aria-label="Operador demonstrativo">M</span></div>
      </header>
      <main className="inko-app-content">{children}</main>
    </div>
  </div>;
}
