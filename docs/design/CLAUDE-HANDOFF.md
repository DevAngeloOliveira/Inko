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
| `Desktop-Login`, `Mobile-Login` | `app/login/` | Login com sessão mockada |
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

## Camada mock

Enquanto os microsserviços não expõem contratos, toda leitura e escrita passa por `apps/web/lib/mock-api.ts`:

- `useLibrary()` devolve o estado reativo (obras, usuários, empréstimos, sessão).
- `signIn`, `createWork`, `deleteWork`, `createUser`, `createLoan`, `returnLoan` são assíncronas, simulam latência
  e lançam `MockApiError` nas regras de negócio (identificador duplicado, obra indisponível, datas inválidas).
- O estado nasce de `lib/demo.ts` e é persistido em `sessionStorage`: vale para a aba e some ao fechá-la.
  "Restaurar dados demo", no menu do usuário, volta à semente. Nada trafega pela rede.
- "Hoje" é fixo em `DEMO_REFERENCE_DATE` (09/11/2026) para que prazos e multas coincidam com o design.
- Disponibilidade de obra e situação de usuário são derivadas dos empréstimos; não há campo duplicado.

Para integrar o backend, substitua o corpo dessas funções por chamadas ao gateway mantendo as assinaturas.

## Limites explicitados

- **Autenticação é demonstrativa.** Qualquer e-mail válido com senha de 6+ caracteres abre uma sessão local; não há
  credencial fixa, verificação de identidade nem autorização. A guarda de rota é só do lado do cliente.
- **Multas**: a regra (R$ 2,00/dia, somente empréstimos ativos atrasados) é espelhada no cliente para a demonstração;
  o cálculo oficial será do serviço Java.
- Capas são composições CSS fictícias; envio de capa, e-mails de lembrete e recuperação de senha são apenas visuais.
- Tema escuro está reservado nos tokens e não foi implementado.
- Sem testes E2E nem comparação visual pixel a pixel automatizados.

## Validação

Em `apps/web`: `pnpm typecheck`, `pnpm test` e `pnpm build`.
`tests/demo-rules.test.mjs` executa as regras de `lib/demo.ts` (requer Node 24, que importa TypeScript sem transpilar).
