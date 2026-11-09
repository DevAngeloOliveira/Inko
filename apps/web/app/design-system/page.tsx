import Image from 'next/image';
import { AppShell } from '../../components/app-shell';
import { DemoNotice, InkoButton, InkoStatus, PageHeading, Section } from '../../components/inko-kit';
import { InkoInteractions } from '../../components/inko-interactions';

const colors = [
  ['Sumi Black','#111111'],['Washi Paper','#F7F3ED'],['Hanko Red','#C43B2F'],['Ink Brown','#5B4636'],['Sand','#E8D9C5'],['Graphite','#2D3748'],
];
const graphics=['pincelada-horizontal-ink','pincelada-horizontal-seal','enso-seal','sakura','seigaiha-tile','selo'];
export default function DesignSystemPage(){return <AppShell><PageHeading eyebrow="FOUNDATIONS / HANDOFF" title="Design System INKO" description="Biblioteca visual implementada a partir das pranchas originais do Claude Design."/><DemoNotice>Esta página documenta os foundations; as telas funcionais seguem implementadas com os mesmos tokens e componentes.</DemoNotice>
  <Section title="Paleta · Sumi clássico"><div className="inko-palette">{colors.map(([name,color])=><div key={name}><div style={{backgroundColor:color}}/><strong>{name}</strong><code>{color}</code></div>)}</div></Section>
  <Section title="Tipografia"><div className="inko-typography"><h2>Manrope · Títulos e hierarquia</h2><p>Inter · Textos de formulário, leitura e operação.</p><span>JETBRAINS MONO · METADADOS E CÓDIGOS</span></div></Section>
  <Section title="Componentes"><div className="inko-design-examples"><InkoButton>Confirmar</InkoButton><InkoButton variant="secondary">Secundário</InkoButton><InkoButton variant="outline">Outline</InkoButton><InkoButton disabled>Desabilitado</InkoButton><InkoStatus status="disp"/><InkoStatus status="emp"/><InkoStatus status="atr"/></div></Section>
  <Section title="Elementos gráficos proprietários"><div className="inko-graphic-grid">{graphics.map(item=><div key={item}><Image src={`/inko/svg/elementos/${item}.svg`} alt={`Asset ${item}`} width={180} height={120} unoptimized/><span>{item}</span></div>)}</div></Section>
  <Section title="Interações e estados"><InkoInteractions/></Section>
  <Section title="Motion e acessibilidade"><p className="inko-muted">Revelação de pincelada, desenho de Enso, entrada editorial e feedback utilizam o arquivo de motion do INKO. Animações respeitam prefers-reduced-motion.</p><a href="/motion-lab" className="inko-text-link">Abrir demonstrações de motion →</a></Section>
</AppShell>}
