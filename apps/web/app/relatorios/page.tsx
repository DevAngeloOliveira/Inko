'use client';
import { useMemo, useState } from 'react';
import { AppShell } from '../../components/app-shell';
import { DemoNotice, InkoButton, PageHeading, Section } from '../../components/inko-kit';
import { activeLateLoans, DEMO_REFERENCE_DATE, formatBRL, formatDate, isValidISODate, loans, totalFineCents, works } from '../../lib/demo';

export default function ReportsPage() {
  const [reference,setReference]=useState(DEMO_REFERENCE_DATE);
  const valid=isValidISODate(reference)&&reference>='2026-10-06';
  const late=useMemo(()=>valid?activeLateLoans(loans,reference):[],[reference,valid]);
  const total=valid?totalFineCents(loans,reference):0;
  const maxDays=late.reduce((max,loan)=>Math.max(max,loan.days),0);
  const counts=late.reduce<Record<string,number>>((acc,loan)=>({...acc,[loan.user]:(acc[loan.user]??0)+1}),{});
  const categories=works.reduce<Record<string,number>>((acc,work)=>({...acc,[work.category]:(acc[work.category]??0)+1}),{});
  return <AppShell><PageHeading eyebrow="RELATÓRIOS / PROGRAMAÇÃO FUNCIONAL" title="Relatório de multas" description="Somente empréstimos ativos atrasados, com data de referência explícita e multa de R$ 2,00 por dia."/>
    <DemoNotice>Relatório calculado em memória sobre empréstimos fictícios do Claude. A regra foi ajustada ao enunciado: devolvidos são excluídos, e não há persistência.</DemoNotice>
    <section className="inko-filter-panel" aria-label="Data de referência"><label className="inko-field"><span className="inko-label">Data de referência</span><input type="date" value={reference} onChange={event=>setReference(event.target.value)} min="2026-10-06" aria-invalid={!valid}/></label><div className="inko-actions">{['2026-11-09','2026-11-16','2026-11-30'].map(date=><InkoButton key={date} variant={reference===date?'primary':'outline'} onClick={()=>setReference(date)}>{formatDate(date)}</InkoButton>)}</div>{!valid&&<span className="inko-field-error">Data inválida. Informe uma data a partir de 06/10/2026.</span>}</section>
    <div className="inko-stat-grid"><div className="inko-kpi inko-kpi--dark"><span>VALOR TOTAL</span><strong>{formatBRL(total)}</strong><small>{late.reduce((sum,loan)=>sum+loan.days,0)} dias × R$ 2,00</small></div><div className="inko-kpi"><span>EMPRÉSTIMOS ATRASADOS</span><strong>{late.length}</strong><small>Apenas empréstimos ativos</small></div><div className="inko-kpi"><span>MAIOR ATRASO</span><strong>{maxDays} dias</strong><small>{late[0]?.work??'Sem atrasos'}</small></div><div className="inko-kpi"><span>EMPRÉSTIMOS ATIVOS</span><strong>{loans.filter(loan=>!loan.returnedAt).length}</strong><small>Base demonstrativa</small></div></div>
    <Section title="Empréstimos ativos atrasados · multa individual"><div className="inko-table-wrap"><table className="inko-table"><thead><tr><th>Código</th><th>Obra</th><th>Usuário</th><th>Vencimento</th><th>Dias</th><th>Multa</th></tr></thead><tbody>{late.map(loan=><tr key={loan.id}><td>{loan.id}</td><td><strong>{loan.work}</strong></td><td>{loan.user}</td><td>{formatDate(loan.due)}</td><td>{loan.days}</td><td><strong>{formatBRL(loan.fineCents)}</strong></td></tr>)}{late.length===0&&<tr><td colSpan={6}>Nenhum empréstimo ativo atrasado na data selecionada.</td></tr>}</tbody><tfoot><tr><th colSpan={5}>Total</th><th>{formatBRL(total)}</th></tr></tfoot></table></div></Section>
    <div className="inko-two-columns"><Section title="Empréstimos atrasados por usuário"><ul className="inko-chart">{Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([name,count])=><li key={name}><span>{name}</span><div><i style={{width:`${count/Math.max(...Object.values(counts),1)*100}%`}}/></div><strong>{count}</strong></li>)}{Object.keys(counts).length===0&&<li>Sem atrasos neste período.</li>}</ul></Section><Section title="Livros por categoria"><ul className="inko-chart">{Object.entries(categories).map(([cat,count])=><li key={cat}><span>{cat}</span><div><i style={{width:`${count/works.length*100}%`}}/></div><strong>{count}</strong></li>)}</ul></Section></div>
  </AppShell>;
}
