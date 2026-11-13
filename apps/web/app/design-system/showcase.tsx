'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CATEGORIES, DEMO_REFERENCE_DATE, activeLateLoans, daysBetween, daysOverdue, formatBRL, formatDate, loans, totalFineCents, works, type Loan } from '../../lib/demo';
import { Icon, type IconName } from '../../components/icon';
import { ConfirmDialog, InkoPasswordInput, InkoSwitch, useMockQuery, useToast } from '../../components/inko-interactions';
import { Breadcrumb, CategoryTag, InkoBadge, InkoButton, InkoCover, InkoEmpty, InkoErrorState, InkoInput, InkoSearch, InkoSegmented, InkoSelect, InkoStatus, InkoTextarea, ProgressBar, type ButtonVariant } from '../../components/inko-kit';
import { InkoAlert, InkoPillTabs, InkoSkeleton, InkoStatistic, InkoStatisticSkeleton, InkoTabs, Pagination } from '../../components/inko-patterns';
import styles from './design-system.module.css';

/** Bloco de documentação: nome do componente, props principais e nota de uso da prancha. */
export function Block({ name, props, note, children }: Readonly<{ name: string; props?: string; note?: ReactNode; children: ReactNode }>) {
  return <section className={`inko-section ${styles.block}`}>
    <header className={styles.blockHead}><h3>{name}</h3>{props && <code>{props}</code>}</header>
    {children}
    {note && <p className="inko-footnote">{note}</p>}
  </section>;
}

/* ---------- 02 · Buttons & Forms ---------- */

interface ButtonRow {
  name: string;
  variant: ButtonVariant;
  label: string;
  loadingLabel?: string;
  icon?: IconName;
}

const buttonRows: readonly ButtonRow[] = [
  { name: 'Primary', variant: 'primary', label: 'Novo empréstimo', loadingLabel: 'Salvando…', icon: 'mais' },
  { name: 'Secondary', variant: 'secondary', label: 'Registrar devolução', loadingLabel: 'Registrando…' },
  { name: 'Outline', variant: 'outline', label: 'Exportar CSV', loadingLabel: 'Gerando…', icon: 'download' },
  { name: 'Ghost', variant: 'ghost', label: 'Cancelar' },
  { name: 'Destructive', variant: 'danger', label: 'Excluir obra', loadingLabel: 'Excluindo…', icon: 'lixeira' },
];

const simulatedStates = [
  { label: 'Hover', className: styles.simHover },
  { label: 'Focus', className: styles.simFocus },
  { label: 'Pressed', className: styles.simPressed },
] as const;

const NOTES_LIMIT = 280;
type ViewMode = 'cards' | 'tabela';
const viewOptions = [
  { value: 'cards', label: 'Cards', icon: 'cards' },
  { value: 'tabela', label: 'Tabela', icon: 'tabela' },
] as const;

function ButtonMatrix() {
  return <div className={styles.scroll}>
    <table className={styles.matrix}>
      <caption className="sr-only">InkoButton: variantes por estado. As colunas Hover, Focus e Pressed são simulações estáticas.</caption>
      <thead><tr><th scope="col">Variante</th><th scope="col">Default</th>{simulatedStates.map(state => <th key={state.label} scope="col">{state.label}</th>)}<th scope="col">Disabled</th><th scope="col">Loading</th></tr></thead>
      <tbody>{buttonRows.map(row => <tr key={row.variant}>
        <th scope="row">{row.name}</th>
        <td><InkoButton variant={row.variant} leftIcon={row.icon}>{row.label}</InkoButton></td>
        {simulatedStates.map(state => <td key={state.label}><InkoButton variant={row.variant} leftIcon={row.icon} className={state.className} tabIndex={-1}>{row.label}</InkoButton></td>)}
        <td><InkoButton variant={row.variant} leftIcon={row.icon} disabled>{row.label}</InkoButton></td>
        <td>
          {row.loadingLabel && <InkoButton variant={row.variant} loading>{row.loadingLabel}</InkoButton>}
          {!row.loadingLabel && <span className="inko-footnote">— (ghost não carrega)</span>}
        </td>
      </tr>)}</tbody>
    </table>
  </div>;
}

export function CoreShowcase() {
  const [notes, setNotes] = useState('Capa com pequeno desgaste na lombada.');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ViewMode>('cards');
  const [notify, setNotify] = useState(true);
  const [term, setTerm] = useState('14');

  return <>
    <Block name="InkoButton · variante × estado" props="variant · size · loading · disabled · leftIcon · iconOnly" note="Uma ação primária por contexto. A coluna Default é interativa (passe o mouse e navegue com Tab); Hover, Focus e Pressed são simulações estáticas do mesmo componente. loading aplica aria-busy e spinner.">
      <ButtonMatrix/>
      <div className={styles.row}>
        <InkoButton size="sm">Small · 32</InkoButton>
        <InkoButton size="md">Medium · 40</InkoButton>
        <InkoButton size="lg">Large · 48</InkoButton>
      </div>
    </Block>

    <Block name="Icon Button" props="iconOnly · aria-label obrigatório" note="40 px (área de toque de 44 px no mobile). Ícone sozinho sempre com aria-label.">
      <div className={styles.row}>
        <InkoButton iconOnly leftIcon="mais" aria-label="Adicionar obra"/>
        <InkoButton iconOnly variant="secondary" leftIcon="atualizar" aria-label="Atualizar lista"/>
        <InkoButton iconOnly variant="outline" leftIcon="filtro" aria-label="Filtrar"/>
        <InkoButton iconOnly variant="ghost" leftIcon="mais-acoes" aria-label="Mais ações"/>
        <InkoButton iconOnly variant="danger" leftIcon="lixeira" aria-label="Excluir obra"/>
        <InkoButton iconOnly size="sm" variant="outline" leftIcon="download" aria-label="Baixar relatório"/>
        <button type="button" className="inko-icon-button" aria-label="Notificações, 3 não lidas"><Icon name="notificacoes"/><span className="inko-icon-button-badge" aria-hidden="true">3</span></button>
      </div>
    </Block>

    <Block name="InkoInput · estados" props="label · help · error · success · required · leftIcon" note="Rótulo persistente; a mensagem é ligada por aria-describedby e o erro combina texto, ícone e aria-invalid. O estado Focus é uma simulação estática.">
      <div className="inko-form-grid">
        <InkoInput id="ds-titulo" label="Título" required placeholder="Ex.: Maré de Tinta" help="Default · helper text"/>
        <InkoInput id="ds-autor" label="Autor" defaultValue="Aiko Tanabe" help="Focus · borda ink + halo 3px" className={styles.simFieldFocus}/>
        <InkoInput id="ds-identificador" label="Identificador" defaultValue="INK-12" error="Use o formato INK-0000 (4 dígitos)."/>
        <InkoInput id="ds-email" label="E-mail" type="email" leftIcon="email" defaultValue="rafael.moura@exemplo.com" success="E-mail disponível"/>
        <InkoInput id="ds-editora" label="Editora" defaultValue="Editora Sumi" disabled help="Disabled"/>
        <InkoPasswordInput id="ds-senha" label="Senha" autoComplete="off" placeholder="Digite qualquer texto" help="Password · alternância de visibilidade funcional"/>
      </div>
      <InkoTextarea id="ds-observacoes" label="Observações" value={notes} maxLength={NOTES_LIMIT} onChange={event => setNotes(event.target.value)} help={`${notes.length} / ${NOTES_LIMIT}`}/>
    </Block>

    <div className={styles.grid2}>
      <Block name="InkoSearch · InkoSelect" props="label · value · onChange" note="A busca usa o elemento <search> e rótulo só para leitores de tela; o select mantém rótulo visível.">
        <InkoSearch label="Buscar no acervo" placeholder="Buscar por título, autor ou código" value={query} onChange={event => setQuery(event.target.value)}/>
        <output className="inko-footnote">{query ? `Buscando por “${query}”` : 'Digite para ver o valor controlado.'}</output>
        <InkoSelect id="ds-categoria" label="Categoria" defaultValue="Mangá">{CATEGORIES.map(category => <option key={category}>{category}</option>)}</InkoSelect>
      </Block>

      <Block name="InkoSegmented · InkoSwitch" props="label · options · value · onChange / checked · onChange" note="Segmented alterna modos de visualização (aria-pressed); o switch expõe role=switch e aria-checked.">
        <div className={styles.row}><InkoSegmented label="Modo de visualização" options={viewOptions} value={view} onChange={setView}/><span className="inko-footnote">Exibindo em {view === 'cards' ? 'cards' : 'tabela'}.</span></div>
        <InkoSwitch checked={notify} onChange={setNotify}>Notificar atrasos · {notify ? 'ligado' : 'desligado'}</InkoSwitch>
      </Block>

      <Block name="Checkbox" props="input nativo · accent-color seal" note="Controle nativo estilizado localmente; o texto do rótulo amplia a área de clique.">
        <fieldset className={styles.choiceGroup}><legend>Categorias</legend>
          <label className={styles.check}><input type="checkbox" defaultChecked/>Mangás</label>
          <label className={styles.check}><input type="checkbox"/>HQs</label>
          <label className={styles.check}><input type="checkbox" disabled/>Desabilitado</label>
        </fieldset>
      </Block>

      <Block name="Radio Group" props="input nativo · name compartilhado" note="Setas do teclado percorrem as opções; o grupo é anunciado pela legenda.">
        <fieldset className={styles.choiceGroup}><legend>Prazo de devolução</legend>
          <label className={styles.check}><input type="radio" name="ds-prazo" value="7" checked={term === '7'} onChange={() => setTerm('7')}/>7 dias</label>
          <label className={styles.check}><input type="radio" name="ds-prazo" value="14" checked={term === '14'} onChange={() => setTerm('14')}/>14 dias</label>
          <label className={styles.check}><input type="radio" name="ds-prazo" value="custom" checked={term === 'custom'} onChange={() => setTerm('custom')}/>Personalizado</label>
        </fieldset>
      </Block>
    </div>
  </>;
}

/* ---------- 02 · Data, navegação & feedback ---------- */

const PAGE_SIZE = 3;
const activeLoans = loans.filter(loan => !loan.returnedAt);
const lateLoans = activeLateLoans(loans, DEMO_REFERENCE_DATE);
const loanedShare = (activeLoans.length / works.length) * 100;
const recordTabs = ['Dados', 'Histórico', 'Exemplares'] as const;
const recordTabText: Record<string, string> = {
  Dados: 'Ficha da obra: título, autor, categoria e editora.',
  Histórico: 'Empréstimos e devoluções anteriores desta obra.',
  Exemplares: 'Exemplares físicos e a disponibilidade de cada um.',
};

type SortKey = 'work' | 'due';
type SortDirection = 'ascending' | 'descending';
type LoanFilter = 'todos' | 'atrasados' | 'prazo';

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function sortLoans(items: readonly Loan[], key: SortKey, direction: SortDirection): Loan[] {
  const factor = direction === 'ascending' ? 1 : -1;
  return [...items].sort((left, right) => left[key].localeCompare(right[key], 'pt-BR') * factor);
}

function LoanDueStatus({ loan }: Readonly<{ loan: Loan }>) {
  const overdue = daysOverdue(loan.due, DEMO_REFERENCE_DATE);
  if (overdue > 0) return <InkoStatus status="atr" detail={`${overdue} d`}/>;
  const remaining = daysBetween(DEMO_REFERENCE_DATE, loan.due);
  if (remaining <= 2) return <InkoBadge tone="warning" icon="relogio">Vence em {remaining} d</InkoBadge>;
  return <InkoStatus status="emp"/>;
}

function SortHeader({ label, column, sort, onSort }: Readonly<{ label: string; column: SortKey; sort: { key: SortKey; direction: SortDirection }; onSort: (key: SortKey) => void }>) {
  const active = sort.key === column;
  return <th scope="col" aria-sort={active ? sort.direction : undefined}>
    <button type="button" className="inko-table-sort" onClick={() => onSort(column)}>{label}<Icon name={active && sort.direction === 'descending' ? 'chevron-baixo' : 'ordenar'} size={14}/></button>
  </th>;
}

function DataTableDemo() {
  const toast = useToast();
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'due', direction: 'ascending' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set([activeLoans[1]?.id ?? '']));

  const sorted = useMemo(() => sortLoans(activeLoans, sort.key, sort.direction), [sort]);
  const pages = Math.ceil(sorted.length / PAGE_SIZE);
  const first = (page - 1) * PAGE_SIZE;
  const rows = sorted.slice(first, first + PAGE_SIZE);
  const allOnPage = rows.every(loan => selected.has(loan.id));

  function toggleSort(key: SortKey) {
    setSort(current => ({ key, direction: current.key === key && current.direction === 'ascending' ? 'descending' : 'ascending' }));
    setPage(1);
  }

  function toggleRow(id: string) {
    setSelected(current => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelected(current => {
      const next = new Set(current);
      rows.forEach(loan => { if (allOnPage) next.delete(loan.id); else next.add(loan.id); });
      return next;
    });
  }

  return <div className={styles.frame}>
    <div className="inko-table-wrap">
      <table className="inko-table">
        <caption className="sr-only">Empréstimos ativos — exemplo de tabela com ordenação e seleção</caption>
        <thead><tr>
          <th scope="col"><input type="checkbox" className={styles.checkbox} checked={allOnPage} onChange={togglePage} aria-label="Selecionar as linhas desta página"/></th>
          <SortHeader label="Obra" column="work" sort={sort} onSort={toggleSort}/>
          <th scope="col">Usuário</th>
          <SortHeader label="Prazo" column="due" sort={sort} onSort={toggleSort}/>
          <th scope="col">Status</th>
          <th scope="col" className="inko-table-end">Ações</th>
        </tr></thead>
        <tbody>{rows.map(loan => {
          const work = works.find(item => item.id === loan.workId);
          return <tr key={loan.id} aria-selected={selected.has(loan.id)}>
            <td><input type="checkbox" className={styles.checkbox} checked={selected.has(loan.id)} onChange={() => toggleRow(loan.id)} aria-label={`Selecionar ${loan.work}`}/></td>
            <td><span className="inko-table-work">{work && <InkoCover work={work} size="xs"/>}<strong>{loan.work}</strong></span></td>
            <td>{loan.user}</td>
            <td>{formatDate(loan.due)}</td>
            <td><LoanDueStatus loan={loan}/></td>
            <td className="inko-table-end"><InkoButton iconOnly size="sm" variant="ghost" leftIcon="enviar" aria-label={`Enviar lembrete sobre ${loan.work}`} onClick={() => toast({ title: 'Lembrete enviado', text: `${loan.user} · demonstração, nada foi enviado.` })}/></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <div className="inko-table-foot">
      <output>{first + 1}–{first + rows.length} de {sorted.length} · <strong>{plural(selected.size, 'selecionado', 'selecionados')}</strong></output>
      <Pagination page={page} pages={pages} onChange={setPage}/>
    </div>
  </div>;
}

function FeedbackDemo() {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Simula a latência da operação destrutiva; o timer é limpo se o bloco desmontar.
  useEffect(() => {
    if (!deleting) return undefined;
    const timer = setTimeout(() => {
      setDeleting(false);
      setConfirming(false);
      toast({ title: 'Obra excluída', text: 'Demonstração: o acervo não foi alterado.' });
    }, 600);
    return () => clearTimeout(timer);
  }, [deleting, toast]);

  return <>
    <Block name="Toast" props="useToast() → { title · text · tone · onUndo }" note="Fica 5 s na tela e pausa com o ponteiro ou o foco sobre ele. Desfazer aparece quando onUndo é informado.">
      <div className={styles.row}>
        <InkoButton variant="outline" onClick={() => toast({ title: 'Empréstimo confirmado', text: 'Prazo: 23/11/2026', onUndo: () => toast({ title: 'Empréstimo desfeito', text: 'A obra voltou a ficar disponível.' }) })}>Mostrar toast com Desfazer</InkoButton>
        <InkoButton variant="ghost" onClick={() => toast({ tone: 'danger', title: 'Não foi possível salvar', text: 'Tente novamente em instantes.' })}>Mostrar toast de erro</InkoButton>
      </div>
    </Block>

    <Block name="ConfirmDialog" props="open · title · confirmLabel · tone · loading · onConfirm · onCancel" note="Elemento <dialog> nativo: foco preso, Esc cancela. Ações destrutivas sempre passam por confirmação.">
      <div className={styles.row}><InkoButton variant="danger" leftIcon="lixeira" onClick={() => setConfirming(true)}>Excluir obra</InkoButton></div>
      <ConfirmDialog open={confirming} title="Excluir “Jardim de Aço · Vol. 1”?" confirmLabel="Excluir obra" loading={deleting} onConfirm={() => setDeleting(true)} onCancel={() => setConfirming(false)}>
        <p>A obra sai do acervo e do histórico visível. Empréstimos passados continuam nos relatórios. Esta ação não pode ser desfeita.</p>
      </ConfirmDialog>
    </Block>
  </>;
}

export function DataShowcase() {
  const toast = useToast();
  const query = useMockQuery();
  const [tab, setTab] = useState<string>(recordTabs[0]);
  const [filter, setFilter] = useState<LoanFilter>('todos');
  const filterItems = [
    { value: 'todos', label: 'Todos', count: activeLoans.length },
    { value: 'atrasados', label: 'Atrasados', count: lateLoans.length },
    { value: 'prazo', label: 'No prazo', count: activeLoans.length - lateLoans.length },
  ] as const;

  return <>
    <Block name="Data Table" props="inko-table · aria-sort · aria-selected · Pagination" note="Linha de 48 px, ordenação pelos cabeçalhos, seleção por checkbox e ações por linha. Abaixo de 768 px as telas trocam a tabela por uma lista de LoanCard; aqui ela rola dentro do próprio contêiner. Grandes volumes: paginação no servidor (25/50/100) e filtros na URL.">
      <DataTableDemo/>
    </Block>

    <div className={styles.grid2}>
      <Block name="InkoStatus · InkoBadge · CategoryTag" props="status: disp|emp|atr|dev · detail · size / tone · icon" note="Status = ícone + texto + cor. Nunca só cor.">
        <div className={styles.row}><InkoStatus status="disp"/><InkoStatus status="emp"/><InkoStatus status="atr" detail="15 d"/><InkoStatus status="dev"/></div>
        <div className={styles.row}>{CATEGORIES.map(category => <CategoryTag key={category} category={category}/>)}<InkoBadge tone="success" icon="check" size="sm">Online</InkoBadge><InkoBadge tone="warning" icon="relogio">Vence em 2 dias</InkoBadge><InkoBadge>3</InkoBadge></div>
      </Block>

      <Block name="InkoStatistic · ProgressBar" props="label · value · helper · icon · tone · href · emphasis / value · label · tone" note="Com href, o card inteiro é o link. ProgressBar expõe role=progressbar com rótulo.">
        <div className="inko-grid-stats">
          <InkoStatistic label="Atrasados" value={String(lateLoans.length)} helper={`${formatBRL(totalFineCents(loans, DEMO_REFERENCE_DATE))} em multas`} icon="relogio" tone="danger" emphasis/>
          <InkoStatistic label="Acervo emprestado" value={`${Math.round(loanedShare)}%`} helper={`${activeLoans.length} de ${plural(works.length, 'obra', 'obras')}`} icon="acervo"/>
        </div>
        <ProgressBar value={loanedShare} label="Acervo emprestado"/>
      </Block>

      <Block name="InkoSkeleton" props="lines · useMockQuery(delay)" note="Shimmer de 1,4 s, estático com prefers-reduced-motion. Nas telas, o skeleton entra após 300 ms de espera.">
        {query.loading && <><InkoStatisticSkeleton/><InkoSkeleton lines={3}/></>}
        {!query.loading && <div className="inko-motion-swap"><InkoStatistic label="Empréstimos ativos" value={String(activeLoans.length)} helper="Conteúdo carregado" icon="emprestimos" tone="info"/></div>}
        <div className={styles.row}><InkoButton size="sm" variant="outline" leftIcon="atualizar" onClick={query.reload} disabled={query.loading}>Recarregar</InkoButton></div>
      </Block>

      <Block name="Breadcrumb · InkoTabs · InkoPillTabs" props="items[] / label · items · active · onChange" note="A aba ativa recebe o sublinhado em pincelada seal; as pílulas filtram listas e aceitam contagem.">
        <Breadcrumb items={[{ label: 'Acervo', href: '/acervo' }, { label: 'Mangás', href: '/acervo' }, { label: 'Maré de Tinta · Vol. 3' }]}/>
        <InkoTabs label="Seções da obra" items={recordTabs} active={tab} onChange={setTab}/>
        <p className="inko-footnote">{recordTabText[tab]}</p>
        <div className={styles.scroll}><InkoPillTabs label="Filtro de empréstimos" items={filterItems} active={filter} onChange={setFilter}/></div>
      </Block>
    </div>

    <Block name="InkoAlert" props="tone: success|warning|danger|info · title · action" note="Alerta inline. O tom danger é anunciado como alerta; os demais, como status.">
      <div className={styles.grid2}>
        <InkoAlert tone="success" title="Devolução registrada">“Maré de Tinta · Vol. 3” voltou a ficar disponível.</InkoAlert>
        <InkoAlert tone="warning" title="8 empréstimos vencem nesta semana">Envie lembretes antes do prazo.</InkoAlert>
        <InkoAlert tone="danger" title="Obra indisponível">Emprestada a Rafael Moura até 25/10/2026 (atrasada).</InkoAlert>
        <InkoAlert tone="info" title="Metadados opcionais">Editora e volume dependem do contrato da API de catálogo.</InkoAlert>
      </div>
    </Block>

    <div className={styles.grid2}>
      <FeedbackDemo/>

      <Block name="InkoEmpty" props="title · text · children (ação)" note="Estado vazio com Enso e uma única ação de saída.">
        <InkoEmpty title="Nenhuma obra encontrada" text="Revise os filtros ou cadastre a primeira obra desta categoria.">
          <InkoButton size="sm" variant="outline" onClick={() => toast({ title: 'Filtros limpos', text: 'Demonstração do estado vazio.' })}>Limpar filtros</InkoButton>
        </InkoEmpty>
      </Block>

      <Block name="InkoErrorState" props="title · text · onRetry" note="Erro de carregamento sempre oferece “Tentar novamente”.">
        <InkoErrorState text="O serviço de empréstimos não respondeu (503). Seus dados estão seguros." onRetry={() => toast({ title: 'Nova tentativa', text: 'Demonstração: nenhum serviço foi chamado.' })}/>
      </Block>
    </div>
  </>;
}
