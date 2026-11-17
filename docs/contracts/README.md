# Contratos INKO

Os contratos de negócio são expostos pelo Gateway (`http://localhost:8000`) e repassados a destinos fixos.
O frontend chama os mesmos caminhos na própria origem (`/api/v1/...`), e o BFF do Next.js os encaminha ao Gateway.
Especificação OpenAPI 3.1: [`openapi.yaml`](openapi.yaml).

## Convenções

- JSON UTF-8. Datas de negócio no formato `YYYY-MM-DD` (`LocalDate`); valores monetários são números com duas casas (`BigDecimal`).
- Identificadores: livro `INK-0000` (informado no cadastro), usuário `USR-0000` e empréstimo `EMP-00000` (gerados pelo serviço).
- Erros seguem `application/problem+json`:

```json
{ "type": "about:blank", "title": "Conflict", "status": 409, "code": "BOOK_UNAVAILABLE",
  "detail": "Obra indisponível: já existe um empréstimo ativo.", "field": "livroId" }
```

| Status | Quando |
| --- | --- |
| 200 / 201 | Consulta ou gravação concluída |
| 400 | JSON malformado, parâmetro de consulta não permitido, corpo em rota que não aceita corpo |
| 404 | Recurso inexistente ou rota não registrada |
| 409 | Identificador ou matrícula duplicados, livro já emprestado, devolução repetida |
| 413 / 415 | Corpo acima de 64 KiB ou sem `application/json` |
| 422 | Regra de validação violada (formato, campo obrigatório, prazo, referência inexistente) |
| 503 | Serviço dependente indisponível, circuito aberto ou capacidade esgotada; a operação **não** é confirmada |
| 504 | Serviço excedeu o prazo do Gateway (2 s) |

## Recursos

| Método | Caminho | Serviço | Consulta | Corpo | Respostas |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/livros` | Catálogo | `categoria`, `q` | — | 200 `Livro[]` |
| POST | `/api/v1/livros` | Catálogo | — | `Livro` | 201, 409, 422 |
| GET | `/api/v1/livros/{id}` | Catálogo | — | — | 200, 404 |
| GET | `/api/v1/livros/{id}/disponibilidade` | Circulação | — | — | 200, 404, 503 |
| GET | `/api/v1/usuarios` | Usuários | `q` | — | 200 `Usuario[]` |
| POST | `/api/v1/usuarios` | Usuários | — | `NovoUsuario` | 201, 409, 422 |
| GET | `/api/v1/usuarios/{id}` | Usuários | — | — | 200, 404 |
| GET | `/api/v1/emprestimos` | Circulação | `usuarioId`, `livroId` | — | 200 `Emprestimo[]` (inclui devolvidos) |
| POST | `/api/v1/emprestimos` | Circulação | — | `NovoEmprestimo` | 201, 409, 422, 503 |
| GET | `/api/v1/emprestimos/ativos` | Circulação | — | — | 200 |
| GET | `/api/v1/emprestimos/atrasados` | Circulação | `referenceDate` | — | 200 |
| GET | `/api/v1/emprestimos/{id}` | Circulação | — | — | 200, 404 |
| POST | `/api/v1/emprestimos/{id}/devolucao` | Circulação | — | `{ "dataDevolucao" }` (opcional) | 200, 404, 409, 422 |
| GET | `/api/v1/relatorios/multas` | Relatórios | `referenceDate` | — | 200, 503 |
| GET | `/api/v1/relatorios/estatisticas` | Relatórios | `referenceDate` | — | 200, 503 |

`referenceDate` é opcional; quando ausente, o serviço usa a data atual de `America/Sao_Paulo`. Para resultados reprodutíveis, sempre informe a data.

## Modelos

```text
Livro          { id, titulo, autor, categoria: "Mangá" | "HQ" | "Graphic novel", volume?, editora?, tituloOriginal? }
NovoUsuario    { nome, matricula, email? }
Usuario        { id, nome, matricula, email?, cadastradoEm }
NovoEmprestimo { livroId, usuarioId, dataEmprestimo?, dataPrevista? }   padrão: hoje e +14 dias
Emprestimo     { id, livroId, usuarioId, dataEmprestimo, dataPrevista, dataDevolucao? }
Disponibilidade{ livroId, disponivel, emprestimoId?, usuarioId?, dataPrevista? }
RelatorioMultas{ referenceDate, valorDiario, quantidade, totalDiasAtraso, total, itens[] }
Estatisticas   { referenceDate, totalLivros, totalUsuarios, totalEmprestimos, emprestimosAtivos,
                 emprestimosAtrasados, totalMultas, livrosPorCategoria{}, emprestimosPorUsuario[] }
```

## Regras garantidas pelos serviços

- **Disponibilidade** é derivada: um livro está disponível quando não existe empréstimo com `dataDevolucao` nula. Não há flag persistida.
- **Concorrência**: o índice único parcial `uq_emprestimo_ativo_livro (livro_id) WHERE data_devolucao IS NULL` impede dois empréstimos ativos do mesmo livro. A violação vira `409 BOOK_UNAVAILABLE`.
- **Referências**: a Circulação consulta Catálogo e Usuários por HTTP (timeouts de 300 ms de conexão e 500 ms de leitura). Livro ou usuário inexistente → `422`; serviço fora do ar → `503`, sem gravação.
- **Devolução** é um `UPDATE ... WHERE data_devolucao IS NULL`: uma segunda devolução não altera o histórico e responde `409`.
- **Atraso**: `dataDevolucao == null` e `dataPrevista < referenceDate`. No dia do vencimento não há atraso.
- **Multa**: R$ 2,00 por dia de atraso, somente para empréstimos ativos atrasados na data de referência.
- **Relatórios** fazem três leituras em lote e em paralelo (livros, usuários, empréstimos), com orçamento total de 1 s, e nunca uma chamada por empréstimo.

## Gateway (SDD-001)

As rotas acima são registradas explicitamente em `apps/gateway/inko_gateway/config.py` (`BUSINESS_ROUTES`), com método, serviço de destino,
parâmetros de consulta permitidos e permissão de corpo. O cliente não escolhe o destino. Seguem valendo: rate limiting, admissão,
slots por serviço (Catálogo 12, Usuários 12, Circulação 8, Relatórios 6; total 38), deadline de 2 s, uma única tentativa upstream,
circuit breaker e limites de payload. Endpoints de controle inalterados: `GET /health`, `GET /ready`, `GET /metrics`,
`GET /api/v1/system/status` e os diagnósticos `GET /api/v1/{servico}/ping`.
