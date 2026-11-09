# ADR-001 — Monorepo poliglota

**Status:** Aceito como baseline inicial (Sprint 00).

## Contexto

INKO usa Next.js, FastAPI, Spring Boot e PostgreSQL. A monorepo precisa permitir compilar, testar e publicar serviços sem lock-in em um único gerenciador de pacotes.

## Decisão

- `apps/web`: Next.js, gerenciado por pnpm.
- `apps/gateway`: FastAPI, gerenciado por pip e pyproject.toml.
- `services/*`: projetos Spring Boot Maven independentes, sem compartilhamento de entidades.
- `infra`: Dockerfiles e inicialização de bancos.
- `compose.yaml`: desenvolvimento integrado com sete containers.
- Um container PostgreSQL com bancos e usuários segregados por serviço.
- O serviço de relatórios não possui acesso direto aos bancos dos outros domínios.
- Comunicação síncrona HTTP no baseline; sem mensageria ou service discovery.

## Consequências

- Independência de build entre os projetos, ainda que o repositório seja único.
- Aumento do custo de integração, mitigado por contratos versionados e testes.
- Migrations e regras de domínio serão implementadas nas sprints seguintes.
- A classe `Biblioteca` exigida no trabalho deverá ser modelada explicitamente na implementação e diagrama final.
