# Contratos INKO

Os contratos de recursos (`/api/v1/livros`, `/api/v1/usuarios`, `/api/v1/emprestimos` e `/api/v1/relatorios`) serão definidos e versionados antes das sprints de implementação.

O gateway expõe no baseline:

- `GET /health`
- `GET /api/v1/system/status`
- `GET /api/v1/{servico}/ping`

O Gateway também oferece `GET /ready` e `GET /metrics` para uso local ou interno. O status preserva `services[]` e informa o frescor em `observedAt`, `ageMs`, `stale` e `refreshIntervalMs`. Consulte o [SDD-001](../architecture/SDD-001-gateway-resilience-capacity.md) para os limites, os erros estruturados e as rotas aceitas.

Os endpoints `/ping` são apenas diagnósticos e não representam implementação das regras de negócio.
