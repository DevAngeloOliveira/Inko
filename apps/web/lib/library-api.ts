'use client';

/**
 * Fronteira única entre as telas e os serviços reais do INKO.
 *
 * As leituras e gravações vão para `/api/v1/*` na própria origem (BFF do Next), que
 * repassa ao Gateway → serviços Java → PostgreSQL. Não há dados simulados nem
 * fallback: se a API falhar, o estado expõe o erro e as telas o mostram.
 *
 * A sessão de operador é real (SDD-002): o token opaco fica num cookie HttpOnly
 * gerido por `/api/auth/session`; aqui só vivem nome, e-mail e papel, em memória.
 * `sessionStorage` guarda apenas preferências de interface, nunca autenticação.
 */

import { businessDate } from './business-date';
import { useSyncExternalStore } from 'react';
import {
  daysBetween, daysOverdue, fineInCents, workLabel,
  type Category, type LibraryUser, type Loan, type Work,
} from './demo';
import { editorialOf } from './editorial';

export interface Session {
  name: string;
  role: string;
  email: string;
  expiresAt: string;
}

export type LoadStatus = 'idle' | 'loading' | 'ok' | 'error';

export interface LibraryState {
  /** `true` quando a sessão foi conferida no servidor e, havendo sessão, os dados terminaram de carregar. */
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

export interface LivroDto { id: string; titulo: string; autor: string; categoria: Category; volume: string | null; editora: string | null; tituloOriginal: string | null; capaVersao?: string | null }
interface OperatorDto { nome: string; email: string; papel: string; expiraEm: string }
interface UsuarioDto { id: string; nome: string; matricula: string; email: string | null; cadastradoEm: string }
interface EmprestimoDto { id: string; livroId: string; usuarioId: string; dataEmprestimo: string; dataPrevista: string; dataDevolucao: string | null }

const LEGACY_SESSION_KEY = 'inko.session.v1';
const ROLE_LABELS: Record<string, string> = { ADMIN: 'Administração', BIBLIOTECARIO: 'Bibliotecário(a)' };
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
let sessionChecked = false;
let sessionCheck: Promise<void> | null = null;
/** Muda a cada login ou limpeza; descarta conferências iniciadas antes da mudança. */
let sessionGeneration = 0;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

/** Capa fictícia determinística: o slot 2:3 aguarda imagens licenciadas. */
function coverFor(id: string): number {
  const sum = [...id].reduce((total, char) => total + char.charCodeAt(0), 0);
  return COVERS[sum % COVERS.length];
}

/** Capa persistida no Catálogo; a versão (hash) na URL invalida o cache após cada troca. */
export function coverUrlFor(dto: Pick<LivroDto, 'id' | 'capaVersao'>): string | undefined {
  return dto.capaVersao ? `/api/media/livros/${encodeURIComponent(dto.id)}?v=${encodeURIComponent(dto.capaVersao)}` : undefined;
}

export function toWork(dto: LivroDto): Work {
  const editorial = editorialOf(dto.id, dto.titulo, dto.autor);
  return {
    id: dto.id, title: dto.titulo, author: dto.autor, category: dto.categoria, volume: dto.volume ?? '',
    cover: coverFor(dto.id), coverUrl: coverUrlFor(dto), publisher: dto.editora ?? undefined, originalTitle: dto.tituloOriginal ?? undefined,
    synopsis: editorial?.synopsis, genres: editorial?.genres,
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
  try {
    globalThis.sessionStorage?.removeItem(LEGACY_SESSION_KEY);
  } catch {
    // Armazenamento indisponível: nada a limpar.
  }
  const ui = readJson<{ notificationsRead: boolean; remindersSent: boolean }>(UI_KEY);
  return {
    ...EMPTY, ready: false, session: null,
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
  next.ready = sessionChecked && (!next.session || next.status === 'ok' || next.status === 'error');
  state = next;
  writeJson(UI_KEY, { notificationsRead: next.notificationsRead, remindersSent: next.remindersSent });
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!sessionChecked) void checkSession();
  else if (getSnapshot().session && getSnapshot().status === 'idle') void refreshLibrary();
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
  if (response.status === 401 && getSnapshot().session) clearSession();
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

/* ---------- Sessão de operador (cookie HttpOnly via BFF) ---------- */

function toSession(dto: OperatorDto): Session {
  return { name: dto.nome, email: dto.email, role: ROLE_LABELS[dto.papel] ?? dto.papel, expiresAt: dto.expiraEm };
}

function scheduleExpiry(session: Session | null): void {
  clearTimeout(expiryTimer);
  if (!session) return;
  const wait = Date.parse(session.expiresAt) - Date.now();
  if (Number.isFinite(wait)) {
    expiryTimer = setTimeout(() => {
      sessionChecked = false;
      void checkSession();
    }, Math.min(Math.max(wait, 0) + 1_000, 2_147_000_000));
  }
}

/** Apaga da memória a sessão e todos os dados protegidos. */
function clearSession(): void {
  sessionGeneration++;
  scheduleExpiry(null);
  commit({ session: null, status: 'idle', error: null, works: [], users: [], loans: [] });
}

async function sessionRequest(method: 'GET' | 'POST' | 'DELETE', body?: unknown): Promise<Response> {
  try {
    return await fetch('/api/auth/session', {
      method, cache: 'no-store', credentials: 'same-origin',
      headers: body === undefined ? { accept: 'application/json' } : { accept: 'application/json', 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Não foi possível contatar o servidor INKO. Verifique se os serviços estão em execução.', 0);
  }
}

async function problemOf(response: Response): Promise<ApiError> {
  const problem = await response.json().catch(() => ({})) as { detail?: string; code?: string };
  return new ApiError(problem.detail ?? `Falha HTTP ${response.status}.`, response.status, undefined, problem.code);
}

/** Confere a sessão no servidor uma vez por carregamento (e de novo quando ela expira). */
export function checkSession(): Promise<void> {
  if (sessionCheck) return sessionCheck;
  const generation = sessionGeneration;
  sessionCheck = (async () => {
    let session: Session | null = null;
    let error: string | null = null;
    try {
      const response = await sessionRequest('GET');
      if (response.ok) session = toSession(await response.json() as OperatorDto);
      else if (response.status !== 401) error = (await problemOf(response)).message;
    } catch (failure) {
      error = failure instanceof Error ? failure.message : 'Falha ao conferir a sessão.';
    }
    sessionCheck = null;
    if (generation !== sessionGeneration) return;
    sessionChecked = true;
    scheduleExpiry(session);
    if (!session) {
      commit({ session: null, status: error ? 'error' : 'idle', error, works: [], users: [], loans: [] });
      return;
    }
    commit({ session, status: 'idle' });
    await refreshLibrary();
  })();
  return sessionCheck;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const response = await sessionRequest('POST', { email: email.trim(), senha: password });
  if (!response.ok) throw await problemOf(response);
  const session = toSession(await response.json() as OperatorDto);
  sessionGeneration++;
  sessionChecked = true;
  scheduleExpiry(session);
  commit({ session, status: 'idle' });
  await refreshLibrary();
  return session;
}

/** Revoga a sessão no servidor (PostgreSQL) e só então limpa a memória. */
export async function signOut(): Promise<void> {
  const response = await sessionRequest('DELETE');
  if (!response.ok) throw await problemOf(response);
  clearSession();
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

/* ---------- Capas (Catálogo, via /api/media) ---------- */

export const COVER_MAX_BYTES = 2 * 1024 * 1024;
export const COVER_TYPES: readonly string[] = ['image/jpeg', 'image/png'];

/** Validação local antecipada; a decisão final (assinatura, decodificação e dimensões) é do Catálogo. */
export function coverFileError(file: Pick<File, 'type' | 'size'>): string | null {
  if (!COVER_TYPES.includes(file.type)) return 'Use um arquivo JPEG ou PNG.';
  if (file.size === 0) return 'O arquivo está vazio.';
  return file.size > COVER_MAX_BYTES ? 'A capa deve ter no máximo 2 MiB.' : null;
}

function mediaUrl(workId: string): string {
  return `/api/media/livros/${encodeURIComponent(workId)}`;
}

function problemFromXhr(xhr: XMLHttpRequest): ApiError {
  let problem: { detail?: string; code?: string } = {};
  try {
    problem = JSON.parse(xhr.responseText) as typeof problem;
  } catch {
    problem = {};
  }
  return new ApiError(problem.detail ?? `Falha HTTP ${xhr.status}.`, xhr.status, undefined, problem.code);
}

/** Envia ou substitui a capa com progresso de upload; recarrega o acervo para trocar a versão da URL. */
export function uploadCover(workId: string, file: File, onProgress?: (percent: number) => void): Promise<void> {
  const local = coverFileError(file);
  if (local) return Promise.reject(new ApiError(local, 422));
  return new Promise<void>((resolve, reject) => {
    const form = new FormData();
    form.append('arquivo', file);
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', mediaUrl(workId));
    xhr.setRequestHeader('accept', 'application/json');
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new ApiError('Não foi possível contatar o servidor INKO.', 0));
    xhr.onload = () => {
      if (xhr.status === 401) clearSession();
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(problemFromXhr(xhr));
        return;
      }
      refreshLibrary().then(resolve, resolve);
    };
    xhr.send(form);
  });
}

export async function removeCover(workId: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(mediaUrl(workId), { method: 'DELETE', cache: 'no-store', headers: { accept: 'application/json' } });
  } catch {
    throw new ApiError('Não foi possível contatar o servidor INKO.', 0);
  }
  if (response.status === 401) clearSession();
  if (!response.ok) throw await problemOf(response);
  await refreshLibrary();
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
export function buildNotifications(library: LibraryState, reference: string = businessDate()): LibraryNotification[] {
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

/* ---------- Vitrine pública (landing) ---------- */

export interface PublicCatalog {
  works: Work[];
  /** IDs de obras com empréstimo ativo, segundo o serviço de Circulação. */
  onLoan: ReadonlySet<string>;
}

async function fetchAvailability(): Promise<{ emprestados: string[] }> {
  let response: Response;
  try {
    response = await fetch('/api/public/disponibilidade', { cache: 'no-store', headers: { accept: 'application/json' } });
  } catch {
    throw new ApiError('Não foi possível contatar o servidor INKO.', 0);
  }
  if (!response.ok) throw await problemOf(response);
  return response.json() as Promise<{ emprestados: string[] }>;
}

/** Obras do Catálogo e IDs emprestados (rota pública sem dados de leitores). */
export async function fetchPublicCatalog(): Promise<PublicCatalog> {
  const [livros, disponibilidade] = await Promise.all([
    request<LivroDto[]>('GET', 'livros'),
    fetchAvailability(),
  ]);
  return { works: livros.map(toWork), onLoan: new Set(disponibilidade.emprestados) };
}
