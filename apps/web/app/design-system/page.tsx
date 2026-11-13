import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { AppShell } from '../../components/app-shell';
import { Icon, type IconName } from '../../components/icon';
import { Enso, InkoBadge, InkoLinkButton, MangaCard, PageHeading, SeigaihaBand, WashiTexture } from '../../components/inko-kit';
import { CirculationCycle, CollectionCard, EditorialBanner, FineSummary, LoanCard } from '../../components/inko-patterns';
import { DEMO_REFERENCE_DATE, activeLateLoans, availabilityOf, daysOverdue, fineInCents, formatBRL, formatDate, loans, works } from '../../lib/demo';
import styles from './design-system.module.css';
import { Block, CoreShowcase, DataShowcase } from './showcase';

export const metadata: Metadata = {
  title: 'Design System',
  description: 'Documentação viva do Design System INKO: marca, fundamentos, componentes e diretrizes.',
};

const toc = [
  { id: 'marca', number: '00', label: 'Marca' },
  { id: 'cores', number: '01', label: 'Cores & tokens' },
  { id: 'tipografia', number: '01', label: 'Tipografia' },
  { id: 'layout', number: '01', label: 'Espaço & motion' },
  { id: 'graficos', number: '01', label: 'Gráficos & ícones' },
  { id: 'core', number: '02', label: 'Buttons & Forms' },
  { id: 'dados', number: '02', label: 'Data & feedback' },
  { id: 'dominio', number: '02', label: 'Componentes INKO' },
  { id: 'diretrizes', number: '07', label: 'Diretrizes' },
] as const;

function Group({ id, eyebrow, title, lead, children }: Readonly<{ id: string; eyebrow: string; title: string; lead?: ReactNode; children: ReactNode }>) {
  return <section id={id} className={styles.group} aria-labelledby={`${id}-titulo`}>
    <header className={styles.groupHead}><span className="inko-eyebrow">{eyebrow}</span><h2 id={`${id}-titulo`}>{title}</h2>{lead && <p>{lead}</p>}</header>
    {children}
  </section>;
}

/* ---------- 00 · Marca ---------- */

const concepts = [
  { number: '01', title: 'Sumi-e', text: 'Traço orgânico, espaço negativo, Enso aberto e selo vermelho. Define a assinatura: marca, banners, login e momentos editoriais.' },
  { number: '02', title: 'Manga Editorial', text: 'Quadros, diagonais, retículas e linhas de movimento — em doses controladas: banners, onboarding, estados vazios e capas.' },
  { number: '03', title: 'Modern SaaS', text: 'Tabelas, formulários e fluxos sem ornamento: hierarquia tipográfica, contorno em vez de sombra, estados explícitos, WCAG 2.2 AA.' },
] as const;

const logos = [
  { file: 'inko-logo.png', name: 'Primária', use: 'Washi / superfícies claras', surface: styles.logoPaper },
  { file: 'inko-logo-inverse.png', name: 'Inversa', use: 'sidebar e fundos Sumi', surface: styles.logoInk },
  { file: 'inko-logo-mono.png', name: 'Monocromática', use: 'carimbo, impressão 1 cor', surface: styles.logoMono },
] as const;

const logoDonts = [
  'Recompor “INKO” com uma fonte digitada',
  'Adicionar tagline ou slogan ao lockup',
  'Gradientes coloridos, neon ou brilho',
  'Distorcer, rotacionar ou recolorir o Enso',
  'Aplicar sobre fotos ou retículas densas',
  'Separar o selo 印 e usá-lo como ícone solto',
] as const;

function Logo({ file, alt, className }: Readonly<{ file: string; alt: string; className?: string }>) {
  return <Image src={`/inko/logo/${file}`} alt={alt} width={900} height={665} sizes="240px" className={className}/>;
}

function BrandSection() {
  return <Group id="marca" eyebrow="00 · Cover & Brand" title="Marca" lead="Sistema de gestão de biblioteca de mangás, HQs e graphic novels.">
    <div className={styles.cover}>
      <WashiTexture/>
      <Enso size={280} className={styles.coverEnso}/>
      <div className={styles.coverText}>
        <Logo file="inko-logo.png" alt="INKO" className={styles.coverLogo}/>
        <span className="inko-eyebrow inko-eyebrow--brown">Identidade visual · v1.0</span>
        <p>Uma linguagem editorial japonesa — tinta Sumi-e, enquadramentos de mangá e o vermelho do selo hanko — aplicada sobre uma arquitetura de interface administrativa clara, densa e acessível.</p>
      </div>
    </div>

    <div className={styles.grid3}>{concepts.map(concept => <article key={concept.number} className={`inko-section ${styles.concept}`}>
      <span className={styles.conceptNumber}>{concept.number}</span><h3>{concept.title}</h3><p>{concept.text}</p>
    </article>)}</div>

    <Block name="Logo & variações" props="/inko/logo/*.png" note={<>Asset raster extraído da arte original (fundo removido). <strong>Não é um vetor editável</strong> — o redesenho vetorial fiel do lettering é um entregável pendente; até lá, use estes PNGs com ≥ 2× o tamanho exibido.</>}>
      <div className={styles.grid3}>{logos.map(logo => <figure key={logo.file} className={styles.logoTile}>
        <div className={`${styles.logoSurface} ${logo.surface}`}><Logo file={logo.file} alt={`Logotipo INKO, versão ${logo.name.toLowerCase()}`}/></div>
        <figcaption><strong>{logo.name}</strong> · {logo.use}</figcaption>
      </figure>)}</div>
    </Block>

    <div className={styles.grid3}>
      <Block name="Área de proteção" note="x = altura do selo 印. Nenhum elemento entra nessa margem.">
        <div className={styles.clearSpace}><Logo file="inko-logo.png" alt=""/></div>
      </Block>
      <Block name="Tamanhos mínimos" note="Abaixo disso, os painéis e o selo viram ruído. Favicon e app icon exigem o redesenho vetorial.">
        <div className={styles.minSizes}>
          <figure><Logo file="inko-logo.png" alt="" className={styles.logo120}/><figcaption>Completo · 120 px</figcaption></figure>
          <figure><Logo file="inko-logo.png" alt="" className={styles.logo88}/><figcaption>Sidebar · 88 px</figcaption></figure>
        </div>
      </Block>
      <Block name="Não fazer">
        <ul className={styles.dontList}>{logoDonts.map(item => <li key={item}><Icon name="fechar" size={16}/>{item}</li>)}</ul>
      </Block>
    </div>
  </Group>;
}

/* ---------- 01 · Cores & tokens ---------- */

interface Swatch {
  name: string;
  token: string;
  hex: string;
  use?: string;
}

const brandColors: readonly Swatch[] = [
  { name: 'Sumi Black', token: 'brand-ink', hex: '#111111', use: 'Texto principal, sidebar, traço da marca' },
  { name: 'Washi Paper', token: 'brand-paper', hex: '#F7F3ED', use: 'Fundo principal e superfícies claras' },
  { name: 'Hanko Red', token: 'brand-seal', hex: '#C43B2F', use: 'Ação primária, item ativo, destaques' },
];

const secondaryColors: readonly Swatch[] = [
  { name: 'Ink Brown', token: 'neutral-brown', hex: '#5B4636' },
  { name: 'Sand', token: 'neutral-sand', hex: '#E8D9C5' },
  { name: 'Mist Gray', token: 'neutral-gray', hex: '#9CA3AF' },
  { name: 'Graphite', token: 'neutral-graphite', hex: '#2D3748' },
];

const semanticColors = [
  { name: 'Success', key: 'success', fg: '#2F6B4F', bg: '#E3EEE6', border: '#9CC3AE', example: 'Disponível', icon: 'check-circulo' },
  { name: 'Warning', key: 'warning', fg: '#7A4E00', bg: '#F8EBCF', border: '#E0B867', example: 'Vence em 2 dias', icon: 'relogio' },
  { name: 'Danger', key: 'danger', fg: '#9B1C2E', bg: '#F6E1E3', border: '#D99AA3', example: 'Atrasado', icon: 'alerta' },
  { name: 'Info', key: 'info', fg: '#2B5C8A', bg: '#E2EAF3', border: '#9DB7D3', example: 'Emprestado', icon: 'emprestimos' },
  { name: 'Disabled', key: 'disabled', fg: '#8A8279', bg: '#ECE6DD', border: '#D5CABB', example: 'Indisponível', icon: 'cadeado' },
] as const satisfies readonly { name: string; key: string; fg: string; bg: string; border: string; example: string; icon: IconName }[];

const semanticTokens = [
  { token: 'background-default', hex: '#F7F3ED', note: 'brand.paper' },
  { token: 'background-subtle', hex: '#EFE8DD', note: 'Cabeçalhos de tabela, faixas' },
  { token: 'surface-default', hex: '#FFFDF9', note: 'Cards, inputs, tabelas' },
  { token: 'surface-elevated', hex: '#FFFFFF', note: 'Modais, menus, toasts' },
  { token: 'surface-inverse', hex: '#111111', note: 'Sidebar, tooltip' },
  { token: 'text-primary', hex: '#111111', note: '17,1:1 sobre Washi' },
  { token: 'text-secondary', hex: '#6B6158', note: '5,5:1 · metadados, legendas' },
  { token: 'text-inverse', hex: '#F7F3ED', note: 'Sobre ink / sidebar' },
  { token: 'text-disabled', hex: '#8A8279', note: 'Isento (WCAG 1.4.3)' },
  { token: 'border-default', hex: '#E2D6C4', note: 'Divisórias decorativas' },
  { token: 'border-strong', hex: '#8C7B68', note: 'Contorno de controles · 3,7:1' },
  { token: 'action-primary', hex: '#C43B2F', note: 'Branco sobre = 5,2:1' },
  { token: 'action-primary-hover', hex: '#A8302A', note: '6,7:1' },
  { token: 'action-primary-pressed', hex: '#8E2721', note: '8,6:1' },
  { token: 'focus-ring', hex: '#111111', note: '2px + offset 2px · inverso #F7F3ED' },
] as const;

/** Amostra pintada pelo token real; o HEX ao lado é só rótulo de documentação. */
function Chip({ token, className = '' }: Readonly<{ token: string; className?: string }>) {
  return <span className={`${styles.chip} ${className}`.trim()} style={{ background: `var(--inko-${token})` }} aria-hidden="true"/>;
}

function SwatchCard({ swatch, large = false }: Readonly<{ swatch: Swatch; large?: boolean }>) {
  return <article className={styles.swatch}>
    <Chip token={swatch.token} className={large ? styles.chipLarge : styles.chipMedium}/>
    <div className={styles.swatchBody}>
      <strong>{swatch.name}</strong>
      <code>--inko-{swatch.token}</code>
      <span className="inko-tabular">{swatch.hex}</span>
      {swatch.use && <span className="inko-muted">{swatch.use}</span>}
    </div>
  </article>;
}

function SemanticExample({ color }: Readonly<{ color: (typeof semanticColors)[number] }>) {
  if (color.key === 'disabled') return <span className={`inko-badge ${styles.badgeDisabled}`}><Icon name={color.icon} size={13}/>{color.example}</span>;
  return <InkoBadge tone={color.key} icon={color.icon}>{color.example}</InkoBadge>;
}

function ColorSection() {
  return <Group id="cores" eyebrow="01 · Foundations" title="Cores & tokens" lead={<>Três cores carregam a marca. O vermelho Hanko é <strong>ação</strong>, nunca erro: perigo usa um carmesim mais escuro, sempre acompanhado de ícone e texto.</>}>
    <div className={styles.grid3}>{brandColors.map(color => <SwatchCard key={color.token} swatch={color} large/>)}</div>

    <Block name="Secundárias — profundidade e apoio" props="--inko-neutral-*" note={<>Mist Gray tem 2,3:1 sobre Washi — use só em fundos de skeleton e ilustração, nunca em texto. Para texto secundário use <code>--inko-text-secondary</code>.</>}>
      <div className={styles.grid4}>{secondaryColors.map(color => <SwatchCard key={color.token} swatch={color}/>)}</div>
    </Block>

    <Block name="Semânticas" props="--inko-status-{tom}-fg · -bg · -border" note="Cada tom tem texto (fg), fundo (bg) e borda. O badge de exemplo usa os três e sempre traz ícone e texto.">
      <div className={styles.semanticGrid}>{semanticColors.map(color => <article key={color.key} className={styles.semantic}>
        <div className={styles.semanticChips}><Chip token={`status-${color.key}-fg`}/><Chip token={`status-${color.key}-bg`}/><Chip token={`status-${color.key}-border`}/></div>
        <strong>{color.name}</strong>
        <span className={`inko-tabular ${styles.semanticHex}`}>fg {color.fg} · bg {color.bg} · bd {color.border}</span>
        <SemanticExample color={color}/>
      </article>)}</div>
    </Block>

    <Block name="Tokens semânticos — tema light" props="app/inko-tokens.css (gerado)" note="Base para o tema dark: só os semânticos são redefinidos. As razões de contraste foram validadas nas pranchas.">
      <div className={`inko-table-wrap ${styles.frame}`}>
        <table className="inko-table">
          <caption className="sr-only">Tokens semânticos do tema light</caption>
          <thead><tr><th scope="col">Token</th><th scope="col">Valor</th><th scope="col">Nota</th></tr></thead>
          <tbody>{semanticTokens.map(row => <tr key={row.token}>
            <th scope="row" className={styles.tokenName}><code>--inko-{row.token}</code></th>
            <td><span className={styles.tokenValue}><Chip token={row.token} className={styles.chipSmall}/>{row.hex}</span></td>
            <td>{row.note}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </Block>
  </Group>;
}

/* ---------- 01 · Tipografia ---------- */

const families = [
  { name: 'Manrope', sample: 'Aa', font: 'var(--inko-font-display)', text: '500 · 600 · 700 · 800 — títulos, navegação, KPIs, rótulos de seção' },
  { name: 'Inter', sample: 'Aa', font: 'var(--inko-font-body)', text: '400 · 500 · 600 · 700 — formulários, tabelas, menus, mensagens' },
  { name: 'Noto Sans JP', sample: 'あア', font: 'var(--inko-font-jp)', lang: 'ja', text: 'Só para conteúdo real em japonês — títulos e nomes originais de obras. Nunca decoração.' },
] as const;

const typeScale = [
  { name: 'display.xl', key: 'display-xl', display: true, spec: '48 / 56 · Manrope 700', tracking: '−0,02em', sample: 'Acervo em movimento' },
  { name: 'display.l', key: 'display-l', display: true, spec: '40 / 48 · Manrope 700', tracking: '−0,015em', sample: 'Bem-vindo de volta' },
  { name: 'heading.1', key: 'heading-1', display: true, spec: '32 / 40 · Manrope 700', tracking: '−0,01em', sample: 'Empréstimos ativos' },
  { name: 'heading.2', key: 'heading-2', display: true, spec: '28 / 36 · Manrope 600', tracking: '−0,01em', sample: 'Relatório de multas' },
  { name: 'heading.3', key: 'heading-3', display: true, spec: '24 / 32 · Manrope 600', tracking: '−0,005em', sample: 'Últimas movimentações' },
  { name: 'heading.4', key: 'heading-4', display: true, spec: '20 / 28 · Manrope 600', tracking: '0', sample: 'Dados da obra' },
  { name: 'body.lg', key: 'body-lg', display: false, spec: '16 / 26 · Inter 400', tracking: '0', sample: 'Selecione o usuário para iniciar um novo empréstimo.' },
  { name: 'body', key: 'body', display: false, spec: '14 / 22 · Inter 400', tracking: '0', sample: 'Padrão de tabelas, formulários e descrições. Mínimo para texto corrido.' },
  { name: 'small', key: 'small', display: false, spec: '12 / 18 · Inter 400', tracking: '+0,005em', sample: 'Helper text, metadados, datas — sempre em text.secondary ou mais escuro' },
  { name: 'caption', key: 'caption', display: false, spec: '11 / 16 · Inter 600', tracking: '+0,06em CAPS', sample: 'Cabeçalho de tabela · rótulo de KPI' },
] as const;

/** Lê as medidas reais dos tokens `--inko-type-*`; a família vem das fontes carregadas pelo layout. */
function typeStyle(key: string, display: boolean): CSSProperties {
  return {
    fontFamily: display ? 'var(--inko-font-display)' : 'var(--inko-font-body)',
    fontSize: `var(--inko-type-${key}-font-size)`,
    lineHeight: `var(--inko-type-${key}-line-height)`,
    fontWeight: `var(--inko-type-${key}-font-weight)`,
    letterSpacing: `var(--inko-type-${key}-letter-spacing)`,
    textTransform: key === 'caption' ? 'uppercase' : undefined,
  };
}

function TypeSection() {
  return <Group id="tipografia" eyebrow="01 · Foundations" title="Tipografia" lead={<>O pincel é exclusivo da marca. A interface fala em duas vozes geométricas: <strong>Manrope</strong> para estrutura e destaque, <strong>Inter</strong> para operação. Números de tabela usam <code>tabular-nums</code>.</>}>
    <div className={styles.grid3}>{families.map(family => <article key={family.name} className={`inko-section ${styles.family}`}>
      <span className={styles.familySample} style={{ fontFamily: family.font }} lang={'lang' in family ? family.lang : undefined} aria-hidden="true">{family.sample}</span>
      <h3 style={{ fontFamily: family.font }}>{family.name}</h3>
      <p>{family.text}</p>
    </article>)}</div>

    <Block name="Escala tipográfica" props="--inko-type-{estilo}-font-size · -line-height · -font-weight · -letter-spacing" note="Amostras renderizadas nas medidas reais dos tokens. O lettering em pincel fica só no logo e em peças editoriais — nunca em formulários, tabelas ou botões.">
      <ul className={styles.typeScale}>{typeScale.map(row => <li key={row.key}>
        <div className={styles.typeMeta}><code>{row.name}</code><span>{row.spec}</span><span>{row.tracking}</span></div>
        <p style={typeStyle(row.key, row.display)}>{row.sample}</p>
      </li>)}</ul>
    </Block>

    <div className={styles.grid2}>
      <Block name="Revisão dos tamanhos pequenos">
        <p className={styles.prose}>Caption 11 px subiu para peso 600 e ficou restrito a rótulos curtos em caixa alta — nunca frases, nunca links. Texto ≤ 12 px só em cores com ≥ 5:1 (text.secondary ou mais escuro). Em mobile, body nunca abaixo de 14 px; inputs com 16 px para evitar o zoom automático do iOS.</p>
      </Block>
      <Block name="Japonês com propósito" note={<>Exiba o título original como metadado secundário, com <code>lang=&quot;ja&quot;</code> para leitores de tela.</>}>
        <p className={styles.jpSample}><strong>{works[0].title}</strong><span lang="ja">{works[0].originalTitle}</span><small>· título original da obra (fictícia)</small></p>
      </Block>
    </div>
  </Group>;
}

/* ---------- 01 · Espaço, grid, radius, sombra e motion ---------- */

const spacingSteps = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16] as const;

const radii = [
  { token: 'xs', px: 4, use: 'Chips, tags' },
  { token: 'sm', px: 8, use: 'Inputs, botões, badges' },
  { token: 'md', px: 12, use: 'Cards admin' },
  { token: 'lg', px: 16, use: 'Painéis' },
  { token: 'xl', px: 24, use: 'Editorial, modais' },
] as const;

const shadows = [
  { token: 'sm', use: 'Cards, hover de linha' },
  { token: 'md', use: 'Dropdown, popover' },
  { token: 'lg', use: 'Modal, toast' },
  { token: 'panel', use: 'Só editorial (quadro de mangá)' },
] as const;

const breakpoints = [
  { name: 'Desktop ≥ 1024', columns: 12, text: 'Sidebar 248 · margem 32 · gutter 24 · conteúdo máx. 1280' },
  { name: 'Tablet 768–1023', columns: 8, text: 'Sidebar vira rail 72 · margem 24 · gutter 20' },
  { name: 'Mobile 360–767', columns: 4, text: 'Drawer · margem 16 · gutter 16' },
] as const;

const motionTokens = [
  { token: 'duration-hover', value: '150ms' },
  { token: 'duration-state', value: '200ms' },
  { token: 'duration-overlay', value: '200ms' },
  { token: 'duration-panel', value: '250ms' },
  { token: 'easing-out', value: 'cubic-bezier(.2,.8,.2,1)' },
  { token: 'easing-in-out', value: 'cubic-bezier(.4,0,.2,1)' },
  { token: 'easing-ink', value: 'cubic-bezier(.65,0,.35,1)' },
] as const;

const ensoPath = 'M151.4 38.7 A80 80 0 1 0 175.2 127.4';
const brushPath = 'M8 12C60 5 150 3 230 6c30 1 52 0 66 5-6 7 2 15-3 22-38 9-120 8-190 10-38 1-74 2-100-3 6-8-2-17 3-23Z';

function LayoutSection() {
  return <Group id="layout" eyebrow="01 · Foundations" title="Espaço, grid, forma & movimento" lead="Base de 4 px, contorno antes de sombra e movimento curto, que respeita prefers-reduced-motion.">
    <div className={styles.grid2}>
      <Block name="Espaçamento · base 4 px" props="--inko-spacing-{1…16}">
        <ul className={styles.spacing}>{spacingSteps.map(step => <li key={step}>
          <code>spacing-{step}</code><span className="inko-tabular">{step * 4}</span><span className={styles.spacingBar} style={{ width: `var(--inko-spacing-${step})` }} aria-hidden="true"/>
        </li>)}</ul>
      </Block>

      <Block name="Radius" props="--inko-radius-{xs…xl}">
        <ul className={styles.tiles}>{radii.map(radius => <li key={radius.token}>
          <span className={styles.radiusBox} style={{ borderRadius: `var(--inko-radius-${radius.token})` }} aria-hidden="true"/>
          <code>radius-{radius.token} · {radius.px}</code><span>{radius.use}</span>
        </li>)}</ul>
      </Block>
    </div>

    <Block name="Sombras — contorno primeiro, profundidade depois" props="--inko-shadow-{sm|md|lg|panel}">
      <ul className={`${styles.tiles} ${styles.tilesWide}`}>{shadows.map(shadow => <li key={shadow.token}>
        <span className={styles.shadowBox} style={{ boxShadow: `var(--inko-shadow-${shadow.token})` }} aria-hidden="true"/>
        <code>shadow-{shadow.token}</code><span>{shadow.use}</span>
      </li>)}</ul>
    </Block>

    <Block name="Grid responsivo · mobile-first" note="As telas crescem de 360 → 768 → 1024, com conteúdo limitado a 1280 px.">
      <div className={styles.grid3}>{breakpoints.map(point => <article key={point.name} className={styles.breakpoint}>
        <div className={styles.columns} style={{ gridTemplateColumns: `repeat(${point.columns}, minmax(0, 1fr))` }} aria-hidden="true">{Array.from({ length: point.columns }, (_, index) => <span key={index}/>)}</div>
        <strong>{point.name} · {point.columns} col</strong><span>{point.text}</span>
      </article>)}</div>
    </Block>

    <div className={styles.grid2}>
      <Block name="Densidade · Expressiva">
        <p className={styles.prose}>Login, onboarding, vazios e hero. Seções com spacing-16, display XL/L, textura Washi e Enso.</p>
      </Block>
      <Block name="Densidade · Operacional">
        <p className={styles.prose}>Linha de tabela de 48 px (compacta 40), input e botão de 40 px, gaps spacing-3/4, sem textura.</p>
      </Block>
    </div>

    <Block name="Motion" props="--inko-duration-* · --inko-easing-*" note={<>Expressivo (600–900 ms) só para o Enso de splash/login. As demonstrações param com prefers-reduced-motion. <Link href="/motion-lab" className="inko-text-link">Abrir o Motion Lab<Icon name="seta" size={14}/></Link></>}>
      <dl className={styles.motionTokens}>{motionTokens.map(item => <div key={item.token}><dt><code>{item.token}</code></dt><dd>{item.value}</dd></div>)}</dl>
      <div className={styles.grid3}>
        <figure className={styles.motionDemo}>
          <svg viewBox="0 0 200 200" width="96" height="96" aria-hidden="true" focusable="false"><path className="inko-motion-demo-enso" d={ensoPath} fill="none" stroke="var(--inko-brand-seal)" strokeWidth="16" strokeLinecap="round"/></svg>
          <figcaption>Enso · splash/login</figcaption>
        </figure>
        <figure className={styles.motionDemo}>
          <div className={`inko-motion-demo-panel ${styles.motionPanel}`} aria-hidden="true"/>
          <figcaption>Entrada de painel · banners</figcaption>
        </figure>
        <figure className={styles.motionDemo}>
          <svg className="inko-motion-demo-brush" viewBox="0 0 300 48" width="180" height="48" aria-hidden="true" focusable="false"><path fill="var(--inko-brand-ink)" d={brushPath}/></svg>
          <figcaption>Revelação de pincelada · títulos</figcaption>
        </figure>
      </div>
    </Block>
  </Group>;
}

/* ---------- 01 · Elementos gráficos & ícones ---------- */

const ELEMENTS = '/inko/svg/elementos';

const brushes = [
  { file: 'pincelada-horizontal-ink', width: 300, height: 48, label: 'brush.horizontal · fundo de rótulo editorial' },
  { file: 'pincelada-horizontal-seal', width: 300, height: 48, label: 'brush.horizontal · seal (texto branco 5,2:1)' },
  { file: 'sublinhado-seal', width: 300, height: 24, label: 'brush.underline · sob o título, nunca sobre' },
  { file: 'pincelada-curva-ink', width: 220, height: 100, label: 'curva · decoração' },
  { file: 'pincelada-vertical-seal', width: 24, height: 120, label: 'vertical' },
] as const;

const halftones = [
  { file: 'retícula-10', size: 8, label: 'halftone.10' },
  { file: 'retícula-25', size: 6, label: 'halftone.25' },
  { file: 'retícula-50', size: 5, label: 'halftone.50' },
] as const;

const motifs = [
  { file: 'tinta-derramada', size: 100, label: 'Tinta' },
  { file: 'sakura', size: 48, label: 'Sakura' },
  { file: 'selo', size: 56, label: 'Selo' },
] as const;

/** Uso de cada ícone. O `Record<IconName, …>` obriga a grade a cobrir todos os nomes de `icon.tsx`. */
const iconUse: Record<IconName, string> = {
  dashboard: 'Dashboard', acervo: 'Acervo', mangas: 'Mangás', usuarios: 'Usuários', usuario: 'Usuário', emprestimos: 'Empréstimos',
  devolucoes: 'Devoluções', relatorios: 'Relatórios', configuracoes: 'Configurações', pesquisa: 'Pesquisa', notificacoes: 'Notificações',
  'check-circulo': 'Disponibilidade', relogio: 'Atrasos', menu: 'Menu', fechar: 'Fechar', mais: 'Adicionar', seta: 'Avançar',
  'seta-esquerda': 'Voltar', 'chevron-baixo': 'Expandir', 'chevron-cima': 'Recolher', 'chevron-esquerda': 'Anterior', 'chevron-direita': 'Próxima',
  ordenar: 'Ordenar', check: 'Confirmado', info: 'Informação', 'erro-circulo': 'Erro de campo', alerta: 'Alerta', sair: 'Sair', olho: 'Mostrar',
  'olho-fechado': 'Ocultar', calendario: 'Data', filtro: 'Filtrar', 'mais-acoes': 'Mais ações', lixeira: 'Excluir', enviar: 'Enviar',
  atualizar: 'Atualizar', carregando: 'Carregando', upload: 'Enviar arquivo', download: 'Baixar', imagem: 'Sem capa', cards: 'Cards',
  tabela: 'Tabela', falha: 'Falha', email: 'E-mail', cadeado: 'Senha',
};
const icons = Object.entries(iconUse) as [IconName, string][];

function Asset({ file, width, height }: Readonly<{ file: string; width: number; height: number }>) {
  return <Image src={`${ELEMENTS}/${file}.svg`} alt="" width={width} height={height} unoptimized/>;
}

function GraphicsSection() {
  return <Group id="graficos" eyebrow="01 · Foundations" title="Elementos proprietários & ícones" lead="Ornamento vive nas bordas da experiência — banners, login, vazios, materiais institucionais. Nunca sob texto operacional, inputs ou tabelas.">
    <div className={styles.grid2}>
      <Block name="Enso" props="size · tone: seal|ink|paper · strokeWidth · animated" note="Abertura sempre à direita, entre 1 e 4 horas — o Enso nunca fecha.">
        <ul className={styles.tiles}>
          <li><Enso size={120}/><span>Expressiva</span></li>
          <li><Enso size={56} strokeWidth={20}/><span>Compacta</span></li>
          <li><Enso size={120} tone="ink" className={styles.watermark}/><span>Marca d’água 7%</span></li>
          <li><Enso size={120} tone="ink"/><span>Mono</span></li>
        </ul>
      </Block>

      <Block name="Pinceladas" props={`${ELEMENTS}/pincelada-*.svg`}>
        <ul className={styles.brushes}>{brushes.map(brush => <li key={brush.file}><Asset file={brush.file} width={brush.width} height={brush.height}/><span>{brush.label}</span></li>)}</ul>
      </Block>

      <Block name="Textura Washi" props="<WashiTexture/>" note="SVG feTurbulence (≈ 0 KB) · login, onboarding, banners. Proibido em tabelas e inputs.">
        <div className={styles.washi}><WashiTexture/><span>Washi sobre background.default</span></div>
      </Block>

      <Block name="Retículas" props={`${ELEMENTS}/retícula-{10|25|50}.svg`} note="Meio-tom em três densidades. Texto nunca fica sobre retícula.">
        <ul className={styles.tiles}>{halftones.map(tone => <li key={tone.file}>
          <span className={styles.halftone} style={{ backgroundImage: `url("${encodeURI(`${ELEMENTS}/${tone.file}.svg`)}")`, backgroundSize: `${tone.size}px ${tone.size}px` }} aria-hidden="true"/><code>{tone.label}</code>
        </li>)}</ul>
      </Block>
    </div>

    <Block name="Motivos" props="<SeigaihaBand/> · quadros · tinta · sakura · selo" note="Seigaiha fecha a sidebar e painéis ink; quadros de mangá entram só em peças editoriais (shadow.panel).">
      <ul className={`${styles.tiles} ${styles.tilesWide}`}>
        <li><SeigaihaBand className={styles.seigaiha}/><span>Seigaiha</span></li>
        <li><span className={styles.frames} aria-hidden="true"><span className={styles.frameRays}/><span className={styles.frameDots}/></span><span>Quadros</span></li>
        {motifs.map(motif => <li key={motif.file}><span className={styles.motif}><Asset file={motif.file} width={motif.size} height={motif.size}/></span><span>{motif.label}</span></li>)}
      </ul>
    </Block>

    <Block name="Iconografia · traço 1,75, cantos arredondados" props="<Icon name size /> · components/icon.tsx" note={<>Grid 24 · área viva 20 · tamanhos 16 / 20 / 24. Ícones de ação seguem a base Lucide (reconhecimento &gt; estilo); Mangás ganhou glifo próprio. Ícone sozinho sempre com <code>aria-label</code> no controle; status nunca só por cor.</>}>
      <ul className={styles.iconGrid}>{icons.map(([name, use]) => <li key={name}><Icon name={name} size={24}/><code>{name}</code><span>{use}</span></li>)}</ul>
    </Block>
  </Group>;
}

/* ---------- 02 · Componentes INKO ---------- */

const cardWorkIds = ['INK-0004', 'INK-0002', 'INK-0001', 'INK-0006'] as const;
const cardWorks = works.filter(work => cardWorkIds.some(id => id === work.id));
const mangaWorks = works.filter(work => work.category === 'Mangá');
const mangaLoaned = mangaWorks.filter(work => availabilityOf(loans, work.id, DEMO_REFERENCE_DATE) !== 'disp').length;
const lateLoans = activeLateLoans(loans, DEMO_REFERENCE_DATE);
const fineRows = lateLoans.map(loan => ({ id: loan.id, work: loan.work, days: loan.days, fineCents: loan.fineCents }));
const loanSamples = loans.filter(loan => loan.id === 'EMP-10302' || loan.id === 'EMP-10377');

function DomainSection() {
  return <Group id="dominio" eyebrow="02 · Components · domínio" title="Componentes INKO" lead={<>Mesmos tokens dos fundamentais. <strong>Capas fictícias</strong> geradas em CSS demonstram o slot de imagem (2:3) onde entrarão capas reais licenciadas.</>}>
    <Block name="MangaCard" props="work · status? · href? · footer?" note="Estados disponível, emprestado, atrasado e sem capa (volume omitido). O status é derivado dos empréstimos de lib/demo.ts na data de referência.">
      <div className="inko-work-grid">{cardWorks.map(work => <MangaCard key={work.id} work={work} status={availabilityOf(loans, work.id, DEMO_REFERENCE_DATE)}/>)}</div>
    </Block>

    <div className={styles.grid2}>
      <Block name="CollectionCard" props="title · titles · loaned · href · icon" note="Os números vêm dos relatórios. O card inteiro é o link.">
        <CollectionCard title="Mangás" titles={mangaWorks.length} loaned={mangaLoaned} href="/acervo"/>
      </Block>

      <Block name="FineSummary" props="rows · reference · href? · limit" note="Soma apenas empréstimos ativos e atrasados; a UI só formata em BRL.">
        <FineSummary rows={fineRows} reference={DEMO_REFERENCE_DATE} href="/relatorios"/>
      </Block>

      <Block name="LoanCard" props="loan · reference · work? · action?" note="Substitui a linha de tabela abaixo de 768 px.">
        <ul className="inko-loan-list">{loanSamples.map(loan => <li key={loan.id}><LoanCard loan={loan} reference={DEMO_REFERENCE_DATE} work={works.find(work => work.id === loan.workId)}/></li>)}</ul>
      </Block>

      <Block name="CirculationCycle" props="sem props" note="Ciclo de circulação de uma obra: disponível → emprestado → atrasado → devolvido.">
        <CirculationCycle/>
      </Block>
    </div>

    <Block name="EditorialBanner · hero" props="variant: hero|compact · eyebrow · title · subtitle · action · headingLevel" note="Variante hero do Dashboard, com Enso desenhado na entrada. Texto nunca sobre retícula; abaixo de 768 px a arte some.">
      <EditorialBanner variant="hero" eyebrow="Biblioteca INKO" title="Acervo em movimento" subtitle={<>Hoje há <strong>{lateLoans.length} empréstimos atrasados</strong> aguardando devolução.</>} action={<InkoLinkButton href="/devolucoes" leftIcon="devolucoes">Registrar devolução</InkoLinkButton>}/>
    </Block>

    <Block name="EditorialBanner · compacto" props="variant=&quot;compact&quot;" note="Painel lateral para novidades e avisos editoriais.">
      <div className={styles.compactBanner}>
        <EditorialBanner eyebrow="Novidades no acervo" title="12 volumes chegaram esta semana" action={<InkoLinkButton href="/acervo" size="sm" variant="outline">Ver chegadas</InkoLinkButton>}/>
      </div>
    </Block>
  </Group>;
}

/* ---------- 07 · Diretrizes ---------- */

const behaviorRules = [
  'Mobile-first: 360 → 768 (8 col) → 1024 (12 col) → máx. 1280 de conteúdo.',
  'Tabelas: abaixo de 768 viram lista de LoanCard; acima, rolam dentro do próprio contêiner.',
  'Filtros e paginação refletidos na URL (searchParams) — compartilháveis.',
  'Toasts de 5 s, que pausam em hover/foco; ações destrutivas sempre com Confirmation Dialog.',
  'Skeleton após 300 ms de espera; erro com “Tentar novamente”.',
  'Tokens são CSS variables (--inko-*): uma implementação visual por componente, sem cores soltas.',
] as const;

const a11yRules: readonly ReactNode[] = [
  'Texto ≥ 4,5:1 (validado nos tokens); controles ≥ 3:1 (border.strong).',
  'Foco visível de 2 px ink + offset de 2 px (2.4.11/2.4.13); sobre fundo escuro, paper.',
  'Alvos ≥ 24×24 (2.5.8); no mobile, 44.',
  <>Labels persistentes; erros com texto + ícone + <code>aria-describedby</code>.</>,
  <>Status nunca só por cor; <code>lang=&quot;ja&quot;</code> em títulos originais.</>,
  <>Decoração SVG com <code>aria-hidden</code>; reduced-motion desliga animações.</>,
];

const componentMap = [
  { name: 'InkoButton', file: 'inko-kit.tsx', props: 'variant: primary|secondary|outline|ghost|danger · size: sm|md|lg · loading · leftIcon · iconOnly', note: 'loading → aria-busy + spinner' },
  { name: 'InkoInput / InkoField', file: 'inko-kit.tsx', props: 'label · help · error · success · required · leftIcon', note: 'erro liga aria-invalid + aria-describedby' },
  { name: 'AppShell', file: 'app-shell.tsx', props: 'breadcrumb[]', note: '≥ 1024 sidebar 248 · 768–1023 rail 72 · < 768 drawer' },
  { name: 'MangaCard', file: 'inko-kit.tsx', props: 'work · status? · href? · footer?', note: 'slot 2:3, fallback sem capa' },
  { name: 'InkoStatus', file: 'inko-kit.tsx', props: 'status: disp|emp|atr|dev · detail? · size?', note: 'ícone + texto sempre' },
  { name: 'LoanCard · CollectionCard', file: 'inko-patterns.tsx', props: 'loan · reference · work / title · titles · loaned · href', note: 'LoanCard substitui a tabela < 768' },
  { name: 'FineSummary', file: 'inko-patterns.tsx', props: 'rows (só ativos atrasados) · reference · href?', note: 'o valor vem pronto; a UI só formata BRL' },
  { name: 'EditorialBanner · Enso', file: 'inko-patterns.tsx · inko-kit.tsx', props: 'variant: hero|compact · title · action?', note: 'decoração aria-hidden; animação opt-in' },
  { name: 'ConfirmDialog · useToast', file: 'inko-interactions.tsx', props: 'open · title · confirmLabel · tone · loading / title · text · tone · onUndo', note: 'dialog nativo; toast de 5 s pausa em hover/foco' },
] as const;

const fineRuleCode = `// lib/demo.ts
export const DAILY_FINE_CENTS = 200; // R$ 2,00 por dia

export function fineInCents(days: number): number {
  return Math.max(0, Math.trunc(days)) * DAILY_FINE_CENTS;
}

// relatório: somente empréstimos ativos e atrasados
activeLateLoans(loans, DEMO_REFERENCE_DATE);`;

function GuidelinesSection() {
  const sample = lateLoans.find(loan => loan.id === 'EMP-10302') ?? lateLoans[0];
  const sampleDays = sample ? daysOverdue(sample.due, DEMO_REFERENCE_DATE) : 0;

  return <Group id="diretrizes" eyebrow="07 · Handoff" title="Diretrizes" lead="Regras de comportamento, responsividade e acessibilidade que valem para todas as telas. Neste projeto os tokens são consumidos por CSS puro (inko-tokens.css → inko-ui.css), sem Tailwind nem shadcn.">
    <div className={styles.grid2}>
      <Block name="Comportamento & responsividade">
        <ul className={styles.rules}>{behaviorRules.map(rule => <li key={rule}><Icon name="check" size={16}/><span>{rule}</span></li>)}</ul>
      </Block>
      <Block name="Acessibilidade · WCAG 2.2 AA">
        <ul className={styles.rules}>{a11yRules.map((rule, index) => <li key={index}><Icon name="check" size={16}/><span>{rule}</span></li>)}</ul>
      </Block>
    </div>

    <Block name="Regra de multa" props="fineInCents · activeLateLoans · formatBRL" note="O cálculo oficial será do serviço de backend; estas funções só espelham a regra para a demonstração e a pré-visualização na devolução.">
      <pre className={styles.code}><code>{fineRuleCode}</code></pre>
      {sample && <p className={styles.prose}>Exemplo com os dados demonstrativos: <strong>{sample.work}</strong> venceu em {formatDate(sample.due)}; na referência de {formatDate(DEMO_REFERENCE_DATE)} são {sampleDays} dias de atraso → <strong>{formatBRL(fineInCents(sampleDays))}</strong>.</p>}
    </Block>

    <Block name="Mapa de componentes · canvas → React" props="components/*.tsx">
      <div className={`inko-table-wrap ${styles.frame}`}>
        <table className={`inko-table ${styles.mapTable}`}>
          <caption className="sr-only">Mapa de componentes do Design System e seus arquivos</caption>
          <thead><tr><th scope="col">Componente</th><th scope="col">Arquivo</th><th scope="col">Props principais</th><th scope="col">Notas</th></tr></thead>
          <tbody>{componentMap.map(row => <tr key={row.name}>
            <th scope="row" className={styles.tokenName}>{row.name}</th><td><code>{row.file}</code></td><td><code>{row.props}</code></td><td>{row.note}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </Block>
  </Group>;
}

/* ---------- Página ---------- */

export default function DesignSystemPage() {
  return <AppShell breadcrumb={[{ label: 'Início', href: '/' }, { label: 'Design System' }]}>
    <PageHeading eyebrow="Documentação viva" title="Design System INKO" description="Marca, fundamentos, componentes reais da fundação e diretrizes de uso — a mesma biblioteca que monta as telas."/>
    <div className={styles.layout}>
      <nav className={styles.toc} aria-label="Seções do Design System">
        <ol>{toc.map(item => <li key={item.id}><a href={`#${item.id}`}><span>{item.number}</span>{item.label}</a></li>)}</ol>
      </nav>
      <div className={styles.sections}>
        <BrandSection/>
        <ColorSection/>
        <TypeSection/>
        <LayoutSection/>
        <GraphicsSection/>
        <Group id="core" eyebrow="02 · Components" title="Buttons & Forms" lead="Uma ação primária por contexto. Os componentes abaixo são os mesmos usados nas telas: passe o mouse, navegue com Tab e altere os valores.">
          <CoreShowcase/>
        </Group>
        <Group id="dados" eyebrow="02 · Components" title="Data display, navegação & feedback" lead="Tabelas, indicadores, navegação local e mensagens. Os exemplos usam os dados demonstrativos de lib/demo.ts e não alteram o acervo.">
          <DataShowcase/>
        </Group>
        <DomainSection/>
        <GuidelinesSection/>
      </div>
    </div>
  </AppShell>;
}
