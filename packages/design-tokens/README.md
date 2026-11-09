# INKO Design Tokens — Sprint 00

Fonte de verdade: `inko.tokens.json` (73 tokens no formato Design Tokens Community Group, exportados pelo Claude).

## Geração

Na raiz do monorepo:

```bash
pnpm tokens:build
pnpm tokens:check
pnpm tokens:test
```

O gerador `scripts/generate.mjs` escreve `apps/web/app/inko-tokens.css`. O comando `--check` apenas verifica se o arquivo versionado corresponde à fonte. O CI e o Dockerfile executam essa verificação.

## Handoff Figma ↔ Next.js

As variáveis existentes no Figma utilizam nomes CSS como `--inko-brand-ink`, `--inko-background-default`, `--inko-space-4` e `--inko-radius-12`.

O export do Claude usa uma escala numérica diferente para espaçamento: `space/4 = 16px`, enquanto o Figma define `space/4 = 4px`.

Para eliminar colisões:

- `--inko-spacing-4`: token **Claude** com valor 16px.
- `--inko-space-4`: alias **Figma** para 4px.
- `--inko-radius-md`: token **Claude** com valor 12px.
- `--inko-radius-12`: alias **Figma** para 12px.

Tokens semânticos são exportados usando `var(--inko-brand-...)` quando apontam para os primitivos. `status/*/ink` oferece compatibilidade com `status/*/fg`.

## Motions

`apps/web/app/inko-motion.css` utiliza os tempos e easings dos tokens e os movimentos editoriais documentados no protótipo do Figma. Respeita `prefers-reduced-motion`. Há classes separadas para entrada de blocos, revelação da pincelada, Enso e logotipo.

As animações do Figma não executam automaticamente no Next.js. A classe CSS correspondente deve ser aplicada aos elementos React. Transições interativas do protótipo não substituem estado real de componentes.

## Limites conhecidos

A exportação `source/figma-variables.claude.json` representa somente 52 valores; não contém as 10 text styles, 4 shadow styles, os tokens de duração/easing nem os aliases Figma já criados no arquivo remoto. **Não reimporte essa coleção como substituição das variáveis existentes**: isso duplicaria tokens e perderia a semântica dos aliases.

As fontes Manrope e Inter são referenciadas na CSS; seu carregamento ainda precisa ser integrado via `next/font` ou assets licenciados. A presença dos nomes em CSS não instala arquivos tipográficos.
