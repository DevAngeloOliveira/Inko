package br.com.inko.circulacao.emprestimo;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public final class CirculacaoFuncoes {
    private CirculacaoFuncoes() {
    }

    public static List<Emprestimo> filtrarAtivos(List<Emprestimo> emprestimos) {
        return emprestimos.stream()
                .filter(Emprestimo::ativo)
                .toList();
    }

    public static List<Emprestimo> identificarEmprestimosAtrasados(List<Emprestimo> emprestimos, LocalDate referencia) {
        return emprestimos.stream()
                .filter(emprestimo -> emprestimo.atrasadoEm(referencia))
                .toList();
    }

    public static Optional<Emprestimo> emprestimoAtivoDoLivro(List<Emprestimo> emprestimos, String livroId) {
        return emprestimos.stream()
                .filter(Emprestimo::ativo)
                .filter(emprestimo -> emprestimo.livroId().equals(livroId))
                .findFirst();
    }
}
