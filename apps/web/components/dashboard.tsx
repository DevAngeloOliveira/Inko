'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DEMO_REFERENCE_DATE, activeLateLoans, daysBetween, formatDate, type Loan, type Work } from '../lib/demo';
import { setRemindersSent, useLibrary } from '../lib/mock-api';
import { AppShell } from './app-shell';
import styles from './dashboard.module.css';
import { Icon, type IconName } from './icon';
import { useMockQuery, useToast } from './inko-interactions';
import { DemoNotice, DemoTag, Enso, InkoBadge, InkoButton, InkoCover, InkoEmpty, InkoLinkButton, WashiTexture } from './inko-kit';
import { FineSummary, InkoPillTabs, InkoStatistic, InkoStatisticSkeleton } from './inko-patterns';

type MoveKind = 'emp' | 'dev';
type MoveFilter = 'all' | MoveKind;

interface Movement {
  key: string;
  kind: MoveKind;
  date: string;
  loan: Loan;
}

const MOVES_LIMIT = 6;
const WEEK_DAYS = 7;

// Nomes fixos (em vez de Intl) para o texto ser idêntico no servidor e no navegador.
const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const moveMeta: Record<MoveKind, { label: string; tone: 'info' | 'neutral'; icon: IconName }> = {
  emp: { label: 'Empréstimo', tone: 'info', icon: 'emprestimos' },
  dev: { label: 'Devolução', tone: 'neutral', icon: 'devolucoes' },
};

const shortcuts: readonly { href: string; label: string; icon: IconName }[] = [
  { href: '/emprestimos', label: 'Novo empréstimo', icon: 'emprestimos' },
  { href: '/devolucoes', label: 'Registrar devolução', icon: 'devolucoes' },
  { href: '/acervo/novo', label: 'Cadastrar obra', icon: 'mais' },
  { href: '/usuarios', label: 'Novo usuário', icon: 'usuario' },
];

function longDate(iso: string, weekdays: readonly string[]): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return `${weekdays[date.getUTCDay()]}, ${date.getUTCDate()} de ${MONTHS[date.getUTCMonth()]}`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Empréstimos e devoluções como eventos, do mais recente para o mais antigo. */
function buildMovements(loans: readonly Loan[]): Movement[] {
  return loans
    .flatMap(loan => {
      const lent: Movement = { key: `${loan.id}-emp`, kind: 'emp', date: loan.start, loan };
      return loan.returnedAt ? [lent, { key: `${loan.id}-dev`, kind: 'dev' as const, date: loan.returnedAt, loan }] : [lent];
    })
    .sort((left, right) => daysBetween(left.date, right.date) || right.loan.id.localeCompare(left.loan.id));
}

function relativeDay(iso: string, reference: string): string {
  const distance = daysBetween(iso, reference);
  if (distance === 0) return 'Hoje';
  if (distance === 1) return 'Ontem';
  return formatDate(iso);
}

function splitWorkLabel(label: string): { title: string; volume: string } {
  const [title, ...rest] = label.split(' · ');
  return { title, volume: rest.join(' · ') };
}

function coverOf(move: Movement, works: readonly Work[]): Pick<Work, 'title' | 'volume' | 'cover'> {
  return works.find(work => work.id === move.loan.workId) ?? { title: move.loan.work, volume: '', cover: null };
}

function AttentionText({ late, dueSoon, compact = false }: Readonly<{ late: number; dueSoon: number; compact?: boolean }>) {
  if (late === 0 && dueSoon === 0) return <>Nenhum empréstimo atrasado ou vencendo nesta semana.</>;
  if (compact) return <><strong>{plural(late, 'atrasado', 'atrasados')}</strong> · {plural(dueSoon, 'vence', 'vencem')} nesta semana</>;
  return <><strong>{plural(late, 'empréstimo atrasado', 'empréstimos atrasados')}</strong> e {dueSoon} vencendo nesta semana {late + dueSoon === 1 ? 'pede' : 'pedem'} atenção.</>;
}

function MoveBadge({ kind, size }: Readonly<{ kind: MoveKind; size?: 'sm' | 'md' }>) {
  const meta = moveMeta[kind];
  return <InkoBadge tone={meta.tone} icon={meta.icon} size={size}>{meta.label}</InkoBadge>;
}

function MoveWork({ move, works }: Readonly<{ move: Movement; works: readonly Work[] }>) {
  const { title, volume } = splitWorkLabel(move.loan.work);
  const exists = works.some(work => work.id === move.loan.workId);
  const content = <><InkoCover work={coverOf(move, works)} size="xs"/><span><strong>{title}</strong>{volume && <span> · {volume}</span>}</span></>;
  // Obra excluída do acervo depois da devolução: mantém o rótulo, sem link quebrado.
  if (!exists) return <span className="inko-table-work">{content}</span>;
  return <Link href={`/acervo/${move.loan.workId}`} className="inko-table-work">{content}</Link>;
}

export function Dashboard() {
  const library = useLibrary();
  const toast = useToast();
  const { loading, reload } = useMockQuery();
  const [filter, setFilter] = useState<MoveFilter>('all');

  const lateLoans = useMemo(() => activeLateLoans(library.loans, DEMO_REFERENCE_DATE), [library.loans]);
  const movements = useMemo(() => buildMovements(library.loans), [library.loans]);
  const activeLoans = library.loans.filter(loan => !loan.returnedAt);
  const dueSoon = activeLoans.filter(loan => {
    const left = daysBetween(DEMO_REFERENCE_DATE, loan.due);
    return left >= 0 && left < WEEK_DAYS;
  }).length;
  const late = lateLoans.length;

  const filtered = movements.filter(move => filter === 'all' || move.kind === filter);
  const visible = filtered.slice(0, MOVES_LIMIT);
  const tabs = [
    { value: 'all' as const, label: 'Todas', count: movements.length },
    { value: 'emp' as const, label: 'Empréstimos', count: movements.filter(move => move.kind === 'emp').length },
    { value: 'dev' as const, label: 'Devoluções', count: movements.filter(move => move.kind === 'dev').length },
  ];
  const firstName = library.session?.name.split(' ')[0] ?? '';
  const sent = library.remindersSent;

  function sendReminders() {
    if (sent) return;
    setRemindersSent(true);
    toast({
      title: 'Lembretes enviados',
      text: `Simulação: ${plural(late, 'atrasado', 'atrasados')} e ${dueSoon} a vencer receberiam e-mail.`,
      onUndo: () => setRemindersSent(false),
    });
  }

  return <AppShell>
    <section className={styles.hero} aria-labelledby="dashboard-hello">
      <WashiTexture/>
      <div className={styles.heroArt} aria-hidden="true">
        <span className={styles.frameRays}/><span className={styles.frameDots}/>
        <Enso size={240} animated className={styles.heroEnso}/>
      </div>
      <div className={styles.heroText}>
        <time className="inko-eyebrow inko-eyebrow--brown" dateTime={DEMO_REFERENCE_DATE}>
          <span className="inko-only-desktop">{longDate(DEMO_REFERENCE_DATE, WEEKDAYS)}</span>
          <span className="inko-only-mobile">{longDate(DEMO_REFERENCE_DATE, WEEKDAYS_SHORT)}</span>
        </time>
        <h1 id="dashboard-hello">Bom dia, {firstName}.</h1>
        <p className="inko-only-desktop"><AttentionText late={late} dueSoon={dueSoon}/></p>
        <p className="inko-only-mobile"><AttentionText late={late} dueSoon={dueSoon} compact/></p>
        <div className={styles.heroActions}>
          <InkoLinkButton href="/emprestimos" leftIcon="mais" className={`${styles.heroButton} inko-only-desktop`}>Novo empréstimo</InkoLinkButton>
          <InkoButton variant="outline" leftIcon={sent ? 'check-circulo' : 'enviar'} aria-disabled={sent} onClick={sendReminders}
            className={`${styles.heroButton} ${styles.reminders}${sent ? ` ${styles.remindersSent}` : ''}`}>
            {sent ? 'Lembretes enviados' : 'Enviar lembretes'}
          </InkoButton>
        </div>
      </div>
    </section>

    <div className={styles.overviewHead}>
      <h2>Visão geral</h2>
      <div className={styles.overviewTools}>
        <InkoButton variant="ghost" size="sm" leftIcon="atualizar" loading={loading} onClick={reload}>Atualizar</InkoButton>
        <DemoTag/>
      </div>
    </div>

    {loading && <div className={`inko-grid-stats ${styles.stats}`} aria-busy="true">
      <output className="sr-only">Carregando indicadores</output>
      <InkoStatisticSkeleton/><InkoStatisticSkeleton/><InkoStatisticSkeleton/><InkoStatisticSkeleton/>
    </div>}
    {!loading && <div className={`inko-grid-stats ${styles.stats}`}>
      <InkoStatistic href="/acervo" label="Acervo" value={String(library.works.length)} helper={library.works.length === 1 ? 'obra cadastrada' : 'obras cadastradas'} icon="acervo" tone="ink"/>
      <InkoStatistic href="/usuarios" label="Usuários" value={String(library.users.length)} helper={library.users.length === 1 ? 'leitor cadastrado' : 'leitores cadastrados'} icon="usuarios" tone="sand"/>
      <InkoStatistic href="/emprestimos" label="Empréstimos ativos" value={String(activeLoans.length)} helper={`${plural(dueSoon, 'vence', 'vencem')} nesta semana`} icon="emprestimos" tone="info"/>
      <InkoStatistic href="/relatorios" label="Atrasados" value={String(late)} helper="R$ 2,00 por dia de atraso" icon="relogio" tone="danger" emphasis={late > 0}/>
    </div>}

    <div className="inko-two-columns">
      <section className="inko-section inko-section--flush inko-column-main" aria-labelledby="dashboard-moves">
        <div className="inko-section-head">
          <h2 id="dashboard-moves">Últimas movimentações</h2>
          <InkoPillTabs label="Filtrar movimentações" items={tabs} active={filter} onChange={setFilter}/>
        </div>
        {visible.length === 0 && <InkoEmpty title="Nenhuma movimentação" text="Empréstimos e devoluções registrados aparecem aqui."/>}
        {visible.length > 0 && <div className="inko-table-wrap inko-only-desktop">
          <table className="inko-table">
            <thead><tr><th scope="col">Obra</th><th scope="col">Movimento</th><th scope="col">Usuário</th><th scope="col" className="inko-table-end">Quando</th></tr></thead>
            <tbody>{visible.map(move => <tr key={move.key} className={styles.moveRow}>
              <td><MoveWork move={move} works={library.works}/></td>
              <td><MoveBadge kind={move.kind}/></td>
              <td>{move.loan.user}</td>
              <td className={`inko-table-end ${styles.when}`}>{relativeDay(move.date, DEMO_REFERENCE_DATE)}</td>
            </tr>)}</tbody>
          </table>
        </div>}
        {visible.length > 0 && <ul className={`${styles.moveList} inko-only-mobile`}>
          {visible.map(move => <li key={move.key}>
            <InkoCover work={coverOf(move, library.works)} size="xs"/>
            <span className={styles.moveListText}><strong>{move.loan.work}</strong><span>{move.loan.user} · {relativeDay(move.date, DEMO_REFERENCE_DATE)}</span></span>
            <MoveBadge kind={move.kind} size="sm"/>
          </li>)}
        </ul>}
        {visible.length > 0 && <div className="inko-table-foot">
          <span>Mostrando {visible.length} de {filtered.length}</span>
          {filter === 'dev' && <Link href="/devolucoes" className="inko-text-link">Ver devoluções<Icon name="seta" size={16}/></Link>}
          {filter !== 'dev' && <Link href="/emprestimos" className="inko-text-link">Ver empréstimos<Icon name="seta" size={16}/></Link>}
        </div>}
      </section>

      <div className={`inko-column-side ${styles.side}`}>
        <section className={`inko-section ${styles.shortcuts}`} aria-labelledby="dashboard-shortcuts">
          <h2 id="dashboard-shortcuts">Atalhos</h2>
          <ul>{shortcuts.map(item => <li key={item.label}><Link href={item.href}><Icon name={item.icon} size={22}/>{item.label}</Link></li>)}</ul>
        </section>
        <FineSummary rows={lateLoans} reference={DEMO_REFERENCE_DATE} href="/relatorios"/>
      </div>
    </div>

    <DemoNotice>Indicadores, movimentações e multas são calculados sobre dados fictícios guardados neste navegador; os lembretes não enviam e-mails.</DemoNotice>

    <footer className={styles.footer}>
      <p className={styles.signature}>
        <Image src="/inko/svg/elementos/enso-seal.svg" alt="" width={28} height={28}/>
        <span>Cada volume, no seu lugar.</span>
      </p>
      <span className="inko-caption">INKO · DADOS DEMONSTRATIVOS</span>
      <nav aria-label="Recursos do projeto">
        <Link href="/design-system">Design System</Link>
        <Link href="/motion-lab">Motion Lab</Link>
        <Link href="/system/status">Diagnóstico técnico</Link>
      </nav>
    </footer>

    <Link href="/emprestimos" className={`${styles.fab} inko-only-mobile`}><Icon name="mais" size={20}/>Novo empréstimo</Link>
  </AppShell>;
}
