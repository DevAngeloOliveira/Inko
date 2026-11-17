package br.com.inko.relatorios.biblioteca;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record LivroResumo(String id, String titulo, String autor, String categoria, String volume) {
}
