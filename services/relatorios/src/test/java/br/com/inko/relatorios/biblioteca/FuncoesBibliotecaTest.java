package br.com.inko.relatorios.biblioteca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class FuncoesBibliotecaTest {
    private static final LocalDate REFERENCIA = LocalDate.of(2026, 11, 9);

    private static final List<LivroResumo> LIVROS = List.of(
            new LivroResumo("INK-0001", "Maré de Tinta", "Aiko Tanabe", "Mangá", "Vol. 3"),
            new LivroResumo("INK-0003", "Capitão Ferrugem", "Rafael Moura", "HQ", "#27"),
            new LivroResumo("INK-0005", "Jardim de Aço", "Sora Ikeda", "Mangá", "Vol. 1"),
            new LivroResumo("INK-0006", "Noite Sem Lua", "Lia Sato", "Graphic novel", null),
            new LivroResumo("INK-0008", "Pétalas de Ferro", "Mei Kurogane", "Mangá", "Vol. 2"));

    private static final List<UsuarioResumo> USUARIOS = List.of(
            new UsuarioResumo("USR-0175", "Helena Vaz", "2025175"),
            new UsuarioResumo("USR-0142", "Rafael Moura", "2025014"),
            new UsuarioResumo("USR-0203", "Lia Sato", "2025203"),
            new UsuarioResumo("USR-0087", "Beatriz Moraes", "2024087"));

    private static final List<EmprestimoResumo> EMPRESTIMOS = List.of(
            emprestimo("EMP-10288", "INK-0005", "USR-0175", "2026-10-06", "2026-10-20", null),
            emprestimo("EMP-10302", "INK-0001", "USR-0142", "2026-10-11", "2026-10-25", null),
            emprestimo("EMP-10311", "INK-0003", "USR-0175", "2026-10-16", "2026-10-30", null),
            emprestimo("EMP-10334", "INK-0008", "USR-0203", "2026-10-23", "2026-11-06", null),
            emprestimo("EMP-10377", "INK-0002", "USR-0087", "2026-10-28", "2026-11-11", null),
            emprestimo("EMP-10270", "INK-0004", "USR-0110", "2026-10-26", "2026-11-09", null),
            emprestimo("EMP-10241", "INK-0007", "USR-0203", "2026-10-12", "2026-10-26", "2026-10-24"),
            emprestimo("EMP-10100", "INK-0006", "USR-0142", "2026-09-01", "2026-09-15", "2026-10-30"));

    private static EmprestimoResumo emprestimo(String id, String livro, String usuario, String inicio, String prevista, String devolucao) {
        return new EmprestimoResumo(id, livro, usuario, LocalDate.parse(inicio), LocalDate.parse(prevista),
                devolucao == null ? null : LocalDate.parse(devolucao));
    }

    private static BigDecimal reais(String valor) {
        return new BigDecimal(valor);
    }

    @Test
    void multaEDeDoisReaisPorDiaEZeroSemAtraso() {
        assertEquals(reais("0.00"), FuncoesBiblioteca.calcularMulta(0));
        assertEquals(reais("0.00"), FuncoesBiblioteca.calcularMulta(-3));
        assertEquals(reais("2.00"), FuncoesBiblioteca.calcularMulta(1));
        assertEquals(reais("40.00"), FuncoesBiblioteca.calcularMulta(20));
        assertEquals(FuncoesBiblioteca.calcularMulta(7), FuncoesBiblioteca.calcularMulta(7));
    }

    @Test
    void atrasoConsideraSomenteAtivosComVencimentoAnteriorAReferencia() {
        List<String> atrasados = FuncoesBiblioteca.identificarEmprestimosAtrasados(EMPRESTIMOS, REFERENCIA).stream()
                .map(EmprestimoResumo::id).toList();
        assertEquals(List.of("EMP-10288", "EMP-10302", "EMP-10311", "EMP-10334"), atrasados);
        assertEquals(0, FuncoesBiblioteca.identificarEmprestimosAtrasados(EMPRESTIMOS, LocalDate.of(2026, 10, 20)).size());
        assertEquals(1, FuncoesBiblioteca.identificarEmprestimosAtrasados(EMPRESTIMOS, LocalDate.of(2026, 10, 21)).size());
    }

    @Test
    void relatorioDeMultasAplicaFilterMapReduce() {
        List<MultaIndividual> multas = FuncoesBiblioteca.gerarRelatorioMultas(EMPRESTIMOS, REFERENCIA);

        assertEquals(List.of(20L, 15L, 10L, 3L), multas.stream().map(MultaIndividual::diasAtraso).toList());
        assertEquals(List.of(reais("40.00"), reais("30.00"), reais("20.00"), reais("6.00")),
                multas.stream().map(MultaIndividual::valor).toList());
        assertEquals(reais("96.00"), FuncoesBiblioteca.totalizarMultas(multas));
        assertEquals(reais("0.00"), FuncoesBiblioteca.totalizarMultas(List.of()));
    }

    @Test
    void versaoImperativaEFuncionalProduzemOMesmoTotal() {
        for (LocalDate data = LocalDate.of(2026, 10, 1); data.isBefore(LocalDate.of(2026, 12, 31)); data = data.plusDays(3)) {
            assertEquals(FuncoesBiblioteca.calcularTotalDeMultasImperativo(EMPRESTIMOS, data),
                    FuncoesBiblioteca.calcularTotalDeMultas(EMPRESTIMOS, data), data.toString());
        }
        assertEquals(FuncoesBiblioteca.contabilizarLivrosPorCategoriaImperativo(LIVROS),
                FuncoesBiblioteca.contabilizarLivrosPorCategoria(LIVROS));
        assertEquals(FuncoesBiblioteca.calcularTotalDeMultasImperativo(List.of(), REFERENCIA),
                FuncoesBiblioteca.calcularTotalDeMultas(List.of(), REFERENCIA));
    }

    @Test
    void segundoReduceSomaDiasEContaAtivos() {
        assertEquals(48L, FuncoesBiblioteca.somarDiasDeAtraso(EMPRESTIMOS, REFERENCIA));
        assertEquals(6L, FuncoesBiblioteca.contarEmprestimosAtivos(EMPRESTIMOS));
        assertEquals(0L, FuncoesBiblioteca.contarEmprestimosAtivos(List.of()));
    }

    @Test
    void agregacoesPorCategoriaEUsuario() {
        assertEquals(Map.of("Mangá", 3L, "HQ", 1L, "Graphic novel", 1L), FuncoesBiblioteca.contabilizarLivrosPorCategoria(LIVROS));
        assertEquals(List.of("INK-0003"), FuncoesBiblioteca.filtrarLivrosPorCategoria(LIVROS, "HQ").stream().map(LivroResumo::id).toList());
        assertEquals(List.of(), FuncoesBiblioteca.filtrarLivrosPorCategoria(List.of(), "HQ"));
        assertEquals(2L, FuncoesBiblioteca.contabilizarEmprestimosPorUsuario(EMPRESTIMOS).get("USR-0175"));
        assertEquals(2L, FuncoesBiblioteca.contabilizarEmprestimosPorUsuario(EMPRESTIMOS).get("USR-0142"));
    }

    @Test
    void funcoesNaoAlteramAsColecoesRecebidas() {
        List<EmprestimoResumo> entrada = new ArrayList<>(EMPRESTIMOS);
        List<EmprestimoResumo> copia = List.copyOf(entrada);
        FuncoesBiblioteca.gerarRelatorioMultas(entrada, REFERENCIA);
        FuncoesBiblioteca.identificarEmprestimosAtrasados(entrada, REFERENCIA);
        FuncoesBiblioteca.contarEmprestimosAtivos(entrada);
        FuncoesBiblioteca.contabilizarEmprestimosPorUsuario(entrada);
        assertEquals(copia, entrada);
    }

    @Test
    void bibliotecaEUmSnapshotImutavel() {
        List<EmprestimoResumo> origem = new ArrayList<>(EMPRESTIMOS);
        Biblioteca biblioteca = new Biblioteca(LIVROS, USUARIOS, origem);
        origem.clear();

        assertEquals(EMPRESTIMOS.size(), biblioteca.emprestimos().size());
        assertThrows(UnsupportedOperationException.class, () -> biblioteca.emprestimos().clear());
        assertEquals(6, biblioteca.emprestimosAtivos().size());
        assertEquals(3, biblioteca.livrosDaCategoria("Mangá").size());
    }

    @Test
    void relatorioEEstatisticasDaBibliotecaReutilizamOPipeline() {
        Biblioteca biblioteca = new Biblioteca(LIVROS, USUARIOS, EMPRESTIMOS);
        Biblioteca.RelatorioMultas relatorio = biblioteca.relatorioMultas(REFERENCIA);

        assertEquals(4, relatorio.quantidade());
        assertEquals(48L, relatorio.totalDiasAtraso());
        assertEquals(reais("96.00"), relatorio.total());
        assertEquals("Jardim de Aço · Vol. 1", relatorio.itens().getFirst().titulo());
        assertEquals("Helena Vaz", relatorio.itens().getFirst().nomeUsuario());

        Biblioteca.Estatisticas estatisticas = biblioteca.estatisticas(REFERENCIA);
        assertEquals(5, estatisticas.totalLivros());
        assertEquals(6L, estatisticas.emprestimosAtivos());
        assertEquals(4, estatisticas.emprestimosAtrasados());
        assertEquals(relatorio.total(), estatisticas.totalMultas());
        assertEquals("USR-0142", estatisticas.emprestimosPorUsuario().getFirst().usuarioId());
    }
}
