# INKO — Implementação do handoff Claude Design

Referência: canvas "INKO — Design System" (25 pranchas `.dc.html`, páginas 00–08), aplicado em 12/11/2026.
A primeira exportação (17 pranchas, 09/11/2026) foi substituída por esta.

## Mapeamento de fontes para o Next.js

| Fonte do Claude | Aplicação Next.js | Cobertura |
| --- | --- | --- |
| `Main`, `Foundations-Color/Type/Layout/Graphics` | `app/inko-tokens.css` (gerado), `app/inko-ui.css`, `app/inko-motion.css`, `app/design-system/` | Marca, paleta, tipografia, espaço, raios, sombras, motion, gráficos e ícones |
| `Components-Core` | `components/inko-kit.tsx`, `components/inko-interactions.tsx`, `components/icon.tsx` | Botões (variante × estado × tamanho), campos, busca, select, switch, segmentado |
| `Components-Data` | `components/inko-patterns.tsx`, `components/inko-interactions.tsx` | Tabela, paginação, badges, statistic, skeleton, tabs, alert, toast, modal, vazios e erro |
| `Components-Domain` | `components/inko-kit.tsx`, `components/inko-patterns.tsx` | MangaCard, capas fictícias, CollectionCard, LoanCard, FineSummary, ciclo de circulação, EditorialBanner |
| `Prototype-Dashboard`, `Desktop-Dashboard`, `Mobile-Dashboard`, `Mobile-Nav` | `components/app-shell.tsx`, `components/dashboard.tsx`, `app/page.tsx` | Shell (sidebar 248 / rail 72 / drawer), busca global, notificações, menu do usuário, dashboard |
| `Desktop-Login`, `Mobile-Login` | `app/login/` | Login com sessão demonstrativa local |
| `Desktop-Acervo`, `Mobile-Acervo` | `app/acervo/` | Filtros na URL, cards/tabela, paginação |
| `Desktop-Obra` | `app/acervo/[id]/` | Detalhes, circulação, histórico, exclusão |
| `Desktop-Cadastro` | `app/acervo/novo/` | Cadastro com validação e prévia |
| `Desktop-Usuarios` | `app/usuarios/` | Lista, detalhe, histórico, novo usuário |
| `Desktop-Emprestimo`, `Mobile-Emprestimo` | `app/emprestimos/` | Fluxo guiado com passo na URL |
| `Desktop-Devolucao` | `app/devolucoes/` | Conferência, data efetiva, multa |
| `Desktop-Relatorios` | `app/relatorios/` | Multas de ativos atrasados, estatísticas, CSV |
| `Landing` | `app/landing/` | Landing page promocional (pública) |
| `Handoff` | Este documento e a seção "Diretrizes" de `/design-system` | Comportamento, responsividade, acessibilidade |

Os `.dc.html` usam `DCLogic`, `sc-if`, `sc-for`, `{{ }}` e `/_blob/`: são referência visual e de comportamento,
não código a copiar. A implementação é React idiomático com CSS sobre tokens (ADR-002). Tailwind e shadcn/ui,
sugeridos na prancha de handoff, continuam fora das dependências.

## Camada de dados

Toda leitura e escrita das telas operacionais passa por `apps/web/lib/library-api.ts`, que chama `/api/v1/*` na própria origem.
O BFF `app/api/v1/[...path]/route.ts` repassa ao Gateway (`GATEWAY_INTERNAL_URL`), que encaminha aos serviços Java e ao PostgreSQL.

- `useLibrary()` devolve o estado reativo (obras, usuários, empréstimos, sessão), carregado dos serviços.
- `createWork`, `createUser`, `createLoan` e `returnLoan` gravam no backend e lançam `ApiError` com o campo da interface.
- Falha de rede ou de serviço aparece como erro na tela; não há fallback para dados simulados.
- `DEMO_REFERENCE_DATE` (09/11/2026) continua sendo o "hoje" da demonstração e é enviado explicitamente nas datas de empréstimo e devolução.
- `lib/demo.ts` mantém tipos, regras puras de apresentação e a amostra usada só por `/design-system` e `/landing`.

## Limites explicitados

- **Autenticação é demonstrativa.** Qualquer e-mail válido com senha de 6+ caracteres abre uma sessão local; não há
  credencial fixa, verificação de identidade nem autorização. A guarda de rota é só do lado do cliente.
- **Multas**: o relatório vem do serviço Java de Relatórios; a tela de devolução só mostra uma pré-visualização com a mesma regra.
- Capas são composições CSS ilustrativas; envio de capa, e-mails de lembrete e recuperação de senha são apenas visuais.
- Exclusão de obras não está no contrato do Catálogo nesta versão.
- Tema escuro está reservado nos tokens e não foi implementado.
- Sem comparação visual pixel a pixel automatizada.

## Validação

Em `apps/web`: `pnpm typecheck`, `pnpm test` e `pnpm build`.
`tests/demo-rules.test.mjs` executa as regras de `lib/demo.ts` (requer Node 24, que importa TypeScript sem transpilar).
