'use client';

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './icon';
import { InkoButton, InkoField } from './inko-kit';

/* ---------- Toast ---------- */

export interface ToastOptions {
  title: string;
  text?: string;
  tone?: 'success' | 'danger';
  /** Mostra "Desfazer" e executa o retorno ao clicar. */
  onUndo?: () => void;
}

const TOAST_DURATION_MS = 5000;
const ToastContext = createContext<(toast: ToastOptions) => void>(() => {});

/** Exibe um toast por 5 s; a contagem pausa com o ponteiro ou o foco sobre ele. */
export function useToast(): (toast: ToastOptions) => void {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [toast, setToast] = useState<(ToastOptions & { key: number }) | null>(null);
  const [paused, setPaused] = useState(false);

  const show = useCallback((options: ToastOptions) => {
    setPaused(false);
    setToast({ ...options, key: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast || paused) return undefined;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast, paused]);

  function undo() {
    toast?.onUndo?.();
    setToast(null);
  }

  return <ToastContext.Provider value={show}>
    {children}
    <div className="inko-toast-region" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      {toast && <output key={toast.key} className="inko-toast inko-motion-toast" role={toast.tone === 'danger' ? 'alert' : undefined}>
        <Icon name={toast.tone === 'danger' ? 'alerta' : 'check-circulo'} size={20} className={toast.tone === 'danger' ? 'inko-toast-icon--danger' : 'inko-toast-icon--success'}/>
        <span className="inko-toast-body"><strong>{toast.title}</strong>{toast.text && <span>{toast.text}</span>}</span>
        {toast.onUndo && <button type="button" className="inko-toast-undo" onClick={undo}>Desfazer</button>}
        <button type="button" className="inko-toast-close" aria-label="Fechar aviso" onClick={() => setToast(null)}><Icon name="fechar" size={16}/></button>
      </output>}
    </div>
  </ToastContext.Provider>;
}

/* ---------- Confirmation Dialog ---------- */

/**
 * Diálogo de confirmação sobre o elemento nativo `<dialog>` (foco preso, Esc fecha).
 * Ações destrutivas sempre passam por aqui.
 */
export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = 'Cancelar', tone = 'danger', loading = false, onConfirm, onCancel }: Readonly<{ open: boolean; title: string; children: ReactNode; confirmLabel: string; cancelLabel?: string; tone?: 'danger' | 'primary'; loading?: boolean; onConfirm: () => void; onCancel: () => void }>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return <dialog ref={dialogRef} className="inko-modal" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onCancel(); }}>
    <div className="inko-modal-content">
      <span className={`inko-modal-icon inko-modal-icon--${tone}`}><Icon name={tone === 'danger' ? 'alerta' : 'info'} size={20}/></span>
      <div><h2 id={titleId}>{title}</h2><div className="inko-modal-text">{children}</div></div>
    </div>
    <div className="inko-modal-actions">
      <InkoButton variant="ghost" onClick={onCancel} disabled={loading}>{cancelLabel}</InkoButton>
      <InkoButton variant={tone} onClick={onConfirm} loading={loading}>{confirmLabel}</InkoButton>
    </div>
  </dialog>;
}

/* ---------- Controles com estado ---------- */

export function InkoSwitch({ checked, onChange, children }: Readonly<{ checked: boolean; onChange: (checked: boolean) => void; children: ReactNode }>) {
  return <button type="button" role="switch" aria-checked={checked} className="inko-switch" onClick={() => onChange(!checked)}><span className="inko-switch-track"><span/></span>{children}</button>;
}

export function InkoPasswordInput({ id, label, help, error, required, ...props }: Readonly<Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { id: string; label: string; help?: string; error?: string }>) {
  const [visible, setVisible] = useState(false);
  return <InkoField id={id} label={label} help={help} error={error} required={required}>
    <span className="inko-control inko-control--action">
      <input {...props} id={id} type={visible ? 'text' : 'password'} className="inko-input" required={required} aria-invalid={Boolean(error)} aria-describedby={error || help ? `${id}-help` : undefined}/>
      <button type="button" className="inko-control-action" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={visible} onClick={() => setVisible(value => !value)}><Icon name={visible ? 'olho-fechado' : 'olho'} size={18}/></button>
    </span>
  </InkoField>;
}

/** Fecha um popover ao clicar fora ou pressionar Esc. */
export function useDismiss<T extends HTMLElement>(open: boolean, onDismiss: () => void) {
  const ref = useRef<T>(null);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) dismiss.current();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') dismiss.current();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return ref;
}

/** Simula a espera de uma consulta: `loading` por um instante a cada `reload()`. */
export function useMockQuery(delay = 900): { loading: boolean; reload: () => void } {
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), delay);
    return () => clearTimeout(timer);
  }, [tick, delay]);

  const reload = useCallback(() => setTick(value => value + 1), []);
  return useMemo(() => ({ loading, reload }), [loading, reload]);
}
