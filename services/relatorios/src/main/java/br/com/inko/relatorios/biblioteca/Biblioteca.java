package br.com.inko.relatorios.biblioteca;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public record Biblioteca(List<LivroResumo> livros, List<UsuarioResumo> usuarios, List<EmprestimoResumo> emprestimos) {
    public Biblioteca {
        livros = List.copyOf(livros);
        usuarios = List.copyOf(usuarios);
        emprestimos = List.copyOf(emprestimos);
    }

    public record ItemMulta(String emprestimoId, String livroId, String titulo, String usuarioId, String nomeUsuario,
                            LocalDate dataPrevista, long diasAtraso, BigDecimal valor) {
    }

    public record RelatorioMultas(LocalDate referenceDate, BigDecimal valorDiario, int quantidade, long totalDiasAtraso,
                                  BigDecimal total, List<ItemMulta> itens) {
    }

    public record EmprestimosDoUsuario(String usuarioId, String nome, long total) {
    }

    public record Estatisticas(LocalDate referenceDate, int totalLivros, int totalUsuarios, int totalEmprestimos,
                               long emprestimosAtivos, int emprestimosAtrasados, BigDecimal totalMultas,
                               Map<String, Long> livrosPorCategoria, List<EmprestimosDoUsuario> emprestimosPorUsuario) {
    }

    public Optional<LivroResumo> livro(String id) {
        return livros.stream().filter(livro -> livro.id().equals(id)).findFirst();
    }

    public Optional<UsuarioResumo> usuario(String id) {
        return usuarios.stream().filter(usuario -> usuario.id().equals(id)).findFirst();
    }

    public List<LivroResumo> livrosDaCategoria(String categoria) {
        return FuncoesBiblioteca.filtrarLivrosPorCategoria(livros, categoria);
    }

    public List<EmprestimoResumo> emprestimosAtivos() {
        return FuncoesBiblioteca.filtrarEmprestimosAtivos(emprestimos);
    }

    public List<EmprestimoResumo> emprestimosAtrasados(LocalDate referencia) {
        return FuncoesBiblioteca.identificarEmprestimosAtrasados(emprestimos, referencia);
    }

    public RelatorioMultas relatorioMultas(LocalDate referencia) {
        List<MultaIndividual> multas = FuncoesBiblioteca.gerarRelatorioMultas(emprestimos, referencia);
        List<ItemMulta> itens = multas.stream()
                .map(multa -> new ItemMulta(multa.emprestimoId(), multa.livroId(), tituloDo(multa.livroId()),
                        multa.usuarioId(), nomeDo(multa.usuarioId()), multa.dataPrevista(), multa.diasAtraso(), multa.valor()))
                .toList();
        long dias = multas.stream().map(MultaIndividual::diasAtraso).reduce(0L, Long::sum);
        return new RelatorioMultas(referencia, FuncoesBiblioteca.MULTA_DIARIA, itens.size(), dias,
                FuncoesBiblioteca.totalizarMultas(multas), itens);
    }

    public Estatisticas estatisticas(LocalDate referencia) {
        List<EmprestimosDoUsuario> porUsuario = FuncoesBiblioteca.contabilizarEmprestimosPorUsuario(emprestimos).entrySet().stream()
                .map(entrada -> new EmprestimosDoUsuario(entrada.getKey(), nomeDo(entrada.getKey()), entrada.getValue()))
                .sorted(Comparator.comparingLong(EmprestimosDoUsuario::total).reversed().thenComparing(EmprestimosDoUsuario::usuarioId))
                .toList();
        return new Estatisticas(referencia, livros.size(), usuarios.size(), emprestimos.size(),
                FuncoesBiblioteca.contarEmprestimosAtivos(emprestimos), emprestimosAtrasados(referencia).size(),
                FuncoesBiblioteca.calcularTotalDeMultas(emprestimos, referencia),
                FuncoesBiblioteca.contabilizarLivrosPorCategoria(livros), porUsuario);
    }

    private String tituloDo(String livroId) {
        return livro(livroId)
                .map(livro -> livro.volume() == null || livro.volume().isBlank() ? livro.titulo() : livro.titulo() + " · " + livro.volume())
                .orElse(livroId);
    }

    private String nomeDo(String usuarioId) {
        return usuario(usuarioId).map(UsuarioResumo::nome).orElse(usuarioId);
    }
}
