# SDD-002 — INKO MVP: Autenticação Real, Sessões e Capas Persistentes

**Status:** PROPOSTO — ainda não implementado.
**Data:** 2026-11-17. **Prazo de apresentação:** 2026-11-18.
**Branch de implementação:** \`dev/angelo\`. **Branch protegida:** \`main\`.
**Baseline consultada:** \`1d50063405b53589c1e702b51d2afa9cc3419ee0\`; conferir HEAD antes de alterar código.

## 1. Diagnóstico verificado no repositório

- Catálogo, Usuários e Circulação já têm operações Java/Spring Boot 4.1.2 e PostgreSQL 17 com Flyway; Relatórios agrega por HTTP.
- \`apps/web/lib/library-api.ts\` integra livros, usuários, empréstimos e relatórios via BFF \`/api/v1/[...path]\`, Gateway FastAPI e Java. **Não substituir essa integração por mocks.**
- \`signIn()\` aceita qualquer e-mail válido + senha com seis caracteres, guarda \`Session\` em \`sessionStorage\`; \`signOut()\` só altera estado do navegador. Nenhuma rota do BFF consulta uma sessão real.
- Os registros de \`usuarios\` são **leitores da biblioteca**, não identidades de operadores. Não usar a matrícula ou o e-mail de um leitor como credencial de operador.
- \`toWork()\` escolhe capa fictícia por hash do ID. \`Livro\` e a tabela \`livros\` não possuem metadados de imagem.
- O \`GatewayHTTP\` limita JSON a 65.536 bytes, deadline a 2 segundos e um único upstream; o BFF \`/api/v1/[...path]\` limita o body a 65.536 bytes. Upload de imagem não pode reutilizar esse pipeline sem uma exceção deliberada.

## 2. Meta e não objetivos

**Meta P0:** operador autentica com senha real; sessão é validada no servidor e revogável; somente operador autorizado executa mutações/consultas privadas; capa de obra é enviada, persistida e recuperada após restart de containers, sem alterar o comportamento do catálogo/emprestimos.

**Fora de P0:** OAuth social, recuperação de senha por e-mail, S3/cloud, CDN, registro público, MFA, marketplace, deploy externo, jobs de image AI, imagens protegidas sem licença e novo microsserviço Java.

Decisão: adicionar **módulo de identidade de operadores** em \`services/usuarios\` e **módulo de mídia de catálogo** em \`services/catalogo\`. As fronteiras são lógicas, sem mais processos JVM ou bancos. Isso reduz risco para a apresentação e mantém evolução futura por extração.

## 3. Autenticação — modelo e contratos

### 3.1 Persistência no banco \`inko_usuarios\`

Flyway \`V2__operadores_sessoes.sql\` (não modificar V1 ou seeds anteriores):

- \`operadores\`: \`id UUID PRIMARY KEY\`, \`email VARCHAR(160) UNIQUE NOT NULL\` (normalizado), \`nome VARCHAR(120) NOT NULL\`, \`senha_hash VARCHAR(255) NOT NULL\`, \`papel VARCHAR(32) NOT NULL CHECK (...)\`, \`ativo BOOLEAN NOT NULL\`, \`criado_em TIMESTAMPTZ\`.
- \`sessoes_operador\`: \`id UUID PRIMARY KEY\`, \`operador_id UUID REFERENCES operadores(id)\`, \`token_hash CHAR(64) UNIQUE NOT NULL\`, \`criado_em TIMESTAMPTZ\`, \`expira_em TIMESTAMPTZ\`, \`revogado_em TIMESTAMPTZ NULL\`. Índices para validade e expiração.
- Papéis iniciais: \`ADMIN\` e \`BIBLIOTECARIO\`. Não reutilizar entidade \`Usuario\` dos leitores.
- Senhas com \`BCryptPasswordEncoder\` (Spring Security Crypto) e fator de trabalho adequado ao hardware local; nunca armazenar senha em texto claro, usar hashing adaptativo. Não inventar criptografia própria.
- Sessões opacas: token aleatório de 32 bytes gerado por \`SecureRandom\`, enviado uma vez ao BFF; persistir **apenas SHA-256(token)**, comparar em tempo constante quando aplicável; expiração fixa, inicialmente oito horas. \`logout\` preenche \`revogado_em\`. Nenhum token aparece em logs, URLs ou localStorage/sessionStorage.
- Conta inicial criada somente quando \`INKO_BOOTSTRAP_ADMIN_EMAIL\` e \`INKO_BOOTSTRAP_ADMIN_PASSWORD\` são fornecidos via ambiente. Exigir senha forte (mínimo 12 caracteres) e criar somente se a conta ainda não existir. **Não commitar usuário/senha padrão.**

### 3.2 Serviço Java de identidade

Rotas internas HTTP, sem dados de senha no DTO de resposta:

- \`POST /api/v1/auth/login\` — email/senha → token opaco + dados mínimos do operador; 401 genérico em credencial inválida, 429 em tentativas excessivas, sem distinguir usuário inexistente.
- \`GET /api/v1/auth/session\` — Authorization: Bearer token → \`id,nome,email,papel,expiraEm\`; 401 se revogado, inválido, expirado ou operador desativado.
- \`POST /api/v1/auth/logout\` — revogar sessão atual; operação idempotente.
- Limitar tentativas de login por identidade/IP em janela limitada; defender timing e enumeração; status 401/403/429; logs sem credenciais. Implementar testes contra brute force e revogação.
- Dados de autenticação nunca devem aparecer nas APIs \`/api/v1/usuarios\` dos leitores.

### 3.3 BFF Next.js 16

Novas rotas same-origin: \`POST /api/auth/session\` login; \`GET /api/auth/session\` status; \`DELETE /api/auth/session\` logout. BFF comunica-se exclusivamente com origem fixa \`USUARIOS_INTERNAL_URL=http://usuarios:8082\` (rede Docker), timeout curto e sem retry; sem URL fornecida pelo cliente.

Após login bem-sucedido, gravar cookie de sessão opaca \`HttpOnly\`, \`SameSite=Lax\`, \`Path=/\`, \`Secure\` em HTTPS, \`Max-Age\` não maior que validade do servidor. Em HTTP local usar nome e \`Secure\` apropriados ao ambiente; não diminuir segurança de produção. Validar \`Origin\` e, quando pertinente, \`Referer\` em mutações (CSRF), exigir cabeçalhos e tipos de conteúdo esperados. Nunca incluir token no JSON para o navegador.

O BFF \`/api/v1/[...path]\` deve validar cookie e sessão real, manter allowlist de recursos, proteger dados pessoais (usuários, empréstimos, relatórios) e ações mutáveis, e exigir papel adequado; respostas 401/403. Apenas consultas públicas de catálogo previamente definidas podem ser anônimas. O BFF remove o cookie/token antes de encaminhar dados ao cliente. Não criar trust baseado apenas em sessionStorage ou em \`role\` enviado pelo browser. \`Cache-Control: no-store\` para conteúdo privado.

**Limite de segurança:** o BFF será o ponto público autenticado de MVP, e serviços Java permanecerão acessíveis apenas na rede privada do Compose. Isso não equivale a Zero Trust: acesso direto ao Gateway na porta de desenvolvimento pode contornar autorização se os downstreams não verificarem credenciais. Para ambiente acessível externamente, remover a exposição pública dos serviços e implementar validação de autorização também no Gateway/serviços (defense in depth). Documentar esse limite sem chamar o MVP de produção segura.

### 3.4 Frontend

- Refatorar \`apps/web/lib/library-api.ts\`: substituir \`signIn\`, \`signOut\` e hidratação de sessão fake por chamadas a \`/api/auth/session\`. Session pode guardar apenas \`nome,email,papel\` em memória; \`sessionStorage\` fica restrito a preferências de UI, nunca autenticação.
- \`useLibrary()\` deve revalidar sessão no carregamento e após expiração; 401 redireciona para \`/login\`; dados protegidos são apagados da memória no logout. Evitar loops de hidratação e fetch repetido.
- Refatorar \`apps/web/app/login/page.tsx\` removendo aviso de \"qualquer senha\"; esconder \"esqueci senha\" e \"lembrar-me\" até serem funcionalidades reais. Preservar Design System e acessibilidade.
- Não tornar o botão de Entrar funcional apenas visualmente: provar senha incorreta → 401, login correto → cookie HttpOnly, reload mantém sessão, logout → sessão revogada no PostgreSQL, acesso posterior → 401.

## 4. Capas — armazenamento e contratos

### 4.1 Ownership / persistência

Catálogo é dono da mídia de capa. Flyway \`V2__midias_capas.sql\` no \`inko_catalogo\`:
- \`capas_livros\`: \`id UUID PRIMARY KEY\`, \`livro_id VARCHAR(16) REFERENCES livros(id) UNIQUE\`, \`object_key VARCHAR(128) UNIQUE\`, \`mime_type VARCHAR(32)\`, \`tamanho_bytes INTEGER\`, \`sha256 CHAR(64)\`, \`largura INTEGER\`, \`altura INTEGER\`, \`criado_em TIMESTAMPTZ\`, \`atualizado_em TIMESTAMPTZ\`.
- Guardar arquivos fora do banco, em volume Docker \`catalogo_media\` montado read-write em \`/var/lib/inko/covers\`, configurado por \`INKO_MEDIA_ROOT\`. **Não armazenar blob em JSON, no Git ou em pasta pública do Next.**
- \`object_key\` gerado pelo servidor com UUID, nunca derivado de nome/URL do cliente. Escrita temporária, validação, rename atômico quando possível e metadados em transação; limpar arquivos órfãos em falhas.
- ID de livro persistente e referência de capa opcional na resposta do Catálogo (\`coverUrl\` ou \`coverId\`), preservando compatibilidade com os DTOs atuais.

### 4.2 Validação de upload

- Permitir **somente JPEG e PNG** no MVP; WebP pode ser incrementado depois se houver decoder confiável.
- Máximo **2 MiB** por arquivo, **12 megapixels** por imagem; validar MIME declarado, assinatura/magic bytes, dimensões e decodificação via biblioteca segura. Rejeitar SVG, GIF animado, ZIP, HTML e executáveis.
- Normalizar/reescrever a imagem com encoder seguro quando viável; remover metadados EXIF. Nunca confiar na extensão do nome.
- Responder 400/413/415/422 conforme a falha. Tratar exploração por decompression bomb, traversal e armazenar sem permissão de execução.
- Apenas \`ADMIN\` ou \`BIBLIOTECARIO\` podem fazer upload/troca; leitura de capas pode ser pública. Respeitar licenças das imagens reais.
- Não permitir baixar imagens de URLs arbitrárias pelo backend (evita SSRF). Upload deve ser feito a partir de arquivo autorizado.

### 4.3 Rotas

Serviço Catálogo (somente rede interna):
- \`PUT /api/v1/livros/{id}/capa\` — multipart para criar/substituir capa, com validação, metadados e atomicidade.
- \`GET /api/v1/livros/{id}/capa\` — devolver bytes, MIME real, \`ETag\`, \`X-Content-Type-Options: nosniff\`, \`Cache-Control\` definido.
- \`DELETE /api/v1/livros/{id}/capa\` — opcional P1, com autorização e tratamento de órfãos.

BFF Next:
- \`PUT /api/media/livros/{id}\`: valida sessão/papel, tamanho durante a leitura do stream e \`Origin\`; encaminha para Catálogo pelo host interno \`CATALOGO_INTERNAL_URL=http://catalogo:8081\`, sem aceitar destino externo, sem retries e com limite explícito de concorrência.
- \`GET /api/media/livros/{id}\`: retorna stream de imagem e cabeçalhos de cache, sem bufferização completa.
- \`DELETE /api/media/livros/{id}\`: somente se operação de exclusão estiver implementada e testada.

**Decisão SDD-001:** binários **não passam** pelo Gateway FastAPI de negócios, cujo contrato é JSON de até 64 KiB. Essa é uma exceção deliberada para mídia, com BFF + limites próprios de 2 MiB/concorrência, documentada como ADR. Não aumentar o limite global do Gateway e não reintroduzir proxy HTTP sem allowlist.

### 4.4 Interface e imagens reais

- Atualizar \`Work\` e \`LivroDto\` com \`coverUrl?: string\` ou referência equivalente, sem quebrar os cards já existentes.
- \`InkoCover\` prioriza a capa persistida; fallback estilizado atual permanece para obras sem capa autorizada.
- Criar componente acessível de envio/substituição de capa na página de detalhes/cadastro, com preview local de arquivo, barra de estado, erro e confirmação.
- Revalidar a URL por versão/\`ETag\` após atualização e evitar cache perpetuamente stale.
- Os manifestos editoriais/seeds existentes devem permanecer preservados; nunca fazer download e persistência indiscriminados de capas de terceiros.

## 5. Qualidade / testes de aceitação P0

**AUTH-01:** conta bootstrap criada por env e credencial armazenada somente como hash adaptativo.
**AUTH-02:** credenciais incorretas devolvem 401 genérico, sem sessão.
**AUTH-03:** login correto cria sessão no banco e cookie HttpOnly; não há token em JS, URL ou localStorage.
**AUTH-04:** recarga da página preserva sessão válida; expiração devolve 401.
**AUTH-05:** logout invalida token no servidor; replay é recusado.
**AUTH-06:** chamada direta a \`/api/v1/emprestimos\` via BFF sem autenticação → 401; papel inadequado → 403.
**AUTH-07:** Origin cruzada em POST/PUT/DELETE → 403; tentativa de senha repetida → 429.
**MEDIA-01:** JPEG/PNG válido de até 2 MiB é gravado e referenciado no banco.
**MEDIA-02:** GET devolve mesmos pixels/arquivo válido, MIME seguro e ETag.
**MEDIA-03:** arquivo > limite, MIME falso, SVG e imagem inválida são recusados sem deixar arquivos temporários.
**MEDIA-04:** capa continua após \`docker compose restart catalogo web\` e após reinício da stack sem remover volumes.
**MEDIA-05:** envio simultâneo/substituição não deixa referência órfã nem mistura arquivos.
**MEDIA-06:** usuário anônimo não envia ou remove imagem, mas pode ver capa pública.
**REG-01:** cadastro, empréstimo, devolução, multas e relatórios continuam funcionando via Next BFF.
**REG-02:** Gateway mantém os limites do SDD-001 e smoke dos sete containers passa.
**REG-03:** nenhuma credencial ou imagem protegida indevidamente é incluída no Git; CI de Java, Python e Next permanece verde.

Testes: JUnit de hash/sessão/expiração/revogação; integração JDBC com PostgreSQL; Java MVC para upload e streaming; testes Next Route Handlers de cookies/CSRF/401/403; Python gateway sem regressão; smoke Docker real; teste manual com browser após reload.

## 6. Plano de execução para a entrega

- **M0 (P0):** auditoria do HEAD, preservar mudanças locais e evidência do fluxo de biblioteca já funcional.
- **M1 (P0):** migration de operadores/sessões, autenticação real e bootstrap via ambiente. Validar API Java isoladamente.
- **M2 (P0):** login/logout real no BFF e frontend, autorização server-side, remover mensagens demonstrativas. Validar após reload.
- **M3 (P0):** migration de capa, armazenamento Docker + endpoints Catálogo + BFF, widget visual e persistência após restart.
- **M4 (P0):** testes de integração e smoke, documentação de bootstrap e mídia, relatório de evidências.
- **M5 (P1):** controles adicionais em serviços Java, rotação/renovação de sessão, recovery e backend de storage pluggable (S3-compatible) somente depois do MVP estável.

Commits recomendados: \`feat(auth): persist operator credentials and revocable sessions\`; \`feat(web): enforce server-backed login and logout\`; \`feat(media): persist catalog cover images in Docker volume\`; \`test(mvp): verify authentication and media durability\`.

**Workflow:** trabalhar apenas na \`dev/angelo\`, commits pequenos; preservar \`main\` até aprovar PR e CI; não fazer deploy externo, não apagar volumes, não criar novos microsserviços. Caso haja outro agente trabalhando no mesmo arquivo, coordenar ou trabalhar em arquivos isolados; não sobrescrever mudanças simultâneas.

## 7. Riscos e limitações

- A aplicação ainda será local; não chamar autenticação de \"pronta para produção\" sem endurecer trust entre Gateway e Java, segurança de transporte HTTPS externo, observabilidade de abuso, backup e política de recuperação.
- Montagem em volume é persistente **dentro da instalação Docker**, mas não é um backup; documentar backup de volume + PostgreSQL juntos.
- Login real de operador não significa criar credenciais para os leitores do acervo.
- Exposição pública de capa de terceiros exige direito de uso; sem licença, manter fallback original.
- Não declarar implementação concluída até testes e smoke comprovarem cada critério.

**Fonte primária:** repositório GitHub \`DevAngeloOliveira/Inko\`, branch \`dev/angelo\`; base externa: OWASP File Upload Cheat Sheet, documentação Spring Security e Next.js Route Handlers.
