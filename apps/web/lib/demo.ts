/**
 * Dados e regras demonstrativas do INKO.
 *
 * Este módulo é a semente (seed) do mock: obras, usuários e empréstimos
 * fictícios extraídos das pranchas do Design System, mais as regras puras
 * de prazo e multa. O estado mutável vive em `lib/mock-api.ts`.
 */

export type Availability = 'disp' | 'emp' | 'atr';
export type CirculationStatus = Availability | 'dev';
export type Category = 'Mangá' | 'HQ' | 'Graphic novel';

export const CATEGORIES: readonly Category[] = ['Mangá', 'HQ', 'Graphic novel'];

export interface Work {
  id: string;
  title: string;
  volume: string;
  author: string;
  category: Category;
  /** Índice da capa fictícia em CSS (0–7); `null` = estado "Sem capa". */
  cover: number | null;
  publisher?: string;
  originalTitle?: string;
  synopsis?: string;
}

export interface LibraryUser {
  id: string;
  name: string;
  email: string;
  since: string;
}

export interface Loan {
  id: string;
  workId: string;
  userId: string;
  /** Rótulo "Título · Volume" congelado no momento do empréstimo. */
  work: string;
  /** Nome do usuário congelado no momento do empréstimo. */
  user: string;
  start: string;
  due: string;
  returnedAt: string | null;
}

/** "Hoje" fixo da demonstração, para que prazos e multas batam com o design. */
export const DEMO_REFERENCE_DATE = '2026-11-09';
export const DAILY_FINE_CENTS = 200;
export const DEFAULT_LOAN_DAYS = 14;

export const works: readonly Work[] = [
  { id: 'INK-0001', title: 'Maré de Tinta', volume: 'Vol. 3', author: 'Aiko Tanabe', category: 'Mangá', cover: 0, publisher: 'Editora Sumi', originalTitle: '墨の潮', synopsis: 'Uma calígrafa descobre que a tinta do porto guarda as memórias de quem partiu.' },
  { id: 'INK-0002', title: 'O Último Ronin', volume: 'Vol. 12', author: 'Kenji Arata', category: 'Mangá', cover: 1, publisher: 'Editora Sumi', originalTitle: '最後の浪人', synopsis: 'Um espadachim sem mestre atravessa províncias em guerra para devolver uma espada.' },
  { id: 'INK-0003', title: 'Capitão Ferrugem', volume: '#27', author: 'Rafael Moura', category: 'HQ', cover: 2, publisher: 'Farol Quadrinhos', synopsis: 'O herói mais enferrujado do cais enfrenta a Liga das Marés.' },
  { id: 'INK-0004', title: 'Kitsune Express', volume: 'Vol. 5', author: 'Haru Mizuki', category: 'Mangá', cover: 3, publisher: 'Washi Press', originalTitle: '狐エクスプレス', synopsis: 'Uma raposa mensageira entrega cartas entre o mundo dos vivos e o dos espíritos.' },
  { id: 'INK-0005', title: 'Jardim de Aço', volume: 'Vol. 1', author: 'Sora Ikeda', category: 'Mangá', cover: 4, publisher: 'Washi Press', originalTitle: '鋼の庭', synopsis: 'Numa cidade-fábrica, uma jardineira cultiva flores de metal vivo.' },
  { id: 'INK-0006', title: 'Noite Sem Lua', volume: '', author: 'Lia Sato', category: 'Graphic novel', cover: null, publisher: 'Farol Quadrinhos', synopsis: 'Um apagão de sete noites muda a rotina de um bairro inteiro.' },
  { id: 'INK-0007', title: 'Liga dos Faróis', volume: '#4', author: 'Bruno Teles', category: 'HQ', cover: 6, publisher: 'Farol Quadrinhos', synopsis: 'Guardiões de faróis esquecidos se unem contra a neblina.' },
  { id: 'INK-0008', title: 'Pétalas de Ferro', volume: 'Vol. 2', author: 'Mei Kurogane', category: 'Mangá', cover: 7, publisher: 'Editora Sumi', originalTitle: '鉄の花びら', synopsis: 'Duas ferreiras rivais disputam a encomenda do século.' },
  { id: 'INK-0009', title: 'Kitsune Express', volume: 'Vol. 4', author: 'Haru Mizuki', category: 'Mangá', cover: 3, publisher: 'Washi Press', originalTitle: '狐エクスプレス' },
  { id: 'INK-0010', title: 'Liga dos Faróis', volume: '#3', author: 'Bruno Teles', category: 'HQ', cover: 6, publisher: 'Farol Quadrinhos' },
  { id: 'INK-0011', title: 'Jardim de Aço', volume: 'Vol. 2', author: 'Sora Ikeda', category: 'Mangá', cover: 4, publisher: 'Washi Press', originalTitle: '鋼の庭' },
  { id: 'INK-0012', title: 'Maré de Tinta', volume: 'Vol. 4', author: 'Aiko Tanabe', category: 'Mangá', cover: 0, publisher: 'Editora Sumi', originalTitle: '墨の潮' },
];

export const libraryUsers: readonly LibraryUser[] = [
  { id: 'USR-0142', name: 'Rafael Moura', email: 'rafael.moura@exemplo.com', since: '2025-03-14' },
  { id: 'USR-0087', name: 'Beatriz Moraes', email: 'bia.moraes@exemplo.com', since: '2024-11-02' },
  { id: 'USR-0203', name: 'Lia Sato', email: 'lia.sato@exemplo.com', since: '2025-08-21' },
  { id: 'USR-0031', name: 'Lucas Almeida', email: 'lucas.almeida@exemplo.com', since: '2024-05-09' },
  { id: 'USR-0110', name: 'Davi Nogueira', email: 'davi.n@exemplo.com', since: '2025-01-27' },
  { id: 'USR-0175', name: 'Helena Vaz', email: 'helena.vaz@exemplo.com', since: '2025-06-03' },
  { id: 'USR-0218', name: 'Paulo Ikeda', email: 'paulo.ikeda@exemplo.com', since: '2026-02-11' },
  { id: 'USR-0226', name: 'Marina Lopes', email: 'marina.lopes@exemplo.com', since: '2026-04-30' },
];

export const loans: readonly Loan[] = [
  { id: 'EMP-10288', workId: 'INK-0005', userId: 'USR-0175', work: 'Jardim de Aço · Vol. 1', user: 'Helena Vaz', start: '2026-10-06', due: '2026-10-20', returnedAt: null },
  { id: 'EMP-10302', workId: 'INK-0001', userId: 'USR-0142', work: 'Maré de Tinta · Vol. 3', user: 'Rafael Moura', start: '2026-10-11', due: '2026-10-25', returnedAt: null },
  { id: 'EMP-10311', workId: 'INK-0003', userId: 'USR-0175', work: 'Capitão Ferrugem · #27', user: 'Helena Vaz', start: '2026-10-16', due: '2026-10-30', returnedAt: null },
  { id: 'EMP-10334', workId: 'INK-0008', userId: 'USR-0203', work: 'Pétalas de Ferro · Vol. 2', user: 'Lia Sato', start: '2026-10-23', due: '2026-11-06', returnedAt: null },
  { id: 'EMP-10377', workId: 'INK-0002', userId: 'USR-0087', work: 'O Último Ronin · Vol. 12', user: 'Beatriz Moraes', start: '2026-10-28', due: '2026-11-11', returnedAt: null },
  { id: 'EMP-10380', workId: 'INK-0009', userId: 'USR-0218', work: 'Kitsune Express · Vol. 4', user: 'Paulo Ikeda', start: '2026-10-30', due: '2026-11-13', returnedAt: null },
  { id: 'EMP-10395', workId: 'INK-0010', userId: 'USR-0226', work: 'Liga dos Faróis · #3', user: 'Marina Lopes', start: '2026-11-04', due: '2026-11-18', returnedAt: null },
  { id: 'EMP-10409', workId: 'INK-0011', userId: 'USR-0142', work: 'Jardim de Aço · Vol. 2', user: 'Rafael Moura', start: '2026-11-08', due: '2026-11-22', returnedAt: null },
  { id: 'EMP-10412', workId: 'INK-0012', userId: 'USR-0031', work: 'Maré de Tinta · Vol. 4', user: 'Lucas Almeida', start: '2026-11-09', due: '2026-11-23', returnedAt: null },
  { id: 'EMP-10270', workId: 'INK-0004', userId: 'USR-0110', work: 'Kitsune Express · Vol. 5', user: 'Davi Nogueira', start: '2026-10-26', due: '2026-11-09', returnedAt: '2026-11-09' },
  { id: 'EMP-10241', workId: 'INK-0007', userId: 'USR-0203', work: 'Liga dos Faróis · #4', user: 'Lia Sato', start: '2026-10-12', due: '2026-10-26', returnedAt: '2026-10-24' },
];

export function workLabel(work: Pick<Work, 'title' | 'volume'>): string {
  return work.volume ? `${work.title} · ${work.volume}` : work.title;
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  if (!isValidISODate(from) || !isValidISODate(to)) return 0;
  return Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export function daysOverdue(due: string, reference: string): number {
  return Math.max(0, daysBetween(due, reference));
}

export function fineInCents(days: number): number {
  return Math.max(0, Math.trunc(days)) * DAILY_FINE_CENTS;
}

/** Relatório acadêmico de multas: somente empréstimos ativos e atrasados. */
export function activeLateLoans(items: readonly Loan[], reference: string) {
  return items.filter(loan => !loan.returnedAt && daysOverdue(loan.due, reference) > 0)
    .map(loan => ({ ...loan, days: daysOverdue(loan.due, reference), fineCents: fineInCents(daysOverdue(loan.due, reference)) }))
    .sort((left, right) => right.days - left.days);
}

export function totalFineCents(items: readonly Loan[], reference: string): number {
  return activeLateLoans(items, reference).map(loan => loan.fineCents).reduce((acc, fine) => acc + fine, 0);
}

/** Status de circulação de um empréstimo na data de referência. */
export function loanStatus(loan: Loan, reference: string): CirculationStatus {
  if (loan.returnedAt) return 'dev';
  return daysOverdue(loan.due, reference) > 0 ? 'atr' : 'emp';
}

/** Empréstimo ativo (não devolvido) de uma obra, se houver. */
export function activeLoanOf(items: readonly Loan[], workId: string): Loan | undefined {
  return items.find(loan => loan.workId === workId && !loan.returnedAt);
}

/** Disponibilidade de uma obra, derivada dos empréstimos ativos. */
export function availabilityOf(items: readonly Loan[], workId: string, reference: string): Availability {
  const loan = activeLoanOf(items, workId);
  if (!loan) return 'disp';
  return daysOverdue(loan.due, reference) > 0 ? 'atr' : 'emp';
}

export function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function formatDate(iso: string): string {
  if (!isValidISODate(iso)) return iso;
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

/** Converte "dd/mm/aaaa" em ISO; devolve `null` quando a data não existe. */
export function parseBRDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  return isValidISODate(iso) ? iso : null;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}

/** Normaliza para busca: minúsculas e sem acentos. */
export function normalize(text: string): string {
  return text.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '');
}
