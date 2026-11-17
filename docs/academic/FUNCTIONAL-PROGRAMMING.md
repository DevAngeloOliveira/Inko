# Programação funcional no INKO

Este documento mostra **onde** e **como** o código Java aplica funções puras, imutabilidade e as operações `filter`, `map` e `reduce`.
Os caminhos são relativos à raiz do repositório.

## 1. Funções puras implementadas

Uma função pura recebe tudo pelos parâmetros, não lê relógio, banco ou rede, não altera a entrada e sempre devolve o mesmo resultado para a mesma entrada.

| Função | Arquivo | Operações |
| --- | --- | --- |
| `filtrarLivrosPorCategoria` | `services/catalogo/.../livro/CatalogoFuncoes.java` | `filter` |
| `contabilizarLivrosPorCategoria` | `services/catalogo/.../livro/CatalogoFuncoes.java` | `groupingBy` + `counting` |
| `filtrarAtivos` | `services/circulacao/.../emprestimo/CirculacaoFuncoes.java` | `filter` |
| `identificarEmprestimosAtrasados` | `services/circulacao/.../emprestimo/CirculacaoFuncoes.java` | `filter` com data explícita |
| `calcularMulta` | `services/relatorios/.../biblioteca/FuncoesBiblioteca.java:20` | aritmética com `BigDecimal` |
| `identificarEmprestimosAtrasados` | `FuncoesBiblioteca.java:39` | `filter` → `filter` |
| `gerarRelatorioMultas` | `FuncoesBiblioteca.java:46` | `filter` → `filter` → `map` → `sorted` |
| `totalizarMultas` | `FuncoesBiblioteca.java:57` | `map` → **`reduce`** |
| `calcularTotalDeMultas` | `FuncoesBiblioteca.java:63` | composição das duas anteriores |
| `calcularTotalDeMultasImperativo` | `FuncoesBiblioteca.java:67` | laço `for` (versão imperativa) |
| `somarDiasDeAtraso` | `FuncoesBiblioteca.java:78` | `map` → **`reduce`** (segunda estatística) |
| `contarEmprestimosAtivos` | `FuncoesBiblioteca.java:84` | `filter` → `map` → **`reduce`** |
| `contabilizarLivrosPorCategoria` / `...Imperativo` | `FuncoesBiblioteca.java:91` e `:96` | agregação funcional e imperativa |
| `contabilizarEmprestimosPorUsuario` | `FuncoesBiblioteca.java:105` | `groupingBy` por `usuarioId` |

Os métodos dos records também são puros: `Emprestimo.ativo()`, `atrasadoEm(referencia)` e `diasDeAtraso(referencia)`
(`services/circulacao/.../emprestimo/Emprestimo.java:31-41`), e `Emprestimo.devolver(data)`, que devolve **um novo** record em vez de alterar o atual.

## 2. Regra da multa

```java
public static BigDecimal calcularMulta(long diasDeAtraso) {
    if (diasDeAtraso <= 0) {
        return ZERO;
    }
    return MULTA_DIARIA.multiply(BigDecimal.valueOf(diasDeAtraso));
}
```

- `MULTA_DIARIA = new BigDecimal("2.00")`: dinheiro nunca usa `double` ou `float`.
- Zero ou menos dias de atraso → `0.00`.
- Atraso é calculado contra uma **data de referência explícita**; nenhuma função pura chama `LocalDate.now()`.
- No dia do vencimento não há atraso (`dataPrevista.isBefore(referencia)` é falso quando as datas são iguais).

## 3. Pipeline do relatório de multas (RF-13)

```java
public static List<MultaIndividual> gerarRelatorioMultas(List<EmprestimoResumo> emprestimos, LocalDate referencia) {
    return emprestimos.stream()
            .filter(EmprestimoResumo::ativo)
            .filter(emprestimo -> emprestimo.atrasadoEm(referencia))
            .map(emprestimo -> new MultaIndividual(..., calcularMulta(emprestimo.diasDeAtraso(referencia))))
            .sorted(...)
            .toList();
}

public static BigDecimal totalizarMultas(List<MultaIndividual> multas) {
    return multas.stream()
            .map(MultaIndividual::valor)
            .reduce(ZERO, BigDecimal::add);
}
```

`RF-18` (valor total) e o total das estatísticas reutilizam exatamente esse pipeline (`calcularTotalDeMultas`): a regra não está duplicada.

## 4. Diagrama do fluxo funcional (modelo para o desenho manuscrito, DOC-03)

```text
 ENTRADA (impura, fora das funções)            TRANSFORMAÇÕES PURAS                         SAÍDA
 ────────────────────────────────             ──────────────────────                       ─────
 HTTP GET /api/v1/emprestimos  ─┐
 HTTP GET /api/v1/livros       ─┼─▶ Biblioteca (snapshot imutável, List.copyOf)
 HTTP GET /api/v1/usuarios     ─┘          │
 referenceDate = 2026-11-09 (parâmetro)    ▼
                                 List<EmprestimoResumo>  (11 registros)
                                           │ filter  ativo()              → dataDevolucao == null
                                           ▼                               (9 registros)
                                           │ filter  atrasadoEm(ref)      → dataPrevista < ref
                                           ▼                               (4 registros)
                                           │ map     calcularMulta(dias)  → 20d→40,00 15d→30,00
                                           ▼                                  10d→20,00  3d→ 6,00
                                 List<MultaIndividual>
                                           │ map     valor
                                           │ reduce  (0,00, BigDecimal::add)
                                           ▼
                                 BigDecimal total = 96,00   ──▶ JSON RelatorioMultas (impuro: HTTP)
```

- **Impuras** (efeitos colaterais, ficam nas bordas): leitura HTTP em `HttpFonteBiblioteca`, gravação no PostgreSQL nos repositórios JDBC,
  leitura do relógio no controller quando `referenceDate` não é informada.
- **Puras**: tudo entre o snapshot `Biblioteca` e o resultado.

## 5. Imperativo × funcional (PF-01)

```java
public static BigDecimal calcularTotalDeMultasImperativo(List<EmprestimoResumo> emprestimos, LocalDate referencia) {
    BigDecimal total = ZERO;
    for (EmprestimoResumo emprestimo : emprestimos) {
        if (emprestimo.dataDevolucao() == null && emprestimo.dataPrevista().isBefore(referencia)) {
            long dias = ChronoUnit.DAYS.between(emprestimo.dataPrevista(), referencia);
            total = total.add(MULTA_DIARIA.multiply(BigDecimal.valueOf(dias)));
        }
    }
    return total;
}
```

| Aspecto | Imperativo | Funcional |
| --- | --- | --- |
| Estado | variável `total` reatribuída a cada volta | nenhum estado mutável visível |
| Controle | laço `for` + `if` explícitos | `filter`, `map`, `reduce` declaram *o que* fazer |
| Reuso | regra de atraso repetida dentro do laço | reaproveita `atrasadoEm` e `calcularMulta` |
| Paralelismo | exige sincronizar `total` | `reduce` associativo pode usar `parallelStream()` |

A equivalência é provada em `FuncoesBibliotecaTest.versaoImperativaEFuncionalProduzemOMesmoTotal`, que compara as duas versões em 30 datas
de referência diferentes e também compara a contagem por categoria imperativa com a funcional.

## 6. Imutabilidade

- `Livro`, `Usuario`, `Emprestimo`, `LivroResumo`, `EmprestimoResumo`, `MultaIndividual` e `Biblioteca` são **records**: campos `final`, sem setters.
- `Biblioteca` copia as listas com `List.copyOf`; alterar a lista original depois de criar o snapshot não muda a biblioteca, e
  `biblioteca.emprestimos().clear()` lança `UnsupportedOperationException` (teste `bibliotecaEUmSnapshotImutavel`).
- `Stream.toList()` devolve listas não modificáveis.
- O teste `funcoesNaoAlteramAsColecoesRecebidas` passa uma `ArrayList` mutável às funções e confirma que ela permanece igual.

## 7. Como demonstrar ao professor

```bash
mvn -B -ntp -f services/relatorios/pom.xml test
```

Abra `FuncoesBibliotecaTest.java` e mostre, nesta ordem: `multaEDeDoisReaisPorDiaEZeroSemAtraso`, `relatorioDeMultasAplicaFilterMapReduce`,
`versaoImperativaEFuncionalProduzemOMesmoTotal`, `segundoReduceSomaDiasEContaAtivos` e `funcoesNaoAlteramAsColecoesRecebidas`.
Depois chame `GET /api/v1/relatorios/multas?referenceDate=2026-11-09` e mostre que o total `96.00` coincide com o teste.
