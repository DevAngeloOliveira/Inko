package br.com.inko.catalogo.capa;

import java.time.Instant;

public record CapaLivro(
        String livroId,
        String objectKey,
        String mimeType,
        int tamanhoBytes,
        String sha256,
        int largura,
        int altura,
        Instant atualizadoEm) {
    public static final int TAMANHO_VERSAO = 16;

    public String versao() {
        return sha256.substring(0, TAMANHO_VERSAO);
    }
}
