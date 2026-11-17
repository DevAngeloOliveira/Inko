package br.com.inko.catalogo.capa;

import java.time.Instant;

public record CapaResposta(
        String livroId,
        String mimeType,
        int tamanhoBytes,
        int largura,
        int altura,
        String sha256,
        String versao,
        Instant atualizadoEm) {
    static CapaResposta de(CapaLivro capa) {
        return new CapaResposta(capa.livroId(), capa.mimeType(), capa.tamanhoBytes(), capa.largura(), capa.altura(),
                capa.sha256(), capa.versao(), capa.atualizadoEm());
    }
}
