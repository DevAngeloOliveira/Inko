# INKO DevOps — Operação e entregas

## Ambientes

O monorepo possui um ambiente local Docker Compose, um ambiente efêmero de integração no GitHub Actions e um modelo de staging por SSH. **Produção não está configurada**. Não há infraestrutura remota, DNS, TLS, autenticação ou monitoramento externo habilitados neste repositório.

| Workflow | Disparo | Comportamento |
| --- | --- | --- |
| INKO CI | PR para main, push main, tag vX.Y.Z, manual | Testes Python, Java, Next.js; tokens; Docker; validação Compose |
| INKO CI / publish | Somente tags de versão pertencentes à main, após sucesso dos testes | Publica 6 imagens GHCR com tags vX.Y.Z e sha-<commit>, SBOM e provenance |
| INKO Security | PR para main, semanal, manual | Bloqueia segredos/misconfiguration HIGH/CRITICAL; reporta vulnerabilidades de dependências em modo informativo |
| INKO Integration | Semanal ou manual | Sobe os 7 containers, espera health checks, valida API, gateway, UI e SVGs; descarta os volumes temporários |
| INKO Staging Deployment | Manual | Usa tag publicada para deploy ou rollback em staging mediante configuração prévia de ambiente protegido |

A pipeline não cria commits automaticamente. `github-actions[bot]` é o executor do GitHub Actions e pode aparecer nos logs e publicações de imagens, mas não precisa ser autor do código-fonte.

## Fluxo recomendado

1. Desenvolver em branch e abrir PR.
2. Exigir INKO CI, SonarCloud e INKO Security aprovados.
3. Fazer merge manual após revisão.
4. Criar uma tag de release sobre um commit na main:

```bash
git switch main
git pull --ff-only origin main
git tag -a v0.4.0 -m "INKO release v0.4.0"
git push origin v0.4.0
```

5. O mesmo workflow de CI valida os serviços e publica as imagens em `ghcr.io/devangelooliveira/inko/{web,gateway,catalogo,usuarios,circulacao,relatorios}:v0.4.0`.
6. Somente após a publicação bem-sucedida, acionar manualmente INKO Staging Deployment com a mesma tag.

Não usar tags de release semânticas para commits que ainda não estão na main. Recomenda-se proteger `main` e `v*` com rulesets do GitHub.

## Publicação e acesso ao GHCR

A publicação usa o `GITHUB_TOKEN` com permissão temporária `packages:write` **somente no job de release**. Não utiliza PAT permanente nem senha de registro no repositório. A imagem tem SBOM e attestations de provenance geradas pelo BuildKit.

O host remoto precisa ter acesso às imagens: configure os pacotes GHCR como públicos ou faça `docker login ghcr.io` no host com credenciais de leitura de pacotes administradas fora do GitHub Actions. A publicação por si só não significa que houve implantação.

## Staging manual

O workflow `INKO Staging Deployment` depende de um Environment chamado `staging` no GitHub. Configure reviewers obrigatórios e os seguintes secrets **no Environment**:

| Secret | Finalidade |
| --- | --- |
| `INKO_STAGING_HOST` | Nome DNS ou IPv4 do host |
| `INKO_STAGING_USER` | Usuário SSH de implantação, com acesso ao Docker |
| `INKO_STAGING_PATH` | Caminho absoluto sem espaços; ex: `/opt/inko` |
| `INKO_STAGING_SSH_KEY` | Chave SSH privada exclusiva do deploy |
| `INKO_STAGING_KNOWN_HOSTS` | Chave pública real do servidor em formato `known_hosts`, conferida fora do CI |

Na máquina remota, crie `/opt/inko/.env` com credenciais reais, `POSTGRES_PASSWORD`, `CATALOG_DB_PASSWORD`, `USERS_DB_PASSWORD` e `CIRCULATION_DB_PASSWORD`. Não versione nem transfira esse arquivo pelo workflow. O host deve possuir Docker Engine, Docker Compose v2, Bash, tar e curl.

O workflow transmite **somente manifests e scripts**, faz backup dos bancos quando a instância PostgreSQL já está ativa, executa pull de imagens pela tag selecionada e aguarda health checks. Os endpoints locais continuam ligados a 127.0.0.1. Publicação externa com DNS/HTTPS requer reverse proxy e TLS configurados separadamente.

## Rollback

Use `workflow_dispatch` com `operation=rollback` e uma `release_tag` anterior, previamente publicada. O procedimento reaplica imagens anteriores; **não reverte migrações nem altera automaticamente os dados PostgreSQL**.

Com o Compose no host, uma alternativa manual é:

```bash
INKO_RELEASE_TAG=v0.3.0 docker compose --env-file .env \
  -f compose.yaml -f compose.release.yaml up -d --no-build --wait
```

O comando manual presume que as imagens da versão já estão no host; faça pull antes, se necessário.

## Backups

No host com `compose.yaml` e `.env` existentes:

```bash
bash scripts/ops/backup-postgres.sh backups
```

O script usa `pg_dump --format=custom` em cada banco, com arquivos separados e permissões restritas. Valide restaurações em ambiente isolado antes de confiar no backup. Mantenha cópias externas criptografadas e com retenção definida; backups locais não substituem disaster recovery.

**Nunca usar `docker compose down -v` no staging ou produção.** A limpeza de volumes é exclusiva do workflow de integração, que roda em runner descartável.

## Segurança e governança

- Branch protection: obrigar PRs, checks de CI, segurança e SonarCloud, bloqueando force push na main.
- Tag protection: proteger `v*` para liberar somente releases deliberadas.
- Actions: permissões padrão restritas, segredos só em Environment, sem deploy de branches de PR.
- Trivy: segredos e configurações HIGH/CRITICAL são bloqueantes; vulnerabilidades de dependências são inicialmente informativas e deverão passar a bloqueantes após tratar a baseline.
- Imagens: não usar `latest` como contrato operacional; selecionar `vX.Y.Z` para deploy e `sha-...` para rastreabilidade.
- Logs: rotacionados por `json-file`; health do Next.js e demais serviços disponíveis.
- Integração: verificar logs de falha nos artifacts do workflow, sem publicar segredos.

## Limites atuais

Ainda não existem métricas Prometheus/Micrometer, OpenTelemetry, centralização de logs, alertas, regras de backup remoto, provisionamento IaC de servidor nem ambiente de produção. Esses itens dependem de infraestrutura e requisitos operacionais concretos. O gateway e microsserviços ainda são uma baseline acadêmica sem operações reais de domínio.

## Publicação automatizada GHCR por manifesto

A primeira release é controlada por `releases/inko.json`. O workflow `INKO GHCR Release` publica seis imagens e só cria a tag e o GitHub Release após validar todas. Instruções e visibilidade dos packages: [GHCR-RELEASE.md](GHCR-RELEASE.md).
