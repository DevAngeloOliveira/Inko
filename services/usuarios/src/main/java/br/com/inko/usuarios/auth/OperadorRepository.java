package br.com.inko.usuarios.auth;

import java.time.Instant;
import java.util.Optional;

public interface OperadorRepository {
    Optional<Operador> buscarPorEmail(String email);

    boolean existeEmail(String email);

    void inserir(Operador operador, Instant criadoEm);

    void criarSessao(SessaoOperador sessao);

    Optional<SessaoAutenticada> buscarSessao(String tokenHash);

    void revogarSessao(String tokenHash, Instant revogadoEm);
}
