'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { DemoNotice, InkoButton, InkoCover, InkoEmpty, InkoLinkButton, InkoStatus, MangaCard, PageHeading } from '../../components/inko-kit';
import { works, type Availability } from '../../lib/demo';

export default function CatalogPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todas');
  const [status, setStatus] = useState('all');
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const filtered = useMemo(() => works.filter(work =>
    (category === 'Todas' || work.category === category)
    && (status === 'all' || work.availability === status)
    && `${work.id} ${work.title} ${work.author} ${work.volume}`.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))
  ), [search, category, status]);
  return <AppShell>
    <PageHeading eyebrow="ACERVO / PESQUISA" title="Acervo" description={`${filtered.length} obras encontradas · capas e dados demonstrativos`} action={<InkoLinkButton href="/acervo/novo">+ Cadastrar obra</InkoLinkButton>}/>
    <DemoNotice>Filtros e visualizações são interativos sobre as obras fictícias do Claude. Cadastro real depende do MS Catálogo.</DemoNotice>
    <section className="inko-filter-panel" aria-label="Filtros do acervo"><label className="inko-field"><span className="inko-label">Buscar título, autor ou código</span><input value={search} onChange={event => setSearch(event.target.value)} type="search" placeholder="Título, autor ou INK-0001…"/></label>
      <label className="inko-field"><span className="inko-label">Disponibilidade</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Todas</option><option value="disp">Disponível</option><option value="emp">Emprestado</option><option value="atr">Atrasado</option></select></label>
      <div className="inko-field"><span className="inko-label">Visualização</span><div className="inko-segmented"><InkoButton variant={view === 'cards' ? 'primary' : 'ghost'} onClick={() => setView('cards')} aria-pressed={view === 'cards'}>Cards</InkoButton><InkoButton variant={view === 'table' ? 'primary' : 'ghost'} onClick={() => setView('table')} aria-pressed={view === 'table'}>Tabela</InkoButton></div></div></section>
    <fieldset className="inko-category-tabs"><legend className="sr-only">Filtrar por categoria</legend>{['Todas','Mangá','HQ','Graphic novel'].map(cat => <button className={category === cat ? 'inko-category--selected' : ''} aria-pressed={category === cat} onClick={() => setCategory(cat)} key={cat}>{cat}</button>)}</fieldset>
    {filtered.length === 0 && <InkoEmpty title="Nenhuma obra encontrada" text="Experimente outro título, autor, categoria ou disponibilidade."><InkoButton variant="outline" onClick={() => { setSearch('');setCategory('Todas');setStatus('all'); }}>Limpar filtros</InkoButton></InkoEmpty>}
    {filtered.length > 0 && view === 'cards' && <div className="inko-work-grid">{filtered.map(work => <MangaCard key={work.id} work={work}/>)}</div>}
    {filtered.length > 0 && view === 'table' && <div className="inko-table-wrap"><table className="inko-table"><thead><tr><th>Obra</th><th>Código</th><th>Autor</th><th>Categoria</th><th>Status</th></tr></thead><tbody>{filtered.map(work => <tr key={work.id}><td><Link className="inko-table-title" href={`/acervo/${work.id}`}><InkoCover work={work} compact/>{work.title} · {work.volume}</Link></td><td>{work.id}</td><td>{work.author}</td><td>{work.category}</td><td><InkoStatus status={work.availability as Availability}/></td></tr>)}</tbody></table></div>}
    <p className="inko-footnote">Mostrando {filtered.length} de {works.length} obras demonstrativas. O total de 3.842 visto no Claude é apenas ilustrativo.</p>
  </AppShell>;
}
