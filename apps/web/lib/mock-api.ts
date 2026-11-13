'use client';

/**
 * API mockada do INKO — fronteira única entre a interface e os dados.
 *
 * Enquanto os microsserviços (catálogo, usuários, circulação, relatórios) não
 * expõem contratos reais, as telas leem o estado com `useLibrary()` e gravam
 * pelas funções assíncronas abaixo. O estado fica em memória e é persistido em
 * `sessionStorage`: sobrevive à navegação e a recarregamentos da aba, e some ao
 * fechá-la. Nada é enviado pela rede.
 *
 * Para integrar o backend real, troque o corpo destas funções por chamadas ao
 * gateway mantendo as assinaturas; as telas não precisam mudar.
 */

import { useSyncExternalStore } from 'react';
import {
  DEMO_REFERENCE_DATE, activeLoanOf, daysBetween, daysOverdue, fineInCents, formatDate, isValidISODate,
  libraryUsers as seedUsers, loans as seedLoans, workLabel, works as seedWorks,
  type Category, type LibraryUser, type Loan, type Work,
} from './demo';
import { isValidEmailAddress } from './validation';

export interface Session {
  name: string;
  role: string;
  email: string;
}

export interface LibraryState {
  /** `false` no servidor e até o estado do navegador ser lido. */
  ready: boolean;
  works: readonly Work[];
  users: readonly LibraryUser[];
  loans: readonly Loan[];
  session: Session | null;
  notificationsRead: boolean;
  remindersSent: boolean;
}

/** Erro de regra de negócio devolvido pela API mockada. */
export class MockApiError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'MockApiError';
    this.field = field;
  }
}

export const MOCK_LATENCY_MS = 450;
const STORAGE_KEY = 'inko.mock.v1';

function seedState(ready: boolean): LibraryState {
  return { ready, works: seedWorks, users: seedUsers, loans: seedLoans, session: null, notificationsRead: false, remindersSent: false };
}

const SERVER_STATE = seedState(false);
let state: LibraryState | null = null;
const listeners = new Set<() => void>();

function readStored(): LibraryState {
  try {
    const raw = globalThis.sessionStorage?.getItem(STORAGE_KEY);
    if (raw) return { ...seedState(true), ...(JSON.parse(raw) as Partial<LibraryState>), ready: true };
  } catch {
    // Armazenamento indisponível ou corrompido: segue com a semente.
  }
  return seedState(true);
}

function getSnapshot(): LibraryState {
  state ??= readStored();
  return state;
}

function getServerSnapshot(): LibraryState {
  return SERVER_STATE;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function commit(next: LibraryState): void {
  state = next;
  try {
    globalThis.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Sem persistência: o estado continua válido em memória.
  }
  listeners.forEach(listener => listener());
}

function latency(): Promise<void> {
  return new Promise(resolve => { setTimeout(resolve, MOCK_LATENCY_MS); });
}

function nextId(prefix: string, ids: readonly string[], width: number): string {
  const highest = ids.reduce((max, id) => Math.max(max, Number(id.slice(prefix.length + 1)) || 0), 0);
  return `${prefix}-${String(highest + 1).padStart(width, '0')}`;
}

/** Estado reativo da biblioteca mockada. */
export function useLibrary(): LibraryState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/* ---------- Autenticação ---------- */

/**
 * Login demonstrativo: aceita qualquer e-mail válido com senha de 6+ caracteres.
 * Não existe credencial fixa nem verificação de identidade; a senha não é guardada.
 */
export async function signIn(email: string, password: string): Promise<Session> {
  await latency();
  if (!isValidEmailAddress(email)) throw new MockApiError('Informe um e-mail válido.', 'email');
  if (password.length < 6) throw new MockApiError('A senha deve ter pelo menos 6 caracteres.', 'password');
  const session: Session = { name: 'Mariana Costa', role: 'Bibliotecária', email: email.trim() };
  commit({ ...getSnapshot(), session });
  return session;
}

export function signOut(): void {
  commit({ ...getSnapshot(), session: null });
}

/* ---------- Catálogo ---------- */

export interface NewWorkInput {
  id: string;
  title: string;
  author: string;
  category: Category;
  volume?: string;
  publisher?: string;
  originalTitle?: string;
}

export async function createWork(input: NewWorkInput): Promise<Work> {
  await latency();
  const current = getSnapshot();
  const id = input.id.trim().toUpperCase();
  if (!/^INK-\d{4}$/.test(id)) throw new MockApiError('Formato inválido. Use INK- seguido de 4 dígitos.', 'id');
  if (current.works.some(work => work.id === id)) throw new MockApiError(`O identificador ${id} já existe no acervo.`, 'id');
  if (!input.title.trim()) throw new MockApiError('Informe o título.', 'title');
  if (!input.author.trim()) throw new MockApiError('Informe o autor.', 'author');
  const work: Work = {
    id, title: input.title.trim(), author: input.author.trim(), category: input.category,
    volume: input.volume?.trim() ?? '', cover: null,
    publisher: input.publisher?.trim() || undefined, originalTitle: input.originalTitle?.trim() || undefined,
  };
  commit({ ...current, works: [work, ...current.works] });
  return work;
}

export async function deleteWork(workId: string): Promise<void> {
  await latency();
  const current = getSnapshot();
  const loan = activeLoanOf(current.loans, workId);
  if (loan) throw new MockApiError(`A obra está emprestada a ${loan.user} e não pode ser excluída.`);
  commit({ ...current, works: current.works.filter(work => work.id !== workId) });
}

/* ---------- Usuários ---------- */

export async function createUser(input: { name: string; email: string }): Promise<LibraryUser> {
  await latency();
  const current = getSnapshot();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 3) throw new MockApiError('Informe o nome completo.', 'name');
  if (!isValidEmailAddress(email)) throw new MockApiError('Informe um e-mail válido.', 'email');
  if (current.users.some(user => user.email.toLowerCase() === email)) throw new MockApiError('Já existe um usuário com este e-mail.', 'email');
  const user: LibraryUser = { id: nextId('USR', current.users.map(item => item.id), 4), name, email, since: DEMO_REFERENCE_DATE };
  commit({ ...current, users: [user, ...current.users] });
  return user;
}

/* ---------- Circulação ---------- */

export async function createLoan(input: { workId: string; userId: string; start: string; due: string }): Promise<Loan> {
  await latency();
  const current = getSnapshot();
  const work = current.works.find(item => item.id === input.workId);
  const user = current.users.find(item => item.id === input.userId);
  if (!user) throw new MockApiError('Selecione um usuário.', 'userId');
  if (!work) throw new MockApiError('Selecione uma obra.', 'workId');
  if (!isValidISODate(input.start) || !isValidISODate(input.due) || daysBetween(input.start, input.due) < 1) {
    throw new MockApiError('O prazo de devolução deve ser posterior à data do empréstimo.', 'due');
  }
  // Revalida a disponibilidade no momento da gravação (conflito de concorrência).
  const conflict = activeLoanOf(current.loans, work.id);
  if (conflict) throw new MockApiError(`Obra indisponível: emprestada a ${conflict.user} até ${formatDate(conflict.due)}.`, 'workId');
  const loan: Loan = {
    id: nextId('EMP', current.loans.map(item => item.id), 5), workId: work.id, userId: user.id,
    work: workLabel(work), user: user.name, start: input.start, due: input.due, returnedAt: null,
  };
  commit({ ...current, loans: [...current.loans, loan] });
  return loan;
}

export interface ReturnReceipt {
  loan: Loan;
  daysLate: number;
  fineCents: number;
}

export async function returnLoan(loanId: string, returnedAt: string): Promise<ReturnReceipt> {
  await latency();
  const current = getSnapshot();
  const loan = current.loans.find(item => item.id === loanId);
  if (!loan || loan.returnedAt) throw new MockApiError('Empréstimo não encontrado ou já encerrado.');
  if (!isValidISODate(returnedAt)) throw new MockApiError('Use o formato dd/mm/aaaa.', 'returnedAt');
  if (daysBetween(loan.start, returnedAt) < 0) throw new MockApiError('A devolução não pode ser antes do empréstimo.', 'returnedAt');
  if (daysBetween(returnedAt, DEMO_REFERENCE_DATE) < 0) throw new MockApiError('A data não pode estar no futuro.', 'returnedAt');
  const closed: Loan = { ...loan, returnedAt };
  commit({ ...current, loans: current.loans.map(item => (item.id === loanId ? closed : item)) });
  const daysLate = daysOverdue(loan.due, returnedAt);
  return { loan: closed, daysLate, fineCents: fineInCents(daysLate) };
}

/* ---------- Avisos ---------- */

export function setRemindersSent(sent: boolean): void {
  commit({ ...getSnapshot(), remindersSent: sent });
}

export function markNotificationsRead(): void {
  commit({ ...getSnapshot(), notificationsRead: true });
}

/** Restaura os dados fictícios originais, preservando a sessão. */
export function resetDemoData(): void {
  commit({ ...seedState(true), session: getSnapshot().session });
}

export interface LibraryNotification {
  id: string;
  tone: 'danger' | 'warning' | 'success';
  text: string;
  when: string;
  href: string;
}

/** Notificações derivadas dos empréstimos: atrasos, vencimentos próximos e devoluções do dia. */
export function buildNotifications(library: LibraryState, reference: string = DEMO_REFERENCE_DATE): LibraryNotification[] {
  const active = library.loans.filter(loan => !loan.returnedAt);
  const late = active.filter(loan => daysOverdue(loan.due, reference) > 0)
    .sort((left, right) => daysBetween(right.due, left.due))
    .map(loan => {
      const days = daysOverdue(loan.due, reference);
      return { id: loan.id, tone: 'danger' as const, text: `${loan.work} está ${days} ${days === 1 ? 'dia atrasado' : 'dias atrasado'} (${loan.user}).`, when: 'Hoje, 08:00', href: '/relatorios' };
    });
  const dueSoon = active.filter(loan => { const left = daysBetween(reference, loan.due); return left >= 0 && left <= 2; })
    .map(loan => {
      const left = daysBetween(reference, loan.due);
      const label = left === 0 ? 'vence hoje' : `vence em ${left} ${left === 1 ? 'dia' : 'dias'}`;
      return { id: loan.id, tone: 'warning' as const, text: `${loan.work} ${label} (${loan.user}).`, when: 'Hoje, 08:00', href: '/devolucoes' };
    });
  const returned = library.loans.filter(loan => loan.returnedAt === reference)
    .map(loan => ({ id: loan.id, tone: 'success' as const, text: `${loan.user} devolveu ${loan.work}.`, when: 'Hoje', href: '/devolucoes' }));
  return [...late, ...dueSoon, ...returned];
}
