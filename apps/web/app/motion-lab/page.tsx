import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Motion Lab',
  description: 'Demonstrações dos motions originais do Claude Design.',
};

const svgPath = 'M151.4 38.7 A80 80 0 1 0 175.2 127.4';
const brushPath = 'M8 12C60 5 150 3 230 6c30 1 52 0 66 5-6 7 2 15-3 22-38 9-120 8-190 10-38 1-74 2-100-3 6-8-2-17 3-23Z';

export default function MotionLab() {
  return (
    <main className="inko-legacy-page" style={{ background: 'var(--inko-background-default)', minHeight: '100vh', padding: 'clamp(24px, 5vw, 80px)', color: 'var(--inko-text-primary)' }}>
      <div className="eyebrow">INKO / DESIGN SOURCE · MOTION LAB</div>
      <h1 style={{ maxWidth: 960 }}>Tinta em movimento.</h1>
      <p className="description">Padrões extraídos de Foundations-Layout.dc.html, Prototype-Dashboard.dc.html e Components-Core.dc.html. Os três primeiros reproduzem um ciclo de 2,4 segundos.</p>
      <section aria-label="Demonstrações de movimento" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginTop: 38 }}>
        <article className="service-card" style={{ minHeight: 275, flexDirection: 'column', alignItems: 'stretch' }}>
          <h2 style={{ fontSize: 19 }}>Enso · draw</h2>
          <div style={{ minHeight: 164, display: 'grid', placeItems: 'center' }}>
            <svg viewBox="0 0 200 200" width="150" height="150" role="img" aria-label="Círculo Enso sendo desenhado com tinta vermelha">
              <path className="inko-motion-demo-enso" d={svgPath} fill="none" stroke="var(--inko-brand-seal)" strokeWidth="16" strokeLinecap="round" />
            </svg>
          </div>
          <small>2.400 ms · 55% draw · 45% hold</small>
        </article>
        <article className="service-card" style={{ minHeight: 275, flexDirection: 'column', alignItems: 'stretch' }}>
          <h2 style={{ fontSize: 19 }}>Painel · entrada</h2>
          <div style={{ minHeight: 164, display: 'grid', placeItems: 'center' }}>
            <div className="inko-motion-demo-panel" style={{ width: 108, height: 82, border: '3px solid var(--inko-brand-ink)', backgroundColor: 'var(--inko-surface-default)', backgroundImage: 'radial-gradient(var(--inko-brand-ink) 1px, transparent 1.3px)', backgroundSize: '5px 5px' }} />
          </div>
          <small>2.400 ms · 30% entrada · 70% hold</small>
        </article>
        <article className="service-card" style={{ minHeight: 275, flexDirection: 'column', alignItems: 'stretch' }}>
          <h2 style={{ fontSize: 19 }}>Pincelada · reveal</h2>
          <div style={{ minHeight: 164, display: 'grid', placeItems: 'center' }}>
            <svg className="inko-motion-demo-brush" viewBox="0 0 300 48" width="190" height="52" role="img" aria-label="Pincelada preta revelada progressivamente">
              <path fill="var(--inko-brand-ink)" d={brushPath} />
            </svg>
          </div>
          <small>2.400 ms · 45% reveal · 55% hold</small>
        </article>
      </section>
      <section aria-label="Microinterações" style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center', marginTop: 38 }}>
        <button className="inko-motion-interactive" style={{ border: 'none', borderRadius: 8, padding: '14px 20px', color: '#fff' }}>Hover / 150 ms</button>
        <div role="status" className="inko-motion-toast" style={{ background: 'var(--inko-surface-default)', border: '1px solid var(--inko-border-default)', borderRadius: 8, padding: 16 }}>Toast / 200 ms</div>
        <div aria-label="Exemplo de skeleton loading" className="inko-motion-shimmer" style={{ width: 150, height: 40, borderRadius: 8 }} />
      </section>
      <p style={{ marginTop: 38, color: 'var(--inko-text-secondary)', lineHeight: 1.6 }}>Todas as animações respeitam a preferência de movimento reduzido. Este laboratório é demonstrativo: chamadas reais, autenticação e empréstimos devem usar o Gateway e os serviços Java.</p>
    </main>
  );
}
