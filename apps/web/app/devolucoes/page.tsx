'use client';

import { Suspense, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '../../components/app-shell';
import { Icon } from '../../components/icon';
import { useToast } from '../../components/inko-interactions';
import { InkoBadge, InkoButton, InkoEmpty, InkoInput, InkoLinkButton, InkoSearch, InkoStatus, PageHeading } from '../../components/inko-kit';
import { DEMO_REFERENCE_DATE, daysBetween, daysOverdue, fineInCents, formatBRL, formatDate, normalize, parseBRDate, type Loan } from '../../lib/demo';
import { MockApiError, returnLoan, useLibrary, type ReturnReceipt } from '../../lib/mock-api';
import styles from './devolucoes.module.css';

const BREADCRUMB = [{ label: 'Início', href: '/' }, { label: 'Registrar devolução' }] as const;
const TODAY_BR = formatDate(DEMO_REFERENCE_DATE);

interface Done {
  receipt: ReturnReceipt;
  /** Dias de atraso na data de referência, para mostrar o status anterior riscado. */
  previousLate: number;
}

function returnDateError(value: string, loan: Loan): string {
  const iso = parseBRDate(value);
  if (!iso) return 'Use o formato dd/mm/aaaa.';
  if (daysBetween(loan.start, iso) < 0) return 'A devolução não pode ser antes do empréstimo.';
  if (daysBetween(iso, DEMO_REFERENCE_DATE) < 0) return 'A data não pode estar no futuro.';
  return '';
}

function countLabel(found: number, total: number, searching: boolean): string {
  const noun = total === 1 ? 'empréstimo ativo' : 'empréstimos ativos';
  return searching ? `${found} de ${total} ${noun}` : `${total} ${noun}`;
}

function lateLabel(days: number): string {
  if (days <= 0) return 'Devolução no prazo';
  return `${days} ${days === 1 ? 'dia' : 'dias'} de atraso`;
}

/** Setas movem o foco e a seleção dentro do `radiogroup` (padrão WAI-ARIA). */
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

function radioTabIndex(checked: boolean, index: number, anyChecked: boolean): number {
  if (checked) return 0;
  return !anyChecked && index === 0 ? 0 : -1;
}

function LoanState({ late, struck = false }: Readonly<{ late: number; struck?: boolean }>) {
  const className = struck ? styles.struck : undefined;
  if (late > 0) return <InkoBadge tone="danger" icon="relogio" size="sm" className={className}>Atrasado · {late} d</InkoBadge>;
  return <InkoBadge tone="info" size="sm" className={className}>No prazo</InkoBadge>;
}

function ReturnForm({ loan, onDone }: Readonly<{ loan: Loan; onDone: (done: Done) => void }>) {
  const [value, setValue] = useState(TODAY_BR);
  const [apiError, setApiError] = useState('');
  const [saving, setSaving] = useState(false);

  const error = returnDateError(value, loan) || apiError;
  const iso = parseBRDate(value);
  const days = iso && !error ? daysOverdue(loan.due, iso) : 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (error || !iso) {
      document.getElementById('devolucao-data')?.focus();
      return;
    }
    setSaving(true);
    try {
      const receipt = await returnLoan(loan.id, iso);
      onDone({ receipt, previousLate: daysOverdue(loan.due, DEMO_REFERENCE_DATE) });
    } catch (failure) {
      setSaving(false);
      setApiError(failure instanceof MockApiError ? failure.message : 'Não foi possível registrar a devolução.');
    }
  }

  return <form className={styles.form} onSubmit={submit} noValidate>
    <h2 id="devolucao-painel">Conferência</h2>
    <dl className="inko-definition">
      <div><dt>Obra</dt><dd>{loan.work}</dd></div>
      <div><dt>Usuário</dt><dd>{loan.user}</dd></div>
      <div><dt>Empréstimo</dt><dd className={styles.plain}>{formatDate(loan.start)}</dd></div>
      <div><dt>Prazo</dt><dd className={styles.plain}>{formatDate(loan.due)}</dd></div>
    </dl>
    <InkoInput id="devolucao-data" label="Data efetiva da devolução" inputMode="numeric" autoComplete="off" placeholder="dd/mm/aaaa" maxLength={10} className={styles.date}
      value={value} error={error || undefined} help={`Padrão: hoje (${TODAY_BR})`} disabled={saving}
      onChange={event => { setValue(event.target.value); setApiError(''); }}/>
    <output className={`${styles.fine} ${days > 0 ? styles.fineLate : styles.fineOk}`}>
      <span className={styles.fineText}>{lateLabel(days)}<small>R$ 2,00 por dia de atraso</small></span>
      <strong>{formatBRL(fineInCents(days))}</strong>
    </output>
    <InkoButton type="submit" size="lg" loading={saving} disabled={Boolean(error)}>Confirmar devolução</InkoButton>
  </form>;
}

function ReturnDone({ done, onReset }: Readonly<{ done: Done; onReset: () => void }>) {
  const { loan, fineCents } = done.receipt;
  return <div className={`${styles.done} inko-motion-swap`}>
    <div className={styles.doneHead}>
      <span className={styles.doneIcon}><Icon name="check-circulo" size={24}/></span>
      <div><h2 id="devolucao-painel" tabIndex={-1}>Devolução registrada</h2><span>{loan.id} encerrado em {formatDate(loan.returnedAt ?? DEMO_REFERENCE_DATE)}</span></div>
    </div>
    <div className={styles.transition}>
      <strong>{loan.work}</strong>
      <span className="sr-only">Status anterior: </span><LoanState late={done.previousLate} struck/>
      <Icon name="seta" size={18}/>
      <span className="sr-only">Novo status: </span><span className="inko-motion-swap"><InkoStatus status="disp"/></span>
    </div>
    <output className={styles.doneFine}>
      {fineCents > 0 && `Multa de ${formatBRL(fineCents)} lançada para ${loan.user}.`}
      {fineCents === 0 && 'Sem multa.'}
    </output>
    <div className="inko-actions">
      <InkoButton variant="outline" className={styles.action} onClick={onReset}>Registrar outra</InkoButton>
      <InkoLinkButton href="/acervo" variant="ghost" className={styles.action}>Ir para o acervo</InkoLinkButton>
    </div>
  </div>;
}

function ReturnsContent() {
  const params = useSearchParams();
  const toast = useToast();
  const { loans } = useLibrary();
  const [selectedId, setSelectedId] = useState(() => params.get('emprestimo') ?? '');
  const [query, setQuery] = useState('');
  const [done, setDone] = useState<Done | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  // A lista vem do mock: o empréstimo devolvido sai dela assim que a gravação termina.
  const active = loans.filter(loan => !loan.returnedAt);
  const term = normalize(query.trim());
  const filtered = active.filter(loan => !term || normalize(`${loan.id} ${loan.work} ${loan.user}`).includes(term));
  const current = active.find(loan => loan.id === selectedId);
  const anyChecked = filtered.some(loan => loan.id === selectedId);

  function revealPanel(focusHeading: boolean) {
    requestAnimationFrame(() => {
      // No mobile o painel fica abaixo da lista: leva a conferência até a área visível.
      if (globalThis.matchMedia?.('(max-width: 767px)').matches) panelRef.current?.scrollIntoView({ block: 'start' });
      if (focusHeading) panelRef.current?.querySelector<HTMLElement>('h2[tabindex]')?.focus({ preventScroll: true });
    });
  }

  function select(loanId: string) {
    setSelectedId(loanId);
    setDone(null);
    revealPanel(false);
  }

  function handleDone(result: Done) {
    setDone(result);
    const { loan, fineCents } = result.receipt;
    toast({ title: 'Devolução registrada', text: fineCents > 0 ? `${loan.work} · multa de ${formatBRL(fineCents)}.` : `${loan.work} · sem multa.` });
    revealPanel(true);
  }

  function reset() {
    setSelectedId('');
    setDone(null);
    setQuery('');
  }

  return <>
    <PageHeading title="Registrar devolução" description="Busque o empréstimo ativo, confira obra e usuário, informe a data efetiva e confirme."/>
    <div className={styles.layout}>
      <section className={styles.list} aria-label="Empréstimos ativos">
        <InkoSearch label="Buscar empréstimo ativo por obra, usuário ou código" placeholder="Obra, usuário ou código EMP-…" value={query} onChange={event => setQuery(event.target.value)} className={styles.search}/>
        <output className={styles.count}>{countLabel(filtered.length, active.length, term !== '')} · dados demonstrativos</output>
        {filtered.length > 0 && <div role="radiogroup" aria-label="Empréstimo" className="inko-choice-list" onKeyDown={onRadioKeyDown}>
          {filtered.map((loan, index) => {
            const checked = loan.id === selectedId;
            return <button key={loan.id} type="button" role="radio" aria-checked={checked} tabIndex={radioTabIndex(checked, index, anyChecked)} className="inko-choice" onClick={() => select(loan.id)}>
              <span className="inko-choice-text"><strong>{loan.work}</strong><small>{loan.id} · {loan.user} · prazo {formatDate(loan.due)}</small></span>
              <LoanState late={daysOverdue(loan.due, DEMO_REFERENCE_DATE)}/>
            </button>;
          })}
        </div>}
        {active.length === 0 && <InkoEmpty title="Nenhum empréstimo ativo" text="Todas as obras estão no acervo. Não há devoluções a registrar.">
          <InkoLinkButton href="/emprestimos" size="sm">Novo empréstimo</InkoLinkButton>
        </InkoEmpty>}
        {active.length > 0 && filtered.length === 0 && <InkoEmpty title="Nenhum empréstimo encontrado" text="Nenhum empréstimo ativo corresponde à busca. Confira a obra, o usuário ou o código.">
          <InkoButton variant="outline" size="sm" onClick={() => setQuery('')}>Limpar busca</InkoButton>
        </InkoEmpty>}
      </section>

      <section className={styles.panel} ref={panelRef} aria-labelledby="devolucao-painel">
        {done && <ReturnDone done={done} onReset={reset}/>}
        {!done && current && <ReturnForm key={current.id} loan={current} onDone={handleDone}/>}
        {!done && !current && <div className={styles.none}>
          <Icon name="devolucoes" size={32}/>
          <h2 id="devolucao-painel">Selecione um empréstimo</h2>
          <span>Os detalhes e o cálculo de multa aparecem aqui.</span>
        </div>}
      </section>
    </div>
  </>;
}

export default function ReturnsPage() {
  return <AppShell breadcrumb={BREADCRUMB}>
    <Suspense fallback={null}><ReturnsContent/></Suspense>
  </AppShell>;
}
