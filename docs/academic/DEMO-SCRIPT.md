# Roteiro da apresentação (18/11/2026)

Tudo roda localmente, sem internet e sem nuvem. Ensaiar uma vez completo antes da aula.

## 0. Preparação (antes de entrar na sala)

```bash
cp .env.example .env
# Defina INKO_BOOTSTRAP_ADMIN_EMAIL e INKO_BOOTSTRAP_ADMIN_PASSWORD (12+ caracteres) no .env.
docker compose up --build -d --wait
docker compose ps
```

- Confirme os 7 contêineres `healthy` e abra http://localhost:3000.
- Faça **uma** requisição de aquecimento (abrir o Acervo): a primeira chamada a cada serviço Java após subir pode passar do prazo de 2 s do Gateway.
- Use o frontend do Docker (porta 3000). O modo `pnpm dev` não é o recomendado para a apresentação.
- Se quiser recomeçar do seed: `docker compose down -v && docker compose up --build -d --wait` (**apaga os dados locais**).
- Data de referência da demonstração: **09/11/2026** (seed com 4 empréstimos atrasados e R$ 96,00 em multas).

## 1. Abertura — o problema (1 min)

Biblioteca de mangás e HQs: cadastrar obras e leitores, emprestar, devolver e cobrar R$ 2,00 por dia de atraso.
Arquitetura: Next.js → Gateway FastAPI → 4 serviços Java → PostgreSQL (um banco por serviço). Mostre `docs/academic/ARCHITECTURE-OVERVIEW.md`.

## 2. Fluxo na interface (5 min)

1. **Login** (http://localhost:3000/login): mostre primeiro uma senha errada (alerta genérico). Depois entre com a conta de operador do `.env`, recarregue a página e mostre que a sessão continua (cookie HttpOnly validado no servidor, SDD-002).
   Em seguida, abra uma obra e envie uma capa JPEG/PNG própria (até 2 MiB). Ela continua lá depois de `docker compose restart catalogo web`.
2. **Acervo**: filtre por categoria *HQ* (RF-03). Abra *Maré de Tinta · Vol. 3*: está **Atrasado**.
3. **Cadastrar obra** (`/acervo/novo`): `INK-0500`, *Obra da Apresentação*, autor qualquer, *Mangá* → Salvar (RF-01).
   Tente salvar de novo com o mesmo identificador → erro "já existe" (409).
4. **Usuários** → *Novo usuário*: nome, matrícula `APR2026` (RF-04). Tente a mesma matrícula de novo → erro.
5. **Empréstimos**: escolha o novo usuário e a obra `INK-0500` → datas → Confirmar (RF-07). Mostre o código `EMP-...`.
6. **Novo empréstimo** da mesma obra para outro usuário: o passo de disponibilidade mostra o conflito (RF-06).
7. **Devoluções**: selecione `EMP-10302` (*Maré de Tinta*, 15 dias de atraso) → Confirmar → multa de R$ 30,00 (RF-09).
8. **Relatórios** com referência 09/11/2026: total caiu de R$ 96,00 para R$ 66,00, porque o devolvido saiu do relatório (RF-13).
   Troque para 16/11 e 30/11 e mostre o recálculo. Exporte o CSV (RF-23).

## 3. Prova de persistência (1 min)

```bash
docker compose restart catalogo usuarios circulacao relatorios
```

Recarregue a página: a obra `INK-0500` e o empréstimo continuam lá (PostgreSQL).

## 4. Código Java — onde está cada exigência (5 min)

| O professor pede | Abra | Mostre |
| --- | --- | --- |
| Uma classe Java | `services/circulacao/.../emprestimo/Emprestimo.java` | record imutável, `ativo()`, `atrasadoEm()`, `devolver()` |
| Classe Biblioteca | `services/relatorios/.../biblioteca/Biblioteca.java` | snapshot com `List.copyOf`, `relatorioMultas()` |
| Função pura | `FuncoesBiblioteca.calcularMulta` | `BigDecimal`, sem relógio, sem banco |
| Stream com `filter` | `CatalogoFuncoes.filtrarLivrosPorCategoria` | entrada não muda |
| Stream com `map` | `FuncoesBiblioteca.gerarRelatorioMultas` | empréstimo → `MultaIndividual` |
| Stream com `reduce` | `FuncoesBiblioteca.totalizarMultas` e `somarDiasDeAtraso` | `reduce(ZERO, BigDecimal::add)` |
| Imperativo × funcional | `calcularTotalDeMultasImperativo` × `calcularTotalDeMultas` | teste de equivalência |
| Transação de empréstimo | `JdbcEmprestimoRepository.inserir` (`@Transactional`) | `INSERT ... RETURNING *` |
| Proteção contra concorrência | `services/circulacao/src/main/resources/db/migration/V1__criar_emprestimos.sql` | índice único parcial → 409 |
| Gateway → Java → PostgreSQL | `apps/gateway/inko_gateway/config.py` (`BUSINESS_ROUTES`) | rota, serviço fixo, query permitida |

## 5. Testes ao vivo (3 min)

```bash
mvn -B -ntp -f services/relatorios/pom.xml test
python scripts/ci/e2e-academic-flow.py http://127.0.0.1:8000
```

O segundo comando mostra as 32 verificações, incluindo **"Caso B concorrência: um 201 e um 409"**:
duas requisições simultâneas para o mesmo livro e só uma gravada.

## 6. Encerramento (1 min)

Limitações honestas: o MVP é local; o Gateway na porta 8000 não exige credencial (defesa em profundidade fica para P1); não há envio de e-mail; o volume de capas não é backup. Próximos passos: autorização no Gateway e nos serviços e RF-27.

## Plano B

- Docker não sobe: mostre os testes Java (`mvn test` nos 4 serviços), que não dependem de banco, e os documentos `docs/academic/*`.
- Serviço Java não responde logo após subir: aguarde 10 s e recarregue (aquecimento da JVM / circuito do Gateway se fecha sozinho).
- Porta 3000/8000/5432 ocupada: defina `WEB_PORT`, `GATEWAY_PORT` e `POSTGRES_PORT` no `.env`.
