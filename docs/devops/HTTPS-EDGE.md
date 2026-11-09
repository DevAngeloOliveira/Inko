# INKO HTTPS Edge

O `compose.edge.yaml` utiliza Caddy como reverse proxy com HTTPS automático para um domínio configurado pelo operador. Ele publica somente o frontend Next.js; toda a API `/api/*` é bloqueada intencionalmente até existir autenticação real e uma revisão de segurança do Gateway.

## Pré-requisitos

- Host Linux com Docker Engine e Docker Compose v2 (com suporte ao YAML `!reset`)
- Domínio próprio apontando para o IP público do host
- TCP 80/443 e UDP 443 liberados no firewall
- Imagens do INKO previamente publicadas no GHCR
- `.env` privado contendo as senhas do PostgreSQL, `INKO_DOMAIN` e `INKO_RELEASE_TAG`

Verifique a configuração sem iniciar containers:

```bash
INKO_RELEASE_TAG=v0.4.0 docker compose --env-file .env \
  -f compose.yaml -f compose.release.yaml -f compose.edge.yaml config --quiet
```

Apenas depois de DNS, imagens e credenciais estarem configurados:

```bash
INKO_RELEASE_TAG=v0.4.0 docker compose --env-file .env \
  -f compose.yaml -f compose.release.yaml -f compose.edge.yaml \
  up -d --no-build --wait
```

Não executar `down -v`: os certificados Caddy e dados PostgreSQL residem em volumes persistentes.

**Escopo:** trata-se de um edge seguro para **demonstração do frontend**. O INKO ainda não possui autenticação real, autorização ou funcionalidades completas e não está liberado como sistema de produção. O gateway só deve ser publicado após implementação e auditoria das proteções necessárias.
