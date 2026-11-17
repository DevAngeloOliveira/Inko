package br.com.inko.relatorios.biblioteca;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

public final class FuncoesBiblioteca {
    public static final BigDecimal MULTA_DIARIA = new BigDecimal("2.00");
    public static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.UNNECESSARY);

    private FuncoesBiblioteca() {
    }

    public static BigDecimal calcularMulta(long diasDeAtraso) {
        if (diasDeAtraso <= 0) {
            return ZERO;
        }
        return MULTA_DIARIA.multiply(BigDecimal.valueOf(diasDeAtraso));
    }

    public static List<LivroResumo> filtrarLivrosPorCategoria(List<LivroResumo> livros, String categoria) {
        return livros.stream()
                .filter(livro -> livro.categoria().equals(categoria))
                .toList();
    }

    public static List<EmprestimoResumo> filtrarEmprestimosAtivos(List<EmprestimoResumo> emprestimos) {
        return emprestimos.stream()
                .filter(EmprestimoResumo::ativo)
                .toList();
    }

    public static List<EmprestimoResumo> identificarEmprestimosAtrasados(List<EmprestimoResumo> emprestimos, LocalDate referencia) {
        return emprestimos.stream()
                .filter(EmprestimoResumo::ativo)
                .filter(emprestimo -> emprestimo.dataPrevista().isBefore(referencia))
                .toList();
    }

    public static List<MultaIndividual> gerarRelatorioMultas(List<EmprestimoResumo> emprestimos, LocalDate referencia) {
        return emprestimos.stream()
                .filter(EmprestimoResumo::ativo)
                .filter(emprestimo -> emprestimo.atrasadoEm(referencia))
                .map(emprestimo -> new MultaIndividual(
                        emprestimo.id(), emprestimo.livroId(), emprestimo.usuarioId(), emprestimo.dataPrevista(),
                        emprestimo.diasDeAtraso(referencia), calcularMulta(emprestimo.diasDeAtraso(referencia))))
                .sorted(Comparator.comparingLong(MultaIndividual::diasAtraso).reversed().thenComparing(MultaIndividual::emprestimoId))
                .toList();
    }

    public static BigDecimal totalizarMultas(List<MultaIndividual> multas) {
        return multas.stream()
                .map(MultaIndividual::valor)
                .reduce(ZERO, BigDecimal::add);
    }

    public static BigDecimal calcularTotalDeMultas(List<EmprestimoResumo> emprestimos, LocalDate referencia) {
        return totalizarMultas(gerarRelatorioMultas(emprestimos, referencia));
    }

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

    public static long somarDiasDeAtraso(List<EmprestimoResumo> emprestimos, LocalDate referencia) {
        return emprestimos.stream()
                .map(emprestimo -> emprestimo.diasDeAtraso(referencia))
                .reduce(0L, Long::sum);
    }

    public static long contarEmprestimosAtivos(List<EmprestimoResumo> emprestimos) {
        return emprestimos.stream()
                .filter(EmprestimoResumo::ativo)
                .map(emprestimo -> 1L)
                .reduce(0L, Long::sum);
    }

    public static Map<String, Long> contabilizarLivrosPorCategoria(List<LivroResumo> livros) {
        return livros.stream()
                .collect(Collectors.groupingBy(LivroResumo::categoria, TreeMap::new, Collectors.counting()));
    }

    public static Map<String, Long> contabilizarLivrosPorCategoriaImperativo(List<LivroResumo> livros) {
        Map<String, Long> contagem = new TreeMap<>();
        for (LivroResumo livro : livros) {
            Long atual = contagem.get(livro.categoria());
            contagem.put(livro.categoria(), atual == null ? 1L : atual + 1);
        }
        return contagem;
    }

    public static Map<String, Long> contabilizarEmprestimosPorUsuario(List<EmprestimoResumo> emprestimos) {
        return emprestimos.stream()
                .collect(Collectors.groupingBy(EmprestimoResumo::usuarioId, TreeMap::new, Collectors.counting()));
    }
}
