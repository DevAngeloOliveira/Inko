import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '../../../components/app-shell';
import { DemoNotice, InkoCover, InkoLinkButton, InkoStatus, PageHeading, Section } from '../../../components/inko-kit';
import { works } from '../../../lib/demo';

export function generateStaticParams() { return works.map(work => ({ id: work.id })); }

export default async function WorkDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const work = works.find(item => item.id === id);
  if (!work) notFound();
  return <AppShell><PageHeading eyebrow="ACERVO / DETALHES" title={`${work.title} · ${work.volume}`} action={<InkoLinkButton href="/acervo" variant="outline">Voltar ao acervo</InkoLinkButton>}/><DemoNotice>A obra, a capa e seus dados são demonstrativos. O histórico real dependerá do MS Circulação.</DemoNotice>
    <section className="inko-work-details"><InkoCover work={work}/><div><div className="inko-work-details-top"><span className="inko-tag">{work.category}</span><InkoStatus status={work.availability}/></div><h2>{work.title}</h2><p className="inko-muted">{work.author}</p><dl className="inko-definition"><div><dt>Identificador</dt><dd>{work.id}</dd></div><div><dt>Volume</dt><dd>{work.volume}</dd></div><div><dt>Categoria</dt><dd>{work.category}</dd></div><div><dt>Disponibilidade</dt><dd>{work.availability === 'disp' ? 'Disponível' : 'Indisponível'}</dd></div></dl><div className="inko-actions">{work.availability === 'disp' ? <InkoLinkButton href="/emprestimos">Simular empréstimo</InkoLinkButton> : <InkoLinkButton href="/devolucoes" variant="outline">Consultar devoluções</InkoLinkButton>}</div></div></section>
    <Section title="Histórico de movimentações"><div className="inko-empty-small">O histórico será apresentado quando o serviço de circulação estiver integrado.</div></Section><p className="inko-footnote"><Link href="/acervo">← Ver todas as obras</Link></p>
  </AppShell>;
}
