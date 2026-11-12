# Validação local da capacidade do Gateway

Veja o [relatório de evidências](GATEWAY-CAPACITY-EVIDENCE.md) para os resultados observados e as pendências do SDD-001.

O [SDD-001](../architecture/SDD-001-gateway-resilience-capacity.md) especifica um worker, 38 slots de negócio distribuídos por destino, seis slots de controle e quatro conexões exclusivas de sondagem. Uma chamada de negócio admitida inicia no máximo uma tentativa upstream. As quotas contam o peer TCP. Quando o Next.js encaminha requisições, elas podem compartilhar um bucket.

Os defaults ficam em `GatewaySettings`. Para alterar o perfil, passe as variáveis ao processo ou ao bloco `environment` do Gateway em um overlay Compose. Use segundos para `INKO_GATEWAY_DEADLINE`, `INKO_GATEWAY_ERROR_RESERVE` e os demais tempos, bytes para `INKO_GATEWAY_REQUEST_BYTES` e `INKO_GATEWAY_RESPONSE_BYTES`, e requisições por segundo para as taxas. O total de `INKO_GATEWAY_BUSINESS_SLOTS` deve coincidir com a soma dos quatro limites `INKO_GATEWAY_<SERVIÇO>_SLOTS`. Se os limites mudarem, revalide o orçamento da guarda Uvicorn no Dockerfile.

## Stack isolada e rollback

Use um projeto Compose separado quando o ambiente local já estiver em execução. O exemplo abaixo usa credenciais de teste e portas de loopback alternativas:

```bash
export COMPOSE_PROJECT_NAME=inko-sdd001
export COMPOSE_ENV_FILES=.env.example
export POSTGRES_PORT=15432 GATEWAY_PORT=18000 WEB_PORT=13000
docker compose -f compose.yaml -f compose.capacity.yaml up --detach --build --wait --wait-timeout 600
bash scripts/ci/smoke-compose.sh
docker compose ps
```

O smoke verifica `/health`, `/ready`, snapshot fresco com quatro serviços saudáveis, os quatro pings, os três bancos e os assets do Next.js. Se a nova imagem regredir, use a revisão anterior em um checkout separado ou a imagem anterior conhecida para recriar o Gateway e a Web. Após a validação, `docker compose down` encerra apenas o projeto selecionado e preserva os volumes.

## Carga local

O gerador usa o HTTPX do lock do Gateway. Executar da raiz do repositório com o Python do ambiente de teste. Antes de medir, confirmar o limite do container e registrar versão do Docker, CPU, RAM, sistema e SHA base. Se houver mudanças locais, registrar também o ID da imagem efetivamente executada.

```bash
for scenario in normal saturation soak; do
  apps/gateway/.venv/bin/python scripts/ops/measure-gateway.py "$scenario" \
    --url "http://127.0.0.1:$GATEWAY_PORT" --source "$(git rev-parse HEAD)" > "$scenario.json"
done
```

No cenário de isolamento, executar o modo `stub --bind 0.0.0.0` em uma rede Docker descartável, sem publicar suas portas. O stub responde a health e ping nas portas 8081 a 8084 e atrasa em 1,5 s o ping da porta 8084. Em um Gateway de teste conectado à mesma rede, configurar os quatro `*_URL` para o nome do stub e sua porta correspondente, aplicar o mesmo limite de CPU e memória e publicar o Gateway apenas em loopback. Rodar `measure-gateway.py isolation` nesse endereço. Os testes pytest usam barreiras para provar o limite exato de slots independentemente da taxa de chegada.

Os JSONs registram chegadas programadas, envios, descartes do gerador, latência por serviço, respostas `503` da aplicação e do Uvicorn e amostras de recursos antes, durante e após o teste. Para memória do container, registrar também `memory.peak` em cgroup v2. Avaliar o pico de slots e conexões, tentativas de negócio em relação às admissões e retorno de operações em curso a zero. Metas de latência e memória são hipóteses locais. Os pings validam o transporte. Dimensionar Tomcat, Hikari e PostgreSQL com os contratos de domínio e uma carga que exercite SQL.

## SonarCloud

Antes da integração, verificar o check nativo para a revisão do PR. Para encerrar na main, executar a auditoria com `--strict --expected-sha <SHA-integrado>`. Registrar a revisão analisada, o ID da análise, Quality Gate `OK` e Security Rating `A`. Ver [procedimento do SonarCloud](SONARCLOUD-BASELINE.md) para a configuração administrativa de New Code.
