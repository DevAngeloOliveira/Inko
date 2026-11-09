'use client';
import { useMemo, useState, type FormEvent } from 'react';
import { AppShell } from '../../components/app-shell';
import { DemoNotice, InkoButton, InkoEmpty, InkoInput, PageHeading, Section } from '../../components/inko-kit';
import { libraryUsers, loans, formatDate } from '../../lib/demo';
import { isValidEmailAddress } from '../../lib/validation';

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(libraryUsers[0].id);
  const [creating, setCreating] = useState(false);
  const [candidate, setCandidate] = useState({ name: '', email: '', registration: '' });
  const [tried, setTried] = useState(false);
  const filtered = useMemo(() => libraryUsers.filter(user => `${user.name} ${user.id} ${user.email}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))), [search]);
  const user = libraryUsers.find(item => item.id === selected) ?? libraryUsers[0];
  const userLoans = loans.filter(loan => loan.user === user.name);
  const valid = candidate.name.trim().length > 1 && isValidEmailAddress(candidate.email) && Boolean(candidate.registration.trim());
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault();setTried(true); }
  return <AppShell><PageHeading eyebrow="USUÁRIOS / CADASTROS" title="Usuários" description="Consulta, histórico e cadastro de leitores" action={<InkoButton onClick={() => {setCreating(true);setTried(false);}}>+ Novo usuário</InkoButton>}/><DemoNotice>Usuários, empréstimos e dados pessoais são fictícios. O cadastro real e a autorização ficarão no MS Usuários.</DemoNotice>
    <div className="inko-user-layout"><Section title="Leitores"><label className="inko-field"><span className="inko-label">Buscar leitor</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome, e-mail ou identificador…"/></label><div className="inko-table-wrap"><table className="inko-table"><thead><tr><th>Leitor</th><th>Código</th><th>Ativos</th><th>Situação</th></tr></thead><tbody>{filtered.map(item => <tr key={item.id} className={selected===item.id?'inko-selected-row':''}><td><button type="button" className="inko-user-picker" onClick={() => setSelected(item.id)}><span className="inko-avatar">{item.name.split(' ').map(p=>p[0]).slice(0,2).join('')}</span>{item.name}</button></td><td>{item.id}</td><td>{item.active}</td><td><span className={`inko-badge inko-badge--${item.late?'danger':'success'}`}>{item.late?'Com atraso':'Regular'}</span></td></tr>)}</tbody></table></div>{filtered.length===0&&<InkoEmpty title="Sem resultados" text="Nenhum usuário corresponde à pesquisa."/>}</Section>
      <Section title={creating?'Novo usuário':'Detalhes do usuário'}>{creating?<form className="inko-form" onSubmit={submit}><InkoInput id="user-name" label="Nome completo" value={candidate.name} onChange={event=>setCandidate(v=>({...v,name:event.target.value}))}/><InkoInput id="user-email" label="E-mail" type="email" value={candidate.email} onChange={event=>setCandidate(v=>({...v,email:event.target.value}))}/><InkoInput id="user-reg" label="Matrícula" value={candidate.registration} onChange={event=>setCandidate(v=>({...v,registration:event.target.value}))}/><div className="inko-actions"><InkoButton type="submit">Validar cadastro</InkoButton><InkoButton variant="outline" type="button" onClick={()=>setCreating(false)}>Cancelar</InkoButton></div>{tried&&<div role="status" className={`inko-alert ${valid?'inko-alert--success':'inko-alert--danger'}`}>{valid?'Campos válidos. Persistência indisponível até integração com o MS Usuários.':'Preencha nome, matrícula e e-mail válido.'}</div>}</form>:<><div className="inko-person"><span className="inko-avatar inko-avatar--large">{user.name.split(' ').map(p=>p[0]).slice(0,2).join('')}</span><div><h3>{user.name}</h3><p>{user.id} · {user.email}</p><span className={`inko-badge inko-badge--${user.late?'danger':'success'}`}>{user.late?'Com atraso':'Regular'}</span></div></div><h3 className="inko-subheading">Histórico de empréstimos</h3><div className="inko-history">{userLoans.map(loan=><div key={loan.id}><strong>{loan.work}</strong><span>{formatDate(loan.start)} → {formatDate(loan.due)}</span><small>{loan.returnedAt?'Devolvido':'Ativo'}</small></div>)}{userLoans.length===0&&<p className="inko-muted">Nenhum empréstimo na amostra demonstrativa.</p>}</div></>}</Section></div>
  </AppShell>;
}
