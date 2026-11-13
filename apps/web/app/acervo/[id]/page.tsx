'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { AppShell } from '../../../components/app-shell';
import { Icon, type IconName } from '../../../components/icon';
import { ConfirmDialog, useMockQuery, useToast } from '../../../components/inko-interactions';
import { CategoryTag, DemoNotice, InkoBadge, InkoButton, InkoCover, InkoEmpty, InkoLinkButton, Section, type Tone } from '../../../components/inko-kit';
import { InkoAlert, InkoSkeleton, InkoTabs, LoanCard } from '../../../components/inko-patterns';
import { DEMO_REFERENCE_DATE, activeLoanOf, daysBetween, daysOverdue, fineInCents, formatBRL, formatDate, workLabel, type Loan, type Work } from '../../../lib/demo';
import { MockApiError, deleteWork, useLibrary } from '../../../lib/mock-api';
import styles from './obra.module.css';

const TAB_HISTORY = 'Movimentações';
const TAB_ABOUT = 'Sobre a obra';
const TABS = [TAB_HISTORY, TAB_ABOUT] as const;

interface Circulation {
  tone: 'success' | 'info' | 'danger';
  icon: IconName;
  title: string;
  text: string;
}

function dayCount(days: number): string {
  return `${days} ${days === 1 ? 'dia' : 'dias'}`;
}

/** Situação atual da obra, derivada do empréstimo ativo (a obra não guarda disponibilidade). */
function describeCirculation(loan: Loan | undefined): Circulation {
  if (!loan) return { tone: 'success', icon: 'check-circulo', title: 'Disponível', text: 'Na estante e pronta para um novo empréstimo.' };
  const holder = `Com ${loan.user} desde ${formatDate(loan.start)} · prazo ${formatDate(loan.due)}`;
  const late = daysOverdue(loan.due, DEMO_REFERENCE_DATE);
  if (late > 0) return { tone: 'danger', icon: 'relogio', title: `Atrasado · ${dayCount(late)}`, text: `${holder} · multa acumulada ${formatBRL(fineInCents(late))}` };
  const left = daysBetween(DEMO_REFERENCE_DATE, loan.due);
  const title = left === 0 ? 'Emprestado · vence hoje' : `Emprestado · faltam ${dayCount(left)}`;
  return { tone: 'info', icon: 'emprestimos', title, text: `${holder} · sem multa` };
}

function historyStatus(loan: Loan): { tone: Tone; icon: IconName; label: string } {
  if (!loan.returnedAt) {
    const late = daysOverdue(loan.due, DEMO_REFERENCE_DATE);
    if (late > 0) return { tone: 'danger', icon: 'relogio', label: `Ativo · atrasado ${late} d` };
    return { tone: 'info', icon: 'emprestimos', label: 'Ativo · no prazo' };
  }
  const lateReturn = daysOverdue(loan.due, loan.returnedAt);
  if (lateReturn > 0) return { tone: 'neutral', icon: 'devolucoes', label: `Devolvido · ${lateReturn} d de atraso` };
  return { tone: 'neutral', icon: 'devolucoes', label: 'Devolvido no prazo' };
}

function historyRowClass(loan: Loan): string | undefined {
  if (loan.returnedAt) return undefined;
  return daysOverdue(loan.due, DEMO_REFERENCE_DATE) > 0 ? styles.rowLate : styles.rowActive;
}

function CirculationPanel({ work, loan }: Readonly<{ work: Work; loan: Loan | undefined }>) {
  const info = describeCirculation(loan);
  return <output className={`${styles.status} ${styles[info.tone]}`}>
    <span className={styles.statusIcon}><Icon name={info.icon} size={22}/></span>
    <span className={styles.statusText}><strong>{info.title}</strong><span>{info.text}</span></span>
    {loan && <InkoLinkButton href={`/devolucoes?emprestimo=${encodeURIComponent(loan.id)}`} leftIcon="devolucoes" className={styles.statusAction}>Registrar devolução</InkoLinkButton>}
    {!loan && <InkoLinkButton href={`/emprestimos?obra=${encodeURIComponent(work.id)}`} leftIcon="emprestimos" className={styles.statusAction}>Emprestar</InkoLinkButton>}
  </output>;
}

function Optional() {
  return <span className={styles.optional}> · opcional</span>;
}

function WorkMetadata({ work }: Readonly<{ work: Work }>) {
  return <dl className={styles.meta}>
    <div><dt>Identificador</dt><dd>{work.id}</dd></div>
    <div><dt>Título</dt><dd>{work.title}</dd></div>
    <div><dt>Autor</dt><dd>{work.author}</dd></div>
    <div><dt>Categoria</dt><dd>{work.category}</dd></div>
    <div><dt>Volume<Optional/></dt>{work.volume ? <dd>{work.volume}</dd> : <dd className={styles.missing}>Não informado</dd>}</div>
    <div><dt>Editora<Optional/></dt>{work.publisher ? <dd>{work.publisher}</dd> : <dd className={styles.missing}>Não informado</dd>}</div>
  </dl>;
}

function HistorySection({ work, history }: Readonly<{ work: Work; history: readonly Loan[] }>) {
  return <Section flush id="historico-obra" title="Histórico de movimentações" action={<span className={styles.restricted}><Icon name="cadeado" size={14}/>Visível para Bibliotecário e Admin</span>}>
    {history.length === 0 && <InkoEmpty title="Sem movimentações" text="Esta obra ainda não foi emprestada. O histórico aparece aqui a partir do primeiro empréstimo."/>}
    {history.length > 0 && <div className="inko-table-wrap inko-only-desktop">
      <table className={`inko-table ${styles.historyTable}`}>
        <thead><tr><th>Usuário</th><th>Empréstimo</th><th>Prazo</th><th>Devolução</th><th>Situação</th></tr></thead>
        <tbody>
          {history.map(loan => {
            const situation = historyStatus(loan);
            return <tr key={loan.id} className={historyRowClass(loan)}>
              <td><span className={loan.returnedAt ? undefined : styles.holder}>{loan.user}</span> <small className="inko-muted">{loan.id}</small></td>
              <td>{formatDate(loan.start)}</td>
              <td>{formatDate(loan.due)}</td>
              {loan.returnedAt ? <td>{formatDate(loan.returnedAt)}</td> : <td className="inko-muted"><span aria-hidden="true">—</span><span className="sr-only">Ainda não devolvida</span></td>}
              <td><InkoBadge tone={situation.tone} icon={situation.icon}>{situation.label}</InkoBadge></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>}
    {history.length > 0 && <ul className={`inko-loan-list inko-only-mobile ${styles.historyList}`}>
      {history.map(loan => <li key={loan.id}><LoanCard loan={loan} reference={DEMO_REFERENCE_DATE} work={work}/></li>)}
    </ul>}
  </Section>;
}

function AboutSection({ work, loanCount }: Readonly<{ work: Work; loanCount: number }>) {
  return <Section id="sobre-obra" title="Sobre a obra">
    {work.synopsis ? <p className={styles.synopsis}>{work.synopsis}</p> : <p className={`${styles.synopsis} inko-muted`}>Sinopse não informada.</p>}
    <dl className="inko-definition">
      <div><dt>Título original</dt>{work.originalTitle ? <dd lang="ja">{work.originalTitle}</dd> : <dd className="inko-muted">Não informado</dd>}</div>
      <div><dt>Editora</dt><dd>{work.publisher ?? 'Não informado'}</dd></div>
      <div><dt>Volume</dt><dd>{work.volume || 'Não informado'}</dd></div>
      <div><dt>Empréstimos registrados</dt><dd>{loanCount}</dd></div>
    </dl>
    <DemoNotice>Obra, sinopse e capa são fictícias. Capas reais dependem de licença de uso e do serviço de catálogo.</DemoNotice>
  </Section>;
}

export default function WorkDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const library = useLibrary();
  const toast = useToast();
  const { loading } = useMockQuery(500);

  const id = decodeURIComponent(params.id ?? '').toUpperCase();
  const work = library.works.find(item => item.id === id);
  const loan = activeLoanOf(library.loans, id);
  const history = useMemo(() => library.loans.filter(item => item.workId === id).sort((left, right) => right.start.localeCompare(left.start)), [library.loans, id]);

  const [tab, setTab] = useState<string>(TAB_HISTORY);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Depois da exclusão a obra some do estado antes da navegação; evita piscar "não encontrada".
  const [leaving, setLeaving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const busy = loading || !library.ready || leaving;

  async function handleDelete() {
    if (!work) return;
    const label = workLabel(work);
    setDeleting(true);
    setLeaving(true);
    setDeleteError(null);
    try {
      await deleteWork(work.id);
      setConfirmOpen(false);
      toast({ title: 'Obra excluída', text: `${label} foi removida do acervo.` });
      router.push('/acervo');
    } catch (cause) {
      const message = cause instanceof MockApiError ? cause.message : 'Não foi possível excluir a obra. Tente novamente.';
      setLeaving(false);
      setConfirmOpen(false);
      setDeleteError(message);
      toast({ title: 'Exclusão não concluída', text: message, tone: 'danger' });
    } finally {
      setDeleting(false);
    }
  }

  return <AppShell breadcrumb={[{ label: 'Acervo', href: '/acervo' }, { label: work ? workLabel(work) : 'Obra não encontrada' }]}>
    {busy && !confirmOpen && <InkoSkeleton lines={5}/>}

    {!busy && !work && <div className={styles.notFound}>
      <InkoEmpty title="Obra não encontrada" text={`Não existe obra com o identificador ${id || 'informado'} no acervo. Ela pode ter sido excluída.`}>
        <InkoLinkButton href="/acervo" variant="outline" leftIcon="seta-esquerda">Voltar ao acervo</InkoLinkButton>
      </InkoEmpty>
    </div>}

    {work && (!busy || confirmOpen) && <>
      <div className={`${styles.hero} inko-motion-enter`}>
        <div className={styles.coverColumn}>
          <div className={styles.coverFrame}><InkoCover work={work}/></div>
          <span className="inko-footnote">{work.cover === null ? 'Sem capa' : 'Capa fictícia'} · slot 2:3 para imagem licenciada</span>
        </div>

        <div className={styles.summary}>
          <header className={styles.heading}>
            <div className={styles.kicker}><CategoryTag category={work.category}/><span>{work.id}</span></div>
            <h1>{work.title}{work.volume && <span> · {work.volume}</span>}</h1>
            <p className={styles.byline}>{work.author}{work.originalTitle && <><span lang="ja" className={styles.original}>{work.originalTitle}</span><small>título original</small></>}</p>
          </header>

          <CirculationPanel work={work} loan={loan}/>
          {deleteError && <InkoAlert tone="danger" title="Não foi possível excluir a obra">{deleteError}</InkoAlert>}
          <WorkMetadata work={work}/>

          <div className="inko-actions">
            <InkoLinkButton href="/acervo" variant="outline" leftIcon="seta-esquerda">Voltar ao acervo</InkoLinkButton>
            <InkoButton variant="ghost" leftIcon="lixeira" className={styles.deleteButton} onClick={() => { setDeleteError(null); setConfirmOpen(true); }}>Excluir obra</InkoButton>
          </div>
        </div>
      </div>

      <InkoTabs label="Informações da obra" items={TABS} active={tab} onChange={setTab}/>
      {tab === TAB_HISTORY && <div role="tabpanel" aria-label={TAB_HISTORY} className="inko-motion-swap"><HistorySection work={work} history={history}/></div>}
      {tab === TAB_ABOUT && <div role="tabpanel" aria-label={TAB_ABOUT} className="inko-motion-swap"><AboutSection work={work} loanCount={history.length}/></div>}

      <ConfirmDialog open={confirmOpen} title="Excluir obra?" confirmLabel="Excluir obra" loading={deleting} onConfirm={handleDelete} onCancel={() => setConfirmOpen(false)}>
        <p><strong>{workLabel(work)}</strong> ({work.id}) será removida do acervo. Obras com empréstimo ativo não podem ser excluídas.</p>
      </ConfirmDialog>
    </>}
  </AppShell>;
}
