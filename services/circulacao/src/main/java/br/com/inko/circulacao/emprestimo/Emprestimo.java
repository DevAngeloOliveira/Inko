package br.com.inko.circulacao.emprestimo;

import br.com.inko.circulacao.api.ApiException;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

public record Emprestimo(String id, String livroId, String usuarioId, LocalDate dataEmprestimo, LocalDate dataPrevista, LocalDate dataDevolucao) {
    public static final int PRAZO_MAXIMO_DIAS = 60;

    public Emprestimo {
        if (livroId == null || livroId.isBlank()) {
            throw ApiException.invalido("Selecione uma obra.", "livroId");
        }
        if (usuarioId == null || usuarioId.isBlank()) {
            throw ApiException.invalido("Selecione um usuário.", "usuarioId");
        }
        if (dataEmprestimo == null || dataPrevista == null) {
            throw ApiException.invalido("Informe as datas do empréstimo.", "dataPrevista");
        }
        long prazo = ChronoUnit.DAYS.between(dataEmprestimo, dataPrevista);
        if (prazo < 1 || prazo > PRAZO_MAXIMO_DIAS) {
            throw ApiException.invalido("O prazo deve ficar entre 1 e " + PRAZO_MAXIMO_DIAS + " dias após o empréstimo.", "dataPrevista");
        }
        if (dataDevolucao != null && dataDevolucao.isBefore(dataEmprestimo)) {
            throw ApiException.invalido("A devolução não pode ser antes do empréstimo.", "dataDevolucao");
        }
        livroId = livroId.strip().toUpperCase();
        usuarioId = usuarioId.strip().toUpperCase();
    }

    public boolean ativo() {
        return dataDevolucao == null;
    }

    public boolean atrasadoEm(LocalDate referencia) {
        return ativo() && dataPrevista.isBefore(referencia);
    }

    public long diasDeAtraso(LocalDate referencia) {
        return atrasadoEm(referencia) ? ChronoUnit.DAYS.between(dataPrevista, referencia) : 0;
    }

    public Emprestimo devolver(LocalDate data) {
        if (!ativo()) {
            throw ApiException.conflito("ALREADY_RETURNED", "O empréstimo " + id + " já foi devolvido.", null);
        }
        return new Emprestimo(id, livroId, usuarioId, dataEmprestimo, dataPrevista, data);
    }
}
