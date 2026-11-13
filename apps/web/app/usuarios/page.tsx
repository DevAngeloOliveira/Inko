'use client';

import { Suspense, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '../../components/app-shell';
import { Icon } from '../../components/icon';
import { useToast } from '../../components/inko-interactions';
import { Avatar, DemoTag, Enso, InkoBadge, InkoButton, InkoEmpty, InkoInput, InkoLinkButton, InkoSearch, InkoStatus, PageHeading } from '../../components/inko-kit';
import { InkoAlert } from '../../components/inko-patterns';
import {
  DEMO_REFERENCE_DATE, daysOverdue, fineInCents, formatBRL, formatDate, loanStatus, normalize,
  type LibraryUser, type Loan,
} from '../../lib/demo';
import { MockApiError, createUser, useLibrary } from '../../lib/mock-api';
import { isValidEmailAddress } from '../../lib/validation';
import styles from './usuarios.module.css';

interface UserRow {
  user: LibraryUser;
  active: number;
  late: number;
  fineCents: number;
}

type FormErrors = Partial<Record<'name' | 'email', string>>;

/** Situação do usuário, derivada dos empréstimos ativos (não há campo persistido). */
function summarize(user: LibraryUser, loans: readonly Loan[]): UserRow {
  const active = loans.filter(loan => loan.userId === user.id && !loan.returnedAt);
  const overdue = active.map(loan => daysOverdue(loan.due, DEMO_REFERENCE_DATE)).filter(days => days > 0);
  return { user, active: active.length, late: overdue.length, fineCents: overdue.reduce((sum, days) => sum + fineInCents(days), 0) };
}

/** Ordem do histórico: atrasados, depois ativos, depois devolvidos; mais recentes primeiro. */
function historyOf(userId: string, loans: readonly Loan[]): Loan[] {
  const rank = { atr: 0, emp: 1, disp: 1, dev: 2 } as const;
  return loans.filter(loan => loan.userId === userId).sort((left, right) => {
    const byStatus = rank[loanStatus(left, DEMO_REFERENCE_DATE)] - rank[loanStatus(right, DEMO_REFERENCE_DATE)];
    return byStatus || right.start.localeCompare(left.start);
  });
}

function historyDates(loan: Loan): string {
  if (loan.returnedAt) return `${formatDate(loan.start)} → devolvido ${formatDate(loan.returnedAt)}`;
  return `${formatDate(loan.start)} → prazo ${formatDate(loan.due)}`;
}

function nextUserId(users: readonly LibraryUser[]): string {
  const highest = users.reduce((max, user) => Math.max(max, Number(user.id.slice(4)) || 0), 0);
  return `USR-${String(highest + 1).padStart(4, '0')}`;
}

function countLabel(found: number, total: number, searching: boolean): string {
  if (!searching) return `${total} ${total === 1 ? 'usuário' : 'usuários'}`;
  return `${found} de ${total} ${total === 1 ? 'usuário' : 'usuários'}`;
}

function validate(name: string, email: string, users: readonly LibraryUser[]): FormErrors {
  const errors: FormErrors = {};
  if (name.trim().length < 3) errors.name = 'Informe o nome completo.';
  const normalized = email.trim().toLowerCase();
  if (!isValidEmailAddress(normalized)) errors.email = 'Informe um e-mail válido.';
  else if (users.some(user => user.email.toLowerCase() === normalized)) errors.email = 'Já existe um usuário com este e-mail.';
  return errors;
}

function UserSituation({ late }: Readonly<{ late: number }>) {
  if (late > 0) return <InkoBadge tone="danger" icon="relogio">Com atraso</InkoBadge>;
  return <InkoBadge tone="success" icon="check-circulo">Regular</InkoBadge>;
}

function HistoryStatus({ loan }: Readonly<{ loan: Loan }>) {
  const status = loanStatus(loan, DEMO_REFERENCE_DATE);
  if (status === 'atr') return <InkoStatus status="atr" detail={`${daysOverdue(loan.due, DEMO_REFERENCE_DATE)} d`}/>;
  if (status === 'dev') return <InkoStatus status="dev"/>;
  return <InkoBadge tone="info">Ativo</InkoBadge>;
}

function UserDetail({ row, loans }: Readonly<{ row: UserRow; loans: readonly Loan[] }>) {
  const { user } = row;
  const history = historyOf(user.id, loans);
  return <section className={styles.detail} aria-labelledby="usuario-detalhe">
    <div className={styles.detailHead}>
      <Enso size={150} tone="ink" className={styles.detailEnso}/>
      <Avatar name={user.name} size={56}/>
      <div className={styles.detailTitle}><h2 id="usuario-detalhe">{user.name}</h2><span>{user.id} · {user.email}</span></div>
    </div>
    <div className={styles.detailBody}>
      <div className="inko-actions">
        <InkoLinkButton href={`/emprestimos?usuario=${user.id}`} leftIcon="emprestimos">Novo empréstimo</InkoLinkButton>
        <InkoLinkButton href="/devolucoes" variant="outline">Registrar devolução</InkoLinkButton>
      </div>
      <dl className={styles.facts}>
        <div><dt>Cadastro</dt><dd>{formatDate(user.since)}</dd></div>
        <div><dt>Ativos</dt><dd>{row.active}</dd></div>
        <div><dt>Multa em aberto</dt><dd className={row.fineCents > 0 ? 'inko-text-danger' : undefined}>{formatBRL(row.fineCents)}</dd></div>
      </dl>
      {row.late > 0 && <InkoAlert tone="danger" title={`${row.late} ${row.late === 1 ? 'empréstimo atrasado' : 'empréstimos atrasados'}`}>Multa acumulada de {formatBRL(row.fineCents)} (R$ 2,00 por dia de atraso).</InkoAlert>}
      <div className={styles.historyHead}><h3>Histórico de empréstimos</h3><span><Icon name="cadeado" size={13}/>Autorizado</span></div>
      {history.length > 0 && <ul className={styles.history}>
        {history.map(loan => <li key={loan.id}>
          <span className={styles.historyText}><strong>{loan.work}</strong><span>{historyDates(loan)}</span></span>
          <HistoryStatus loan={loan}/>
        </li>)}
      </ul>}
      {history.length === 0 && <p className="inko-footnote">Nenhum empréstimo registrado para este usuário.</p>}
    </div>
  </section>;
}

function UserForm({ users, onCancel, onCreated }: Readonly<{ users: readonly LibraryUser[]; onCancel: () => void; onCreated: (user: LibraryUser) => void }>) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [failure, setFailure] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate(name, email, users);
    setErrors(found);
    setFailure('');
    if (found.name || found.email) {
      document.getElementById(found.name ? 'novo-usuario-nome' : 'novo-usuario-email')?.focus();
      return;
    }
    setSaving(true);
    try {
      onCreated(await createUser({ name, email }));
    } catch (error) {
      setSaving(false);
      if (error instanceof MockApiError && (error.field === 'name' || error.field === 'email')) {
        setErrors({ [error.field]: error.message });
        return;
      }
      setFailure(error instanceof Error ? error.message : 'Não foi possível cadastrar o usuário.');
    }
  }

  return <section className={styles.create} aria-labelledby="novo-usuario">
    <div className={styles.createHead}>
      <h2 id="novo-usuario">Novo usuário</h2>
      <InkoButton variant="ghost" iconOnly aria-label="Fechar" onClick={onCancel} disabled={saving}><Icon name="fechar" size={18}/></InkoButton>
    </div>
    <form className="inko-form inko-form--lg" onSubmit={submit} noValidate>
      <InkoInput id="novo-usuario-nome" label="Nome completo" required autoComplete="off" autoFocus value={name} error={errors.name} onChange={event => setName(event.target.value)}/>
      <InkoInput id="novo-usuario-email" label="E-mail" type="email" required autoComplete="off" value={email} error={errors.email} help="Usado para lembretes de prazo." onChange={event => setEmail(event.target.value)}/>
      <InkoInput id="novo-usuario-id" label="Identificador" disabled readOnly value={`${nextUserId(users)} (gerado)`}/>
      {failure && <InkoAlert tone="danger">{failure}</InkoAlert>}
      <output className="sr-only">{saving ? 'Cadastrando usuário…' : ''}</output>
      <div className="inko-actions inko-actions--end">
        <InkoButton variant="ghost" onClick={onCancel} disabled={saving}>Cancelar</InkoButton>
        <InkoButton type="submit" loading={saving}>Cadastrar</InkoButton>
      </div>
    </form>
  </section>;
}

function UsersContent() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { users, loans } = useLibrary();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => users.map(user => summarize(user, loans)), [users, loans]);
  const term = normalize(query.trim());
  const filtered = rows.filter(row => !term || normalize(`${row.user.name} ${row.user.email} ${row.user.id}`).includes(term));
  // A URL (?u=USR-ID) é a fonte da seleção: a busca global do shell navega para cá.
  const current = rows.find(row => row.user.id === params.get('u')) ?? rows[0];

  function revealPanel() {
    // No mobile o painel fica abaixo da lista: leva o detalhe até a área visível.
    if (globalThis.matchMedia?.('(max-width: 767px)').matches) {
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ block: 'start' }));
    }
  }

  function select(userId: string) {
    setCreating(false);
    router.replace(`/usuarios?u=${userId}`, { scroll: false });
    revealPanel();
  }

  function startCreate() {
    setCreating(true);
    revealPanel();
  }

  function handleCreated(user: LibraryUser) {
    setCreating(false);
    setQuery('');
    router.replace(`/usuarios?u=${user.id}`, { scroll: false });
    toast({ title: 'Usuário cadastrado', text: `${user.name} · ${user.id}` });
  }

  return <>
    <PageHeading title="Usuários" description={<>{users.length} {users.length === 1 ? 'leitor' : 'leitores'} · <DemoTag>dados demonstrativos</DemoTag></>} action={<InkoButton leftIcon="mais" onClick={startCreate}>Novo usuário</InkoButton>}/>
    <div className={styles.layout}>
      <section className={styles.list} aria-label="Lista de usuários">
        <div className={styles.listSearch}>
          <InkoSearch label="Buscar por nome, e-mail ou identificador" placeholder="Nome, e-mail ou identificador…" value={query} onChange={event => setQuery(event.target.value)}/>
          <output className={styles.count}>{countLabel(filtered.length, rows.length, term !== '')}</output>
        </div>
        {filtered.length > 0 && <div className="inko-table-wrap inko-only-desktop">
          <table className={`inko-table ${styles.table}`}>
            <thead><tr><th scope="col">Usuário</th><th scope="col">ID</th><th scope="col" className="inko-table-end">Ativos</th><th scope="col">Situação</th></tr></thead>
            <tbody>
              {filtered.map(row => {
                const on = !creating && row.user.id === current?.user.id;
                return <tr key={row.user.id} aria-selected={on}>
                  <td><button type="button" className={styles.pick} aria-pressed={on} onClick={() => select(row.user.id)}>
                    <Avatar name={row.user.name} size={32}/>
                    <span className={styles.pickText}><strong>{row.user.name}</strong><span>{row.user.email}</span></span>
                  </button></td>
                  <td className="inko-muted">{row.user.id}</td>
                  <td className={`inko-table-end ${styles.active}`}>{row.active}</td>
                  <td><UserSituation late={row.late}/></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>}
        {filtered.length > 0 && <ul className={`${styles.cards} inko-only-mobile`}>
          {filtered.map(row => {
            const on = !creating && row.user.id === current?.user.id;
            return <li key={row.user.id}><button type="button" className={styles.card} aria-pressed={on} onClick={() => select(row.user.id)}>
              <Avatar name={row.user.name} size={40}/>
              <span className={styles.pickText}><strong>{row.user.name}</strong><span>{row.user.email}</span><span>{row.user.id} · {row.active} {row.active === 1 ? 'ativo' : 'ativos'}</span></span>
              <UserSituation late={row.late}/>
            </button></li>;
          })}
        </ul>}
        {filtered.length === 0 && <InkoEmpty title="Nenhum usuário encontrado" text="Nenhum cadastro corresponde à busca. Confira o nome, o e-mail ou o identificador.">
          <InkoButton variant="outline" size="sm" onClick={() => setQuery('')}>Limpar busca</InkoButton>
        </InkoEmpty>}
      </section>
      <div className={styles.panel} ref={panelRef}>
        {creating && <UserForm users={users} onCancel={() => setCreating(false)} onCreated={handleCreated}/>}
        {!creating && current && <UserDetail key={current.user.id} row={current} loans={loans}/>}
      </div>
    </div>
  </>;
}

export default function UsersPage() {
  return <AppShell>
    <Suspense fallback={null}><UsersContent/></Suspense>
  </AppShell>;
}
