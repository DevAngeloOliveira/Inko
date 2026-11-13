'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AppShell } from '../../../components/app-shell';
import { Icon } from '../../../components/icon';
import { useToast } from '../../../components/inko-interactions';
import { CategoryTag, DemoNotice, InkoButton, InkoCover, InkoInput, InkoLinkButton, InkoSelect, InkoStatus, PageHeading } from '../../../components/inko-kit';
import { InkoAlert } from '../../../components/inko-patterns';
import { CATEGORIES, workLabel, type Category, type Work } from '../../../lib/demo';
import { MockApiError, createWork } from '../../../lib/mock-api';
import styles from './cadastro.module.css';

interface FormValues {
  id: string;
  category: '' | Category;
  title: string;
  author: string;
  volume: string;
  publisher: string;
  originalTitle: string;
}

type RequiredField = 'id' | 'category' | 'title' | 'author';
type FieldErrors = Partial<Record<RequiredField, string>>;

const EMPTY: FormValues = { id: '', category: '', title: '', author: '', volume: '', publisher: '', originalTitle: '' };

/** Ordem visual dos campos obrigatórios: define o foco e o resumo de erros. */
const REQUIRED: readonly { field: RequiredField; inputId: string; label: string }[] = [
  { field: 'id', inputId: 'work-id', label: 'Identificador' },
  { field: 'category', inputId: 'work-category', label: 'Categoria' },
  { field: 'title', inputId: 'work-title', label: 'Título' },
  { field: 'author', inputId: 'work-author', label: 'Autor' },
];

const ID_PATTERN = /^INK-\d{4}$/i;

function idError(value: string): string | undefined {
  if (ID_PATTERN.test(value.trim())) return undefined;
  return value ? 'Formato inválido. Use INK- seguido de 4 dígitos.' : 'Informe o identificador.';
}

function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  const id = idError(values.id);
  if (id) errors.id = id;
  if (!values.category) errors.category = 'Escolha uma categoria.';
  if (!values.title.trim()) errors.title = 'Informe o título.';
  if (!values.author.trim()) errors.author = 'Informe o autor.';
  return errors;
}

function isRequiredField(field: string | undefined): field is RequiredField {
  return REQUIRED.some(item => item.field === field);
}

function fieldCount(total: number): string {
  return total === 1 ? '1 campo' : `${total} campos`;
}

export default function NewWorkPage() {
  const toast = useToast();
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [tried, setTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Work | null>(null);
  const [coverName, setCoverName] = useState('');
  // Trocar a chave recria o campo de arquivo (não controlado) ao limpar o formulário.
  const [formKey, setFormKey] = useState(0);

  const errors: FieldErrors = { ...(tried ? validate(values) : {}), ...serverErrors };
  const invalid = REQUIRED.filter(item => errors[item.field]);
  const filled = REQUIRED.filter(item => values[item.field].trim() !== '').length;

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues(current => ({ ...current, [key]: value }));
    setSaved(null);
    setFailure(null);
    if (isRequiredField(key)) setServerErrors(current => ({ ...current, [key]: undefined }));
  }

  function focusField(field: RequiredField) {
    document.getElementById(REQUIRED.find(item => item.field === field)?.inputId ?? '')?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTried(true);
    setSaved(null);
    setFailure(null);
    const local = validate(values);
    const firstInvalid = REQUIRED.find(item => local[item.field]);
    if (firstInvalid || !values.category) {
      if (firstInvalid) focusField(firstInvalid.field);
      return;
    }
    setSaving(true);
    try {
      const work = await createWork({
        id: values.id, category: values.category, title: values.title, author: values.author,
        volume: values.volume, publisher: values.publisher, originalTitle: values.originalTitle,
      });
      setSaved(work);
      setValues(EMPTY);
      setTried(false);
      setServerErrors({});
      setCoverName('');
      setFormKey(key => key + 1);
      toast({ title: 'Obra cadastrada', text: `${workLabel(work)} (${work.id}) já aparece no acervo como Disponível.` });
    } catch (cause) {
      const error = cause instanceof MockApiError ? cause : null;
      const field = error?.field;
      if (error && isRequiredField(field)) {
        setServerErrors({ [field]: error.message });
        focusField(field);
      } else {
        setFailure(error?.message ?? 'Não foi possível salvar a obra. Tente novamente.');
      }
    } finally {
      setSaving(false);
    }
  }

  return <AppShell breadcrumb={[{ label: 'Acervo', href: '/acervo' }, { label: 'Cadastrar obra' }]}>
    <div className={styles.layout}>
      <div className={styles.main}>
        <PageHeading title="Cadastrar obra" description={<>Campos com <span className="inko-required">*</span> são obrigatórios no contrato do serviço de catálogo.</>}/>

        {saved && <InkoAlert tone="success" title="Obra cadastrada e disponível para empréstimo." action={<Link href={`/acervo/${saved.id}`} className={styles.alertLink}>Ver obra</Link>}>{workLabel(saved)} · {saved.id}</InkoAlert>}

        {invalid.length > 0 && <InkoAlert tone="danger" title={`Corrija ${fieldCount(invalid.length)} antes de salvar.`}>
          <ul className={styles.errorList}>
            {invalid.map(item => <li key={item.field}><a href={`#${item.inputId}`} onClick={event => { event.preventDefault(); focusField(item.field); }}>{item.label}</a>: {errors[item.field]}</li>)}
          </ul>
        </InkoAlert>}

        {failure && <InkoAlert tone="danger" title="A obra não foi salva">{failure}</InkoAlert>}

        <form key={formKey} className={`inko-form inko-form--lg ${styles.form}`} onSubmit={handleSubmit} noValidate>
          <fieldset className={styles.required}>
            <legend>Dados obrigatórios</legend>
            <InkoInput id="work-id" label="Identificador" required placeholder="INK-0000" autoComplete="off" spellCheck={false} maxLength={8} className={styles.identifier}
              value={values.id} onChange={event => set('id', event.target.value)} error={errors.id} help="Formato INK-0000 · único no acervo"/>
            <InkoSelect id="work-category" label="Categoria" required value={values.category} onChange={event => set('category', event.target.value as FormValues['category'])} error={errors.category}>
              <option value="">Selecione…</option>
              {CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
            </InkoSelect>
            <InkoInput id="work-title" label="Título" required placeholder="Ex.: Maré de Tinta" autoComplete="off" value={values.title} onChange={event => set('title', event.target.value)} error={errors.title}/>
            <InkoInput id="work-author" label="Autor" required placeholder="Nome como aparece na capa" autoComplete="off" value={values.author} onChange={event => set('author', event.target.value)} error={errors.author}/>
          </fieldset>

          <details className={styles.optional}>
            <summary>Metadados opcionais <span>· volume, editora, título original, capa — dependem do contrato da API</span></summary>
            <div className={styles.optionalGrid}>
              <InkoInput id="work-volume" label="Volume" placeholder="Ex.: Vol. 3" autoComplete="off" value={values.volume} onChange={event => set('volume', event.target.value)}/>
              <InkoInput id="work-publisher" label="Editora" autoComplete="off" value={values.publisher} onChange={event => set('publisher', event.target.value)}/>
              <InkoInput id="work-original-title" label="Título original" lang="ja" autoComplete="off" value={values.originalTitle} onChange={event => set('originalTitle', event.target.value)}/>
              <label className={styles.upload}>
                <Icon name="upload" size={24}/>
                <span className={styles.uploadText}>Enviar capa
                  <small>JPG ou PNG, proporção 2:3, mín. 400×600. Somente imagens com licença de uso.</small>
                  {coverName && <small className={styles.uploadFile}>{coverName} selecionado — não será enviado nesta demonstração.</small>}
                </span>
                <input type="file" accept="image/png,image/jpeg" className="sr-only" aria-describedby="work-cover-note" onChange={event => setCoverName(event.target.files?.[0]?.name ?? '')}/>
              </label>
              <p id="work-cover-note" className={`inko-footnote ${styles.uploadNote}`}>O envio é apenas visual: capas reais dependem de licença de uso e do armazenamento do backend de catálogo. A obra entra no acervo com o estado “Sem capa”.</p>
            </div>
          </details>

          <div className={styles.formFoot}>
            <output className={styles.progress} htmlFor="work-id work-category work-title work-author">{filled} de {REQUIRED.length} campos obrigatórios preenchidos</output>
            <div className="inko-actions inko-actions--end">
              <InkoLinkButton href="/acervo" variant="ghost" className={styles.action}>Cancelar</InkoLinkButton>
              <InkoButton type="submit" loading={saving} className={styles.action}>{saving ? 'Salvando…' : 'Salvar obra'}</InkoButton>
            </div>
          </div>
        </form>
      </div>

      <aside aria-label="Pré-visualização" className={styles.preview}>
        <span className="inko-caption">Pré-visualização no acervo</span>
        <article className="inko-manga-card">
          <InkoCover work={{ title: values.title, volume: values.volume, cover: null }}/>
          <div className="inko-manga-card-meta">
            {values.category ? <CategoryTag category={values.category}/> : <span className="inko-tag">Categoria</span>}
            {values.volume.trim() && <span>{values.volume.trim()}</span>}
          </div>
          <div className="inko-manga-card-title">
            <strong className={styles.previewTitle}>{values.title.trim() || 'Título da obra'}</strong>
            <span>{values.author.trim() || 'Autor'}</span>
          </div>
          <div className="inko-manga-card-footer">
            <InkoStatus status="disp"/>
            <small>{values.id.trim().toUpperCase() || 'INK-0000'}</small>
          </div>
        </article>
        <p className="inko-footnote">Toda obra nova entra como Disponível.</p>
        <DemoNotice>O cadastro é gravado apenas neste navegador, até a integração com o serviço de catálogo.</DemoNotice>
      </aside>
    </div>
  </AppShell>;
}
