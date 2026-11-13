import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '../../components/icon';
import { CategoryTag, Enso, InkoBadge, InkoCover, SeigaihaBand, WashiTexture } from '../../components/inko-kit';
import { works } from '../../lib/demo';
import { LandingHeader, LeadForm, Showcase } from './landing-client';
import styles from './landing.module.css';

export const metadata: Metadata = {
  title: 'Gestão de acervo de mangás, HQs e graphic novels',
  description: 'O INKO cuida do acervo físico da sua biblioteca: obras cadastradas, empréstimos com prazo, devoluções conferidas e atrasos calculados.',
};

const MARQUEE = ['Mangá', 'HQ', 'Graphic novel', 'Empréstimos', 'Devoluções', 'Relatórios'] as const;

const FAQ = [
  { question: 'Dá para ler mangás e HQs dentro do INKO?', answer: 'Não. O INKO não é um leitor digital nem um serviço de streaming. Ele gerencia o acervo físico: o que a biblioteca tem, com quem está cada volume e quando volta.' },
  { question: 'Como a multa por atraso é calculada?', answer: 'R$ 2,00 por dia de atraso, por empréstimo. O relatório considera só os empréstimos ativos e atrasados na data de referência. Os já devolvidos não entram.' },
  { question: 'Funciona no celular?', answer: 'Sim. As telas se adaptam do celular ao desktop; no celular, as tabelas viram listas compactas e o menu abre em gaveta.' },
  // Marcador de conteúdo da prancha: o preço ainda não foi definido.
  { question: 'Quanto custa?', answer: '[SEU MODELO DE PREÇO OU “FALE COM A GENTE”]' },
] as const;

function coverOf(id: string) {
  return works.find(work => work.id === id) ?? works[0];
}

function MarqueeItems() {
  return <>{MARQUEE.map(item => <span key={item}>{item} ✦</span>)}</>;
}

export default function LandingPage() {
  return <div className={styles.page}>
    <LandingHeader/>

    <main>
      <div className={`${styles.dark} ${styles.heroBand}`}>
        <div className={styles.heroRays} aria-hidden="true"/>
        <div className={styles.heroDots} aria-hidden="true"/>

        <section aria-labelledby="hero-t" className={`${styles.container} ${styles.hero}`}>
          <div className={styles.heroText}>
            <span className={styles.heroEyebrow}>Gestão de acervo · mangás, HQs e graphic novels</span>
            <h1 id="hero-t" className={styles.heroTitle}>Nenhum volume fora do lugar.</h1>
            <p className={styles.heroLead}>O INKO cuida do acervo físico da sua biblioteca: cada obra cadastrada, cada empréstimo com prazo, cada devolução conferida e cada atraso calculado. Feito para quem guarda mangás e quadrinhos.</p>
            <div className={styles.heroActions}>
              <a href="#demo" className={`${styles.btn} ${styles.btnPrimary}`}>Pedir demonstração<Icon name="seta" size={18}/></a>
              <Link href="/login" className={`${styles.btn} ${styles.btnOutlineLight}`}>
                <svg className="inko-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="m6 3 14 9-14 9Z"/></svg>Ver o sistema
              </Link>
            </div>
            <ul className={styles.heroChecks}>
              <li><Icon name="check" size={16}/>Acervo físico, não leitor digital</li>
              <li><Icon name="check" size={16}/>Desktop e celular</li>
              <li><Icon name="check" size={16}/>Acessível (WCAG 2.2 AA)</li>
            </ul>
          </div>

          <div className={styles.heroArt} aria-hidden="true">
            <div className={styles.heroStage}>
              <Enso size={460} strokeWidth={17} animated className={styles.heroEnso}/>
              <div className={`${styles.fan} ${styles.fanLeft}`}><InkoCover work={coverOf('INK-0003')}/></div>
              <div className={`${styles.fan} ${styles.fanRight}`}><InkoCover work={coverOf('INK-0004')}/></div>
              <div className={`${styles.fan} ${styles.fanFront}`}><InkoCover work={coverOf('INK-0001')}/></div>
            </div>
          </div>
        </section>

        <div className={styles.marquee} aria-hidden="true">
          {/* Conteúdo repetido em número par: o deslocamento de -50% fecha o ciclo sem salto. */}
          <div className={styles.marqueeTrack}><MarqueeItems/><MarqueeItems/><MarqueeItems/><MarqueeItems/></div>
        </div>
      </div>

      <Showcase/>

      <section id="recursos" aria-labelledby="rc-t" className={styles.features}>
        <div className={`${styles.container} ${styles.featuresInner}`}>
          <h2 id="rc-t" className={styles.h2}>Quatro rotinas da biblioteca, resolvidas no mesmo lugar.</h2>
          <div className={styles.featureGrid}>
            <article className={styles.feature}>
              <span className={`${styles.featureIcon} ${styles.iconInk}`}><Icon name="acervo" size={24}/></span>
              <h3>Acervo que se encontra</h3>
              <p>Cadastre por identificador, título, autor e categoria. Busque e filtre por disponibilidade, em cards ou tabela.</p>
              <div className={styles.featureFoot}><CategoryTag category="Mangá"/><CategoryTag category="HQ"/><CategoryTag category="Graphic novel"/></div>
            </article>
            <article className={styles.feature}>
              <span className={`${styles.featureIcon} ${styles.iconInfo}`}><Icon name="emprestimos" size={24}/></span>
              <h3>Empréstimo guiado</h3>
              <p>Usuário, obra, disponibilidade, datas, confirmação. Se o volume já saiu, o sistema avisa com quem está e até quando.</p>
              <div className={styles.steps} aria-hidden="true"><span className={styles.stepDone}/><span className={styles.stepDone}/><span className={styles.stepNow}/><span/><span/><span/></div>
            </article>
            <article className={styles.feature}>
              <span className={`${styles.featureIcon} ${styles.iconSuccess}`}><Icon name="devolucoes" size={24}/></span>
              <h3>Devolução em dois toques</h3>
              <p>Localize o empréstimo ativo, confira obra e leitor, informe a data. A obra volta a aparecer como disponível na hora.</p>
              <div className={`${styles.featureFoot} ${styles.swap}`} aria-hidden="true">
                <InkoBadge tone="info" className={styles.struck}>Emprestado</InkoBadge><Icon name="seta" size={16}/><InkoBadge tone="success">Disponível</InkoBadge>
              </div>
            </article>
            <article className={`${styles.feature} ${styles.featureDark}`}>
              <span className={`${styles.featureIcon} ${styles.iconSeal}`}><Icon name="relatorios" size={24}/></span>
              <h3>Multas sem planilha</h3>
              <p>Escolha a data de referência e veja os empréstimos ativos em atraso, a multa de cada um e o total. Devolvidos ficam de fora.</p>
              <div className={styles.rate}><span>por dia de atraso</span><strong>R$ 2,00</strong></div>
            </article>
          </div>
        </div>
      </section>

      <section id="como" aria-labelledby="cm-t" className={`${styles.container} ${styles.how}`}>
        <h2 id="cm-t" className={styles.h2}>Do balcão ao relatório, em três quadros.</h2>
        <ol className={styles.frames}>
          <li className={styles.frame}>
            <div className={styles.frameDots} aria-hidden="true"/>
            <span className={styles.frameNumber} aria-hidden="true">1</span>
            <h3>Cadastre o acervo</h3>
            <p>Identificador, título, autor e categoria bastam. Volume, editora e capa entram quando você tiver.</p>
          </li>
          <li className={styles.frame}>
            <div className={styles.frameRays} aria-hidden="true"/>
            <span className={styles.frameNumber} aria-hidden="true">2</span>
            <h3>Empreste e devolva</h3>
            <p>O fluxo guiado evita emprestar o que já saiu. Na volta, a devolução atualiza a estante sozinha.</p>
          </li>
          <li className={`${styles.frame} ${styles.frameDark}`}>
            <Enso size={190} className={styles.frameEnso}/>
            <span className={styles.frameNumber} aria-hidden="true">3</span>
            <h3>Acompanhe os prazos</h3>
            <p>O painel mostra o que vence na semana e o que atrasou. O relatório fecha as multas na data que você escolher.</p>
          </li>
        </ol>
      </section>

      <section aria-labelledby="pv-t" className={styles.preview}>
        <WashiTexture/>
        <div className={`${styles.container} ${styles.previewInner}`}>
          <div className={styles.previewText}>
            <h2 id="pv-t" className={styles.h2}>Tinta e papel por fora. Software sério por dentro.</h2>
            <p className={styles.lead}>A identidade vem do Sumi-e e dos quadros de mangá. A operação é a de um sistema administrativo: tabelas densas, estados claros, teclado em tudo.</p>
            <Link href="/login" className={`${styles.btn} ${styles.btnInk}`}>Explorar o protótipo<Icon name="seta" size={18}/></Link>
          </div>
          <div className={styles.previewArt} aria-hidden="true">
            <div className={styles.mock}>
              <div className={styles.mockSide}>
                <Image src="/inko/logo/inko-logo-inverse.png" alt="" width={900} height={665} sizes="120px" className={styles.mockLogo}/>
                <span className={styles.mockActive}/><span/><span/><span/><span/>
              </div>
              <div className={styles.mockMain}>
                <div className={styles.mockBanner}><strong>Bom dia, Mariana.</strong><span>4 empréstimos atrasados</span></div>
                <div className={styles.mockStats}><span/><span/><span/><span/></div>
                <div className={styles.mockTable}><span/><span/><span/><span/></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Depoimento" className={styles.quoteSection}>
        {/* Marcadores da prancha: o depoimento real ainda não existe e não deve ser inventado. */}
        <figure className={styles.quote}>
          <blockquote>[DEPOIMENTO DE UMA BIBLIOTECA QUE USA O INKO — uma ou duas frases sobre o que mudou no dia a dia]</blockquote>
          <figcaption>[NOME · CARGO · BIBLIOTECA]</figcaption>
        </figure>
      </section>

      <section id="faq" aria-labelledby="fq-t" className={styles.faq}>
        <h2 id="fq-t">Dúvidas frequentes</h2>
        <div className={styles.faqList}>
          {FAQ.map((item, index) => <details key={item.question} className={styles.faqItem} open={index === 0}>
            <summary>{item.question}<Icon name="chevron-baixo" size={20}/></summary>
            <p>{item.answer}</p>
          </details>)}
        </div>
      </section>

      <section id="demo" aria-labelledby="dm-t" className={`${styles.dark} ${styles.demo}`}>
        <SeigaihaBand className={styles.demoWaves}/>
        <div className={styles.demoInner}>
          <Image src="/inko/logo/inko-logo-inverse.png" alt="" width={900} height={665} sizes="220px" className={styles.demoLogo}/>
          <h2 id="dm-t" className={styles.demoTitle}>Veja o INKO com o acervo da sua biblioteca.</h2>
          <p className={styles.demoLead}>Deixe seu e-mail e a gente marca uma demonstração.</p>
          <LeadForm/>
        </div>
      </section>
    </main>

    <footer className={`${styles.dark} ${styles.footer}`}>
      <div className={`${styles.container} ${styles.footerInner}`}>
        <span>INKO · Sistema de gestão de biblioteca de mangás e HQs</span>
        <nav aria-label="Rodapé" className={styles.footerNav}>
          <a href="#acervo">Acervo</a>
          <a href="#recursos">Recursos</a>
          <a href="#faq">Dúvidas</a>
          <Link href="/login">Entrar</Link>
        </nav>
      </div>
    </footer>
  </div>;
}
