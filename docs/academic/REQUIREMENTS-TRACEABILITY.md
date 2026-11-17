# Rastreabilidade de requisitos

Situação em 17/11/2026. Os códigos seguem os cards do quadro principal do Trello; a coluna **Status** vale para o código da `dev/angelo`,
não para a coluna do card (o Trello não foi atualizado automaticamente).

Legenda dos testes: **U** = JUnit/pytest/node unitário, **E2E** = `scripts/ci/e2e-academic-flow.py` contra Compose + PostgreSQL,
**UI** = verificado no navegador sobre a stack real.

| Card | Requisito | Arquivo / classe | Teste | Status |
| --- | --- | --- | --- | --- |
| RF-01 | Cadastrar livros (formato, obrigatoriedade, unicidade, persistência) | `catalogo/livro/Livro.java`, `CatalogoService.cadastrar`, `V1__criar_livros.sql` | U `CatalogoTest`; E2E 201/409/422 | Concluído |
| RF-02 | Consultar livro por ID e listar | `LivroController`, `JdbcLivroRepository` | U `consultaPorIdentificador...`; E2E 200/404 | Concluído |
| RF-03 | Filtrar por categoria (função pura) | `CatalogoFuncoes.filtrarLivrosPorCategoria` | U vazio, sem resultado, várias categorias, entrada inalterada; E2E | Concluído |
| RF-04 | Cadastrar usuário (ID, nome, matrícula; e-mail complementar) | `usuarios/usuario/Usuario.java`, `UsuarioService`, `V1__criar_usuarios.sql` | U `UsuarioTest`; E2E 201/409; UI | Concluído |
| RF-05 | Consultar usuário por ID e listar | `UsuarioController`, `JdbcUsuarioRepository` | U; E2E 200/404 | Concluído |
| RF-06 | Verificar disponibilidade (derivada, falha controlada) | `EmprestimoService.disponibilidade`, `HttpReferencias` | U; E2E disponível/indisponível; Caso E manual (503) | Concluído |
| RF-07 | Registrar empréstimo (transação, índice parcial, 409) | `Emprestimo`, `JdbcEmprestimoRepository.inserir`, `uq_emprestimo_ativo_livro` | U `livroIndisponivelGeraConflito`; E2E Caso B (corrida 201/409), 422; UI | Concluído |
| RF-08 | Consultar empréstimos e histórico | `EmprestimoController.listar/buscar` | E2E | Concluído |
| RF-09 | Registrar devolução atômica, recusar repetição | `EmprestimoService.devolver`, `registrarDevolucao` | U; E2E Casos C e D; UI | Concluído |
| RF-10 | Empréstimos ativos | `CirculacaoFuncoes.filtrarAtivos`, `/emprestimos/ativos` | U; E2E | Concluído |
| RF-11 | Empréstimos atrasados com referência explícita | `CirculacaoFuncoes.identificarEmprestimosAtrasados`, `/emprestimos/atrasados` | U data igual / posterior; E2E | Concluído |
| RF-12 | Multa por função pura (`BigDecimal`, R$ 2,00/dia) | `FuncoesBiblioteca.calcularMulta` | U zero, negativo, 1 e 20 dias | Concluído |
| RF-13 | Relatório de multas `filter → map → reduce` | `FuncoesBiblioteca.gerarRelatorioMultas`, `totalizarMultas`, `/relatorios/multas` | U; E2E (devolvido sai do relatório); UI | Concluído |
| RF-14 | Quantidade de livros por categoria | `FuncoesBiblioteca.contabilizarLivrosPorCategoria` | U; E2E estatísticas | Concluído |
| RF-15 | Empréstimos por usuário | `FuncoesBiblioteca.contabilizarEmprestimosPorUsuario` | U; E2E estatísticas | Concluído |
| RF-16 | Quantidade de empréstimos ativos | `FuncoesBiblioteca.contarEmprestimosAtivos` (reduce) | U | Concluído |
| RF-17 | Quantidade de ativos atrasados | `Biblioteca.estatisticas` → `identificarEmprestimosAtrasados` | U; E2E | Concluído |
| RF-18 | Valor total das multas, sem duplicar regra | `FuncoesBiblioteca.calcularTotalDeMultas` | U; E2E total = soma dos itens | Concluído |
| PF-01 | Versão imperativa × funcional equivalentes; segundo `reduce` | `calcularTotalDeMultasImperativo`, `contabilizarLivrosPorCategoriaImperativo`, `somarDiasDeAtraso` | U `versaoImperativaEFuncionalProduzemOMesmoTotal`, `segundoReduceSomaDiasEContaAtivos` | Concluído |
| — | Classes `Livro`, `Usuario`, `Emprestimo`, `Biblioteca` | ver `ARCHITECTURE-OVERVIEW.md` | U `bibliotecaEUmSnapshotImutavel` | Concluído |
| QA-01 | Testes unitários de domínio | 33 JUnit em 4 serviços | `mvn test` | Concluído |
| QA-02 | Fluxo integrado com banco real | `scripts/ci/e2e-academic-flow.py` (32 verificações) | executado via Gateway e via BFF | Concluído |
| QA-03 | Gateway, contratos, frontend, smoke | `test_gateway_business.py`, `apps/web/tests`, `smoke-compose.sh` | 32 pytest; 36 node + typecheck + build; smoke de 7 contêineres | Concluído (SonarCloud: ver README) |
| DOC-01..05 | README e documentação acadêmica | `README.md`, `docs/academic/*`, `docs/contracts/*` | revisão | Concluído |
| RF-19 | Pesquisa avançada | `?q=` em livros e usuários; busca global e filtros na interface | E2E (filtro); UI | Parcial: busca textual e por categoria, sem filtros combinados no servidor |
| RF-21 | Histórico por usuário | `GET /emprestimos?usuarioId=`; tela Usuários | E2E | Concluído |
| RF-22 | Painel de vencimentos e atrasos | Dashboard e notificações derivadas dos empréstimos | UI | Parcial: calculado na interface com a referência fixa |
| RF-23 | Exportação CSV | Relatórios (CSV a partir do relatório Java) | UI manual | Concluído |
| RF-20 | Catálogo público | `/landing` com amostra estática | — | Pendente (fora do caminho crítico) |
| RF-24 | Filtros históricos adicionais | — | — | Pendente |
| RF-25 | Autenticação e autorização | login demonstrativo apenas no navegador | — | Pendente: não há autenticação real; usar só localmente |
| RF-26 | Auditoria avançada | — | — | Pendente |
| RF-27 | Notificações por e-mail | botão "Enviar lembretes" é simulação identificada | — | Pendente |
