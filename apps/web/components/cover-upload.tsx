'use client';

import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { workLabel, type Work } from '../lib/demo';
import { ApiError, COVER_TYPES, coverFileError, removeCover, uploadCover } from '../lib/library-api';
import { ConfirmDialog, useToast } from './inko-interactions';
import { InkoButton, ProgressBar } from './inko-kit';
import { InkoAlert } from './inko-patterns';

type Phase = 'idle' | 'ready' | 'sending' | 'removing';

/**
 * Envio e troca da capa de uma obra (SDD-002 §4.4): pré-visualização local,
 * progresso, erro e confirmação. Só aceita JPEG/PNG até 2 MiB; o Catálogo valida
 * de novo assinatura, dimensões e conteúdo antes de gravar.
 */
export function CoverUpload({ work }: Readonly<{ work: Work }>) {
  const inputId = useId();
  const hintId = useId();
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function reset() {
    setFile(null);
    setPreview(null);
    setProgress(0);
    setPhase('idle');
    if (input.current) input.current.value = '';
  }

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setError(null);
    if (!selected) {
      reset();
      return;
    }
    const problem = coverFileError(selected);
    if (problem) {
      reset();
      setError(problem);
      return;
    }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setPhase('ready');
  }

  async function send() {
    if (!file) return;
    setPhase('sending');
    setError(null);
    try {
      await uploadCover(work.id, file, setProgress);
      toast({ title: 'Capa salva', text: `A capa de ${workLabel(work)} foi gravada no acervo.` });
      reset();
    } catch (cause) {
      setPhase('ready');
      setProgress(0);
      setError(cause instanceof ApiError ? cause.message : 'Não foi possível enviar a capa. Tente novamente.');
    }
  }

  async function remove() {
    setPhase('removing');
    setError(null);
    try {
      await removeCover(work.id);
      setConfirmRemove(false);
      toast({ title: 'Capa removida', text: `${workLabel(work)} volta a usar a capa ilustrada do INKO.` });
      reset();
    } catch (cause) {
      setConfirmRemove(false);
      setPhase('idle');
      setError(cause instanceof ApiError ? cause.message : 'Não foi possível remover a capa.');
    }
  }

  const busy = phase === 'sending' || phase === 'removing';

  return <section className="inko-cover-upload" aria-label="Capa da obra">
    {preview && <img className="inko-cover-upload-preview" src={preview} alt="Pré-visualização da nova capa"/>}
    <label htmlFor={inputId} className="inko-label">{work.coverUrl ? 'Trocar capa' : 'Enviar capa'}</label>
    <input ref={input} id={inputId} type="file" accept={COVER_TYPES.join(',')} aria-describedby={hintId} disabled={busy} onChange={choose}/>
    <small id={hintId} className="inko-footnote">JPEG ou PNG, até 2 MiB e 12 megapixels. Use apenas imagens com direito de uso.</small>
    {phase === 'sending' && <ProgressBar value={progress} label="Envio da capa"/>}
    {error && <InkoAlert tone="danger" title="Capa não enviada">{error}</InkoAlert>}
    <div className="inko-actions">
      {file && <InkoButton size="sm" leftIcon="upload" loading={phase === 'sending'} onClick={() => void send()}>Salvar capa</InkoButton>}
      {file && <InkoButton size="sm" variant="ghost" disabled={busy} onClick={reset}>Cancelar</InkoButton>}
      {!file && work.coverUrl && <InkoButton size="sm" variant="ghost" leftIcon="lixeira" disabled={busy} onClick={() => setConfirmRemove(true)}>Remover capa</InkoButton>}
    </div>
    <ConfirmDialog open={confirmRemove} title="Remover capa?" confirmLabel="Remover capa" loading={phase === 'removing'} onConfirm={() => void remove()} onCancel={() => setConfirmRemove(false)}>
      <p>A imagem de <strong>{workLabel(work)}</strong> será apagada do acervo. A obra volta a usar a capa ilustrada.</p>
    </ConfirmDialog>
  </section>;
}
