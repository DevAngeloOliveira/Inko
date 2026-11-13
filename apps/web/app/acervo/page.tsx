'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { AppShell } from '../../components/app-shell';
import { Icon } from '../../components/icon';
import { useMockQuery, useToast } from '../../components/inko-interactions';
import { InkoButton, InkoCover, InkoEmpty, InkoLinkButton, InkoSearch, InkoSegmented, InkoStatus, MangaCard, PageHeading } from '../../components/inko-kit';
import { Pagination } from '../../components/inko-patterns';
import { CATEGORIES, DEMO_REFERENCE_DATE, availabilityOf, normalize, workLabel, type Availability, type Category, type Work } from '../../lib/demo';
import { useLibrary } from '../../lib/mock-api';
import styles from './acervo.module.css';

const PAGE_SIZE = 8;

type View = 'cards' | 'table';
type StatusFilter = 'all' | Availability;
type CategoryFilter = 'all' | Category;
type SortKey = 'id' | 'titulo' | 'autor';

interface CatalogRow {
  work: Work;
  status: Availability;
}

const CATEGORY_OPTIONS: readonly { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'Mangá', label: 'Mangás' },
  { value: 'HQ', label: 'HQs' },
  { value: 'Graphic novel', label: 'Graphic novels' },
];

const STATUS_LABEL: Record<Availability, string> = { disp: 'Disponível', emp: 'Emprestado', atr: 'Atrasado' };

/** Valores padrão ficam fora da URL, para que o link compartilhado seja curto. */
const DEFAULTS: Record<string, string> = { q: '', categoria: 'all', status: 'all', ver: 'cards', ordem: 'id', pagina: '1' };

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

const SORTERS: Record<SortKey, (left: Work, right: Work) => number> = {
  id: (left, right) => collator.compare(left.id, right.id),
  titulo: (left, right) => collator.compare(workLabel(left), workLabel(right)),
  autor: (left, right) => collator.compare(left.author, right.author) || collator.compare(workLabel(left), workLabel(right)),
};

function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function countLabel(total: number): string {
  return `${total} ${total === 1 ? 'obra' : 'obras'}`;
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

/** Exporta a lista filtrada como CSV gerado no próprio navegador (sem rede). */
function downloadCsv(rows: readonly CatalogRow[]): void {
  const header = ['Identificador', 'Título', 'Volume', 'Autor', 'Categoria', 'Disponibilidade'];
  const lines = rows.map(({ work, status }) => [work.id, work.title, work.volume, work.author, work.category, STATUS_LABEL[status]].map(csvCell).join(';'));
  const blob = new Blob([`﻿${[header.map(csvCell).join(';'), ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'inko-acervo.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

function SortHeader({ label, sortKey, active, onSort }: Readonly<{ label: string; sortKey: SortKey; active: SortKey; onSort: (key: SortKey) => void }>) {
  return <th aria-sort={active === sortKey ? 'ascending' : undefined}>
    <button type="button" className="inko-table-sort" onClick={() => onSort(sortKey)}>{label}<Icon name="ordenar" size={12}/></button>
  </th>;
}

function CatalogSkeleton() {
  return <>
    <output className="sr-only">Carregando acervo…</output>
    <div className="inko-work-grid" aria-hidden="true">
      {Array.from({ length: PAGE_SIZE }, (_, index) => <div key={index} className={styles.skeletonCard}>
        <span className={`${styles.skeletonCover} inko-motion-shimmer`}/>
        <span className="inko-skeleton-line inko-motion-shimmer" style={{ width: '45%' }}/>
        <span className="inko-skeleton-line inko-skeleton-line--lg inko-motion-shimmer" style={{ width: '85%' }}/>
        <span className="inko-skeleton-line inko-motion-shimmer" style={{ width: '60%' }}/>
      </div>)}
    </div>
  </>;
}

function Catalog() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const library = useLibrary();
  const toast = useToast();
  const { loading } = useMockQuery(600);

  // A busca tem estado local: escrever direto na URL atrasaria a digitação.
  const [query, setQuery] = useState(() => params.get('q') ?? '');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const category = oneOf<CategoryFilter>(params.get('categoria'), ['all', ...CATEGORIES], 'all');
  const status = oneOf<StatusFilter>(params.get('status'), ['all', 'disp', 'emp', 'atr'], 'all');
  const view = oneOf<View>(params.get('ver'), ['cards', 'table'], 'cards');
  const sort = oneOf<SortKey>(params.get('ordem'), ['id', 'titulo', 'autor'], 'id');
  const requestedPage = Math.max(1, Number.parseInt(params.get('pagina') ?? '1', 10) || 1);

  const rows = useMemo(() => {
    const term = normalize(query.trim());
    return library.works
      .map(work => ({ work, status: availabilityOf(library.loans, work.id, DEMO_REFERENCE_DATE) }))
      .filter(row => (category === 'all' || row.work.category === category)
        && (status === 'all' || row.status === status)
        && (!term || normalize(`${row.work.title} ${row.work.volume} ${row.work.author} ${row.work.id}`).includes(term)))
      .sort((left, right) => SORTERS[sort](left.work, right.work));
  }, [library.works, library.loans, query, category, status, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pages);
  const first = (page - 1) * PAGE_SIZE;
  const visible = rows.slice(first, first + PAGE_SIZE);
  const filtered = query.trim() !== '' || category !== 'all' || status !== 'all';
  const hiddenFilters = (status === 'all' ? 0 : 1) + (sort === 'id' ? 0 : 1);
  const busy = loading || !library.ready;

  /** Grava filtros na URL; qualquer mudança que não seja de página volta para a primeira. */
  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    if (!('pagina' in changes)) next.delete('pagina');
    for (const [key, value] of Object.entries(changes)) {
      if (value === DEFAULTS[key]) next.delete(key);
      else next.set(key, value);
    }
    const search = next.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  function handleQuery(value: string) {
    setQuery(value);
    update({ q: value.trim() });
  }

  function clearFilters() {
    setQuery('');
    update({ q: '', categoria: 'all', status: 'all' });
  }

  function handleExport() {
    downloadCsv(rows);
    toast({ title: 'Exportação concluída', text: `${countLabel(rows.length)} em inko-acervo.csv.` });
  }

  return <>
    <PageHeading title="Acervo" description={`${countLabel(library.works.length)} · capas e dados demonstrativos`} action={<>
      <InkoButton variant="outline" leftIcon="download" className="inko-only-desktop" disabled={busy || rows.length === 0} onClick={handleExport}>Exportar</InkoButton>
      <InkoLinkButton href="/acervo/novo" leftIcon="mais">Cadastrar obra</InkoLinkButton>
    </>}/>

    <div className={styles.toolbar}>
      <div className={styles.searchWrap}>
        <InkoSearch label="Buscar por título, autor ou identificador" placeholder="Título, autor ou identificador…" value={query} onChange={event => handleQuery(event.target.value)}/>
        <button type="button" className={`${styles.filterButton} inko-only-mobile`} aria-expanded={filtersOpen} aria-controls="acervo-filtros" aria-label={`Filtros (${hiddenFilters} ${hiddenFilters === 1 ? 'ativo' : 'ativos'})`} onClick={() => setFiltersOpen(open => !open)}>
          <Icon name="filtro" size={18}/>{hiddenFilters > 0 && <span className={styles.filterDot} aria-hidden="true"/>}
        </button>
      </div>
      <fieldset className={styles.categories}>
        <legend className="sr-only">Categoria</legend>
        {CATEGORY_OPTIONS.map(option => <button key={option.value} type="button" className={styles.chip} aria-pressed={category === option.value} onClick={() => update({ categoria: option.value })}>{option.label}</button>)}
      </fieldset>
      <div id="acervo-filtros" className={styles.filters} data-open={filtersOpen}>
        <span className={`inko-control inko-control--select ${styles.select}`}>
          <select className="inko-input" aria-label="Disponibilidade" value={status} onChange={event => update({ status: event.target.value })}>
            <option value="all">Toda disponibilidade</option>
            <option value="disp">Disponível</option>
            <option value="emp">Emprestado</option>
            <option value="atr">Atrasado</option>
          </select>
          <Icon name="chevron-baixo" size={18}/>
        </span>
        <span className={`inko-control inko-control--select ${styles.select}`}>
          <select className="inko-input" aria-label="Ordenar por" value={sort} onChange={event => update({ ordem: event.target.value })}>
            <option value="id">Ordenar por identificador</option>
            <option value="titulo">Ordenar por título</option>
            <option value="autor">Ordenar por autor</option>
          </select>
          <Icon name="chevron-baixo" size={18}/>
        </span>
      </div>
      <div className={`${styles.viewSwitch} inko-only-desktop`}>
        <InkoSegmented<View> label="Visualização" value={view} onChange={value => update({ ver: value })} options={[{ value: 'cards', label: 'Cards', icon: 'cards' }, { value: 'table', label: 'Tabela', icon: 'tabela' }]}/>
      </div>
    </div>

    {busy && <CatalogSkeleton/>}

    {!busy && rows.length === 0 && <div className={styles.emptyPanel}>
      <InkoEmpty title="Nenhuma obra encontrada" text="Revise a busca e os filtros, ou cadastre uma nova obra.">
        <div className="inko-actions">
          {filtered && <InkoButton variant="outline" onClick={clearFilters}>Limpar filtros</InkoButton>}
          <InkoLinkButton href="/acervo/novo" variant={filtered ? 'ghost' : 'primary'} leftIcon="mais">Cadastrar obra</InkoLinkButton>
        </div>
      </InkoEmpty>
    </div>}

    {!busy && rows.length > 0 && <ul className={`${styles.mobileList} inko-only-mobile`}>
      {visible.map(({ work, status: availability }) => <li key={work.id}>
        <Link href={`/acervo/${work.id}`} className={styles.mobileItem}>
          <InkoCover work={work} size="sm"/>
          <span className={styles.mobileText}>
            <strong>{workLabel(work)}</strong>
            <span className={styles.mobileMeta}>{work.author} · {work.id}</span>
            <InkoStatus status={availability}/>
          </span>
          <Icon name="chevron-direita" size={18}/>
        </Link>
      </li>)}
    </ul>}

    {!busy && rows.length > 0 && view === 'cards' && <div className="inko-work-grid inko-only-desktop inko-motion-enter">
      {visible.map(({ work, status: availability }) => <MangaCard key={work.id} work={work} status={availability}/>)}
    </div>}

    {!busy && rows.length > 0 && view === 'table' && <div className={`${styles.tablePanel} inko-table-wrap inko-only-desktop inko-motion-enter`}>
      <table className={`inko-table ${styles.table}`}>
        <caption className="sr-only">Obras do acervo</caption>
        <thead><tr>
          <SortHeader label="ID" sortKey="id" active={sort} onSort={key => update({ ordem: key })}/>
          <SortHeader label="Obra" sortKey="titulo" active={sort} onSort={key => update({ ordem: key })}/>
          <SortHeader label="Autor" sortKey="autor" active={sort} onSort={key => update({ ordem: key })}/>
          <th>Categoria</th>
          <th>Disponibilidade</th>
        </tr></thead>
        <tbody>
          {visible.map(({ work, status: availability }) => <tr key={work.id}>
            <td className="inko-muted">{work.id}</td>
            <td><Link href={`/acervo/${work.id}`} className="inko-table-work"><InkoCover work={work} size="xs"/><strong>{work.title}</strong>{work.volume && <span>{work.volume}</span>}</Link></td>
            <td>{work.author}</td>
            <td>{work.category}</td>
            <td><InkoStatus status={availability}/></td>
          </tr>)}
        </tbody>
      </table>
    </div>}

    {!busy && rows.length > 0 && <div className={styles.footer}>
      <output>Mostrando {first + 1}–{first + visible.length} de {countLabel(rows.length)}{filtered && ` · ${library.works.length} no acervo`}</output>
      <Pagination page={page} pages={pages} onChange={value => update({ pagina: String(value) })}/>
    </div>}
  </>;
}

export default function CatalogPage() {
  return <AppShell>
    {/* `useSearchParams` exige um limite de Suspense para a página ser pré-renderizada. */}
    <Suspense fallback={<CatalogSkeleton/>}>
      <Catalog/>
    </Suspense>
  </AppShell>;
}
