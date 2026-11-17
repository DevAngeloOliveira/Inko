'use client';

import Image from 'next/image';
import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { Icon } from '../../components/icon';
import { InkoBadge, InkoCover } from '../../components/inko-kit';
import { CATEGORIES, type Category, type Work } from '../../lib/demo';
import { ANIME, CAMPAIGNS, COLLECTIONS, GENRES, collectionById, type Campaign, type EditorialFilter } from '../../lib/editorial';
import { fetchPublicCatalog, type PublicCatalog } from '../../lib/library-api';
import styles from './landing.module.css';

/* ---------- Topo ---------- */

const SECTIONS = [
  { href: '#inicio', label: 'Início' },
  { href: '#acervo', label: 'Explorar acervo' },
  { href: '#colecoes', label: 'Coleções' },
  { href: '#plataforma', label: 'A plataforma' },
  { href: '#como', label: 'Como funciona' },
] as const;

export function LandingHeader() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const close = () => setOpen(false);

  return <header className={`${styles.dark} ${styles.topbar}`}>
    <div className={`${styles.container} ${styles.topbarInner}`}>
      <Link href="/landing" aria-label="INKO — início" className={styles.logoLink}>
        <Image src="/inko/logo/inko-logo-inverse.png" alt="INKO" width={900} height={665} sizes="124px" priority className={styles.logo}/>
      </Link>
      <button type="button" className={styles.menuButton} aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(value => !value)}>
        <Icon name={open ? 'fechar' : 'menu'} size={20}/>Menu
      </button>
      <div id={menuId} className={open ? `${styles.menu} ${styles.menuOpen}` : styles.menu}>
        <nav aria-label="Seções" className={styles.nav}>
          {SECTIONS.map(section => <a key={section.href} href={section.href} className={styles.navLink} onClick={close}>{section.label}</a>)}
        </nav>
        <div className={styles.topActions}>
          <Link href="/login" className={`${styles.btn} ${styles.btnSm} ${styles.btnPrimary}`}>Entrar</Link>
        </div>
      </div>
    </div>
  </header>;
}

/* ---------- Estado compartilhado da vitrine ---------- */

interface ShowcaseFilter extends EditorialFilter {
  genre?: string;
}

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ok'; data: PublicCatalog };

interface CatalogContextValue {
  state: LoadState;
  filter: ShowcaseFilter;
  applyFilter: (filter: ShowcaseFilter, scroll?: boolean) => void;
  reload: () => void;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

function useCatalog(): CatalogContextValue {
  const value = useContext(CatalogContext);
  if (!value) throw new Error('CatalogProvider ausente');
  return value;
}

/** Busca obras e disponibilidade nos serviços reais uma vez; falhas aparecem como erro, nunca como dados fictícios. */
export function CatalogProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [filter, setFilter] = useState<ShowcaseFilter>({});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    setState({ status: 'loading' });
    fetchPublicCatalog()
      .then(data => { if (current) setState({ status: 'ok', data }); })
      .catch((error: unknown) => {
        if (current) setState({ status: 'error', message: error instanceof Error ? error.message : 'Catálogo indisponível.' });
      });
    return () => { current = false; };
  }, [attempt]);

  const applyFilter = useCallback((next: ShowcaseFilter, scroll = true) => {
    setFilter(next);
    if (scroll) document.getElementById('acervo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
  const reload = useCallback(() => setAttempt(value => value + 1), []);
  const value = useMemo(() => ({ state, filter, applyFilter, reload }), [state, filter, applyFilter, reload]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

function matches(work: Work, filter: ShowcaseFilter): boolean {
  if (filter.category && work.category !== filter.category) return false;
  if (filter.genre && !work.genres?.includes(filter.genre)) return false;
  if (filter.collection && !collectionById(filter.collection)?.works.includes(work.id)) return false;
  return true;
}

function filterLabel(filter: ShowcaseFilter): string | null {
  if (filter.collection) return collectionById(filter.collection)?.title ?? null;
  if (filter.genre) return filter.genre;
  return null;
}

/* ---------- Vitrine do acervo ---------- */

const PAGE_SIZE = 12;
const CATEGORY_TABS: readonly { value: Category | 'all'; label: string }[] = [
  { value: 'all', label: 'Tudo' },
  ...CATEGORIES.map(category => ({ value: category, label: category === 'Mangá' ? 'Mangás' : `${category}s` })),
];

function WorkCard({ work, onLoan }: Readonly<{ work: Work; onLoan: boolean }>) {
  return <article className={styles.work}>
    <div className={styles.workCover}><InkoCover work={work}/></div>
    <div className={styles.workMeta}>
      <span className="inko-caption">{work.category} · {work.volume || 'Volume único'}</span>
      <h3>{work.title}</h3>
      <span className={styles.workAuthor}>{work.author}</span>
      {work.genres && <ul className={styles.genreTags} aria-label="Gêneros">{work.genres.slice(0, 2).map(genre => <li key={genre}>{genre}</li>)}</ul>}
      <div className={styles.workFoot}>
        {!onLoan && <InkoBadge tone="success" icon="check-circulo">Na estante</InkoBadge>}
        {onLoan && <InkoBadge tone="info" icon="emprestimos">Emprestado</InkoBadge>}
        <Link href={`/acervo/${work.id}`} className={styles.workLink} aria-label={`Ver detalhes de ${work.title}`}>Detalhes<Icon name="seta" size={14}/></Link>
      </div>
    </div>
  </article>;
}

function ShowcaseSkeleton() {
  return <ul className={styles.works} aria-hidden="true">
    {Array.from({ length: 6 }, (_, index) => <li key={index}><div className={`${styles.work} ${styles.workSkeleton}`}>
      <div className={`${styles.workCover} inko-motion-shimmer`}/>
      <div className={styles.workMeta}><span className="inko-skeleton-line inko-motion-shimmer"/><span className="inko-skeleton-line inko-skeleton-line--lg inko-motion-shimmer"/></div>
    </div></li>)}
  </ul>;
}

export function CatalogShowcase() {
  const { state, filter, applyFilter, reload } = useCatalog();
  const [limit, setLimit] = useState(PAGE_SIZE);
  const panelId = useId();
  const category = filter.category ?? 'all';
  const extra = filterLabel(filter);

  useEffect(() => { setLimit(PAGE_SIZE); }, [filter]);

  const visible = state.status === 'ok' ? state.data.works.filter(work => matches(work, filter)) : [];

  return <section id="acervo" aria-labelledby="ac-t" className={`${styles.container} ${styles.showcase}`}>
    <div className={styles.showcaseHead}>
      <div className={styles.showcaseIntro}>
        <div className={styles.brushLabel}>
          <svg aria-hidden="true" focusable="false" viewBox="0 0 300 48" preserveAspectRatio="none"><g filter="url(#inko-ink-rough)"><path d="M8 12C60 5 150 3 230 6c30 1 52 0 66 5-6 7 2 15-3 22-38 9-120 8-190 10-38 1-74 2-100-3 6-8-2-17 3-23Z"/></g></svg>
          <span>Explorar o acervo</span>
        </div>
        <h2 id="ac-t" className={styles.h2}>Universos que você conhece. Histórias que ainda vai descobrir.</h2>
        <p className={styles.lead}>Obras e disponibilidade lidas agora do Catálogo e da Circulação do INKO.</p>
      </div>
      <div role="tablist" aria-label="Filtrar por categoria" className={styles.cats}>
        {CATEGORY_TABS.map(item => <button key={item.value} type="button" role="tab" aria-selected={category === item.value} aria-controls={panelId}
          onClick={() => applyFilter(item.value === 'all' ? {} : { category: item.value }, false)}>{item.label}</button>)}
      </div>
    </div>

    {extra && <p className={styles.activeFilter}>
      <span>Mostrando: <strong>{extra}</strong></span>
      <button type="button" onClick={() => applyFilter({ category: filter.category }, false)}><Icon name="fechar" size={14}/>Limpar</button>
    </p>}

    <div id={panelId} aria-live="polite" aria-busy={state.status === 'loading'}>
      {state.status === 'loading' && <ShowcaseSkeleton/>}
      {state.status === 'error' && <div className={styles.stateBox} role="alert">
        <strong>Catálogo indisponível</strong>
        <span>{state.message}</span>
        <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnInkSolid}`} onClick={reload}>Tentar novamente</button>
      </div>}
      {state.status === 'ok' && visible.length === 0 && <div className={styles.stateBox}>
        <strong>Nenhuma obra neste recorte</strong>
        <span>Experimente outra categoria, gênero ou coleção.</span>
      </div>}
      {state.status === 'ok' && visible.length > 0 && <>
        <ul className={`${styles.works} inko-motion-swap`} aria-label="Obras do acervo" key={JSON.stringify(filter)}>
          {visible.slice(0, limit).map(work => <li key={work.id}><WorkCard work={work} onLoan={state.data.onLoan.has(work.id)}/></li>)}
        </ul>
        <div className={styles.showcaseFoot}>
          <span>{Math.min(limit, visible.length)} de {visible.length} {visible.length === 1 ? 'obra' : 'obras'}</span>
          {limit < visible.length && <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnOutlineInk}`} onClick={() => setLimit(value => value + PAGE_SIZE)}>Ver mais obras</button>}
        </div>
      </>}
    </div>
    <p className={styles.finePrint}>Capas ilustrativas criadas pelo INKO: nenhuma arte original de editoras é reproduzida. Ao entrar, cada obra mostra prazo, histórico e empréstimo ativo.</p>
  </section>;
}

/* ---------- Campanhas editoriais ---------- */

function CampaignBanner({ campaign, titles }: Readonly<{ campaign: Campaign; titles: readonly string[] }>) {
  const { applyFilter } = useCatalog();
  return <article className={`${styles.campaign} ${styles[`tone${campaign.tone[0].toUpperCase()}${campaign.tone.slice(1)}`]}`}>
    <div className={styles.campaignInk} aria-hidden="true"/>
    <span className={styles.campaignLabel}>{campaign.label}</span>
    <h3>{campaign.title}</h3>
    <p>{campaign.text}</p>
    <ul className={styles.campaignTitles} aria-label="Destaques">{titles.map(title => <li key={title}>{title}</li>)}</ul>
    <button type="button" className={styles.campaignCta} onClick={() => applyFilter(campaign.filter)}>{campaign.cta}<Icon name="seta" size={16}/></button>
  </article>;
}

export function CampaignBanners() {
  const { state } = useCatalog();
  const titles = (ids: readonly string[]) => state.status === 'ok'
    ? ids.map(id => state.data.works.find(work => work.id === id)?.title).filter((title): title is string => Boolean(title))
    : [];

  return <section aria-labelledby="cp-t" className={`${styles.container} ${styles.campaigns}`}>
    <div className={styles.sectionHead}>
      <span className={styles.kicker}>Curadoria INKO</span>
      <h2 id="cp-t" className={styles.h2}>Toda grande aventura começa com uma página.</h2>
    </div>
    <div className={styles.campaignGrid}>
      {CAMPAIGNS.map(campaign => <CampaignBanner key={campaign.id} campaign={campaign} titles={titles(campaign.works)}/>)}
    </div>
    <p className={styles.finePrint}>Seleções editoriais do INKO, sem patrocínio nem vínculo com editoras ou detentores dos direitos.</p>
  </section>;
}

/* ---------- Descoberta por gênero ---------- */

export function GenreNavigation() {
  const { state, applyFilter } = useCatalog();
  const count = (genre: string) => state.status === 'ok' ? state.data.works.filter(work => work.genres?.includes(genre)).length : null;

  return <section aria-labelledby="gn-t" className={`${styles.container} ${styles.genres}`}>
    <div className={styles.sectionHead}>
      <span className={styles.kicker}>Descubra sua próxima obsessão</span>
      <h2 id="gn-t" className={styles.h2}>Explore por gênero.</h2>
    </div>
    <ul className={styles.genreGrid}>
      {GENRES.map((genre, index) => {
        const total = count(genre);
        return <li key={genre}><button type="button" className={styles.genreTile} onClick={() => applyFilter({ genre })}>
          <span className={styles.genreIndex} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          <strong>{genre}</strong>
          <span>{total === null ? '…' : `${total} ${total === 1 ? 'obra' : 'obras'}`}</span>
        </button></li>;
      })}
    </ul>
  </section>;
}

/* ---------- Coleções temáticas e adaptações ---------- */

export function CollectionsShowcase() {
  const { state, applyFilter } = useCatalog();
  const worksOf = (ids: readonly string[]) => state.status === 'ok' ? state.data.works.filter(work => ids.includes(work.id)) : [];

  return <section id="colecoes" aria-labelledby="cl-t" className={`${styles.container} ${styles.collections}`}>
    <div className={styles.sectionHead}>
      <span className={styles.kicker}>Coleções</span>
      <h2 id="cl-t" className={styles.h2}>Seus universos favoritos, reunidos em um só lugar.</h2>
    </div>
    <ul className={styles.collectionGrid}>
      {COLLECTIONS.map(collection => {
        const works = worksOf(collection.works);
        return <li key={collection.id}><button type="button" className={styles.collection} onClick={() => applyFilter({ collection: collection.id })}>
          <span className={styles.collectionCovers} aria-hidden="true">
            {works.slice(0, 3).map(work => <span key={work.id}><InkoCover work={work} size="sm"/></span>)}
          </span>
          <strong>{collection.title}</strong>
          <span>{collection.description}</span>
          <small>{state.status === 'ok' ? `${works.length} obras no acervo` : 'Carregando…'}</small>
        </button></li>;
      })}
    </ul>
  </section>;
}

export function AnimeAdaptations() {
  const { state, applyFilter } = useCatalog();
  const titleOf = (id: string) => state.status === 'ok' ? state.data.works.find(work => work.id === id)?.title : undefined;

  return <section aria-labelledby="an-t" className={`${styles.dark} ${styles.anime}`}>
    <div className={styles.container}>
      <div className={styles.sectionHead}>
        <span className={`${styles.kicker} ${styles.kickerLight}`}>Do mangá ao anime</span>
        <h2 id="an-t" className={styles.h2}>Mais que livros. Universos inteiros.</h2>
        <p className={styles.leadLight}>Adaptações conhecidas e o mangá que lhes deu origem. O INKO empresta o volume impresso; a série animada aparece só como referência.</p>
      </div>
      <ul className={styles.animeList}>
        {ANIME.map(item => <li key={item.id}>
          <strong>{item.title}</strong>
          <span>{item.studios.join(' e ')} · {item.year}</span>
          <small>Mangá: {titleOf(item.mangaId) ?? item.mangaId}</small>
        </li>)}
      </ul>
      <button type="button" className={`${styles.btn} ${styles.btnOutlineLight}`} onClick={() => applyFilter({ collection: 'manga-anime' })}>Ver os mangás no acervo<Icon name="seta" size={18}/></button>
    </div>
  </section>;
}

/* ---------- Produto em ação ---------- */

const SCREENS = [
  { id: 'dashboard', label: 'Dashboard', text: 'Empréstimos ativos, atrasos e movimentações do dia.' },
  { id: 'acervo', label: 'Catálogo', text: 'Busca, filtros por categoria e disponibilidade de cada obra.' },
  { id: 'emprestimos', label: 'Empréstimos', text: 'Fluxo guiado que bloqueia obras já emprestadas.' },
  { id: 'devolucoes', label: 'Devoluções', text: 'Conferência, data efetiva e multa calculada na hora.' },
  { id: 'relatorios', label: 'Relatórios', text: 'Multas e estatísticas calculadas pelo serviço Java.' },
] as const;

export function ProductPreview() {
  const [active, setActive] = useState<(typeof SCREENS)[number]['id']>('dashboard');
  const tabsId = useId();
  const screen = SCREENS.find(item => item.id === active) ?? SCREENS[0];

  return <div className={styles.product}>
    <div role="tablist" aria-label="Telas do INKO" className={styles.productTabs}>
      {SCREENS.map(item => <button key={item.id} id={`${tabsId}-${item.id}`} type="button" role="tab" aria-selected={active === item.id}
        aria-controls={`${tabsId}-panel`} onClick={() => setActive(item.id)}>{item.label}</button>)}
    </div>
    <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${screen.id}`} className={styles.productPanel}>
      <figure className={styles.productFrame}>
        <Image key={screen.id} src={`/inko/landing/${screen.id}.jpg`} alt={`Tela de ${screen.label} do INKO com dados de demonstração`}
          width={1541} height={784} sizes="(max-width: 900px) 100vw, 880px" className={`${styles.productShot} inko-motion-swap`}/>
        <figcaption>{screen.text}</figcaption>
      </figure>
    </div>
  </div>;
}
