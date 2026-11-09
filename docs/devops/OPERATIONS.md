# INKO — DevOps operations v0.2

## Implementado no repositório

- GitHub Actions: builds Next.js, Python e quatro Java; scanner Trivy e SonarCloud
- GHCR: publicação de seis imagens em tags SemVer pela main
- Docker Compose: smoke automático em PRs que alterem serviços/infraestrutura; teste agendado e manual
- Observabilidade opt-in: Prometheus 3.16, Blackbox Exporter e Grafana 13.3
- HTTPS edge opcional: Caddy 2.11 com certificados automáticos, sem publicar a API enquanto não existir autenticação real
- Backup: PostgreSQL com `pg_dump`, verificação de integridade e restauração em banco isolado
- Staging: workflow manual por SSH e rollback por tag, dependente de Environment e host
- IaC: playbook Ansible para provisionar um Ubuntu 24.04 de staging

## Executar o smoke integrado

O workflow `INKO Integration` é executado automaticamente para PRs de aplicação/infraestrutura e também está disponível em **Actions → INKO Integration → Run workflow** após merge. Seu runner cria contêineres descartáveis e nunca utiliza credenciais reais de staging.

O teste verifica: PostgreSQL com três bancos isolados, quatro endpoints Java por meio do Gateway, health dos serviços, home Next.js e os assets estáticos.

## Observabilidade local

Inclua uma senha não trivial e exclusiva em `.env`:

```dotenv
GRAFANA_ADMIN_PASSWORD=SUBSTITUA_POR_UMA_SENHA_FORTE
```

Inicie o monitoramento junto dos sete containers:

```bash
docker compose --env-file .env -f compose.yaml -f compose.monitoring.yaml up -d --build
```

- Grafana: http://127.0.0.1:3001
- Prometheus: http://127.0.0.1:9090
- Quatro serviços: métricas internas em `/actuator/prometheus`
- Blackbox: HTTP do Gateway e frontend

O Grafana provisiona automaticamente o datasource Prometheus. As regras de alerta existem e podem ser visualizadas no Prometheus; **ainda não há notificação externa**. Sem canal de alerta configurado, não existe aviso por e-mail, telefone ou mensageria. Os painéis são acessíveis somente por localhost.

## DNS e HTTPS

O overlay `compose.edge.yaml` é para um host com domínio, DNS e portas 80/443 alcançáveis, após a publicação de imagens no GHCR.

```dotenv
INKO_DOMAIN=inko.seudominio.example
INKO_RELEASE_TAG=v0.4.0
```

```bash
docker compose --env-file .env -f compose.yaml -f compose.release.yaml -f compose.edge.yaml config
docker compose --env-file .env -f compose.yaml -f compose.release.yaml -f compose.edge.yaml up -d --no-build --wait
```

Caddy fornece TLS automático quando o domínio resolve e as portas estão acessíveis. O Gateway não é exposto pelo proxy. A interface pública ainda é apenas uma demonstração; autenticação e autorização reais continuam pendentes.

Mais detalhes em [HTTPS-EDGE.md](HTTPS-EDGE.md).

## Backups e restauração

No host com o PostgreSQL disponível e o arquivo `.env` em segurança:

```bash
bash scripts/ops/backup-postgres.sh backups
bash scripts/ops/verify-backup.sh backups/inko-<timestamp>
```

O backup grava três dumps em formato customizado e um arquivo `SHA256SUMS`. A validação lê as três listas `pg_restore` e confere os checksums.

A restauração de teste **não altera o banco original**:

```bash
bash scripts/ops/restore-isolated.sh backups/inko-<timestamp> inko_catalogo inko_restore_teste --confirm-isolated
```

No ambiente restaurado, compare contagens e constraints antes de considerar o backup recuperável. Para disaster recovery, adote cópia criptografada fora do host, retenção, RPO/RTO definidos e exercícios periódicos de restauração. A restauração do banco operacional exige procedimento explícito de downtime/migração; este script deliberadamente não faz isso.

## Preparação de host com Ansible

A automação disponibilizada é um modelo para Ubuntu 24.04, não um host real provisionado.

```bash
ansible-galaxy collection install -r infra/ansible/requirements.yml
ansible-playbook -i infra/ansible/inventory.example.ini infra/ansible/provision.yml \
  --extra-vars @secure-deploy-vars.yml
```

Forneça o endereço real no inventory e `inko_deploy_public_key` em variáveis locais ou Ansible Vault; não versione arquivos com credenciais. Configure separadamente DNS, firewall, acesso SSH e o `/opt/inko/.env`.

**Atenção:** participar do grupo `docker` equivale a possuir privilégios administrativos sobre o host; utilize somente um usuário de implantação dedicado. O playbook não altera regras de firewall, para evitar cortar o acesso SSH.

## Environment de staging no GitHub

Em **Settings → Environments**, crie `staging`, configure reviewers obrigatórios e restrinja as branches/tags permitidas. Cadastre os cinco secrets usados pelo workflow:

- `INKO_STAGING_HOST`
- `INKO_STAGING_USER`
- `INKO_STAGING_PATH`
- `INKO_STAGING_SSH_KEY`
- `INKO_STAGING_KNOWN_HOSTS`

Os segredos e o host de execução **não estão disponíveis no repositório**. Sem eles, nenhum deploy remoto deve ser tentado.

## Segurança e governança

Proteja a main e as tags `v*`. Exija CI, SonarCloud e Trivy antes do merge. Não habilite `GITHUB_TOKEN` com permissão de escrita global, nem permita que o bot faça commits de manutenção automaticamente.

O aplicativo continua sem autenticação funcional e sem operações reais de domínio. Não há ambiente de produção pronto nem monitoramento externo implantado. Toda publicação em staging dependerá de configuração explícita do host e do Environment.

## Limites de validação

Os overlays Compose, scripts Bash e arquivos Prometheus/Caddy foram preparados para verificação pelo CI. O smoke integrado precisa terminar com sucesso em runner real. Não foram realizados testes de restauração, provisionamento Ansible ou emissão de certificado em um host remoto.
