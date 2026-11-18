package br.com.inko.usuarios.auth;

import java.time.Instant;
import java.util.UUID;

public record SessaoOperador(UUID id, UUID operadorId, String tokenHash, Instant criadoEm, Instant expiraEm) {
}
