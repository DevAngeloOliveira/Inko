# SDD-001 — Evidências de validação local

Execução de 12/11/2026 a partir da baseline `6cc015d` e das alterações locais da branch `codex/sdd-001-gateway-resilience`. Host Windows 11, AMD Ryzen 9 3900X (12 núcleos e 24 threads), Docker Desktop com engine Linux 29.9.2 e cerca de 7,7 GiB para a VM. Os ensaios Linux limitaram cada Gateway a 1 vCPU e 512 MiB. O gerador de chegada aberta usou Python 3.13.15 no host. Os upstreams de carga eram stubs HTTP na rede isolada. O [runbook](GATEWAY-CAPACITY.md) contém os comandos e parâmetros.

## Primeira rodada Linux

Imagem `sha256:86061d1c395dcbf56726a17530ffec7dceed5fd62d39233261ab801edcb7faa3`. A rodada coincidiu com builds Docker e apresentou atrasos de agendamento do gerador e da VM. Latências da tabela mostram o maior percentil entre os destinos, incluindo respostas de rejeição. Os números são evidência de bancada.

| Cenário | Programadas / enviadas / descartadas | Respostas | p95 / p99 máx. | Tentativas / admissões |
| --- | ---: | --- | ---: | ---: |
| Normal, 10 req/s por 120 s | 1.200 / 1.171 / 29 | 1.102 × 200, 3 × 429, 5 × 503 da aplicação, 61 falhas de rede | 195 / 3.569 ms | 1.129 / 1.156 |
| Saturação, 120 req/s por 30 s | 3.600 / 2.972 / 628 | 729 × 200, 1.795 × 429, 442 × 503 do Uvicorn, 2 × 503 da aplicação, 3 × 504, 1 × 500 | 2.070 / 3.514 ms | 733 / 733 |
| Relatórios a 1,5 s, 30 s | 360 / 359 / 1 | Relatórios 287 × 503 e 12 × 504. Circulação 58 × 200 e 2 × 504 | Circulação 144 / 606 ms | 72 / 354 |
| Soak, 10 req/s por 600 s | 6.000 / 5.844 / 156 | 5.743 × 200, 34 × 503 do Uvicorn, 32 × 504, 1 × 429, 34 falhas de rede | 731 / 1.696 ms | 5.778 / 5.778 |

Na saturação, o pico amostrado de trabalho de negócio foi 22 e voltou a zero. Na degradação de Relatórios, o pico global foi 7. O teste TCP com barreiras é a evidência do teto de 38 operações e da reserva de oito slots para Circulação enquanto os seis de Relatórios estão ocupados. O teste de carga inclui a quota e a guarda compartilhadas. O ensaio complementar no Windows, sem o limite do container, observou seis tentativas simultâneas de Relatórios e 59 respostas 200 em Circulação, com p95 de 9 ms.

A rodada inicial ficou aquém das metas de p99 e sucesso em carga ordinária. O pico de atraso medido no agendador do Gateway foi 1,68 s durante saturação. O 500 nessa rodada foi associado à expiração conjunta do prazo de trabalho e da janela de erro antes do início da resposta ASGI.

No soak, o pico de memória cgroup foi 58,8 MiB e o valor após a pausa foi 54,5 MiB. O RSS de processo amostrado atingiu 64,8 MiB e permaneceu nesse nível após a pausa. O pico de concorrência de negócio foi nove, com retorno a zero. O agendador registrou atraso de até 6,01 s durante essa rodada concorrente com builds no host. Em uma rodada complementar de 600 s no Windows, 5.932 de 6.000 chegadas foram enviadas, todas responderam 200 e o maior p99 entre os destinos foi 131 ms.

O Gateway agora tenta uma única resposta da fase correta se ainda não iniciou o envio. A tentativa usa o prazo absoluto original e pode concluir na retomada se o servidor aceitar o envio imediatamente. Dois testes reproduzem a expiração simultânea e verificam `408` no upload e `504` aguardando upstream, sem nova tentativa upstream.

## Repetição com a correção

Imagem `sha256:1d66944e133c8ce334a585267c6c34530961c818359eda1584ab14d67a9f69fd`, com o mesmo perfil de CPU e memória. A repetição incluiu as fases diretamente relevantes para a correção.

| Cenário | Programadas / enviadas / descartadas | Respostas | p95 / p99 máx. | Tentativas / admissões |
| --- | ---: | --- | ---: | ---: |
| Normal, 10 req/s por 120 s | 1.200 / 1.143 / 57 | 1.070 × 200, 51 × 429, 13 × 504, 9 falhas de rede | 1.751 / 3.599 ms | 1.089 / 1.089 |
| Saturação, 120 req/s por 30 s | 3.600 / 2.577 / 1.023 | 653 × 200, 1.445 × 429, 475 × 503 do Uvicorn, 4 × 503 da aplicação | 3.177 / 3.741 ms | 653 / 653 |
| Relatórios a 1,5 s, 30 s | 360 / 360 / 0 | Relatórios 290 × 503 e 10 × 504. Circulação 60 × 200 | Circulação 1.068 / 1.408 ms | 70 / 323 |

A saturação repetida teve zero respostas 500 e pico amostrado de 18 slots de negócio. Em isolamento, Relatórios atingiu seis tentativas simultâneas e Circulação respondeu a todas as suas chamadas. A concorrência de negócio voltou a zero nos três casos. A meta de p95/p99 e sucesso ordinário segue pendente de calibração em uma bancada sem a contenção observada. A rodada normal no Windows, sem o limite de container, teve 1.191 respostas 200 em 1.191 chamadas enviadas e p95/p99 máximos de 9/254 ms.

## Serviços e banco

No Compose isolado, o PostgreSQL 17 retornou `max_connections=100` e havia dez sessões em cada um dos três bancos de aplicação durante a coleta. A contagem de threads do processo Java em repouso mostrou dez workers HTTP do Tomcat por serviço e um thread de manutenção Hikari por serviço JDBC. Os quatro serviços Spring Boot 4.1.2 responderam `404` a `/actuator/prometheus` nas imagens Java locais reutilizadas, portanto faltam séries de utilização sob carga desse endpoint. O scrape Java existente foi preservado. Qualquer ajuste de pools depende de medição com as rotas de domínio e carga SQL.

O primeiro smoke expirou aguardando o snapshot enquanto a imagem Web ainda compilava. As consultas diretas aos quatro serviços retornaram 200, e um comparativo de quatro ciclos de sonda por serviço obteve 200 com e sem keep-alive. O Gateway voltou a publicar quatro serviços saudáveis em ciclos consecutivos após reiniciar no projeto isolado. O smoke final passou com o Gateway corrigido e a Web `sha256:74a6e4121afd7d0a8498065c8236119da823abc4a2089e11e85524958e56b5fa`. Verificou sete containers saudáveis, os quatro pings, os três bancos, 40 assets e o logo otimizado. A página `/system/status` renderizou o estado e `/metrics` respondeu pelo Gateway e retornou 404 pela Web.

## Verificações automatizadas

- Gateway com Python 3.13.15 e dependências travadas, 25 testes aprovados.
- Web, typecheck e build aprovados, 28 testes aprovados. Os cinco testes de tokens passaram no Linux. No Windows, um teste de tokens falhou ao converter a URL de um arquivo em caminho local.
- Java, um teste aprovado em cada um dos quatro serviços, compilado com `--release 21`.
- Quatro testes da auditoria Sonar, validação de Compose, seis regras Prometheus, Caddy, actionlint e Trivy de código-fonte offline aprovados. A primeira tentativa Trivy online parou com HTTP 429 do Maven Central.

## Governança

A auditoria local do SonarCloud passou seus casos sintéticos. O check nativo do PR e a análise do SHA integrado com Quality Gate `OK` e Security Rating `A` dependem do fluxo remoto. A revisão local ainda não possui esse SHA integrado.
