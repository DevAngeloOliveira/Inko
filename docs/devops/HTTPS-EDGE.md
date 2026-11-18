# INKO HTTPS Edge

O Caddy termina HTTPS e encaminha a interface e as chamadas de mesma origem ao Next.js. Os handlers de sessão, catálogo, disponibilidade e capas pertencem ao BFF. O gateway, PostgreSQL e os serviços Java continuam na rede interna.

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

Para uso com dados reais, siga a [configuração e homologação do piloto](PILOTO.md).
