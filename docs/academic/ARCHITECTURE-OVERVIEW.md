# Visão de arquitetura do INKO

## Fluxo de uma requisição

```text
Navegador ──▶ Next.js (apps/web)          páginas React + BFF /api/v1/* (mesma origem)
                │  GATEWAY_INTERNAL_URL
                ▼
             FastAPI Gateway (apps/gateway)   rotas explícitas, rate limit, admissão, slots,
                │                              deadline 2 s, circuit breaker, 1 tentativa
     ┌──────────┼──────────────┬────────────────┐
     ▼          ▼              ▼                ▼
  Catálogo   Usuários       Circulação       Relatórios        (Spring Boot 4, Java 21)
     │          │          │    │  ▲  ▲          │  HTTP em lote: livros, usuários, empréstimos
     │          │          │    └──┼──┼──────────┘
     │          │          │  valida livro/usuário por HTTP (timeouts)
     ▼          ▼          ▼
 inko_catalogo inko_usuarios inko_circulacao      PostgreSQL 17, um banco por serviço, sem FK entre bancos
```

## Responsabilidades

| Serviço | Dono de | Tabela | Regras principais |
| --- | --- | --- | --- |
| Catálogo (8081) | Livros | `livros` | Identificador `INK-0000` único, categoria válida, filtro por categoria |
| Usuários (8082) | Leitores | `usuarios` | ID gerado `USR-0000`, matrícula e e-mail únicos |
| Circulação (8083) | Empréstimos e devoluções | `emprestimos` | Disponibilidade derivada, índice parcial único, devolução atômica |
| Relatórios (8084) | Projeções | — | Classe `Biblioteca`, funções puras, multas e estatísticas |

Migrações Flyway por serviço em `src/main/resources/db/migration`; seed determinístico e idempotente em `db/seed` (`ON CONFLICT DO NOTHING`).

## Decisões relevantes

- **Sem transação distribuída.** A Circulação valida livro e usuário por HTTP *antes* de abrir a transação local; a gravação é uma transação curta no próprio banco.
- **Concorrência resolvida no banco.** `CREATE UNIQUE INDEX uq_emprestimo_ativo_livro ON emprestimos (livro_id) WHERE data_devolucao IS NULL`.
  Duas requisições simultâneas para o mesmo livro: a segunda viola o índice e recebe `409`. Não depende de verificação prévia no frontend.
- **Falha controlada.** Se Catálogo ou Usuários não respondem, a Circulação devolve `503` e não grava (Caso E).
- **Relatórios sem acesso a bancos alheios.** Três leituras HTTP paralelas com orçamento de 1 s, cardinalidade fixa (nunca uma chamada por empréstimo).
- **Gateway preservado (SDD-001).** O registro de rotas virou tabela explícita; limites e endpoints de controle não mudaram.

## Modelo UML para o diagrama manuscrito (DOC-02)

Reproduza à mão em folha A4. O modelo reflete o código atual; este arquivo **não substitui** a entrega física.

```text
┌──────────────────────────────┐          ┌──────────────────────────────┐
│ «record» Livro               │          │ «record» Usuario             │
├──────────────────────────────┤          ├──────────────────────────────┤
│ - id: String  (INK-0000)     │          │ - id: String  (USR-0000)     │
│ - titulo: String             │          │ - nome: String               │
│ - autor: String              │          │ - matricula: String          │
│ - categoria: String          │          │ - email: String [0..1]       │
│ - volume: String [0..1]      │          │ - cadastradoEm: LocalDate    │
│ - editora: String [0..1]     │          ├──────────────────────────────┤
│ - tituloOriginal: String[0..1]│         │ + comIdentificador(id, data) │
├──────────────────────────────┤          └──────────────┬───────────────┘
│ + pertenceA(categoria): bool │                         │ 1
└──────────────┬───────────────┘                         │
               │ 1                                        │
               │        refere-se a        realiza        │
               │ 0..*  (livroId)          (usuarioId) 0..*│
         ┌─────┴──────────────────────────────────────────┴─────┐
         │ «record» Emprestimo                                   │
         ├───────────────────────────────────────────────────────┤
         │ - id: String (EMP-00000)                              │
         │ - livroId: String                                     │
         │ - usuarioId: String                                   │
         │ - dataEmprestimo: LocalDate                           │
         │ - dataPrevista: LocalDate                             │
         │ - dataDevolucao: LocalDate [0..1]                     │
         ├───────────────────────────────────────────────────────┤
         │ + ativo(): boolean                                    │
         │ + atrasadoEm(referencia: LocalDate): boolean          │
         │ + diasDeAtraso(referencia: LocalDate): long           │
         │ + devolver(data: LocalDate): Emprestimo               │
         └───────────────────────────────────────────────────────┘
                                   ◇ 0..* (projeções read-only)
                                   │
         ┌─────────────────────────┴─────────────────────────────┐
         │ «record» Biblioteca                                   │
         ├───────────────────────────────────────────────────────┤
         │ - livros: List<LivroResumo>          (imutável)       │
         │ - usuarios: List<UsuarioResumo>      (imutável)       │
         │ - emprestimos: List<EmprestimoResumo>(imutável)       │
         ├───────────────────────────────────────────────────────┤
         │ + livrosDaCategoria(categoria): List<LivroResumo>     │
         │ + emprestimosAtivos(): List<EmprestimoResumo>         │
         │ + emprestimosAtrasados(ref): List<EmprestimoResumo>   │
         │ + relatorioMultas(ref): RelatorioMultas               │
         │ + estatisticas(ref): Estatisticas                     │
         └───────────────────────────────────────────────────────┘
```

Multiplicidades: um **Livro** participa de 0..* **Empréstimos** (no máximo um ativo, garantido pelo índice parcial);
um **Usuario** realiza 0..* **Empréstimos**; cada **Empréstimo** refere-se a exatamente 1 Livro e 1 Usuario (por identificador, sem FK entre bancos).
**Biblioteca** agrega (losango vazio) as projeções de livros, usuários e empréstimos usadas nos relatórios.

Em código, `Livro` está em `services/catalogo/.../livro/Livro.java`, `Usuario` em `services/usuarios/.../usuario/Usuario.java`,
`Emprestimo` em `services/circulacao/.../emprestimo/Emprestimo.java` e `Biblioteca` em `services/relatorios/.../biblioteca/Biblioteca.java`.
