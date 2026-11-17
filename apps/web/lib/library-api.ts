'use client';

/**
 * Fronteira única entre as telas e os serviços reais do INKO.
 *
 * As leituras e gravações vão para `/api/v1/*` na própria origem (BFF do Next), que
 * repassa ao Gateway → serviços Java → PostgreSQL. Não há dados simulados nem
 * fallback: se a API falhar, o estado expõe o erro e as telas o mostram.
 *
 * Somente a sessão de login continua demonstrativa (RF-25 está fora do escopo):
 * ela vive em `sessionStorage` e não protege nada no servidor.
 */

import { useSyncExternalStore } from 'react';
import {
  DEMO_REFERENCE_DATE, daysBetween, daysOverdue, fineInCents, workLabel,
  type Category, type LibraryUser, type Loan, type Work,
} from './demo';
import { isValidEmailAddress } from './validation';

export interface Session {
  name: string;
  role: string;
  email: string;
}

export type LoadStatus = 'idle' | 'loading' | 'ok' | 'error';

export interface LibraryState {
  /** `true` quando a sessão foi lida e, havendo sessão, os dados terminaram de carregar (com sucesso ou erro). */
  ready: boolean;
  status: LoadStatus;
  error: string | null;
  works: readonly Work[];
  users: readonly LibraryUser[];
  loans: readonly Loan[];
  session: Session | null;
  notificationsRead: boolean;
  remindersSent: boolean;
}

/** Erro devolvido pela API (problem+json) com o campo da interface, quando houver. */
export class ApiError extends Error {
  readonly field?: string;
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, field?: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.field = field;
    this.code = code;
  }
}

interface LivroDto { id: string; titulo: string; autor: string; categoria: Category; volume: string | null; editora: string | null; tituloOriginal: string | null }
interface UsuarioDto { id: string; nome: string; matricula: string; email: string | null; cadastradoEm: string }
interface EmprestimoDto { id: string; livroId: string; usuarioId: string; dataEmprestimo: string; dataPrevista: string; dataDevolucao: string | null }

const SESSION_KEY = 'inko.session.v1';
const UI_KEY = 'inko.ui.v1';
const COVERS = [0, 1, 2, 3, 4, 6, 7] as const;

/** Nomes de campo da API Java → nomes usados pelos formulários. */
const FIELD_ALIASES: Record<string, string> = {
  titulo: 'title', autor: 'author', categoria: 'category', tituloOriginal: 'originalTitle',
  nome: 'name', matricula: 'registration', livroId: 'workId', usuarioId: 'userId',
  dataPrevista: 'due', dataEmprestimo: 'start', dataDevolucao: 'returnedAt',
};

const EMPTY: Omit<LibraryState, 'ready' | 'session' | 'notificationsRead' | 'remindersSent'> = {
  status: 'idle', error: null, works: [], users: [], loans: [],
};
const SERVER_STATE: LibraryState = { ...EMPTY, ready: false, session: null, notificationsRead: false, remindersSent: false };

let state: LibraryState | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** Capa fictícia determinística: o slot 2:3 aguarda imagens licenciadas. */
function coverFor(id: string): number {
  const sum = [...id].reduce((total, char) => total + char.charCodeAt(0), 0);
  return COVERS[sum % COVERS.length];
}

function toWork(dto: LivroDto): Work {
  return {
    id: dto.id, title: dto.titulo, author: dto.autor, category: dto.categoria, volume: dto.volume ?? '',
    cover: coverFor(dto.id), publisher: dto.editora ?? undefined, originalTitle: dto.tituloOriginal ?? undefined,
  };
}

function toUser(dto: UsuarioDto): LibraryUser {
  return { id: dto.id, name: dto.nome, registration: dto.matricula, email: dto.email ?? '', since: dto.cadastradoEm };
}

function toLoans(dtos: readonly EmprestimoDto[], works: readonly Work[], users: readonly LibraryUser[]): Loan[] {
  const workById = new Map(works.map(work => [work.id, work]));
  const userById = new Map(users.map(user => [user.id, user]));
  return dtos.map(dto => {
    const work = workById.get(dto.livroId);
    return {
      id: dto.id, workId: dto.livroId, userId: dto.usuarioId,
      work: work ? workLabel(work) : dto.livroId, user: userById.get(dto.usuarioId)?.name ?? dto.usuarioId,
      start: dto.dataEmprestimo, due: dto.dataPrevista, returnedAt: dto.dataDevolucao,
    };
  });
}

function readJson<T>(key: string): Partial<T> {
  try {
    const raw = globalThis.sessionStorage?.getItem(key);
    return raw ? JSON.parse(raw) as Partial<T> : {};
  } catch {
    return {};
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    globalThis.sessionStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Sem persistência local: o estado de interface continua válido em memória.
  }
}

function initialState(): LibraryState {
  const session = readJson<{ session: Session }>(SESSION_KEY).session ?? null;
  const ui = readJson<{ notificationsRead: boolean; remindersSent: boolean }>(UI_KEY);
  return {
    ...EMPTY, ready: !session, session,
    notificationsRead: Boolean(ui.notificationsRead), remindersSent: Boolean(ui.remindersSent),
  };
}

function getSnapshot(): LibraryState {
  state ??= initialState();
  return state;
}

function getServerSnapshot(): LibraryState {
  return SERVER_STATE;
}

function commit(patch: Partial<LibraryState>): void {
  const next = { ...getSnapshot(), ...patch };
  next.ready = !next.session || next.status === 'ok' || next.status === 'error';
  state = next;
  writeJson(SESSION_KEY, { session: next.session });
  writeJson(UI_KEY, { notificationsRead: next.notificationsRead, remindersSent: next.remindersSent });
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const current = getSnapshot();
  if (current.session && current.status === 'idle') void refreshLibrary();
  return () => { listeners.delete(listener); };
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1/${path}`, {
      method, cache: 'no-store',
      headers: body === undefined ? { accept: 'application/json' } : { accept: 'application/json', 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Não foi possível contatar o servidor INKO. Verifique se os serviços estão em execução.', 0);
  }
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const problem = (payload ?? {}) as { detail?: string; title?: string; field?: string; code?: string };
    const field = problem.field ? FIELD_ALIASES[problem.field] ?? problem.field : undefined;
    throw new ApiError(problem.detail ?? problem.title ?? `Falha HTTP ${response.status}.`, response.status, field, problem.code);
  }
  return payload as T;
}

/** Recarrega livros, usuários e empréstimos do backend (uma leitura por recurso, sem duplicar em re-renderizações). */
export function refreshLibrary(): Promise<void> {
  if (inflight) return inflight;
  commit({ status: getSnapshot().status === 'ok' ? 'ok' : 'loading' });
  inflight = (async () => {
    try {
      const [livros, usuarios, emprestimos] = await Promise.all([
        request<LivroDto[]>('GET', 'livros'),
        request<UsuarioDto[]>('GET', 'usuarios'),
        request<EmprestimoDto[]>('GET', 'emprestimos'),
      ]);
      const works = livros.map(toWork);
      const users = usuarios.map(toUser);
      commit({ status: 'ok', error: null, works, users, loans: toLoans(emprestimos, works, users) });
    } catch (error) {
      commit({
        status: 'error', works: [], users: [], loans: [],
        error: error instanceof Error ? error.message : 'Falha ao carregar os dados da biblioteca.',
      });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Estado reativo da biblioteca, carregado dos serviços reais. */
export function useLibrary(): LibraryState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/* ---------- Sessão demonstrativa (RF-25 fora do escopo) ---------- */

export async function signIn(email: string, password: string): Promise<Session> {
  if (!isValidEmailAddress(email)) throw new ApiError('Informe um e-mail válido.', 422, 'email');
  if (password.length < 6) throw new ApiError('A senha deve ter pelo menos 6 caracteres.', 422, 'password');
  const session: Session = { name: 'Mariana Costa', role: 'Bibliotecária', email: email.trim() };
  commit({ session, status: 'idle' });
  await refreshLibrary();
  return session;
}

export function signOut(): void {
  commit({ session: null, status: 'idle', error: null, works: [], users: [], loans: [] });
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
  const created = await request<LivroDto>('POST', 'livros', {
    id: input.id.trim(), titulo: input.title, autor: input.author, categoria: input.category,
    volume: input.volume, editora: input.publisher, tituloOriginal: input.originalTitle,
  });
  await refreshLibrary();
  return toWork(created);
}

/** A exclusão de obras não está no contrato do serviço de Catálogo desta versão. */
export async function deleteWork(workId: string): Promise<void> {
  throw new ApiError(`A exclusão de ${workId} não faz parte do contrato do Catálogo nesta versão.`, 501);
}

/* ---------- Usuários ---------- */

export async function createUser(input: { name: string; registration: string; email?: string }): Promise<LibraryUser> {
  const created = await request<UsuarioDto>('POST', 'usuarios', {
    nome: input.name, matricula: input.registration, email: input.email?.trim() || null,
  });
  await refreshLibrary();
  return toUser(created);
}

/* ---------- Circulação ---------- */

export async function createLoan(input: { workId: string; userId: string; start: string; due: string }): Promise<Loan> {
  const created = await request<EmprestimoDto>('POST', 'emprestimos', {
    livroId: input.workId, usuarioId: input.userId, dataEmprestimo: input.start, dataPrevista: input.due,
  });
  await refreshLibrary();
  const current = getSnapshot();
  return toLoans([created], current.works, current.users)[0];
}

export interface ReturnReceipt {
  loan: Loan;
  daysLate: number;
  /** Pré-visualização da multa; o valor oficial vem do serviço de Relatórios. */
  fineCents: number;
}

export async function returnLoan(loanId: string, returnedAt: string): Promise<ReturnReceipt> {
  const closed = await request<EmprestimoDto>('POST', `emprestimos/${encodeURIComponent(loanId)}/devolucao`, { dataDevolucao: returnedAt });
  await refreshLibrary();
  const current = getSnapshot();
  const loan = toLoans([closed], current.works, current.users)[0];
  const daysLate = daysOverdue(loan.due, returnedAt);
  return { loan, daysLate, fineCents: fineInCents(daysLate) };
}

/* ---------- Relatórios (serviço Java) ---------- */

export interface FineReportItem {
  emprestimoId: string;
  livroId: string;
  titulo: string;
  usuarioId: string;
  nomeUsuario: string;
  dataPrevista: string;
  diasAtraso: number;
  valor: number;
}

export interface FineReport {
  referenceDate: string;
  valorDiario: number;
  quantidade: number;
  totalDiasAtraso: number;
  total: number;
  itens: FineReportItem[];
}

export interface LibraryStatistics {
  referenceDate: string;
  totalLivros: number;
  totalUsuarios: number;
  totalEmprestimos: number;
  emprestimosAtivos: number;
  emprestimosAtrasados: number;
  totalMultas: number;
  livrosPorCategoria: Record<string, number>;
  emprestimosPorUsuario: { usuarioId: string; nome: string; total: number }[];
}

export function fetchFineReport(referenceDate: string): Promise<FineReport> {
  return request<FineReport>('GET', `relatorios/multas?referenceDate=${encodeURIComponent(referenceDate)}`);
}

export function fetchStatistics(referenceDate: string): Promise<LibraryStatistics> {
  return request<LibraryStatistics>('GET', `relatorios/estatisticas?referenceDate=${encodeURIComponent(referenceDate)}`);
}

/* ---------- Avisos de interface ---------- */

/** Marca os lembretes como enviados na interface; o envio de e-mails (RF-27) não está implementado. */
export function setRemindersSent(sent: boolean): void {
  commit({ remindersSent: sent });
}

export function markNotificationsRead(): void {
  commit({ notificationsRead: true });
}

export interface LibraryNotification {
  id: string;
  tone: 'danger' | 'warning' | 'success';
  text: string;
  when: string;
  href: string;
}

/** Notificações derivadas dos empréstimos persistidos: atrasos, vencimentos próximos e devoluções do dia. */
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
