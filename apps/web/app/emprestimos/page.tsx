'use client';
import { useState } from 'react';
import { AppShell } from '../../components/app-shell';
import { DemoNotice, InkoButton, InkoLinkButton, InkoStatus, PageHeading, Section } from '../../components/inko-kit';
import { DEMO_REFERENCE_DATE, formatDate, libraryUsers, works } from '../../lib/demo';

const labels = ['Usuário','Obra','Disponibilidade','Datas','Confirmar'];

function stepClassName(step: number, currentStep: number): string {
  if (step === currentStep) return 'inko-step-current';
  if (step < currentStep) return 'inko-step-complete';
  return '';
}

export default function LoansPage() {
  const [userId, setUserId] = useState('');
  const [workId, setWorkId] = useState('');
  const [term, setTerm] = useState(14);
  const [step, setStep] = useState(1);
  const user = libraryUsers.find(item=>item.id===userId);
  const work = works.find(item=>item.id===workId);
  const available = work?.availability === 'disp';
  const dueDate = new Date(`${DEMO_REFERENCE_DATE}T00:00:00Z`);
  dueDate.setUTCDate(dueDate.getUTCDate()+term);
  return <AppShell><PageHeading eyebrow="CIRCULAÇÃO / EMPRÉSTIMOS" title="Novo empréstimo" description="Fluxo guiado de seleção, disponibilidade e conferência" action={<InkoLinkButton href="/acervo" variant="outline">Consultar acervo</InkoLinkButton>}/><DemoNotice>Este fluxo funciona como prévia interativa. Não registra empréstimos no backend e não altera disponibilidade.</DemoNotice>
    <ol className="inko-stepper">{labels.map((label,i)=><li key={label} className={stepClassName(i + 1, step)}><span>{i+1<step?'✓':i+1}</span>{label}</li>)}</ol>
    <div className="inko-two-columns"><Section title={`${step} · ${labels[step-1]}`}>
      {step===1&&<div className="inko-choice-list">{libraryUsers.slice(0,4).map(item=><button key={item.id} type="button" aria-pressed={userId===item.id} className={userId===item.id?'inko-choice--selected':''} onClick={()=>setUserId(item.id)}><span className="inko-avatar">{item.name.charAt(0)}</span><span><strong>{item.name}</strong><small>{item.id} · {item.late?'Possui atraso':'Sem alerta na amostra'}</small></span></button>)}</div>}
      {step===2&&<div className="inko-choice-list">{works.filter(w=>['INK-0002','INK-0003','INK-0004','INK-0006'].includes(w.id)).map(item=><button key={item.id} type="button" aria-pressed={workId===item.id} className={workId===item.id?'inko-choice--selected':''} onClick={()=>setWorkId(item.id)}><span className={`inko-choice-thumbnail inko-cover--${item.cover}`}/><span><strong>{item.title} · {item.volume}</strong><small>{item.author} · {item.id}</small></span><InkoStatus status={item.availability}/></button>)}</div>}
      {step===3&&<div className={`inko-alert ${available?'inko-alert--success':'inko-alert--danger'}`}>{available?`${work?.title} está disponível na amostra de dados.`:`${work?.title ?? 'Obra'} está indisponível. Escolha outra obra para prosseguir.`}</div>}
      {step===4&&<div className="inko-form"><label className="inko-field"><span className="inko-label">Prazo de empréstimo</span><select value={term} onChange={event=>setTerm(Number(event.target.value))}><option value={7}>7 dias</option><option value={14}>14 dias</option><option value={21}>21 dias</option></select></label><div className="inko-definition"><div><dt>Data inicial (demonstração)</dt><dd>{formatDate(DEMO_REFERENCE_DATE)}</dd></div><div><dt>Data prevista</dt><dd>{formatDate(dueDate.toISOString().slice(0,10))}</dd></div></div></div>}
      {step===5&&<div className="inko-form"><h3>Prévia do empréstimo</h3><p>Os dados estão prontos para uma futura requisição ao microsserviço de circulação.</p><div className="inko-alert inko-alert--warning">A confirmação está desabilitada enquanto o backend não implementa RF-07. Nenhum empréstimo será registrado.</div><InkoButton disabled>Confirmar empréstimo</InkoButton></div>}
      <div className="inko-actions"><InkoButton variant="outline" disabled={step===1} onClick={()=>setStep(value=>Math.max(1,value-1))}>Voltar</InkoButton><InkoButton disabled={step===5||(step===1&&!userId)||(step===2&&!workId)||(step===3&&!available)} onClick={()=>setStep(value=>Math.min(5,value+1))}>Continuar</InkoButton></div>
    </Section><Section title="Resumo da operação"><dl className="inko-definition"><div><dt>Usuário</dt><dd>{user?.name??'Não selecionado'}</dd></div><div><dt>Obra</dt><dd>{work?`${work.title} · ${work.volume}`:'Não selecionada'}</dd></div><div><dt>Disponibilidade</dt><dd>{work?<InkoStatus status={work.availability}/>: '—'}</dd></div><div><dt>Prazo</dt><dd>{term} dias</dd></div><div><dt>Previsão</dt><dd>{formatDate(dueDate.toISOString().slice(0,10))}</dd></div></dl><p className="inko-footnote">No backend, a disponibilidade precisará ser validada novamente em transação para impedir empréstimos simultâneos.</p></Section></div>
  </AppShell>;
}
