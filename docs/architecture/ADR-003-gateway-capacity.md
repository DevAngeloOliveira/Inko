# ADR-003 — Capacidade por destino no Gateway

**Status**: adotado para implementação local. O aceite operacional segue os critérios do SDD-001.

O INKO precisa limitar o trabalho iniciado pelo Gateway e manter slots e conexões disponíveis para os destinos saudáveis durante a degradação de outro serviço.

O Gateway usará um worker, admissão sem espera e pools HTTP independentes por serviço. O orçamento inicial é de 38 slots de negócio (12/12/8/6), seis slots de controle e quatro conexões exclusivas para sondas. Cada requisição de negócio admite até uma tentativa upstream. O status lê um snapshot renovado a cada cinco segundos.

Um pool compartilhado maior manteria a competição entre destinos. Uma fila acrescentaria espera ao prazo de dois segundos. Redis ou outro coordenador só se justifica se houver mais de um processo e o orçamento tiver de ser compartilhado entre eles.

O isolamento cobre slots e pools dentro do processo. Quota global, guarda Uvicorn e CPU são recursos compartilhados. Escalar workers ou réplicas exige recalcular o orçamento. Timeout ou desconexão no Gateway pode deixar trabalho em execução no serviço de destino.

Veja o [SDD-001](SDD-001-gateway-resilience-capacity.md) para os contratos, hipóteses iniciais e critérios de aceite.
