# ADR-004 — Capas fora do Gateway de negócios

**Status**: adotado no MVP (SDD-002). **Data**: 2026-11-17.

O Gateway FastAPI tem um contrato JSON de até 64 KiB, com prazo de 2 s e uma tentativa upstream (SDD-001). Uma capa de até 2 MiB não cabe nesse contrato. Aumentar o limite global afetaria todas as rotas de negócio e o orçamento de capacidade do ADR-003.

**Decisão.** Os binários de capa seguem um caminho próprio: navegador → BFF Next `/api/media/livros/{id}` → Catálogo (`CATALOGO_INTERNAL_URL`, origem fixa na rede Docker). O Gateway não participa desse caminho e seus limites permanecem iguais.

**Limites do caminho de mídia:**

- **BFF**
  - Exige sessão de operador e `Origin` da própria aplicação no `PUT` e no `DELETE`.
  - Conta os bytes durante o stream e aborta acima de 2 MiB mais a sobrecarga do multipart.
  - Aceita no máximo 4 envios simultâneos por processo; acima disso responde 429.
  - Não faz retry.
  - Usa timeout de 10 s para envio e de 2,5 s para leitura e remoção.
  - Faz streaming no `GET` e aceita apenas `image/jpeg` ou `image/png` vindos do Catálogo.
- **Catálogo**
  - Valida o MIME declarado, a assinatura, as dimensões (antes de decodificar) e a decodificação.
  - Regrava a imagem sem metadados.
  - Grava de forma atômica no volume `catalogo_media` e guarda os metadados em `capas_livros`.
  - Não baixa imagens por URL, o que evita SSRF.

**Consequências.**

- A leitura é pública e cacheável. A URL carrega a versão (`?v=<sha256[0:16]>`), de modo que cada troca de capa invalida o cache.
- O Catálogo passa a receber tráfego que não passa pelo Gateway. Na stack do Compose ele continua sem porta publicada.
- Escalar o web para várias réplicas multiplica o limite de concorrência. Nesse caso, mova o semáforo para o serviço ou para um proxy.
- A troca para um storage S3-compatible fica atrás da classe de armazenamento do Catálogo, como prevê a fase P1 do SDD-002.
