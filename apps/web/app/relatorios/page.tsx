'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '../../components/app-shell';
import { Icon } from '../../components/icon';
import { useToast } from '../../components/inko-interactions';
import { InkoButton, InkoEmpty, InkoInput, InkoLinkButton, PageHeading, Section } from '../../components/inko-kit';
import { FineSummary, InkoAlert, InkoSkeleton, InkoStatisticSkeleton, LoanCard } from '../../components/inko-patterns';
import { CATEGORIES, DEMO_REFERENCE_DATE, activeLateLoans, formatBRL, formatDate, parseBRDate, totalFineCents } from '../../lib/demo';
import { useLibrary } from '../../lib/mock-api';
import styles from './relatorios.module.css';

/** Primeiro empréstimo da base demonstrativa: antes disso não há o que calcular. */
const MIN_REFERENCE = '2026-10-06';

const QUICK_DATES = [
  { value: DEMO_REFERENCE_DATE, label: 'Hoje · 09/11' },
  { value: '2026-11-16', label: '16/11' },
  { value: '2026-11-30', label: '30/11' },
] as const;

type LateLoan = ReturnType<typeof activeLateLoans>[number];
type SortKey = 'id' | 'work' | 'user' | 'due' | 'days' | 'fineCents';
type SortDirection = 'asc' | 'desc';
interface SortState { key: SortKey; direction: SortDirection }

const COLUMNS: readonly { key: SortKey; label: string; end?: boolean }[] = [
  { key: 'id', label: 'Código' },
  { key: 'work', label: 'Obra' },
  { key: 'user', label: 'Usuário' },
  { key: 'due', label: 'Prazo' },
  { key: 'days', label: 'Dias', end: true },
  { key: 'fineCents', label: 'Multa', end: true },
];

function compareRows(left: LateLoan, right: LateLoan, key: SortKey): number {
  const a = left[key];
  const b = right[key];
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'pt-BR');
}

function sortRows(rows: readonly LateLoan[], sort: SortState): LateLoan[] {
  const factor = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((left, right) => factor * compareRows(left, right, sort.key) || left.id.localeCompare(right.id));
}

function nextSort(current: SortState, key: SortKey): SortState {
  if (current.key === key) return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  // Colunas numéricas começam pelo maior valor, que é o que interessa na cobrança.
  return { key, direction: key === 'days' || key === 'fineCents' ? 'desc' : 'asc' };
}

function ariaSort(sort: SortState, key: SortKey): 'ascending' | 'descending' | undefined {
  if (sort.key !== key) return undefined;
  return sort.direction === 'asc' ? 'ascending' : 'descending';
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Aspas duplicadas e prefixo em células que uma planilha interpretaria como fórmula. */
function csvCell(value: string | number): string {
  const text = String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

function buildCsv(rows: readonly LateLoan[], reference: string, totalCents: number): string {
  const lines = [
    ['Código', 'Obra', 'Usuário', 'Prazo', 'Dias de atraso', 'Multa (R$)'],
    ...rows.map(row => [row.id, row.work, row.user, formatDate(row.due), row.days, (row.fineCents / 100).toFixed(2).replace('.', ',')]),
    ['Total', '', '', `Referência ${formatDate(reference)}`, rows.reduce((sum, row) => sum + row.days, 0), (totalCents / 100).toFixed(2).replace('.', ',')],
  ];
  // BOM + ponto e vírgula: abre direto em planilhas configuradas para pt-BR.
  return `﻿${lines.map(line => line.map(csvCell).join(';')).join('\r\n')}\r\n`;
}

function downloadCsv(content: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function SortHeader({ column, sort, onSort }: Readonly<{ column: (typeof COLUMNS)[number]; sort: SortState; onSort: (key: SortKey) => void }>) {
  return <th scope="col" aria-sort={ariaSort(sort, column.key)} className={column.end ? 'inko-table-end' : undefined}>
    <button type="button" className="inko-table-sort" onClick={() => onSort(column.key)}>
      {column.label}<Icon name={sort.key === column.key && sort.direction === 'asc' ? 'chevron-cima' : sortIcon(sort, column.key)} size={13}/>
    </button>
  </th>;
}

function sortIcon(sort: SortState, key: SortKey): 'chevron-baixo' | 'ordenar' {
  return sort.key === key ? 'chevron-baixo' : 'ordenar';
}

function returnHref(loanId: string): string {
  return `/devolucoes?emprestimo=${encodeURIComponent(loanId)}`;
}

export default function ReportsPage() {
  const library = useLibrary();
  const toast = useToast();
  const [referenceText, setReferenceText] = useState(formatDate(DEMO_REFERENCE_DATE));
  const [sort, setSort] = useState<SortState>({ key: 'days', direction: 'desc' });

  const parsed = parseBRDate(referenceText);
  const reference = parsed !== null && parsed >= MIN_REFERENCE ? parsed : null;

  const late = useMemo(() => (reference ? activeLateLoans(library.loans, reference) : []), [library.loans, reference]);
  const rows = useMemo(() => sortRows(late, sort), [late, sort]);
  const totalCents = reference ? totalFineCents(library.loans, reference) : 0;
  const totalDays = late.reduce((sum, loan) => sum + loan.days, 0);
  const worst = late[0];

  const byUser = useMemo(() => {
    const counts = new Map<string, number>();
    late.forEach(loan => counts.set(loan.user, (counts.get(loan.user) ?? 0) + 1));
    const max = Math.max(1, ...counts.values());
    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'pt-BR'))
      .map(([name, count]) => ({ name, count, width: (count / max) * 100 }));
  }, [late]);

  const byCategory = useMemo(() => CATEGORIES.map(category => {
    const count = library.works.filter(work => work.category === category).length;
    const share = library.works.length > 0 ? (count / library.works.length) * 100 : 0;
    return { category, count, share };
  }), [library.works]);

  function exportCsv() {
    if (!reference || rows.length === 0) {
      toast({ tone: 'danger', title: 'Nada para exportar', text: 'Não há multas em aberto na data de referência informada.' });
      return;
    }
    downloadCsv(buildCsv(rows, reference, totalCents), `inko-multas-${reference}.csv`);
    toast({ title: 'CSV exportado', text: `${plural(rows.length, 'empréstimo', 'empréstimos')} · referência ${formatDate(reference)}. Arquivo gerado neste navegador.` });
  }

  return <AppShell>
    <PageHeading
      title="Relatório de multas"
      description={<>Somente empréstimos <strong>ativos e atrasados</strong> na data de referência · devolvidos não entram · dados demonstrativos</>}
      action={<InkoButton variant="outline" leftIcon="download" onClick={exportCsv} disabled={!library.ready}>Exportar CSV</InkoButton>}
    />

    <section className={styles.reference} aria-label="Data de referência do relatório">
      <InkoInput
        id="ref" label="Data de referência" className={styles.referenceField} inputMode="numeric" autoComplete="off"
        placeholder="dd/mm/aaaa" maxLength={10} value={referenceText} onChange={event => setReferenceText(event.target.value)}
        error={reference ? undefined : 'Data inválida. Use dd/mm/aaaa (a partir de 06/10/2026).'}
        help="Multa = dias de atraso até a data × R$ 2,00"
      />
      <fieldset className={styles.quick}>
        <legend className="sr-only">Atalhos de data</legend>
        {QUICK_DATES.map(date => <button key={date.value} type="button" aria-pressed={reference === date.value} onClick={() => setReferenceText(formatDate(date.value))}>{date.label}</button>)}
      </fieldset>
    </section>

    {!library.ready && <>
      <div className="inko-grid-stats"><InkoStatisticSkeleton/><InkoStatisticSkeleton/><InkoStatisticSkeleton/></div>
      <Section><InkoSkeleton lines={4}/></Section>
    </>}

    {library.ready && <>
      <div className="inko-grid-stats">
        <article className={`${styles.kpi} ${styles.kpiDark}`}><span className="inko-caption">Valor total</span><strong>{formatBRL(totalCents)}</strong><small>{plural(totalDays, 'dia', 'dias')} × R$ 2,00</small></article>
        <article className={`${styles.kpi} ${styles.kpiDanger}`}><span className="inko-caption">Empréstimos atrasados</span><strong>{late.length}</strong><small>ativos com prazo vencido</small></article>
        <article className={styles.kpi}><span className="inko-caption">Maior atraso</span><strong>{worst ? plural(worst.days, 'dia', 'dias') : '—'}</strong><small>{worst?.work ?? 'Sem atrasos'}</small></article>
      </div>

      <InkoAlert tone="info" title="Como este relatório é calculado">
        Entram apenas empréstimos ativos com prazo vencido na data de referência; ao registrar a devolução, o empréstimo sai do relatório.
        Os valores são calculados neste navegador sobre dados fictícios — o cálculo oficial será do serviço de relatórios.
      </InkoAlert>

      <Section flush id="fines" title="Empréstimos ativos atrasados · multa individual">
        {rows.length === 0 && <InkoEmpty title="Nenhuma multa em aberto" text={reference ? `Nenhum empréstimo ativo atrasado em ${formatDate(reference)}.` : 'Informe uma data de referência válida para calcular as multas.'}/>}

        {rows.length > 0 && <>
          <div className="inko-table-wrap inko-only-desktop">
            <table className={`inko-table ${styles.table}`}>
              <caption className="sr-only">Multas por empréstimo ativo atrasado em {reference && formatDate(reference)}. Use os cabeçalhos para ordenar.</caption>
              <thead><tr>
                {COLUMNS.map(column => <SortHeader key={column.key} column={column} sort={sort} onSort={key => setSort(current => nextSort(current, key))}/>)}
                <th scope="col" className="inko-table-end"><span className="sr-only">Ações</span></th>
              </tr></thead>
              <tbody>
                {rows.map(row => <tr key={row.id}>
                  <td className={styles.code}>{row.id}</td>
                  <td><strong>{row.work}</strong></td>
                  <td>{row.user}</td>
                  <td>{formatDate(row.due)}</td>
                  <td className="inko-table-end"><span className={styles.days}><Icon name="relogio" size={13}/>{row.days}<span className="sr-only"> {row.days === 1 ? 'dia de atraso' : 'dias de atraso'}</span></span></td>
                  <td className={`inko-table-end ${styles.fine}`}>{formatBRL(row.fineCents)}</td>
                  <td className="inko-table-end"><InkoLinkButton href={returnHref(row.id)} variant="ghost" size="sm" leftIcon="devolucoes" aria-label={`Registrar devolução de ${row.work} (${row.id})`}>Registrar devolução</InkoLinkButton></td>
                </tr>)}
              </tbody>
              <tfoot><tr>
                <td colSpan={4}>Total</td>
                <td className="inko-table-end">{totalDays}</td>
                <td className={`inko-table-end ${styles.grandTotal}`}>{formatBRL(totalCents)}</td>
                <td/>
              </tr></tfoot>
            </table>
          </div>

          <div className="inko-only-mobile">
            <ul className={`inko-loan-list ${styles.mobileList}`}>
              {rows.map(row => <li key={row.id}>
                <LoanCard loan={row} reference={reference ?? DEMO_REFERENCE_DATE} work={library.works.find(work => work.id === row.workId)} action={<div className={styles.mobileFine}>
                  <strong>{formatBRL(row.fineCents)}</strong>
                  <InkoLinkButton href={returnHref(row.id)} variant="outline" size="sm" leftIcon="devolucoes" aria-label={`Registrar devolução de ${row.work} (${row.id})`}>Registrar devolução</InkoLinkButton>
                </div>}/>
              </li>)}
            </ul>
            <p className={styles.mobileTotal}><span>Total · {plural(totalDays, 'dia', 'dias')}</span><span className={styles.grandTotal}>{formatBRL(totalCents)}</span></p>
          </div>
        </>}
      </Section>

      <div className={styles.panels}>
        <Section id="by-user" title="Empréstimos atrasados por usuário" className={styles.panel}>
          {byUser.length > 0 && <ul className={styles.bars}>
            {byUser.map(user => <li key={user.name} className={styles.barRow}><span>{user.name}</span><span className={styles.track} aria-hidden="true"><span className={styles.bar} style={{ width: `${user.width}%` }}/></span><strong>{user.count}</strong></li>)}
          </ul>}
          {byUser.length === 0 && <span className={styles.muted}>Nenhum usuário com atraso nesta data.</span>}
          <span className={styles.note}>Recalcula com a data de referência</span>
        </Section>

        <Section id="by-category" title="Livros por categoria" className={styles.panel}>
          <ul className={`${styles.bars} ${styles.stacked}`}>
            {byCategory.map(item => <li key={item.category} className={styles.barStack}>
              <span><span>{item.category}</span><strong>{item.count.toLocaleString('pt-BR')} · {Math.round(item.share)}%</strong></span>
              <span className={styles.track} aria-hidden="true"><span className={styles.bar} style={{ width: `${item.share}%` }}/></span>
            </li>)}
          </ul>
          <span className={styles.note}>Total {library.works.length.toLocaleString('pt-BR')} obras · inclui emprestadas</span>
        </Section>

        {reference && <FineSummary rows={late} reference={reference} limit={3}/>}
      </div>
    </>}
  </AppShell>;
}
