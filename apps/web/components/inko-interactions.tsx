'use client';

import { useRef, useState } from 'react';
import { InkoButton, InkoInput } from './inko-kit';
import { InkoSkeleton, InkoTabs } from './inko-patterns';

export function InkoInteractions() {
  const [tab, setTab] = useState('Componentes');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);

  function closeDialog() {
    dialogRef.current?.close();
  }

  function confirmDialog() {
    closeDialog();
    setMessage('Ação de demonstração concluída.');
  }

  return (
    <div className="inko-form">
      <InkoTabs items={['Componentes', 'Carregamento', 'Feedback']} active={tab} onChange={setTab} />

      {tab === 'Componentes' && (
        <>
          <InkoInput id="ds-search" label="InkoInput · estado padrão" value={search} onChange={event => setSearch(event.target.value)} placeholder="Digite para testar…" />
          <div className="inko-actions">
            <InkoButton onClick={() => dialogRef.current?.showModal()}>Abrir modal</InkoButton>
            <InkoButton variant="outline" onClick={() => setMessage('Mensagem de demonstração exibida.')}>Mostrar toast</InkoButton>
          </div>
        </>
      )}

      {tab === 'Carregamento' && <InkoSkeleton lines={4} />}
      {tab === 'Feedback' && <div className="inko-alert inko-alert--success">As mensagens de feedback são textuais e não dependem somente da cor.</div>}

      {message && (
        <output className="inko-toast">
          <span>{message}</span>
          <button type="button" aria-label="Fechar notificação" onClick={() => setMessage('')}>×</button>
        </output>
      )}

      <dialog ref={dialogRef} aria-labelledby="inko-modal-title" className="inko-modal">
        <h2 id="inko-modal-title">Modal INKO</h2>
        <p>Componente demonstrativo de diálogo com confirmação e cancelamento.</p>
        <div className="inko-actions">
          <InkoButton variant="outline" onClick={closeDialog}>Cancelar</InkoButton>
          <InkoButton onClick={confirmDialog}>Confirmar</InkoButton>
        </div>
      </dialog>
    </div>
  );
}
