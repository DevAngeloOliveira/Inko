package br.com.inko.catalogo.capa;

import java.util.Optional;

public interface CapaRepository {
    boolean livroExiste(String livroId);

    boolean bloquearLivro(String livroId);

    Optional<CapaLivro> buscar(String livroId);

    void salvar(CapaLivro capa);

    void remover(String livroId);
}
