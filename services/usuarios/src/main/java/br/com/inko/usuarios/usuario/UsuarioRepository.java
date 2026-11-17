package br.com.inko.usuarios.usuario;

import java.util.List;
import java.util.Optional;

public interface UsuarioRepository {
    Usuario inserir(Usuario usuario);

    Optional<Usuario> buscar(String id);

    List<Usuario> listar();

    boolean existeMatricula(String matricula);

    boolean existeEmail(String email);
}
