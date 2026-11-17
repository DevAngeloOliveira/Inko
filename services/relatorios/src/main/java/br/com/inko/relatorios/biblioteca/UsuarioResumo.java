package br.com.inko.relatorios.biblioteca;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record UsuarioResumo(String id, String nome, String matricula) {
}
