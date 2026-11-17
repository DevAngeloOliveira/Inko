package br.com.inko.usuarios.auth;

import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

public record Operador(UUID id, String email, String nome, String senhaHash, Papel papel, boolean ativo) {
    public Operador {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(senhaHash, "senhaHash");
        Objects.requireNonNull(papel, "papel");
        email = normalizarEmail(email);
        nome = Objects.requireNonNull(nome, "nome").strip();
    }

    public static String normalizarEmail(String email) {
        return Objects.requireNonNull(email, "email").strip().toLowerCase(Locale.ROOT);
    }

    @Override
    public String toString() {
        return "Operador[id=" + id + ", papel=" + papel + ", ativo=" + ativo + "]";
    }
}
