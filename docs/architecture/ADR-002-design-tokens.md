# ADR-002 — Fonte de verdade dos tokens do INKO

## Status

Aceita para a Sprint 00, sob validação de build no ambiente de desenvolvimento.

## Contexto

O Claude Design forneceu três artefatos: `inko.tokens.json`, `figma-variables.json` e `globals.css`. O JSON semântico contém 73 tokens; os dois arquivos de exportação contêm 52 variáveis cada. O arquivo Figma existente contém variáveis próprias e componentes vinculados a elas.

Há uma divergência de nomenclatura: `space/4` representa 16px no arquivo do Claude e 4px na escala do Figma. Há também diferenças nos nomes das CSS custom properties.

## Decisão

`packages/design-tokens/inko.tokens.json` é a fonte de verdade para o frontend. O script determinístico `generate.mjs` produz `apps/web/app/inko-tokens.css` e valida referências, tipos e colisões. Os aliases compatibilizam os tokens existentes no Figma sem renomear ou substituir as variáveis remotas.

A CSS operacional do Next.js utiliza somente tokens semânticos gerados. Motions autorais e acessibilidade estão definidos em `inko-motion.css`, com `prefers-reduced-motion`.

## Consequências

- As atualizações na identidade começam no JSON principal e são regeneradas e testadas.
- Não se deve copiar manualmente as declarações de `globals.claude.css` para o frontend.
- Mudanças feitas apenas no Figma não são importadas automaticamente para o repositório.
- O monorepo ainda precisa de build integrado em Docker para validação fim a fim.
- Componentes detalhados do Claude não estão presentes nesses três arquivos: esse handoff cobre foundations e não exporta a biblioteca React inteira.
