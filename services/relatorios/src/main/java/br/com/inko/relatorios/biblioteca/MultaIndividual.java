package br.com.inko.relatorios.biblioteca;

import java.math.BigDecimal;
import java.time.LocalDate;

public record MultaIndividual(String emprestimoId, String livroId, String usuarioId, LocalDate dataPrevista, long diasAtraso, BigDecimal valor) {
}
