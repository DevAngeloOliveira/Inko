# SDD-002 — Relatório de evidências

**Data**: 2026-11-17. **Branch**: `dev/angelo`.

**Ambiente**: stack Compose descartável `inko-qa` com os 7 contêineres, PostgreSQL 17 e os volumes `postgres_data` e `catalogo_media`. Os bancos já tinham os seeds V1000/V1001 aplicados.

A conta de operador foi criada pelo bootstrap. As variáveis `INKO_BOOTSTRAP_ADMIN_*` ficaram num arquivo de ambiente local, fora do Git, com a senha gerada aleatoriamente.

## Comandos executados

| Verificação | Comando | Resultado |
|---|---|---|
| Unitários Java | `mvn -B -ntp verify` em cada serviço | Usuários 23, Catálogo 27, Circulação 9, Relatórios 10, todos sem falhas |
| Gateway (REG-02) | `uv run pytest` em `apps/gateway` | 32 aprovados; o Gateway não foi alterado |
| Web | `tsc --noEmit`, `node --test tests/*.test.mjs`, `next build` | typecheck OK, 55/55 testes, build OK |
| Aceitação SDD-002 | `python scripts/ci/e2e-mvp-auth-media.py http://127.0.0.1:13000` | 47/47 verificações |
| MEDIA-04 (restart parcial) | `docker compose restart catalogo web` + `--after-restart` | 3/3 |
| MEDIA-04 (stack inteira) | `docker compose stop` + `up -d` (sem `-v`) + `--after-restart` | 3/3 |
| REG-01 pelo BFF autenticado | `e2e-academic-flow.py http://127.0.0.1:13000` com `INKO_E2E_*` | 32/32 |
| REG-01 pelo Gateway | `e2e-academic-flow.py http://127.0.0.1:18000` | 32/32 |
| BFF sem credenciais | o mesmo fluxo sem `INKO_E2E_*` | Falha em RF-01 com 401 `UNAUTHENTICATED`, como esperado |

## Critérios de aceite

| Critério | Evidência |
|---|---|
| AUTH-01 | V2 aplicada fora de ordem sobre V1000. `operadores` guarda um único ADMIN com `senha_hash` `$2a$12$…`; não há senha em texto claro. |
| AUTH-02 | Senha incorreta → 401 `INVALID_CREDENTIALS` e nenhum cookie gravado. Na UI aparece a mensagem genérica "E-mail ou senha incorretos". |
| AUTH-03 | Login → 200 com `Set-Cookie` `HttpOnly; SameSite=Lax`. O JSON não contém token. `sessoes_operador` tem o SHA-256 do token e não tem o token em claro. No navegador, `document.cookie` vem vazio e não há sessão em `sessionStorage`/`localStorage`. |
| AUTH-04 | `GET /api/auth/session` com o cookie → 200. Navegação com recarga completa manteve a sessão. Sessão com `expira_em` no passado → 401. |
| AUTH-05 | Logout → 204, `Max-Age=0` e `revogado_em` preenchido. Replay do token antigo → 401. Na UI, "Sair" leva a `/login` e a API responde 401. |
| AUTH-06 | Anônimo em `emprestimos`, `emprestimos/ativos`, `usuarios` e `relatorios` → 401; POST `livros` → 401. O catálogo e `/api/public/disponibilidade` (só IDs) seguem públicos. A regra de papel (403) está coberta em `auth-bff.test.mjs`. |
| AUTH-07 | `Origin` cruzada em POST, logout e upload → 403. A sexta falha seguida no mesmo e-mail → 429 com `Retry-After`. |
| MEDIA-01 | JPEG enviado → 200; `capas_livros` guarda o MIME e o SHA-256; o livro passa a ter `capaVersao`. |
| MEDIA-02 | GET devolve `image/jpeg` com assinatura `FFD8FF`, `ETag` igual ao SHA-256 dos bytes e `nosniff`. `If-None-Match` → 304. |
| MEDIA-03 | Recusados: > 2 MiB (413), PNG declarado como JPEG (415), SVG (415), HTML (415), PNG corrompido (422) e 14 MP (422). Nenhum arquivo temporário ficou no volume. Na UI, o SVG é recusado antes do envio. |
| MEDIA-04 | O mesmo SHA-256 é servido depois de `restart catalogo web` e depois de reiniciar a stack inteira. |
| MEDIA-05 | 4 envios simultâneos concluem. O arquivo servido é o referenciado no banco, e a quantidade de arquivos no volume é igual à de linhas em `capas_livros`. |
| MEDIA-06 | Anônimo não envia nem remove capa (401). Operador remove (204) e a capa deixa de ser servida (404). |
| REG-01 | O fluxo acadêmico (cadastro, empréstimo, 409 concorrente, devolução, multas e estatísticas) passa pelo BFF autenticado e pelo Gateway. |
| REG-02 | Os limites do SDD-001 não mudaram; o pytest do Gateway passa. |
| REG-03 | Não há credencial no Git: `.env.example` traz as variáveis vazias e o CI gera uma senha efêmera mascarada. Não há imagens de terceiros; a capa de teste é gerada pelo próprio teste. |

## Teste manual no navegador

Executado no painel de navegador do app, em `http://127.0.0.1:13000`:

1. Senha errada mostra o alerta genérico.
2. A senha correta abre o Dashboard.
3. Uma recarga em `/acervo/INK-0006` exibe a capa persistida.
4. Em `/acervo/INK-0043`, um PNG gerado no próprio navegador foi enviado. A UI mostrou o toast "Capa salva", e a capa passou a aparecer no detalhe com a opção "Trocar capa".
5. Um SVG foi recusado na UI.
6. "Sair" levou de volta a `/login`, e `/emprestimos` também redirecionou para `/login`.
7. A landing anônima carregou 12 obras com a disponibilidade.

## Limites conhecidos (não é produção)

- **Gateway exposto:** a porta 8000 continua publicada em `127.0.0.1` e não exige credencial. Quem acessa o Gateway direto contorna a autorização do BFF. Para expor externamente, remova essa porta e valide a sessão também no Gateway e nos serviços (fase P1 do SDD-002).
- **Rate limit por IP contornável:** o limite por IP usa o `X-Forwarded-For` que o Next recebe, e o cliente pode forjar esse valor quando não há proxy confiável na frente. O limite por e-mail (5 falhas em 15 min) continua valendo. Os contadores ficam em memória por instância e se perdem no restart.
- **Partida a frio:** a primeira chamada logo após reiniciar um serviço Java pode responder 503/504. Os scripts E2E aquecem os serviços antes de verificar.
- **Volume não é backup:** o volume `catalogo_media` e o PostgreSQL precisam de backup juntos (veja o README).
- **Sessões antigas:** sessões expiradas ou revogadas não são apagadas. A limpeza periódica fica para a fase P1.
