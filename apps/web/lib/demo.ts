export type Availability = 'disp' | 'emp' | 'atr';
export type Category = 'Mangá' | 'HQ' | 'Graphic novel';

export interface Work {
  id: string;
  title: string;
  volume: string;
  author: string;
  category: Category;
  availability: Availability;
  cover: number;
}

export interface LibraryUser {
  id: string;
  name: string;
  email: string;
  active: number;
  late: boolean;
}

export interface Loan {
  id: string;
  work: string;
  user: string;
  start: string;
  due: string;
  returnedAt: string | null;
}

export const DEMO_REFERENCE_DATE = '2026-11-09';
export const DAILY_FINE_CENTS = 200;

export const works: readonly Work[] = [
  { id: 'INK-0001', title: 'Maré de Tinta', volume: 'Vol. 3', author: 'Aiko Tanabe', category: 'Mangá', availability: 'atr', cover: 0 },
  { id: 'INK-0002', title: 'O Último Ronin', volume: 'Vol. 12', author: 'Kenji Arata', category: 'Mangá', availability: 'emp', cover: 1 },
  { id: 'INK-0003', title: 'Capitão Ferrugem', volume: '#27', author: 'Rafael Moura', category: 'HQ', availability: 'atr', cover: 2 },
  { id: 'INK-0004', title: 'Kitsune Express', volume: 'Vol. 5', author: 'Haru Mizuki', category: 'Mangá', availability: 'disp', cover: 3 },
  { id: 'INK-0005', title: 'Jardim de Aço', volume: 'Vol. 1', author: 'Sora Ikeda', category: 'Mangá', availability: 'atr', cover: 4 },
  { id: 'INK-0006', title: 'Noite Sem Lua', volume: 'Graphic novel', author: 'Lia Sato', category: 'Graphic novel', availability: 'disp', cover: 5 },
  { id: 'INK-0007', title: 'Liga dos Faróis', volume: '#4', author: 'Bruno Teles', category: 'HQ', availability: 'disp', cover: 6 },
  { id: 'INK-0008', title: 'Pétalas de Ferro', volume: 'Vol. 2', author: 'Mei Kurogane', category: 'Mangá', availability: 'atr', cover: 7 },
];

export const libraryUsers: readonly LibraryUser[] = [
  { id: 'USR-0142', name: 'Rafael Moura', email: 'rafael.moura@exemplo.com', active: 2, late: true },
  { id: 'USR-0087', name: 'Beatriz Moraes', email: 'bia.moraes@exemplo.com', active: 1, late: false },
  { id: 'USR-0203', name: 'Lia Sato', email: 'lia.sato@exemplo.com', active: 1, late: true },
  { id: 'USR-0031', name: 'Lucas Almeida', email: 'lucas.almeida@exemplo.com', active: 1, late: false },
  { id: 'USR-0110', name: 'Davi Nogueira', email: 'davi.n@exemplo.com', active: 0, late: false },
  { id: 'USR-0175', name: 'Helena Vaz', email: 'helena.vaz@exemplo.com', active: 2, late: true },
];

export const loans: readonly Loan[] = [
  { id: 'EMP-10288', work: 'Jardim de Aço · Vol. 1', user: 'Helena Vaz', start: '2026-10-06', due: '2026-10-20', returnedAt: null },
  { id: 'EMP-10302', work: 'Maré de Tinta · Vol. 3', user: 'Rafael Moura', start: '2026-10-11', due: '2026-10-25', returnedAt: null },
  { id: 'EMP-10311', work: 'Capitão Ferrugem · #27', user: 'Helena Vaz', start: '2026-10-16', due: '2026-10-30', returnedAt: null },
  { id: 'EMP-10334', work: 'Pétalas de Ferro · Vol. 2', user: 'Lia Sato', start: '2026-10-23', due: '2026-11-06', returnedAt: null },
  { id: 'EMP-10377', work: 'O Último Ronin · Vol. 12', user: 'Beatriz Moraes', start: '2026-10-28', due: '2026-11-11', returnedAt: null },
  { id: 'EMP-10380', work: 'Kitsune Express · Vol. 4', user: 'Paulo Ikeda', start: '2026-10-30', due: '2026-11-13', returnedAt: null },
  { id: 'EMP-10395', work: 'Liga dos Faróis · #3', user: 'Marina Lopes', start: '2026-11-04', due: '2026-11-18', returnedAt: null },
  { id: 'EMP-10409', work: 'Jardim de Aço · Vol. 2', user: 'Rafael Moura', start: '2026-11-08', due: '2026-11-22', returnedAt: null },
  { id: 'EMP-10412', work: 'Maré de Tinta · Vol. 4', user: 'Lucas Almeida', start: '2026-11-09', due: '2026-11-23', returnedAt: null },
];

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function daysOverdue(due: string, reference: string): number {
  if (!isValidISODate(due) || !isValidISODate(reference)) return 0;
  return Math.max(0, Math.floor((Date.parse(`${reference}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / 86400000));
}

export function fineInCents(days: number): number {
  return Math.max(0, Math.trunc(days)) * DAILY_FINE_CENTS;
}

export function activeLateLoans(items: readonly Loan[], reference: string) {
  return items.filter(loan => !loan.returnedAt && daysOverdue(loan.due, reference) > 0)
    .map(loan => ({ ...loan, days: daysOverdue(loan.due, reference), fineCents: fineInCents(daysOverdue(loan.due, reference)) }))
    .sort((left, right) => right.days - left.days);
}

export function totalFineCents(items: readonly Loan[], reference: string): number {
  return activeLateLoans(items, reference).map(loan => loan.fineCents).reduce((acc, fine) => acc + fine, 0);
}

export function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function formatDate(iso: string): string {
  if (!isValidISODate(iso)) return iso;
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}
