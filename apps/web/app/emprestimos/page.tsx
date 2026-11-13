'use client';

import { Suspense, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '../../components/app-shell';
import { Icon } from '../../components/icon';
import { useToast } from '../../components/inko-interactions';
import { Avatar, InkoButton, InkoCover, InkoEmpty, InkoField, InkoLinkButton, InkoSearch, InkoStatus, PageHeading } from '../../components/inko-kit';
import { InkoAlert } from '../../components/inko-patterns';
import {
  DEFAULT_LOAN_DAYS, DEMO_REFERENCE_DATE, activeLoanOf, addDays, availabilityOf, daysOverdue, fineInCents, formatBRL, formatDate,
  normalize, workLabel, type LibraryUser, type Loan, type Work,
} from '../../lib/demo';
import { MockApiError, createLoan, useLibrary } from '../../lib/mock-api';
import styles from './emprestimos.module.css';

const STEP_LABELS = ['Usuário', 'Obra', 'Disponibilidade', 'Datas', 'Confirmar', 'Resultado'] as const;
const NEXT_LABELS: Record<number, string> = { 1: 'Continuar', 2: 'Verificar disponibilidade', 3: 'Informar datas', 4: 'Revisar' };
const TERMS = [7, 14, 21] as const;
const BREADCRUMB = [{ label: 'Início', href: '/' }, { label: 'Novo empréstimo' }] as const;

interface StepAlert {
  step: number;
  message: string;
}

function stepClassName(step: number, currentStep: number): string {
  if (step === currentStep) return `${styles.step} ${styles.stepCurrent}`;
  if (step < currentStep) return `${styles.step} ${styles.stepDone}`;
  return styles.step;
}

function stepMark(step: number, currentStep: number): string {
  return step < currentStep ? '✓' : String(step);
}

function parseTerm(value: string | null): number {
  const term = Number(value);
  return TERMS.some(option => option === term) ? term : DEFAULT_LOAN_DAYS;
}

/** Passo mais avançado que a seleção atual permite abrir (protege URLs digitadas e o Voltar do navegador). */
function reachableStep(requested: number, hasUser: boolean, hasWork: boolean, available: boolean): number {
  const wanted = Number.isInteger(requested) && requested >= 1 ? requested : 1;
  if (!hasUser) return 1;
  if (!hasWork) return Math.min(wanted, 2);
  if (!available) return Math.min(wanted, 3);
  return Math.min(wanted, 5);
}

function canAdvance(step: number, hasUser: boolean, hasWork: boolean, available: boolean): boolean {
  if (step === 1) return hasUser;
  if (step === 2) return hasWork;
  if (step === 3) return available;
  return true;
}

interface Pending {
  active: number;
  late: number;
  fineCents: number;
}

function pendingOf(userId: string, loans: readonly Loan[]): Pending {
  const active = loans.filter(loan => loan.userId === userId && !loan.returnedAt);
  const overdue = active.map(loan => daysOverdue(loan.due, DEMO_REFERENCE_DATE)).filter(days => days > 0);
  return { active: active.length, late: overdue.length, fineCents: overdue.reduce((sum, days) => sum + fineInCents(days), 0) };
}

function userNote(pending: Pending): string {
  if (pending.late > 0) return `${pending.late} ${pending.late === 1 ? 'empréstimo atrasado' : 'empréstimos atrasados'} · ${formatBRL(pending.fineCents)}`;
  if (pending.active > 0) return `${pending.active} ${pending.active === 1 ? 'empréstimo ativo' : 'empréstimos ativos'}`;
  return 'Sem pendências';
}

function conflictText(loan: Loan): string {
  const days = daysOverdue(loan.due, DEMO_REFERENCE_DATE);
  if (days > 0) return `Emprestada a ${loan.user} · prazo vencido em ${formatDate(loan.due)} (${days} ${days === 1 ? 'dia' : 'dias'} de atraso).`;
  return `Emprestada a ${loan.user} desde ${formatDate(loan.start)} · prazo ${formatDate(loan.due)}.`;
}

/** Setas movem o foco e a seleção dentro de um `radiogroup` (padrão WAI-ARIA). */
function onRadioKeyDown(event: KeyboardEvent<HTMLDivElement>) {
  const delta = ({ ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 } as Record<string, number>)[event.key];
  if (!delta) return;
  const radios = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
  const index = radios.indexOf(document.activeElement as HTMLButtonElement);
  if (index < 0) return;
  event.preventDefault();
  const next = radios[(index + delta + radios.length) % radios.length];
  next.focus();
  next.click();
}

/** Roving tabindex: o item marcado (ou o primeiro, se nenhum) é a parada do Tab. */
function radioTabIndex(checked: boolean, index: number, anyChecked: boolean): number {
  if (checked) return 0;
  return !anyChecked && index === 0 ? 0 : -1;
}

function UserStep({ users, loans, selectedId, onSelect }: Readonly<{ users: readonly LibraryUser[]; loans: readonly Loan[]; selectedId: string; onSelect: (id: string) => void }>) {
  const [query, setQuery] = useState('');
  const term = normalize(query.trim());
  const filtered = users.filter(user => !term || normalize(`${user.name} ${user.email} ${user.id}`).includes(term));
  const anyChecked = filtered.some(user => user.id === selectedId);
  return <>
    <InkoSearch label="Buscar usuário por nome, e-mail ou identificador" placeholder="Nome, e-mail ou identificador…" value={query} onChange={event => setQuery(event.target.value)} className={styles.search}/>
    {filtered.length > 0 && <div role="radiogroup" aria-label="Usuário" className={styles.choices} onKeyDown={onRadioKeyDown}>
      {filtered.map((user, index) => {
        const pending = pendingOf(user.id, loans);
        const checked = user.id === selectedId;
        return <button key={user.id} type="button" role="radio" aria-checked={checked} tabIndex={radioTabIndex(checked, index, anyChecked)} className="inko-choice" onClick={() => onSelect(user.id)}>
          <Avatar name={user.name} size={36}/>
          <span className="inko-choice-text"><strong>{user.name}</strong><small className={pending.late > 0 ? 'inko-text-danger' : undefined}>{user.id} · {userNote(pending)}</small></span>
        </button>;
      })}
    </div>}
    {filtered.length === 0 && <InkoEmpty title="Nenhum usuário encontrado" text="Confira o nome, o e-mail ou o identificador."><InkoLinkButton href="/usuarios" variant="outline" size="sm">Cadastrar usuário</InkoLinkButton></InkoEmpty>}
  </>;
}

function WorkStep({ works, loans, selectedId, onSelect }: Readonly<{ works: readonly Work[]; loans: readonly Loan[]; selectedId: string; onSelect: (id: string) => void }>) {
  const [query, setQuery] = useState('');
  const term = normalize(query.trim());
  const filtered = works.filter(work => !term || normalize(`${workLabel(work)} ${work.author} ${work.id}`).includes(term));
  const anyChecked = filtered.some(work => work.id === selectedId);
  return <>
    <InkoSearch label="Buscar obra por título, autor ou identificador" placeholder="Título, autor ou identificador INK-…" value={query} onChange={event => setQuery(event.target.value)} className={styles.search}/>
    {filtered.length > 0 && <div role="radiogroup" aria-label="Obra" className={styles.choices} onKeyDown={onRadioKeyDown}>
      {filtered.map((work, index) => {
        const checked = work.id === selectedId;
        return <button key={work.id} type="button" role="radio" aria-checked={checked} tabIndex={radioTabIndex(checked, index, anyChecked)} className="inko-choice" onClick={() => onSelect(work.id)}>
          <InkoCover work={work} size="xs"/>
          <span className="inko-choice-text"><strong>{workLabel(work)}</strong><small>{work.id} · {work.author}</small></span>
          <InkoStatus status={availabilityOf(loans, work.id, DEMO_REFERENCE_DATE)} size="sm"/>
        </button>;
      })}
    </div>}
    {filtered.length === 0 && <InkoEmpty title="Nenhuma obra encontrada" text="Confira o título, o autor ou o identificador."/>}
  </>;
}

function AvailabilityStep({ work, conflict, onChooseOther }: Readonly<{ work: Work; conflict?: Loan; onChooseOther: () => void }>) {
  const title = workLabel(work);
  return <>
    {!conflict && <output className={`${styles.verdict} ${styles.verdictOk} inko-motion-swap`}>
      <span className={styles.verdictIcon}><Icon name="check-circulo" size={24}/></span>
      <span className={styles.verdictText}><strong>“{title}” está disponível</strong><span>Verificado agora no serviço de circulação.</span></span>
    </output>}
    {conflict && <div role="alert" className={`${styles.verdict} ${styles.verdictConflict} inko-motion-swap`}>
      <span className={styles.verdictIcon}><Icon name="alerta" size={24}/></span>
      <span className={styles.verdictText}>
        <strong className="inko-only-desktop">Conflito: “{title}” não está disponível</strong>
        <strong className="inko-only-mobile">Obra indisponível</strong>
        <span>{conflictText(conflict)}</span>
      </span>
      <div className={styles.verdictActions}>
        <button type="button" className={`inko-button inko-button--md ${styles.inkButton}`} onClick={onChooseOther}>Escolher outra obra</button>
        <Link href={`/acervo/${work.id}`} className={`inko-button inko-button--md ${styles.conflictLink}`}>Ver obra</Link>
      </div>
    </div>}
    {conflict && <p className={styles.conflictHint}>Escolha outra obra para continuar. Você pode avisar {conflict.user.split(' ')[0]} pela <Link href={`/usuarios?u=${conflict.userId}`}>página do usuário</Link>.</p>}
  </>;
}

function DatesStep({ term, due, onTerm }: Readonly<{ term: number; due: string; onTerm: (term: number) => void }>) {
  return <>
    <div className={styles.dates}>
      <InkoField id="emprestimo-data" label="Data do empréstimo" help="Hoje">
        <span className="inko-control inko-control--select"><input id="emprestimo-data" className="inko-input inko-input--lg inko-tabular" readOnly value={formatDate(DEMO_REFERENCE_DATE)} aria-describedby="emprestimo-data-help"/><Icon name="calendario" size={18}/></span>
      </InkoField>
      <fieldset className={styles.terms}>
        <legend>Prazo</legend>
        <div role="radiogroup" aria-label="Prazo" className={styles.termOptions} onKeyDown={onRadioKeyDown}>
          {TERMS.map(option => <button key={option} type="button" role="radio" aria-checked={term === option} tabIndex={term === option ? 0 : -1} className={styles.term} onClick={() => onTerm(option)}>{option} dias</button>)}
        </div>
        <span className={styles.due}>Devolução até <strong>{formatDate(due)}</strong></span>
      </fieldset>
    </div>
    <InkoAlert tone="info">Após o prazo, a multa é de R$ 2,00 por dia de atraso.</InkoAlert>
  </>;
}

function Success({ loan, onReset }: Readonly<{ loan: Loan; onReset: () => void }>) {
  return <div className={styles.success}>
    <svg viewBox="0 0 200 200" width="120" height="120" aria-hidden="true" focusable="false">
      <g filter="url(#inko-ink-rough)"><path className="inko-motion-enso-entry" d="M151.4 38.7 A80 80 0 1 0 175.2 127.4" fill="none" stroke="var(--inko-brand-seal)" strokeWidth="16" strokeLinecap="round"/></g>
      <path d="m72 102 20 20 38-40" fill="none" stroke="var(--inko-brand-ink)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    <h2 tabIndex={-1} data-step-heading>Empréstimo registrado</h2>
    <output>{loan.id} · “{loan.work}” com {loan.user} até <strong>{formatDate(loan.due)}</strong>.<br/>A obra agora aparece como <strong className={styles.loaned}>Emprestado</strong> no acervo.</output>
    <div className={styles.successActions}>
      <InkoButton className={styles.navButton} onClick={onReset}>Novo empréstimo</InkoButton>
      <InkoLinkButton href="/acervo" variant="outline" className={styles.navButton}>Ver acervo</InkoLinkButton>
    </div>
  </div>;
}

function LoanWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { users, works, loans } = useLibrary();
  const [created, setCreated] = useState<Loan | null>(null);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<StepAlert | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const mounted = useRef(false);

  // A URL guarda passo e seleção: o Voltar do navegador e o recarregamento preservam o fluxo.
  const user = users.find(item => item.id === params.get('usuario'));
  const work = works.find(item => item.id === params.get('obra'));
  const term = parseTerm(params.get('prazo'));
  const conflict = work ? activeLoanOf(loans, work.id) : undefined;
  const available = Boolean(work) && !conflict;
  // Depois de gravado, o fluxo fica no resultado (evita reenvio ao voltar no histórico).
  const step = created ? 6 : reachableStep(Number(params.get('step') ?? 1), Boolean(user), Boolean(work), available);
  const due = addDays(DEMO_REFERENCE_DATE, term);
  const pending = useMemo(() => (user ? pendingOf(user.id, loans) : null), [user, loans]);
  const blocked = step === 3 && !available;

  useEffect(() => {
    // Ao trocar de passo, o foco vai para o título do passo (não na primeira renderização).
    if (mounted.current) cardRef.current?.querySelector<HTMLElement>('[data-step-heading]')?.focus();
    mounted.current = true;
  }, [step]);

  function href(patch: Record<string, string | number | null>): string {
    const next = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null) next.delete(key);
      else next.set(key, String(value));
    });
    const query = next.toString();
    return query ? `/emprestimos?${query}` : '/emprestimos';
  }

  function update(patch: Record<string, string | number | null>) {
    router.replace(href(patch), { scroll: false });
  }

  function goTo(target: number) {
    router.push(href({ step: target }), { scroll: false });
  }

  function back() {
    goTo(Math.max(1, step - 1));
  }

  function reset() {
    setCreated(null);
    setAlert(null);
    router.push('/emprestimos');
  }

  async function confirm() {
    if (!user || !work) return;
    setSaving(true);
    setAlert(null);
    try {
      const loan = await createLoan({ workId: work.id, userId: user.id, start: DEMO_REFERENCE_DATE, due });
      setCreated(loan);
      router.replace(href({ step: 6 }), { scroll: false });
      toast({ title: 'Empréstimo registrado', text: `${loan.work} com ${loan.user} até ${formatDate(loan.due)}.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível registrar o empréstimo.';
      // Conflito de concorrência: a obra foi emprestada enquanto o fluxo estava aberto.
      if (error instanceof MockApiError && error.field === 'workId') {
        setAlert({ step: 2, message });
        router.replace(href({ step: 2 }), { scroll: false });
      } else if (error instanceof MockApiError && error.field === 'userId') {
        setAlert({ step: 1, message });
        router.replace(href({ step: 1 }), { scroll: false });
      } else {
        setAlert({ step: 5, message });
      }
    } finally {
      setSaving(false);
    }
  }

  return <>
    <PageHeading title="Novo empréstimo" description="Fluxo guiado · teste o conflito escolhendo uma obra Emprestada ou Atrasada."/>
    <p className={`${styles.mobileStep} inko-only-mobile`} aria-hidden="true">Etapa {step} de {STEP_LABELS.length} · {STEP_LABELS[step - 1]}</p>
    <ol className={styles.stepper} aria-label="Etapas">
      {STEP_LABELS.map((label, index) => <li key={label} className={stepClassName(index + 1, step)} aria-current={index + 1 === step ? 'step' : undefined}>
        <span className={styles.stepDot} aria-hidden="true">{stepMark(index + 1, step)}</span>
        <span className={styles.stepLabel}>{index + 1 < step && <span className="sr-only">Concluída: </span>}{label}</span>
      </li>)}
    </ol>

    <div className={styles.layout}>
      <div className={styles.main}>
        <section className={styles.card} ref={cardRef} aria-label={`Etapa ${step} de ${STEP_LABELS.length}: ${STEP_LABELS[step - 1]}`}>
          {alert?.step === step && <InkoAlert tone="danger" title="Não foi possível concluir">{alert.message}</InkoAlert>}

          {step === 1 && <>
            <h2 tabIndex={-1} data-step-heading>1 · Selecione o usuário</h2>
            <UserStep users={users} loans={loans} selectedId={user?.id ?? ''} onSelect={id => update({ usuario: id })}/>
          </>}

          {step === 2 && <>
            <h2 tabIndex={-1} data-step-heading>2 · Selecione a obra</h2>
            <WorkStep works={works} loans={loans} selectedId={work?.id ?? ''} onSelect={id => { setAlert(null); update({ obra: id }); }}/>
          </>}

          {step === 3 && work && <>
            <h2 tabIndex={-1} data-step-heading>3 · Disponibilidade</h2>
            <AvailabilityStep work={work} conflict={conflict} onChooseOther={() => goTo(2)}/>
          </>}

          {step === 4 && <>
            <h2 tabIndex={-1} data-step-heading>4 · Datas</h2>
            <DatesStep term={term} due={due} onTerm={value => update({ prazo: value })}/>
          </>}

          {step === 5 && user && work && <>
            <h2 tabIndex={-1} data-step-heading>5 · Confirme o empréstimo</h2>
            <dl className={styles.review}>
              <div><dt>Usuário</dt><dd>{user.name}</dd></div>
              <div><dt>Obra</dt><dd>{workLabel(work)} <span>· {work.id}</span></dd></div>
              <div><dt>Empréstimo</dt><dd>{formatDate(DEMO_REFERENCE_DATE)}</dd></div>
              <div><dt>Devolução até</dt><dd>{formatDate(due)}</dd></div>
            </dl>
          </>}

          {step === 6 && created && <Success loan={created} onReset={reset}/>}

          {step < 6 && pending && pending.late > 0 && (step === 1 || step === 5) && <InkoAlert tone="warning" title={`${user?.name} tem ${pending.late} ${pending.late === 1 ? 'empréstimo atrasado' : 'empréstimos atrasados'}`}>Multa em aberto de {formatBRL(pending.fineCents)}. O novo empréstimo pode seguir, mas oriente a devolução.</InkoAlert>}
        </section>

        {step < 6 && <div className={styles.nav}>
          <InkoButton variant="ghost" leftIcon="chevron-esquerda" className={styles.navButton} disabled={step === 1 || saving} onClick={back}>Voltar</InkoButton>
          {blocked && <button type="button" className={`inko-button inko-button--md inko-only-mobile ${styles.inkButton} ${styles.navButton}`} onClick={() => goTo(2)}>Escolher outra obra</button>}
          {step < 5 && !blocked && <InkoButton className={styles.navButton} disabled={!canAdvance(step, Boolean(user), Boolean(work), available)} onClick={() => goTo(step + 1)}>{NEXT_LABELS[step]}</InkoButton>}
          {step === 5 && <InkoButton className={styles.navButton} loading={saving} onClick={confirm}>Confirmar empréstimo</InkoButton>}
        </div>}
      </div>

      {step < 6 && <aside className={styles.summary} aria-labelledby="emprestimo-resumo">
        <h2 id="emprestimo-resumo">Resumo</h2>
        <dl>
          <div><dt>Usuário</dt><dd>{user?.name ?? 'Não selecionado'}</dd></div>
          <div><dt>Obra</dt><dd>{work ? workLabel(work) : 'Não selecionada'}</dd></div>
          <div><dt>Disponibilidade</dt><dd>{work ? <InkoStatus status={availabilityOf(loans, work.id, DEMO_REFERENCE_DATE)} size="sm"/> : '—'}</dd></div>
          <div><dt>Empréstimo</dt><dd>{formatDate(DEMO_REFERENCE_DATE)}</dd></div>
          <div><dt>Devolução até</dt><dd>{formatDate(due)} <span>({term} dias)</span></dd></div>
        </dl>
        <p className="inko-footnote">A disponibilidade é verificada de novo no momento da confirmação.</p>
      </aside>}
    </div>
  </>;
}

export default function LoansPage() {
  return <AppShell breadcrumb={BREADCRUMB}>
    <Suspense fallback={null}><LoanWizard/></Suspense>
  </AppShell>;
}
