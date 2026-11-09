# INKO — GHCR Release v0.4.0

O fluxo `INKO GHCR Release` publica as seis imagens Docker de aplicação a partir de um manifesto versionado no repositório. Os executores do GitHub Actions não adicionam commits ao histórico.

## Primeira publicação

O manifesto `releases/inko.json` contém `"version": "v0.4.0"`. Quando este manifesto é adicionado ou atualizado por um Pull Request e o PR é integrado à `main`, o workflow executa:

1. Validação de SemVer e verificação de inexistência da tag.
2. Testes dos quatro serviços Spring Boot, Gateway FastAPI e frontend Next.js, além dos tokens e Compose.
3. Build e push de seis imagens `linux/amd64` com SBOM e provenance.
4. Inspeção dos seis manifests no GHCR com autenticação por `GITHUB_TOKEN`.
5. Criação de tag anotada e GitHub Release **somente após os seis pushes concluírem**.

Os pacotes são nomeados `ghcr.io/devangelooliveira/inko/{web,gateway,catalogo,usuarios,circulacao,relatorios}:v0.4.0`.

O workflow não cria commits, não usa tokens pessoais permanentes e não executa deploy. Tags criadas usando `GITHUB_TOKEN` não disparam novos workflows de `push`; por isso, a publicação e as verificações já são executadas pelo próprio fluxo de release.

## Verificação após execução

Consulte **Actions → INKO GHCR Release**. Para considerar a entrega finalizada, precisam estar verdes os jobs `prepare`, `verify`, os **seis jobs `publish`** e `finalize`.

Verifique a tag `v0.4.0` em **Releases** e os seis packages no perfil do GitHub. A publicação inicial costuma deixar os packages **privados**. Para download anônimo em servidores externos, altere a visibilidade de cada package em **Package settings → Change visibility → Public**. Essa escolha deve ser feita explicitamente pelo proprietário.

## Utilização em servidor

Com Docker Compose v2 e as credenciais reais existentes apenas no `.env` do host:

```bash
export INKO_RELEASE_TAG=v0.4.0
docker compose --env-file .env -f compose.yaml -f compose.release.yaml pull
docker compose --env-file .env -f compose.yaml -f compose.release.yaml up -d --no-build --wait
```

Se os packages continuarem privados, o host deve executar `docker login ghcr.io` com credencial **somente de leitura** e armazenamento seguro. Evite senhas nos argumentos do shell.

O registro GHCR armazena imagens, mas não hospeda a aplicação. Para staging público é preciso host, DNS, HTTPS e configuração segura. Nunca publique os endpoints de backend antes da implementação de autenticação e autorização.

## Próximas versões

Para uma nova release, mude apenas a versão no manifesto (por exemplo `v0.4.1`) via Pull Request. Tags existentes não serão sobrescritas. Não envie manualmente tags de versões com builds ainda não validados.

Se um ou mais builds falharem, a tag e o GitHub Release não são criados. Algumas imagens podem existir no GHCR como publicação parcial; para recuperá-las, faça reexecução dos jobs antes de alterar a versão e confira o resultado da validação.

Para mais detalhes sobre staging e rollback, consulte `docs/devops/README.md` e `docs/devops/OPERATIONS.md`.
