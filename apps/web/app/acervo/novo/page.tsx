'use client';
import { useState, type FormEvent } from 'react';
import { AppShell } from '../../../components/app-shell';
import { DemoNotice, InkoButton, InkoInput, InkoLinkButton, PageHeading, Section } from '../../../components/inko-kit';

export default function NewWorkPage() {
  const [values, setValues] = useState({ id: '', title: '', author: '', category: '' });
  const [attempted, setAttempted] = useState(false);
  const [validated, setValidated] = useState(false);
  const errors = { id: /^INK-\d{4}$/i.test(values.id.trim()) ? '' : 'Use o formato INK-0000.', title: values.title.trim() ? '' : 'Informe o título.', author: values.author.trim() ? '' : 'Informe o autor.', category: values.category ? '' : 'Escolha uma categoria.' };
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault();setAttempted(true);setValidated(Object.values(errors).every(value => !value)); }
  function update(key: keyof typeof values, value: string) { setValues(current => ({...current,[key]: value}));setValidated(false); }
  return <AppShell><PageHeading eyebrow="ACERVO / NOVA OBRA" title="Cadastrar obra" description="Valide os dados e visualize a prévia de um novo item de acervo." action={<InkoLinkButton href="/acervo" variant="outline">Voltar</InkoLinkButton>}/>
    <DemoNotice>Formulário demonstrativo: validações funcionam, mas nenhuma obra é salva antes da API de catálogo.</DemoNotice>
    <div className="inko-two-columns"><Section title="Dados da obra"><form className="inko-form" onSubmit={submit} noValidate>
      <InkoInput id="work-id" label="Identificador *" placeholder="INK-0009" value={values.id} onChange={event => update('id',event.target.value)} error={attempted?errors.id:undefined} help="Formato único no acervo: INK-0000"/>
      <InkoInput id="work-title" label="Título *" value={values.title} onChange={event => update('title',event.target.value)} error={attempted?errors.title:undefined}/>
      <InkoInput id="work-author" label="Autor *" value={values.author} onChange={event => update('author',event.target.value)} error={attempted?errors.author:undefined}/>
      <label className="inko-field"><span className="inko-label">Categoria *</span><select value={values.category} aria-invalid={attempted && Boolean(errors.category)} onChange={event => update('category',event.target.value)}><option value="">Selecionar categoria</option>{['Mangá','HQ','Graphic novel'].map(cat=><option key={cat}>{cat}</option>)}</select>{attempted && errors.category && <span className="inko-field-error">{errors.category}</span>}</label>
      <div className="inko-actions"><InkoButton type="submit">Validar cadastro</InkoButton><InkoLinkButton href="/acervo" variant="ghost">Cancelar</InkoLinkButton></div>
      {validated && <output className="inko-alert inko-alert--success">Todos os campos passaram na validação. A gravação fica disponível quando o MS Catálogo for implementado.</output>}
    </form></Section><Section title="Prévia da obra"><div className="inko-preview"><div className="inko-preview-cover">INKO <span>EDIÇÃO EM PREPARAÇÃO</span></div><div><span className="inko-tag">{values.category || 'Categoria'}</span><h3>{values.title || 'Título da obra'}</h3><p>{values.author || 'Autor'}</p><small>{values.id || 'INK-0000'}</small></div></div></Section></div>
  </AppShell>;
}
