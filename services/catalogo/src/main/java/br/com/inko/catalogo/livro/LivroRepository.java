package br.com.inko.catalogo.livro;

import java.util.List;
import java.util.Optional;

public interface LivroRepository {
    void inserir(Livro livro);

    Optional<Livro> buscar(String id);

    List<Livro> listar();
}
