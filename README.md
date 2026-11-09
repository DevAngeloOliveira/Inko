# INKO — Monorepo Starter (Sprint 00)

Biblioteca especializada em mangás, HQs e graphic novels. Arquitetura poliglota Next.js + FastAPI + Spring Boot + PostgreSQL.

## Design System INKO — Integração do Claude

O pacote inclui `packages/design-tokens/inko.tokens.json` como fonte de verdade, CSS gerado em `apps/web/app/inko-tokens.css`, motions acessíveis em `apps/web/app/inko-motion.css` e compatibilidade de nomes com o Figma.

```bash
pnpm tokens:build
pnpm tokens:check
pnpm tokens:test
```

Documentação: `packages/design-tokens/README.md` e `docs/architecture/ADR-002-design-tokens.md`. Os logos, SVGs e motions originais estão versionados; os componentes React de domínio serão implementados nas próximas sprints.

## Estado do projeto

Este pacote implementa **apenas o setup inicial**: builds, configuração, endpoints diagnósticos, Docker Compose, bancos isolados, Dashboard de demonstração visual e testes de sanidade. Ainda não implementa cadastro de livros, circulação, multas ou regras de negócio. Os logos e SVGs originais já foram incorporados, e o Design System completo segue em implementação incremental a partir do Figma.

## Requisitos

- Docker Engine / Docker Desktop com Compose v2
- Docker executando containers Linux (no Windows, usar WSL2)
- Para desenvolvimento fora de containers: Node.js 24 LTS, pnpm 10.15, Java 21, Maven 3.9, Python 3.13

## Execução integrada

Windows PowerShell:

```powershell
Copy-Item .env.example .env
# Edite os valores de senha no arquivo .env antes de iniciar
 docker compose up --build -d
 docker compose ps
```

Linux/macOS:

```bash
cp .env.example .env
# Edite as senhas em .env
 docker compose up --build -d
 docker compose ps
```

Acesse:

- Frontend: http://localhost:3000
- Gateway e OpenAPI: http://localhost:8000/docs
- Health Gateway: http://localhost:8000/health
- Status dos serviços: http://localhost:8000/api/v1/system/status
- Teste de proxy: http://localhost:8000/api/v1/catalogo/ping
- PostgreSQL local: 127.0.0.1:5432 (não exposto para outras máquinas)

Portas dos microsserviços Java ficam restritas à rede interna do Docker.

Parar sem apagar dados:

```bash
docker compose down
```

Apagar também o volume PostgreSQL (perda de todos os dados):

```bash
docker compose down -v
```

A inicialização dos bancos ocorre **somente quando o volume do PostgreSQL é criado pela primeira vez**. Alterar credenciais posteriormente exige migração manual ou reinicialização do volume em ambiente de desenvolvimento.

## Organização

```text
inko-monorepo-starter/
├── apps/
│   ├── web/                 Next.js 16 + TypeScript
│   └── gateway/             FastAPI + httpx
├── services/
│   ├── catalogo/            Spring Boot 4 + JDBC
│   ├── usuarios/            Spring Boot 4 + JDBC
│   ├── circulacao/          Spring Boot 4 + JDBC
│   └── relatorios/          Spring Boot 4, sem DB próprio
├── packages/design-tokens/  Tokens do Claude com aliases do Figma
├── infra/
│   ├── docker/
│   └── postgres/init/
├── docs/architecture/
├── docs/contracts/
├── .github/workflows/
├── compose.yaml
├── pnpm-workspace.yaml
└── package.json
```

## Testes locais

```bash
python -m pip install -e './apps/gateway[test]'
python -m pytest -q apps/gateway/tests

cd services/catalogo
mvn test

cd ../..
npm install -g pnpm@10.15.0
pnpm install
pnpm --filter @inko/web test
pnpm --filter @inko/web typecheck
```

Testes Maven devem ser repetidos em cada um dos quatro serviços. O GitHub Actions configura uma matrix para executar os quatro.

## Padrões de arquitetura

- Frontend comunica-se com o Gateway; domínio reside nos microsserviços Java.
- Bancos separados na mesma instância PostgreSQL: inko_catalogo, inko_usuarios, inko_circulacao.
- Gateway usa nomes de serviços da rede Compose: catalogo, usuarios, circulacao, relatorios.
- Relatórios receberá dados via API e aplicará funções puras, imutabilidade, map/filter/reduce.
- Código-fonte sem comentários, conforme enunciado da disciplina.
- `Biblioteca`, `Livro`, `Usuario` e `Emprestimo` serão modeladas na implementação efetiva.
- Não usar ORM ou tabelas compartilhadas entre serviços.

## Próximos passos

1. Manter `pnpm-lock.yaml` versionado e instalar dependências com `pnpm install --frozen-lockfile`.
2. Revisar o Design System no Figma e exportar tokens/assets originais.
3. Definir os contratos OpenAPI antes dos recursos de negócio.
4. Criar migrations versionadas nos serviços proprietários dos dados.
5. Implementar RF-01 a RF-18 com testes e documentação conforme o enunciado.

## Cuidado

As senhas de `.env.example` são **apenas exemplos para desenvolvimento local**. Trocar antes de usar. Não publicar `.env`, segredos ou credenciais reais no GitHub.


## Motion Lab (Claude Design source)

O pacote-fonte `INKO-Design-System-Figma.zip` foi auditado. A versão `v0.3` inclui SVGs/PNG originais de marca, motions de fonte em `apps/web/app/inko-motion.css`, a rota demonstrativa `/motion-lab` e uma matriz de rastreabilidade em `docs/design/claude-source-motion-audit.md`. Os arquivos `.dc.html` são um formato do Claude Design, não páginas React diretamente reutilizáveis.

## Baseline de reprodutibilidade

O monorepo utiliza pnpm 10.15.0 com `pnpm-lock.yaml` versionado. O CI e a imagem Docker do frontend devem instalar exatamente as versões resolvidas, com `--frozen-lockfile`. Novas dependências devem atualizar `package.json` e o lockfile no mesmo Pull Request.

Os assets originais estão em `apps/web/public/inko`. O CSS gerado de `packages/design-tokens/inko.tokens.json` e os motions do Claude estão em `apps/web/app`. A rota `/motion-lab` permanece disponível para demonstrar os efeitos; a home visual começou a ser portada do Figma. O conteúdo demonstrativo não é dado persistido.

## Frontend · Sprint 00

A rota `/` contém o Dashboard visual inicial com o logotipo e os elementos gráficos originais do INKO. Os indicadores e movimentos apresentados são **dados fictícios** de demonstração; o fluxo de catálogo, circulação, usuários e relatórios ainda não está integrado.

- `/`: Dashboard responsivo inspirado no Figma (ainda sujeito a revisão visual).
- `/motion-lab`: demonstração dos motions originais.
- `/system/status`: diagnóstico técnico dos microsserviços, preservado da home anterior.

O frontend usa os design tokens semânticos gerados a partir de `packages/design-tokens/inko.tokens.json`. Módulos ainda não implementados são exibidos como indisponíveis e não direcionam a rotas inexistentes.

O layout foi estruturado com componentes React sem compartilhar lógica de negócios entre a interface e os microsserviços. Funcionalidades dos RFs serão implementadas incrementalmente.


## Assets estáticos no Docker

O build `standalone` do Next.js não incorpora automaticamente `public/` na pasta `.next/standalone`. O estágio final de `apps/web/Dockerfile` copia explicitamente `apps/web/public` para `apps/web/public` dentro da imagem, além de `.next/static`.

O GitHub Actions compila a imagem e executa um smoke test HTTP dos logos, ícones SVG e elementos gráficos, incluindo a otimização de PNG pelo Next.js. Para verificar localmente após o merge:

```bash
git pull --ff-only origin main
docker compose up -d --build --force-recreate web
node apps/web/scripts/smoke-static-assets.mjs
```

O teste exige um frontend acessível em `http://127.0.0.1:3000` (ou pela variável `INKO_BASE_URL`). Os demais containers permanecem preservados.

## DevOps automatizado

A infraestrutura de engenharia é gerenciada pelo GitHub Actions: CI por serviço, validação de Compose, scanner de segurança, integração de sete containers, publicação versionada no GHCR e staging manual com backup de PostgreSQL. Não existe deployment automático em produção nem alteração automática de código pelo bot.

- Guia de operação, releases, rollback e segurança: [docs/devops/README.md](docs/devops/README.md)
- Teste integrado manual: **Actions → INKO Integration → Run workflow**
- Release GHCR: criar tag `vX.Y.Z` na `main`, após aprovação do CI
- Staging: requer Environment protegido, servidor SSH e secrets, conforme o guia

O SonarCloud permanece um gate separado e não é substituído pelo scanner Trivy.
