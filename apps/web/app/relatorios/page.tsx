'use client';

import { businessDate } from '../../lib/business-date';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../components/app-shell';
import { Icon } from '../../components/icon';
import { useToast } from '../../components/inko-interactions';
import { InkoButton, InkoEmpty, InkoErrorState, InkoInput, InkoLinkButton, PageHeading, Section } from '../../components/inko-kit';
import { FineSummary, InkoAlert, InkoSkeleton, InkoStatisticSkeleton, LoanCard } from '../../components/inko-patterns';
import { CATEGORIES, addDays, formatBRL, formatDate, parseBRDate, type Loan } from '../../lib/demo';
import { fetchFineReport, fetchStatistics, useLibrary, type FineReport, type LibraryStatistics } from '../../lib/library-api';
import styles from './relatorios.module.css';

/** Linha do relatório do serviço Java, no formato que a tabela e o LoanCard usam. */
type LateLoan = Loan & { days: number; fineCents: number };

interface ReportData { report: FineReport; stats: LibraryStatistics }

function toRows(report: FineReport, loans: readonly Loan[]): LateLoan[] {
  const byId = new Map(loans.map(loan => [loan.id, loan]));
  return report.itens.map(item => ({
    id: item.emprestimoId, workId: item.livroId, userId: item.usuarioId, work: item.titulo, user: item.nomeUsuario,
    start: byId.get(item.emprestimoId)?.start ?? item.dataPrevista, due: item.dataPrevista, returnedAt: null,
    days: item.diasAtraso, fineCents: Math.round(item.valor * 100),
  }));
}
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
  const [referenceText, setReferenceText] = useState(formatDate(businessDate()));
  const [sort, setSort] = useState<SortState>({ key: 'days', direction: 'desc' });

  const today = businessDate();
  const quickDates = [{ value: today, label: 'Hoje' }, { value: addDays(today, -7), label: 'Há 7 dias' }];
  const reference = parseBRDate(referenceText);

  const [data, setData] = useState<ReportData | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Recalcula só quando a data ou o conteúdo dos empréstimos muda, não a cada nova referência do array.
  const loansKey = useMemo(() => library.loans.map(loan => `${loan.id}:${loan.returnedAt ?? ''}`).join('|'), [library.loans]);

  useEffect(() => {
    if (!reference || library.status !== 'ok') return undefined;
    let current = true;
    setFailure(null);
    Promise.all([fetchFineReport(reference), fetchStatistics(reference)])
      .then(([report, stats]) => { if (current) setData({ report, stats }); })
      .catch((error: unknown) => { if (current) setFailure(error instanceof Error ? error.message : 'Falha ao gerar o relatório.'); });
    return () => { current = false; };
  }, [reference, attempt, loansKey, library.status]);

  const loading = reference !== null && failure === null && (data === null || data.report.referenceDate !== reference);
  const late = useMemo(() => (data && reference ? toRows(data.report, library.loans) : []), [data, reference, library.loans]);
  const rows = useMemo(() => sortRows(late, sort), [late, sort]);
  const totalCents = data ? Math.round(data.report.total * 100) : 0;
  const totalDays = data?.report.totalDiasAtraso ?? 0;
  const worst = late[0];

  const byUser = useMemo(() => {
    const counts = new Map<string, number>();
    late.forEach(loan => counts.set(loan.user, (counts.get(loan.user) ?? 0) + 1));
    const max = Math.max(1, ...counts.values());
    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'pt-BR'))
      .map(([name, count]) => ({ name, count, width: (count / max) * 100 }));
  }, [late]);

  const totalWorks = data?.stats.totalLivros ?? 0;
  const byCategory = useMemo(() => CATEGORIES.map(category => {
    const count = data?.stats.livrosPorCategoria[category] ?? 0;
    const share = totalWorks > 0 ? (count / totalWorks) * 100 : 0;
    return { category, count, share };
  }), [data, totalWorks]);

  function exportCsv() {
    if (!reference || rows.length === 0) {
      toast({ tone: 'danger', title: 'Nada para exportar', text: 'Não há multas em aberto na data de referência informada.' });
      return;
    }
    downloadCsv(buildCsv(rows, reference, totalCents), `inko-multas-${reference}.csv`);
    toast({ title: 'CSV exportado', text: `${plural(rows.length, 'empréstimo', 'empréstimos')} · referência ${formatDate(reference)}. Arquivo gerado a partir do relatório do serviço Java.` });
  }

  return <AppShell>
    <PageHeading
      title="Relatório de multas"
      description={<>Somente empréstimos <strong>ativos e atrasados</strong> na data de referência · devolvidos não entram · calculado pelo serviço de Relatórios</>}
      action={<InkoButton variant="outline" leftIcon="download" onClick={exportCsv} disabled={loading || data === null}>Exportar CSV</InkoButton>}
    />

    <section className={styles.reference} aria-label="Data de referência do relatório">
      <InkoInput
        id="ref" label="Data de referência" className={styles.referenceField} inputMode="numeric" autoComplete="off"
        placeholder="dd/mm/aaaa" maxLength={10} value={referenceText} onChange={event => setReferenceText(event.target.value)}
        error={reference ? undefined : 'Data inválida. Use dd/mm/aaaa.'}
        help="Multa = dias de atraso até a data × R$ 2,00"
      />
      <fieldset className={styles.quick}>
        <legend className="sr-only">Atalhos de data</legend>
        {quickDates.map(date => <button key={date.value} type="button" aria-pressed={reference === date.value} onClick={() => setReferenceText(formatDate(date.value))}>{date.label}</button>)}
      </fieldset>
    </section>

    {failure && <InkoErrorState title="Relatório indisponível" text={failure} onRetry={() => setAttempt(value => value + 1)}/>}

    {!failure && loading && <>
      <div className="inko-grid-stats"><InkoStatisticSkeleton/><InkoStatisticSkeleton/><InkoStatisticSkeleton/></div>
      <Section><InkoSkeleton lines={4}/></Section>
    </>}

    {!failure && !loading && data && <>
      <div className="inko-grid-stats">
        <article className={`${styles.kpi} ${styles.kpiDark}`}><span className="inko-caption">Valor total</span><strong>{formatBRL(totalCents)}</strong><small>{plural(totalDays, 'dia', 'dias')} × R$ 2,00</small></article>
        <article className={`${styles.kpi} ${styles.kpiDanger}`}><span className="inko-caption">Empréstimos atrasados</span><strong>{late.length}</strong><small>ativos com prazo vencido</small></article>
        <article className={styles.kpi}><span className="inko-caption">Maior atraso</span><strong>{worst ? plural(worst.days, 'dia', 'dias') : '—'}</strong><small>{worst?.work ?? 'Sem atrasos'}</small></article>
      </div>

      <InkoAlert tone="info" title="Como este relatório é calculado">
        Entram apenas empréstimos ativos com prazo vencido na data de referência; ao registrar a devolução, o empréstimo sai do relatório.
        O serviço Java de Relatórios aplica o pipeline filter → map → reduce sobre os empréstimos persistidos (R$ 2,00 por dia).
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
                <LoanCard loan={row} reference={reference ?? businessDate()} work={library.works.find(work => work.id === row.workId)} action={<div className={styles.mobileFine}>
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
          <span className={styles.note}>Total {totalWorks.toLocaleString('pt-BR')} obras · inclui emprestadas</span>
        </Section>

        {reference && <FineSummary rows={late} reference={reference} limit={3}/>}
      </div>
    </>}
  </AppShell>;
}
