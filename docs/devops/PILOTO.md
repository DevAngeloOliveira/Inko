# INKO em uma biblioteca física

O piloto atende uma instituição com balcão de circulação. Um visitante consulta títulos, abre os detalhes e leva o código do exemplar à equipe. O operador cadastra o leitor, confirma o empréstimo, acompanha o prazo e registra a devolução. O exemplar volta a aparecer como disponível quando o catálogo é consultado novamente. O relatório calcula multas em aberto. O piloto não processa pagamentos.

## Leitura da base e decisões

| Camada | Comportamento observado | Decisão para o piloto |
| --- | --- | --- |
| Next.js e design system | A vitrine já combinava catálogo e disponibilidade, mas o detalhe abria a área privada. O dashboard utilizava uma data de demonstração. | Vitrine em `/`, detalhes públicos no cartão, painel em `/dashboard`. Manter tokens, capas ilustradas e exemplos determinísticos na área acadêmica. |
| BFF e identidade | A sessão opaca é validada no serviço de Usuários. O operador e o leitor são entidades distintas. | O visitante consulta sem conta. A equipe registra as operações. Manter histórico e dados pessoais nas rotas privadas. |
| Gateway FastAPI | As rotas têm limites de admissão, concorrência e tempo. O BFF depende do gateway na rede interna. | Caddy encaminha ao Next.js. Medir latência e falhas no primeiro acesso após reinício antes de aumentar prazos. |
| Catálogo e Usuários | PostgreSQL por serviço, matrícula e exemplar identificáveis. Capas residem em volume separado. | Criar cadastros reais em bancos novos e copiar o volume de capas junto ao backup. Vincular curadoria estática somente a obras correspondentes. |
| Circulação e Relatórios | O domínio Java calcula prazos e multas. A exclusão mútua de empréstimos e a devolução têm cobertura no fluxo integrado do repositório. | Usar o calendário de São Paulo na interface e manter o relatório com data selecionável. Conservar records, funções puras e testes comparando Streams e implementação imperativa. |
| Entrega e operação | Existem Compose, edge TLS, GHCR, smoke, scripts de restauração e monitoramento opcional. O edge anterior barrava também o BFF. | Homologar uma versão identificada pelo mesmo commit no host de teste e praticar recuperação antes do primeiro atendimento. |

## Instalação isolada

Para a aula, o Compose padrão continua aplicando as migrações e os dados demonstrativos. Para clientes, iniciar o projeto Compose `inko-piloto` com volumes **novos**. A troca de localizações do Flyway não remove registros preexistentes. Nunca reutilizar o volume acadêmico nem executar limpeza de volumes para converter um ambiente.

Preparar um arquivo de ambiente privado fora do repositório com senhas próprias para os bancos, conta de bootstrap, domínio e tag GHCR construída a partir desta revisão ou posterior. Apontar o DNS para o host. Com acesso às imagens, executar no diretório do repositório:

```bash
export COMPOSE_PROJECT_NAME=inko-piloto
export COMPOSE_FILE=compose.yaml:compose.release.yaml:compose.edge.yaml:compose.piloto.yaml
docker compose --env-file /etc/inko/piloto.env config --quiet
docker compose --env-file /etc/inko/piloto.env up -d --no-build --wait
docker compose --env-file /etc/inko/piloto.env ps
```

## Aceite antes de convidar leitores

1. No host de homologação, abrir o domínio em janela privada. Conferir catálogo vazio, abrir o login e verificar que a API de usuários responde 401 sem sessão. Conferir que só Caddy publica portas.
2. Entrar como operador, cadastrar um leitor de teste e uma obra com capa. Abrir a vitrine em outra janela e conferir código, título, capa e disponibilidade, sem identificação do leitor.
3. Registrar um empréstimo, conferir as datas e tentar um segundo empréstimo do mesmo exemplar. Esperar conflito. Atualizar a vitrine, devolver, atualizar novamente e conferir histórico e relatório.
4. Sair da sessão e validar que a área privada exige novo login. Rodar os fluxos acadêmico e de autenticação/mídia em uma instalação descartável com os seeds esperados pelos scripts.
5. Restaurar uma cópia de PostgreSQL e das capas em outro projeto Compose. Conferir uma capa e um histórico após a restauração. Registrar tag, data, operador responsável e tempo de recuperação.

## Evolução após o piloto

| Prioridade | Entrega | Critério observável |
| --- | --- | --- |
| Antes de ampliar a equipe | Provisionamento, revogação e recuperação de contas individuais, auditoria de circulação | Identificar o operador de cada movimentação e revogar um acesso sem afetar colegas. |
| Antes de ampliar o acervo | Paginação e busca no servidor, inclusive disponibilidade pública por página | Medir latência com o volume previsto e confirmar que abrir a vitrine não transfere todos os empréstimos ativos. |
| Antes de prometer avisos | Lembretes persistidos, consentimento e integração de entrega | Uma devolução cancela avisos pendentes e uma tentativa repetida não duplica a mensagem. |
| Conforme demanda dos leitores | Reserva e acompanhamento pelo titular | Duas solicitações concorrentes respeitam uma fila e cada leitor vê apenas suas reservas. |

A demonstração da disciplina continua reproduzível com seeds, datas explícitas e o roteiro em `docs/academic`. Para o piloto, registrar resultados de homologação separadamente das evidências da disciplina.
