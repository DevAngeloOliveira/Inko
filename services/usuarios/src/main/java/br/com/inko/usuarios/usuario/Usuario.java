package br.com.inko.usuarios.usuario;

import br.com.inko.usuarios.api.ApiException;
import java.time.LocalDate;
import java.util.regex.Pattern;

public record Usuario(String id, String nome, String matricula, String email, LocalDate cadastradoEm) {
    private static final Pattern IDENTIFICADOR = Pattern.compile("USR-\\d{4,}");
    private static final Pattern MATRICULA = Pattern.compile("[A-Za-z0-9.-]{3,20}");
    private static final Pattern EMAIL = Pattern.compile("[^@\\s]+@[^@\\s]+\\.[^@\\s]+");

    public Usuario {
        if (id != null && !IDENTIFICADOR.matcher(id).matches()) {
            throw ApiException.invalido("Identificador de usuário inválido.", "id");
        }
        nome = obrigatorio(nome, "nome", "Informe o nome completo.");
        if (nome.length() < 3 || nome.length() > 120) {
            throw ApiException.invalido("Informe o nome completo.", "nome");
        }
        matricula = obrigatorio(matricula, "matricula", "Informe a matrícula.").toUpperCase();
        if (!MATRICULA.matcher(matricula).matches()) {
            throw ApiException.invalido("Matrícula inválida. Use de 3 a 20 letras, números, ponto ou hífen.", "matricula");
        }
        email = email == null || email.isBlank() ? null : email.strip().toLowerCase();
        if (email != null && (email.length() > 160 || !EMAIL.matcher(email).matches())) {
            throw ApiException.invalido("Informe um e-mail válido.", "email");
        }
    }

    public Usuario comIdentificador(String novoId, LocalDate data) {
        return new Usuario(novoId, nome, matricula, email, data);
    }

    private static String obrigatorio(String valor, String campo, String mensagem) {
        if (valor == null || valor.isBlank()) {
            throw ApiException.invalido(mensagem, campo);
        }
        return valor.strip().replaceAll("\\s+", " ");
    }
}
