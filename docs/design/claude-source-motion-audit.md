# INKO — Motion source audit (Claude Design export)

## Origem e escopo

Fonte: `INKO-Design-System-Figma.zip`, diretório `telas/` (`.dc.html`). Este ZIP contém 24 pranchas em formato específico do Claude Design, SVGs, PNGs, JSON de tokens e `canvas.json`. Os `.dc.html` usam `DCLogic` e atributos de template `{{...}}` e NÃO são componentes React/Next.js executáveis diretamente.

A implementação CSS em `apps/web/app/inko-motion.css` espelha os keyframes efetivamente encontrados no export. O playground `/motion-lab` demonstra os três motions editoriais e alguns estados de UI. As animações anteriores de entrada geral (`inko-motion-enter`) são um refinamento INKO, **não** parte literal do export do Claude.

## Mapa de movimentos

| Arquivo fonte | Classe/keyframe | Duração | Curva | Condição |
|---|---|---|---|---|
| Foundations-Layout.dc.html | `.m-enso` / `inkDraw` | 2.4s infinito | cubic-bezier(.65,0,.35,1) | `stroke-dashoffset` 440→60 em 55% do ciclo; restante hold |
| Foundations-Layout.dc.html | `.m-panel` / `panelIn` | 2.4s infinito | cubic-bezier(.2,.8,.2,1) | translação (-24px,12px), -3°, opacity 0→1 em 30%; hold |
| Foundations-Layout.dc.html | `.m-brush` / `brushReveal` | 2.4s infinito | cubic-bezier(.65,0,.35,1) | clip-path 100%→0% em 45%; hold |
| Desktop-Login.dc.html | `.enso` / `inkDraw` | 900ms | cubic-bezier(.65,0,.35,1) | dashoffset 520→70, forwards |
| Desktop-Emprestimo.dc.html | `.enso` / `inkDraw` | 900ms | cubic-bezier(.65,0,.35,1) | mesmo padrão de login |
| Prototype-Dashboard.dc.html | `.enso` / `inkDraw` | 900ms | cubic-bezier(.65,0,.35,1) | mesmo padrão de login |
| Desktop-Devolucao.dc.html | `.swap` | 220ms | cubic-bezier(.2,.8,.2,1) | opacity 0→1, Y=6px→0 |
| Prototype-Dashboard.dc.html | `.pop` | 200ms | cubic-bezier(.2,.8,.2,1) | opacity 0→1, Y=-4px→0 |
| Prototype-Dashboard.dc.html | `.toast` | 200ms | cubic-bezier(.2,.8,.2,1) | opacity 0→1, Y=12px→0 |
| Prototype-Dashboard.dc.html | `.sk` | 1.4s infinito | linear | skeleton shimmer -300px→300px |
| Components-Data.dc.html | `.sk` | 1.4s infinito | linear | skeleton shimmer -200px→200px |
| Components-Core.dc.html | `.spin` | .8s infinito | linear | rotation 0°→360° |

Todos os arquivos citados contêm `@media (prefers-reduced-motion: reduce)` nos motions relevantes. O estado final do Enso precisa fixar dashoffset=60 no exemplo de Foundations e 70 nas telas de entrada.

## Microinterações com estado

O `Prototype-Dashboard.dc.html` define: filtro de pesquisa normalizado; painel de notificações; painel do usuário; seleção de abas Todas/Empréstimos/Devoluções; `loading` simulado de 900ms; `toast` autoclosing de 5s; envio de lembretes simulado e ação de desfazer. Botões têm reações de hover/pressed, mas nenhum desses callbacks é integração real de backend.

`Desktop-Emprestimo.dc.html` contém etapas de fluxo guiado, seleção de usuário/obra, prazo; `Desktop-Devolucao.dc.html` contém busca, data, estado de confirmação. `Desktop-Login.dc.html` simula autenticação local, **não** faz autenticação real. Os valores e usuários de demonstração não devem ser reutilizados como regra de domínio.

## Divergências e riscos

1. O export estático **não contém uma aplicação Next.js**; é preciso portar os estados para componentes React tipados.
2. A UI de devolução calcula multa `dias de atraso × R$ 2` para empréstimo devolvido; o escopo acadêmico definido para o INKO limita **relatório de multas** aos empréstimos ativos e atrasados. Decidir explicitamente se haverá regra complementar para multa de devolução — não mesclar silenciosamente os fluxos.
3. `Prototype-Dashboard` usa ações simuladas de envio de notificações; não afirmar envio real no backend sem implementação.
4. A comparação anterior com o Figma encontrou entradas escalonadas nas telas que não aparecem nesses `.dc.html`; essas animações são decisões adicionais, não equivalência literal com o Claude.
5. O pacote de SVG não preserva o filtro `feTurbulence`; o README original explica que o Figma precisa de um efeito Noise/Texture para reproduzir essa textura.
6. O logotipo principal continua raster. Vetorizar o lettering manualmente ou com edição apropriada em design é uma entrega separada.

## Integração técnica

- Tokens: `packages/design-tokens/inko.tokens.json` é a fonte de verdade; CSS é gerado e versionado pela rotina existente.
- Animações específicas: `apps/web/app/inko-motion.css` contém keyframes e classes com prefixo `inko-`.
- Imagens: `apps/web/public/inko/logo` e `apps/web/public/inko/svg`; não carregar assets de dentro de `telas/*.dc.html` na aplicação.
- Demonstração: `/motion-lab`; garantir `prefers-reduced-motion` e evitar animações em tabelas e operações de alto volume.
- Validação: executar `pnpm tokens:check && pnpm tokens:test && pnpm test:web` antes de build do Next.js.
