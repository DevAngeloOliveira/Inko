# Contratos INKO

Os contratos de recursos (`/api/v1/livros`, `/api/v1/usuarios`, `/api/v1/emprestimos` e `/api/v1/relatorios`) serão definidos e versionados antes das sprints de implementação.

O gateway expõe no baseline:

- `GET /health`
- `GET /api/v1/system/status`
- `GET /api/v1/{servico}/ping`

Os endpoints `/ping` são apenas diagnósticos e não representam implementação das regras de negócio.
