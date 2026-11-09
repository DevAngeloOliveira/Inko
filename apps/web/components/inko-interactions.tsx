'use client';
import { useState } from 'react';
import { InkoButton, InkoInput } from './inko-kit';
import { InkoSkeleton, InkoTabs } from './inko-patterns';

export function InkoInteractions() {
  const [tab,setTab]=useState('Componentes');
  const [dialog,setDialog]=useState(false);
  const [message,setMessage]=useState('');
  const [search,setSearch]=useState('');
  return <div className="inko-form">
    <InkoTabs items={['Componentes','Carregamento','Feedback']} active={tab} onChange={setTab}/>
    {tab === 'Componentes' && <><InkoInput id="ds-search" label="InkoInput · estado padrão" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Digite para testar…"/><div className="inko-actions"><InkoButton onClick={()=>setDialog(true)}>Abrir modal</InkoButton><InkoButton variant="outline" onClick={()=>setMessage('Mensagem de demonstração exibida.')}>Mostrar toast</InkoButton></div></>}
    {tab === 'Carregamento' && <InkoSkeleton lines={4}/>}
    {tab === 'Feedback' && <div className="inko-alert inko-alert--success">As mensagens de feedback são textuais e não dependem somente da cor.</div>}
    {message && <div className="inko-toast" role="status">{message}<button aria-label="Fechar notificação" onClick={()=>setMessage('')}>×</button></div>}
    {dialog && <div className="inko-modal-backdrop" role="presentation" onClick={()=>setDialog(false)}><section role="dialog" aria-modal="true" aria-labelledby="inko-modal-title" className="inko-modal" onClick={event=>event.stopPropagation()}><h2 id="inko-modal-title">Modal INKO</h2><p>Componente demonstrativo de diálogo com confirmação e cancelamento.</p><div className="inko-actions"><InkoButton variant="outline" onClick={()=>setDialog(false)}>Cancelar</InkoButton><InkoButton onClick={()=>{setDialog(false);setMessage('Ação de demonstração concluída.');}}>Confirmar</InkoButton></div></section></div>}
  </div>;
}
