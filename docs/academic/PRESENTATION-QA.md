# Material de estudo e banco de perguntas

As cinco respostas abaixo são **material de estudo** para a redação individual manuscrita. Escreva com suas palavras.

## A. Transparência referencial

Uma expressão é referencialmente transparente quando pode ser trocada pelo seu valor sem mudar o comportamento do programa.
`FuncoesBiblioteca.calcularMulta(15)` sempre vale `30.00`: em qualquer lugar do código, podemos substituir a chamada por `30.00`.
Isso só é possível porque a função depende apenas do parâmetro. Já `LocalDate.now()` **não** é transparente: o valor muda a cada dia.
Por isso as funções de atraso recebem `referencia` como parâmetro e o relógio só é lido no controller, quando a data não é informada.
Benefício prático: o teste `multaEDeDoisReaisPorDiaEZeroSemAtraso` não precisa de banco, rede nem relógio.

## B. Funções impuras e efeitos colaterais

Efeito colateral é qualquer interação além de devolver um valor: gravar no banco, chamar HTTP, ler o relógio, alterar uma variável externa.
No INKO, os efeitos ficam nas **bordas**: `JdbcEmprestimoRepository.inserir` (grava no PostgreSQL), `HttpReferencias.livroExiste`
(chama o Catálogo) e `HttpFonteBiblioteca.carregar` (lê três serviços). O núcleo (`FuncoesBiblioteca`, `CirculacaoFuncoes`) é puro.
Separar assim deixa o núcleo testável e previsível, e concentra os pontos de falha (timeouts, 503) em poucos lugares.

## C. Imutabilidade

Um objeto imutável não muda depois de criado. `Emprestimo` é um `record`: seus campos são `final`. Para devolver um empréstimo,
`devolver(data)` **cria um novo** `Emprestimo` com `dataDevolucao` preenchida, em vez de alterar o atual. `Biblioteca` copia as listas com
`List.copyOf`; quem a criou não consegue mais alterá-la (teste `bibliotecaEUmSnapshotImutavel`). Vantagens: sem efeitos inesperados entre
partes do código, compartilhamento seguro entre threads e funções que não alteram a entrada (`funcoesNaoAlteramAsColecoesRecebidas`).

## D. Orientação a objetos × programação funcional

A **orientação a objetos** organiza o sistema em objetos com dados e comportamento: `Livro` sabe se pertence a uma categoria (`pertenceA`),
`Emprestimo` sabe se está atrasado (`atrasadoEm`). Encapsulamento, interfaces (`LivroRepository`, `Referencias`) e injeção de dependência
separam domínio de persistência. A **programação funcional** trata o processamento como transformação de dados por funções puras:
`filter → map → reduce` no relatório de multas. O INKO combina os dois: objetos imutáveis (records) modelam o domínio e Streams processam coleções.
A comparação concreta está em `calcularTotalDeMultasImperativo` (laço com variável acumuladora) × `calcularTotalDeMultas` (pipeline declarativo).

## E. Concorrência

Dois bibliotecários podem tentar emprestar o mesmo livro no mesmo instante. Verificar "está disponível?" e depois gravar não basta:
as duas requisições podem ver "disponível" antes de qualquer uma gravar (condição de corrida). O INKO resolve no banco, que é a fonte da verdade:
o índice único parcial `uq_emprestimo_ativo_livro (livro_id) WHERE data_devolucao IS NULL` só permite um empréstimo ativo por livro.
A segunda gravação viola o índice e o serviço responde **409**. A devolução usa `UPDATE ... WHERE data_devolucao IS NULL`, que é atômico:
duas devoluções simultâneas não alteram o histórico duas vezes. Do lado funcional, dados imutáveis e funções puras não precisam de travas.
O teste integrado "Caso B" dispara duas requisições em paralelo e confirma exatamente um 201 e um 409.

## Banco de perguntas (qualquer integrante pode ser chamado)

| Pergunta provável | Resposta curta | Onde mostrar |
| --- | --- | --- |
| Onde está a classe `Biblioteca` e o que ela faz? | Snapshot imutável de livros, usuários e empréstimos; gera relatório e estatísticas | `relatorios/.../Biblioteca.java` |
| Mostre uma função pura | `calcularMulta`: só depende do parâmetro | `FuncoesBiblioteca.java:20` |
| Onde usam `filter`? | Filtro por categoria e de ativos/atrasados | `CatalogoFuncoes`, `FuncoesBiblioteca:39` |
| Onde usam `map`? | Empréstimo → multa individual | `FuncoesBiblioteca:46` |
| Onde usam `reduce`? | Soma das multas e dos dias de atraso; contagem de ativos | `FuncoesBiblioteca:57`, `:78`, `:84` |
| Por que `BigDecimal`? | `double` tem erro de arredondamento em dinheiro | `MULTA_DIARIA` |
| Por que passar a data de referência? | Determinismo e testes; `now()` muda o resultado | `identificarEmprestimosAtrasados(..., referencia)` |
| Livro com vencimento hoje está atrasado? | Não: precisa ser `dataPrevista < referencia` | teste `atrasoExigeAtivo...` |
| Devolvido entra no relatório de multas? | Não; só ativos atrasados | E2E "RF-13 devolvido sai do relatório" |
| Como impedem empréstimo duplo? | Índice único parcial no PostgreSQL → 409 | `V1__criar_emprestimos.sql` |
| E se o Catálogo cair durante um empréstimo? | A Circulação responde 503 e não grava | `HttpReferencias`, Caso E |
| Por que não usar uma FK entre bancos? | Cada serviço é dono do seu banco; referência por ID e validação por HTTP | `ARCHITECTURE-OVERVIEW.md` |
| O que o Gateway faz? | Roteia contratos fixos, limita taxa e concorrência, prazo de 2 s, circuit breaker | `apps/gateway/inko_gateway` |
| Onde ficam os dados? | PostgreSQL 17, três bancos: `inko_catalogo`, `inko_usuarios`, `inko_circulacao` | `compose.yaml`, migrações Flyway |
| Como rodar os testes? | `mvn test` por serviço; `pytest` no Gateway; `pnpm test`; script E2E | README, seção Testes |
| O login é seguro? | Não; é demonstrativo e só local (RF-25 pendente) | `lib/library-api.ts` |
| O frontend calcula a multa? | Só uma pré-visualização na devolução; o relatório oficial vem do Java | `app/relatorios/page.tsx` |
| Diferença entre imperativo e funcional no código? | Laço com acumulador × pipeline; mesmo resultado provado em teste | `FuncoesBibliotecaTest` |
