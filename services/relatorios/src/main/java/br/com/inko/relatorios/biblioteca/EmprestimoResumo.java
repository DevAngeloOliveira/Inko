package br.com.inko.relatorios.biblioteca;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

@JsonIgnoreProperties(ignoreUnknown = true)
public record EmprestimoResumo(String id, String livroId, String usuarioId, LocalDate dataEmprestimo, LocalDate dataPrevista, LocalDate dataDevolucao) {
    public boolean ativo() {
        return dataDevolucao == null;
    }

    public boolean atrasadoEm(LocalDate referencia) {
        return ativo() && dataPrevista.isBefore(referencia);
    }

    public long diasDeAtraso(LocalDate referencia) {
        return atrasadoEm(referencia) ? ChronoUnit.DAYS.between(dataPrevista, referencia) : 0;
    }
}
