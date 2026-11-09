# INKO — Implementação do handoff Claude Design

Referência: exportação dos 17 artboards `.dc.html` recebidos em 09/11/2026.

## Mapeamento de fontes para o Next.js

| Fonte do Claude | Aplicação Next.js | Cobertura |
| --- | --- | --- |
| `Foundations-Color.dc.html` | `app/inko-tokens.css`, `app/inko-ui.css` | Paleta, cores semânticas e contraste visual |
| `Foundations-Type.dc.html` | `app/inko-ui.css` | Hierarquia tipográfica e famílias de fontes |
| `Foundations-Layout.dc.html` | `app/inko-ui.css`, `app/inko-motion.css` | Grid, spacing, raios, responsividade e motion |
| `Foundations-Graphics.dc.html` | `public/inko/svg`, `components/inko-kit.tsx` | Logo, Enso, pinceladas, capas sintéticas e retículas |
| `Components-Core.dc.html` | `components/inko-kit.tsx`, `components/inko-interactions.tsx` | Botões, inputs, variantes, interação e foco |
| `Components-Data.dc.html` | `components/inko-patterns.tsx` | Cards estatísticos, skeleton, alert, modal, toast e tabs |
| `Components-Domain.dc.html` | `components/inko-kit.tsx`, `components/inko-patterns.tsx` | MangaCard, CollectionCard, LoanCard, FineSummary, EditorialBanner |
| `Desktop-Dashboard.dc.html` | `components/dashboard.tsx`, `app/page.tsx` | Dashboard responsivo e navegação |
| `Desktop-Acervo.dc.html` | `app/acervo/page.tsx` | Filtros, categorias, cards e tabela |
| `Desktop-Cadastro.dc.html` | `app/acervo/novo/page.tsx` | Formulário, validação e prévia |
| `Desktop-Obra.dc.html` | `app/acervo/[id]/page.tsx` | Detalhes e disponibilidade |
| `Desktop-Usuarios.dc.html` | `app/usuarios/page.tsx` | Lista, seleção, histórico e validação de novo usuário |
| `Desktop-Emprestimo.dc.html` | `app/emprestimos/page.tsx` | Wizard de prévia e validação de disponibilidade |
| `Desktop-Devolucao.dc.html` | `app/devolucoes/page.tsx` | Busca, seleção e conferência sem gravação |
| `Desktop-Relatorios.dc.html` | `app/relatorios/page.tsx` | Multa de ativos atrasados, estatísticas e filtros |
| `Desktop-Login.dc.html` | `app/login/page.tsx` | Formulário visual e validação local, sem autenticação fictícia |
| `Handoff.dc.html` | Todos os componentes e esta documentação | Rastreabilidade e adaptação idiomática para React |

## Fontes e comportamento

Os arquivos `.dc.html` utilizam `DCLogic`, `sc-if`, `sc-for`, interpolação `{{ }}` e referências internas `/_blob/`. Esses elementos são específicos do protótipo Claude e não devem ser copiados diretamente para o Next.js.

A implementação usa `useState`, `useMemo`, componentes React tipados, rotas App Router e SVGs previamente incorporados em `public/inko`.

## Limites explicitados

- **Operações de escrita são demos**. Formulários validam localmente, mas cadastro, autenticação, empréstimo e devolução não são enviados ao backend enquanto os contratos e serviços reais não estiverem implementados.
- O modelo de dados de demonstração foi extraído das pranchas e organizado em `lib/demo.ts`. Não há uso de senhas fixas para simular autenticação bem-sucedida.
- O relatório considera **somente empréstimos ativos atrasados**, com multa de R$ 2,00/dia e `map`, `filter` e `reduce`. Não cria cobrança de multas para empréstimos devolvidos, respeitando a especificação acadêmica.
- O Dashboard preserva métricas demonstrativas da prancha (3.842/1.286/412/4), que não são totais calculados sobre a pequena coleção de dados de teste. Ambas as origens são claramente sinalizadas na interface.
- As capas são composições CSS fictícias. Imagens licenciadas, integração com APIs, validações de autorização reais, testes E2E e análise visual pixel a pixel permanecem pendentes.
- A base evita adicionar bibliotecas de UI até que se aprove o contrato visual da primeira implementação. `Tailwind/shadcn` são recomendações do handoff, ainda não dependências instaladas.

## Validação

Na raiz do frontend: `node --test tests/*.test.mjs`.

No monorepo: `pnpm install --frozen-lockfile && pnpm --filter @inko/web typecheck && pnpm --filter @inko/web build`.

Após integração do código na branch do GitHub, o workflow deverá compilar a imagem do Docker, validar seus assets e executar testes dos quatro serviços Java e do gateway Python.
