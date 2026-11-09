'use client';
import { useMemo, useState } from 'react';
import { AppShell } from '../../components/app-shell';
import { DemoNotice, InkoButton, PageHeading, Section } from '../../components/inko-kit';
import { DEMO_REFERENCE_DATE, daysOverdue, formatDate, isValidISODate, loans } from '../../lib/demo';

export default function ReturnsPage() {
  const [search,setSearch]=useState('');
  const [selected,setSelected]=useState<string|null>(null);
  const [returnDate,setReturnDate]=useState(DEMO_REFERENCE_DATE);
  const filtered=useMemo(()=>loans.filter(loan=>!loan.returnedAt&&`${loan.id} ${loan.work} ${loan.user}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))),[search]);
  const loan=loans.find(item=>item.id===selected);
  const valid=isValidISODate(returnDate)&&loan!==undefined&&returnDate>=loan.start&&returnDate<=DEMO_REFERENCE_DATE;
  const late=loan&&valid?daysOverdue(loan.due,returnDate):0;
  return <AppShell><PageHeading eyebrow="CIRCULAÇÃO / DEVOLUÇÕES" title="Registrar devolução" description="Localize o empréstimo e confira os dados da operação"/>
    <DemoNotice>Conferência demonstrativa. A ação de devolução fica indisponível até o MS Circulação implementar RF-09. Multas de empréstimos devolvidos não são calculadas nesta versão.</DemoNotice>
    <div className="inko-two-columns"><Section title="Empréstimos ativos"><label className="inko-field"><span className="inko-label">Pesquisar empréstimo</span><input type="search" placeholder="Código, usuário ou obra…" value={search} onChange={event=>setSearch(event.target.value)}/></label><div className="inko-choice-list">{filtered.map(item=><button key={item.id} onClick={()=>setSelected(item.id)} aria-pressed={selected===item.id} className={selected===item.id?'inko-choice--selected':''}><span><strong>{item.work}</strong><small>{item.id} · {item.user} · prazo {formatDate(item.due)}</small></span></button>)}{filtered.length===0&&<p className="inko-muted">Nenhum empréstimo encontrado.</p>}</div></Section>
    <Section title="Conferência">{loan?<div className="inko-form"><dl className="inko-definition"><div><dt>Identificador</dt><dd>{loan.id}</dd></div><div><dt>Obra</dt><dd>{loan.work}</dd></div><div><dt>Leitor</dt><dd>{loan.user}</dd></div><div><dt>Empréstimo</dt><dd>{formatDate(loan.start)}</dd></div><div><dt>Prazo</dt><dd>{formatDate(loan.due)}</dd></div></dl><label className="inko-field"><span className="inko-label">Data efetiva de devolução</span><input type="date" value={returnDate} onChange={event=>setReturnDate(event.target.value)} min={loan.start} max={DEMO_REFERENCE_DATE} aria-invalid={!valid}/></label>{!valid?<div className="inko-alert inko-alert--danger">Informe uma data válida entre o empréstimo e a data de referência.</div>:<div className={`inko-alert ${late?'inko-alert--warning':'inko-alert--success'}`}>{late>0?`${late} dia(s) após o vencimento. A regra de multa para devolvidos não está prevista no relatório acadêmico.`:'Devolução dentro do prazo.'}</div>}<InkoButton disabled>Confirmar devolução</InkoButton></div>:<div className="inko-empty-small">Selecione um empréstimo para realizar a conferência.</div>}</Section></div>
  </AppShell>;
}
