# INKO — Sistema de Biblioteca de Mangás e HQs

Projeto final da disciplina de Paradigmas de Linguagens de Programação: gestão de acervo, leitores, empréstimos, devoluções e multas de uma
biblioteca de mangás, HQs e graphic novels, combinando **orientação a objetos** e **programação funcional** em Java.

Arquitetura poliglota: Next.js 16 (interface) → FastAPI (API Gateway) → quatro serviços Spring Boot 4 / Java 21 → PostgreSQL 17 com um banco por serviço.

## Piloto de uma biblioteca física

O leitor consulta obras, códigos e disponibilidade em `/`. A equipe entra por `/login` e opera em `/dashboard`. Consulte a [avaliação da base, configuração do piloto e critérios de abertura](docs/devops/PILOTO.md).

## Escopo acadêmico

- Classes de domínio `Livro`, `Usuario`, `Emprestimo` e `Biblioteca`, modeladas como records imutáveis.
- RF-01 a RF-18: cadastro e consulta de livros e usuários, empréstimo, devolução, atrasos, multas (R$ 2,00/dia) e estatísticas.
- Funções puras, imutabilidade e Streams com `filter`, `map` e `reduce`, incluindo a mesma operação em versão imperativa e funcional (PF-01).
- Persistência real, concorrência tratada no banco e testes unitários e integrados.

Documentação para a apresentação em [`docs/academic`](docs/academic): [rastreabilidade](docs/academic/REQUIREMENTS-TRACEABILITY.md),
[programação funcional](docs/academic/FUNCTIONAL-PROGRAMMING.md), [arquitetura e UML](docs/academic/ARCHITECTURE-OVERVIEW.md),
[roteiro da demonstração](docs/academic/DEMO-SCRIPT.md) e [perguntas e respostas](docs/academic/PRESENTATION-QA.md).
Contratos REST: [`docs/contracts`](docs/contracts/README.md) e [`openapi.yaml`](docs/contracts/openapi.yaml).

## Microsserviços

| Serviço | Responsabilidade | Banco |
| --- | --- | --- |
| `apps/web` | Interface Next.js com o Design System INKO e BFF `/api/v1/*` | — |
| `apps/gateway` | Rotas explícitas, rate limit, admissão, slots (12/12/8/6), deadline de 2 s, circuit breaker (SDD-001) | — |
| `services/catalogo` | `Livro`: cadastro, consulta, filtro por categoria | `inko_catalogo` |
| `services/usuarios` | `Usuario`: cadastro com matrícula única, consulta | `inko_usuarios` |
| `services/circulacao` | `Emprestimo`: empréstimo, devolução, disponibilidade, ativos e atrasados | `inko_circulacao` |
| `services/relatorios` | `Biblioteca`: multas e estatísticas com funções puras | — (consome os demais por HTTP) |

Migrações Flyway versionadas em cada serviço (`src/main/resources/db/migration`) e seed determinístico idempotente em `db/seed`.

## Funcionalidades concluídas

- Cadastro e consulta de livros com identificador `INK-0000` único e filtro por categoria.
- Cadastro e consulta de usuários com matrícula única e e-mail complementar.
- Empréstimo com validação de livro e usuário, prazo padrão de 14 dias e bloqueio de empréstimo duplo (409), inclusive sob concorrência.
- Devolução atômica, recusa de devolução repetida e histórico preservado.
- Relatório de multas e estatísticas calculados pelo serviço Java, com data de referência configurável na tela.
- Exportação CSV do relatório; histórico de empréstimos por usuário.

## Limitações conhecidas

- **Autenticação de operadores (SDD-002)**: a senha é guardada como hash BCrypt e a sessão é opaca, revogável e expira em 8 h, num cookie HttpOnly. O BFF autoriza as rotas privadas. O Gateway (porta 8000) continua sem credencial e acessível só em `127.0.0.1`. Isso é um MVP local, não produção; os limites estão em `docs/academic/SDD-002-EVIDENCIAS.md`.
- "Enviar lembretes" é simulação identificada; não há envio de e-mail (RF-27).
- A equipe pode excluir obras pelo detalhe do acervo, respeitando as restrições de circulação.
- Capas: o operador envia JPEG/PNG de até 2 MiB, gravados no volume `catalogo_media` (ADR-004). Obras sem capa enviada mantêm a ilustração em CSS. O volume não é backup: faça backup dele junto com o PostgreSQL.
- O catálogo público já consulta os serviços. Filtros históricos (RF-24) e auditoria (RF-26) estão pendentes.
- A primeira chamada a um serviço Java logo após subir os contêineres pode exceder o prazo de 2 s do Gateway (aquecimento da JVM); a seguinte responde normalmente.
- Durante os testes, o frontend em modo `next dev` recarregou em ciclo uma vez e o problema não se repetiu; para a demonstração, prefira o frontend do Docker (ou `next build && next start`).

## Requisitos

- Docker Engine / Docker Desktop com Compose v2
- Docker executando containers Linux (no Windows, usar WSL2)
- Para desenvolvimento fora de containers: Node.js 24 LTS, pnpm 10.15, Java 21, Maven 3.9, Python 3.13 e uv

## Execução integrada

```bash
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
# Edite .env e defina INKO_BOOTSTRAP_ADMIN_EMAIL e INKO_BOOTSTRAP_ADMIN_PASSWORD (12+ caracteres).
# A conta de operador ADMIN é criada uma única vez; nunca commite esses valores.
docker compose up --build -d --wait
docker compose ps
```

Acesse:

- Frontend: http://localhost:3000 (acervo público e entrada da equipe em `/login`)
- Gateway e OpenAPI: http://localhost:8000/docs (os contratos de negócio estão em `docs/contracts/openapi.yaml`)
- Status dos serviços: http://localhost:8000/api/v1/system/status
- Exemplo de contrato: http://localhost:8000/api/v1/relatorios/multas?referenceDate=2026-11-09
- PostgreSQL local: 127.0.0.1:5432 (não exposto para outras máquinas)

As portas dos microsserviços Java ficam restritas à rede interna do Docker. Portas do host configuráveis por `WEB_PORT`, `GATEWAY_PORT` e `POSTGRES_PORT`.

Parar sem apagar dados: `docker compose down`. Apagar também o volume do PostgreSQL (perda de todos os dados, inclusive cadastros feitos na apresentação): `docker compose down -v`.

A criação dos bancos e usuários ocorre **somente quando o volume do PostgreSQL é criado pela primeira vez**. As tabelas e o seed são aplicados pelo Flyway na inicialização dos serviços, de forma idempotente.

## Testes

```bash
mvn -B -ntp -f services/catalogo/pom.xml test
mvn -B -ntp -f services/usuarios/pom.xml test
mvn -B -ntp -f services/circulacao/pom.xml test
mvn -B -ntp -f services/relatorios/pom.xml test

cd apps/gateway
uv sync --locked --extra test --no-build --no-install-project
.venv/bin/python -m pytest -q        # Windows: .venv\Scripts\python -m pytest -q
cd ../..

pnpm install --frozen-lockfile
pnpm --filter @inko/web typecheck
pnpm --filter @inko/web test
pnpm --filter @inko/web build
pnpm tokens:check

# Com o Compose em execução:
bash scripts/ci/smoke-compose.sh
python scripts/ci/e2e-academic-flow.py http://127.0.0.1:8000
```

`e2e-academic-flow.py` executa o fluxo obrigatório contra o PostgreSQL real: cadastro de livro e usuário, disponibilidade, empréstimo,
duas requisições simultâneas (um 201 e um 409), devolução, devolução repetida, histórico e relatórios com data de referência fixa.

## Evidências de programação funcional

| Conceito | Onde |
| --- | --- |
| Funções puras | `services/relatorios/.../biblioteca/FuncoesBiblioteca.java`, `services/catalogo/.../livro/CatalogoFuncoes.java`, `services/circulacao/.../emprestimo/CirculacaoFuncoes.java` |
| `filter → map → reduce` | `gerarRelatorioMultas` + `totalizarMultas` |
| Segundo `reduce` | `somarDiasDeAtraso`, `contarEmprestimosAtivos` |
| Imperativo × funcional | `calcularTotalDeMultasImperativo` × `calcularTotalDeMultas` (teste de equivalência) |
| Imutabilidade | records, `List.copyOf` em `Biblioteca`, testes de entrada inalterada |

## Organização

```text
apps/web/                 Next.js 16 + TypeScript (Design System INKO, BFF)
apps/gateway/             FastAPI + httpx (SDD-001)
services/{catalogo,usuarios,circulacao,relatorios}/   Spring Boot 4 + Java 21
packages/design-tokens/   Tokens do Design System
infra/                    Docker, PostgreSQL, observabilidade, Caddy, Ansible
docs/                     academic, architecture, contracts, design, devops
scripts/ci/               smoke do Compose e fluxo acadêmico integrado
```

## Design System

Fonte de verdade em `packages/design-tokens/inko.tokens.json`, CSS gerado em `apps/web/app/inko-tokens.css` (`pnpm tokens:build` / `pnpm tokens:check`),
motions em `apps/web/app/inko-motion.css`. Documentação viva em `/design-system`; handoff em `docs/design/CLAUDE-HANDOFF.md`.

## Padrões de arquitetura

- O frontend fala apenas com a própria origem; o BFF repassa ao Gateway, e o domínio reside nos serviços Java.
- Bancos separados na mesma instância PostgreSQL, sem chaves estrangeiras entre bancos; referências por identificador validadas por HTTP.
- Sem ORM nem tabelas compartilhadas: Spring JDBC com SQL explícito.
- Código Java de implementação sem comentários, conforme o enunciado da disciplina.

## Cuidado

As senhas de `.env.example` são **apenas exemplos para desenvolvimento local**. Não publicar `.env`, segredos ou credenciais reais no GitHub.

## Motion Lab (Claude Design source)

O pacote-fonte `INKO-Design-System-Figma.zip` foi auditado. A versão `v0.3` inclui SVGs/PNG originais de marca, motions de fonte em `apps/web/app/inko-motion.css`, a rota demonstrativa `/motion-lab` e uma matriz de rastreabilidade em `docs/design/claude-source-motion-audit.md`. Os arquivos `.dc.html` são um formato do Claude Design, não páginas React diretamente reutilizáveis.

## Baseline de reprodutibilidade

O monorepo utiliza pnpm 10.15.0 com `pnpm-lock.yaml` versionado. O CI e a imagem Docker do frontend devem instalar exatamente as versões resolvidas, com `--frozen-lockfile`. Novas dependências devem atualizar `package.json` e o lockfile no mesmo Pull Request.

Os assets originais estão em `apps/web/public/inko`. O CSS gerado de `packages/design-tokens/inko.tokens.json` e os motions do Claude estão em `apps/web/app`. A rota `/motion-lab` permanece disponível para demonstrar os efeitos.

## Frontend

As telas operacionais (`/dashboard`, `/acervo`, `/usuarios`, `/emprestimos`, `/devolucoes`, `/relatorios`) leem e gravam pelos serviços reais, via `lib/library-api.ts` e o BFF `app/api/v1/[...path]/route.ts`. A vitrine de `/` e `/landing` lê obras e disponibilidade do BFF. A página `/design-system` usa a amostra estática de `lib/demo.ts`. `/motion-lab` e `/system/status` são diagnósticos.


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


## Operação avançada e observabilidade

Veja [docs/devops/OPERATIONS.md](docs/devops/OPERATIONS.md) para o smoke integrado em PR, monitoramento Prometheus/Grafana, edge Caddy, backups verificáveis, restauração isolada e provisionamento Ansible. O deploy remoto requer um Environment protegido e um host real.
