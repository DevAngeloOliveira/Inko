package br.com.inko.circulacao.emprestimo;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface EmprestimoRepository {
    Emprestimo inserir(Emprestimo emprestimo);

    boolean registrarDevolucao(String id, LocalDate data);

    Optional<Emprestimo> buscar(String id);

    Optional<Emprestimo> ativoDoLivro(String livroId);

    List<Emprestimo> listar();
}
