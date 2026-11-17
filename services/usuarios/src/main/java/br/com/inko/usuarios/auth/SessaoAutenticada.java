package br.com.inko.usuarios.auth;

import java.time.Instant;

public record SessaoAutenticada(Operador operador, Instant expiraEm, Instant revogadoEm) {
    public boolean validaEm(Instant agora) {
        return revogadoEm == null && expiraEm.isAfter(agora) && operador.ativo();
    }
}
