import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '../../components/icon';
import { Enso, InkoBadge, InkoCover, SeigaihaBand, WashiTexture } from '../../components/inko-kit';
import {
  AnimeAdaptations, CampaignBanners, CatalogProvider, CatalogShowcase, CollectionsShowcase, GenreNavigation, LandingHeader, ProductPreview,
} from './landing-client';
import styles from './landing.module.css';

const DESCRIPTION = 'Dos universos que marcaram gerações às próximas histórias que você vai descobrir. Conheça o INKO: uma nova forma de explorar, organizar e acompanhar seu acervo de mangás e quadrinhos.';

export const metadata: Metadata = {
  title: 'Grandes histórias merecem uma estante à altura',
  description: DESCRIPTION,
  openGraph: {
    title: 'INKO · Mangás, HQs e Graphic Novels',
    description: DESCRIPTION,
    type: 'website',
    locale: 'pt_BR',
    siteName: 'INKO',
    images: [{ url: '/inko/logo/inko-logo.png', width: 900, height: 665, alt: 'Logotipo do INKO' }],
  },
};

const MARQUEE = ['Uma estante. Infinitos universos.', 'Mangás', 'HQs', 'Graphic novels', 'Do primeiro volume à última página.', 'Empréstimos', 'Devoluções', 'Relatórios'] as const;

/* Composições gráficas originais com títulos reais do acervo; nenhuma capa de editora é reproduzida. */
const HERO_COVERS = {
  left: { title: 'Berserk', volume: 'Vol. 1', cover: 1 },
  right: { title: 'Batman: Year One', volume: 'Edição encadernada', cover: 2 },
  front: { title: 'One Piece', volume: 'Vol. 1', cover: 0 },
} as const;

const PILLARS = [
  { icon: 'pesquisa', tone: styles.iconInk, title: 'Descubra', text: 'Explore títulos, autores, categorias, gêneros e coleções do acervo.', href: '#acervo', cta: 'Explorar o acervo' },
  { icon: 'acervo', tone: styles.iconInfo, title: 'Organize', text: 'Cadastre cada volume com identificador próprio e acompanhe o que está na estante.', href: '/acervo/novo', cta: 'Cadastrar obra' },
  { icon: 'emprestimos', tone: styles.iconSuccess, title: 'Empreste', text: 'Empréstimos guiados com prazo, sem chance de emprestar o mesmo volume duas vezes.', href: '/emprestimos', cta: 'Novo empréstimo' },
  { icon: 'relatorios', tone: styles.iconSeal, title: 'Acompanhe', text: 'Devoluções, atrasos e multas de R$ 2,00 por dia, com data de referência escolhida por você.', href: '/relatorios', cta: 'Ver relatórios' },
] as const;

const FAQ = [
  { question: 'O que é o INKO?', answer: 'Uma plataforma para organizar e circular um acervo físico de mangás, HQs e graphic novels: cadastro de obras e leitores, empréstimos, devoluções, atrasos e relatórios.' },
  { question: 'Que tipo de acervo ele gerencia?', answer: 'Volumes impressos de bibliotecas, clubes de leitura e coleções particulares. Cada volume tem identificador próprio e só pode estar emprestado para uma pessoa por vez.' },
  { question: 'Como funcionam os empréstimos?', answer: 'Você escolhe o leitor e a obra, o INKO confere a disponibilidade e registra a data de devolução prevista, de 14 dias por padrão. Na devolução, o volume volta à estante na hora.' },
  { question: 'Como funcionam as multas?', answer: 'R$ 2,00 por dia de atraso, por empréstimo. O relatório considera apenas empréstimos ativos e atrasados na data de referência escolhida; os devolvidos não entram.' },
  { question: 'Qual a diferença entre o mangá e o anime?', answer: 'O mangá é a obra em quadrinhos impressa, que o INKO cataloga e empresta. O anime é a adaptação em animação: aparece só como referência editorial e não é um exemplar do acervo.' },
  { question: 'Posso ler as obras digitalmente no INKO?', answer: 'Não. O INKO não é leitor digital nem serviço de streaming. Ele mostra o que existe na estante, com quem está cada volume e quando ele volta.' },
  { question: 'Como explorar a demonstração?', answer: 'Use “Entrar” com qualquer e-mail válido e uma senha de 6 ou mais caracteres. É um acesso demonstrativo local: o acervo, os empréstimos e os relatórios usam dados de demonstração gravados no banco do INKO.' },
] as const;

function MarqueeItems() {
  return <>{MARQUEE.map(item => <span key={item}>{item} ✦</span>)}</>;
}

export default function LandingPage() {
  return <div className={styles.page}>
    <LandingHeader/>

    <CatalogProvider>
      <main>
        <div className={`${styles.dark} ${styles.heroBand}`}>
          <div className={styles.heroRays} aria-hidden="true"/>
          <div className={styles.heroDots} aria-hidden="true"/>

          <section id="inicio" aria-labelledby="hero-t" className={`${styles.container} ${styles.hero}`}>
            <div className={`${styles.heroText} inko-motion-enter`}>
              <span className={styles.heroEyebrow}>Mangás · HQs · Graphic Novels</span>
              <h1 id="hero-t" className={styles.heroTitle}>Grandes histórias merecem uma estante à altura.</h1>
              <p className={styles.heroLead}>{DESCRIPTION}</p>
              <div className={styles.heroActions}>
                <a href="#acervo" className={`${styles.btn} ${styles.btnPrimary}`}>Explorar o acervo<Icon name="seta" size={18}/></a>
                <a href="#plataforma" className={`${styles.btn} ${styles.btnOutlineLight}`}>Conhecer o INKO</a>
              </div>
              <ul className={styles.heroChecks}>
                <li><Icon name="check" size={16}/>Acervo físico, não leitor digital</li>
                <li><Icon name="check" size={16}/>Disponibilidade lida do sistema</li>
                <li><Icon name="check" size={16}/>Desktop e celular</li>
              </ul>
            </div>

            <div className={styles.heroArt} aria-hidden="true">
              <div className={styles.heroStage}>
                <Enso size={460} strokeWidth={17} animated className={styles.heroEnso}/>
                <div className={`${styles.fan} ${styles.fanLeft}`}><InkoCover work={HERO_COVERS.left}/></div>
                <div className={`${styles.fan} ${styles.fanRight}`}><InkoCover work={HERO_COVERS.right}/></div>
                <div className={`${styles.fan} ${styles.fanFront}`}><InkoCover work={HERO_COVERS.front}/></div>
              </div>
            </div>
          </section>

          <div className={styles.marquee} aria-hidden="true">
            {/* Conteúdo repetido em número par: o deslocamento de -50% fecha o ciclo sem salto. */}
            <div className={styles.marqueeTrack}><MarqueeItems/><MarqueeItems/></div>
          </div>
        </div>

        <CatalogShowcase/>

        <CampaignBanners/>

        <GenreNavigation/>

        <section id="como" aria-labelledby="cm-t" className={styles.features}>
          <div className={`${styles.container} ${styles.featuresInner}`}>
            <div className={styles.sectionHead}>
              <span className={styles.kicker}>Como o INKO funciona</span>
              <h2 id="cm-t" className={styles.h2}>Organize sua coleção. Viva cada história.</h2>
            </div>
            <div className={styles.featureGrid}>
              {PILLARS.map((pillar, index) => <article key={pillar.title} className={index === 3 ? `${styles.feature} ${styles.featureDark}` : styles.feature}>
                <span className={`${styles.featureIcon} ${pillar.tone}`}><Icon name={pillar.icon} size={24}/></span>
                <h3>{pillar.title}</h3>
                <p>{pillar.text}</p>
                {pillar.href.startsWith('#')
                  ? <a href={pillar.href} className={styles.featureLink}>{pillar.cta}<Icon name="seta" size={16}/></a>
                  : <Link href={pillar.href} className={styles.featureLink}>{pillar.cta}<Icon name="seta" size={16}/></Link>}
              </article>)}
            </div>
          </div>
        </section>

        <section aria-labelledby="pr-t" className={`${styles.container} ${styles.productSection}`}>
          <div className={styles.sectionHead}>
            <span className={styles.kicker}>Produto em ação</span>
            <h2 id="pr-t" className={styles.h2}>Do balcão ao relatório, sem planilha.</h2>
            <p className={styles.lead}>Capturas da aplicação real, com os dados de demonstração do INKO.</p>
          </div>
          <ProductPreview/>
        </section>

        <CollectionsShowcase/>

        <AnimeAdaptations/>

        <section id="plataforma" aria-labelledby="pv-t" className={styles.preview}>
          <WashiTexture/>
          <div className={`${styles.container} ${styles.previewInner}`}>
            <div className={styles.previewText}>
              <span className={styles.kicker}>Sobre o INKO</span>
              <h2 id="pv-t" className={styles.h2}>Tinta e papel por fora. Engenharia por dentro.</h2>
              <p className={styles.lead}>A identidade vem do sumi-e, do enso e dos quadros de mangá. Por trás, cada operação passa por serviços próprios de catálogo, leitores, circulação e relatórios, com regras de negócio testadas e um banco que impede emprestar o mesmo volume duas vezes.</p>
              <ul className={styles.aboutList}>
                <li><InkoBadge tone="neutral" icon="acervo">Catálogo</InkoBadge><span>obras com identificador único</span></li>
                <li><InkoBadge tone="info" icon="emprestimos">Circulação</InkoBadge><span>empréstimos e devoluções atômicos</span></li>
                <li><InkoBadge tone="danger" icon="relatorios">Relatórios</InkoBadge><span>multas e estatísticas calculadas por funções puras</span></li>
              </ul>
            </div>
            <div className={styles.aboutArt} aria-hidden="true">
              <Enso size={320} tone="ink" strokeWidth={14}/>
              <Image src="/inko/logo/inko-logo.png" alt="" width={900} height={665} sizes="260px" className={styles.aboutLogo}/>
            </div>
          </div>
        </section>

        <section id="faq" aria-labelledby="fq-t" className={styles.faq}>
          <h2 id="fq-t">Perguntas frequentes</h2>
          <div className={styles.faqList}>
            {FAQ.map((item, index) => <details key={item.question} className={styles.faqItem} open={index === 0}>
              <summary>{item.question}<Icon name="chevron-baixo" size={20}/></summary>
              <p>{item.answer}</p>
            </details>)}
          </div>
        </section>

        <section aria-labelledby="dm-t" className={`${styles.dark} ${styles.demo}`}>
          <SeigaihaBand className={styles.demoWaves}/>
          <div className={styles.demoInner}>
            <Image src="/inko/logo/inko-logo-inverse.png" alt="" width={900} height={665} sizes="220px" className={styles.demoLogo}/>
            <h2 id="dm-t" className={styles.demoTitle}>Todo universo começa em algum lugar. O seu começa aqui.</h2>
            <p className={styles.demoLead}>O próximo capítulo começa aqui: entre na demonstração e navegue pelo acervo, empréstimos e relatórios.</p>
            <div className={styles.demoActions}>
              <Link href="/acervo" className={`${styles.btn} ${styles.btnPrimary}`}>Conhecer o acervo<Icon name="seta" size={18}/></Link>
              <Link href="/login" className={`${styles.btn} ${styles.btnOutlineLight}`}>Entrar</Link>
            </div>
          </div>
        </section>
      </main>
    </CatalogProvider>

    <footer className={`${styles.dark} ${styles.footer}`}>
      <div className={`${styles.container} ${styles.footerInner}`}>
        <span>INKO · A arte de colecionar histórias</span>
        <nav aria-label="Rodapé" className={styles.footerNav}>
          <a href="#acervo">Acervo</a>
          <a href="#colecoes">Coleções</a>
          <a href="#faq">Perguntas</a>
          <Link href="/login">Entrar</Link>
        </nav>
        <small className={styles.footerNote}>Projeto acadêmico · Paradigmas de Linguagens de Programação. Títulos e marcas citados pertencem aos seus detentores; capas ilustrativas criadas pelo INKO.</small>
      </div>
    </footer>
  </div>;
}
