package br.com.inko.catalogo.capa;

import br.com.inko.catalogo.api.ApiException;
import org.springframework.http.HttpStatus;

final class CapaErros {
    private static final String CAMPO = "arquivo";

    private CapaErros() {
    }

    static ApiException vazio() {
        return new ApiException(HttpStatus.BAD_REQUEST, "EMPTY_FILE", "Envie um arquivo de imagem não vazio.", CAMPO);
    }

    static ApiException grandeDemais() {
        return new ApiException(HttpStatus.CONTENT_TOO_LARGE, "PAYLOAD_TOO_LARGE", "A capa excede o limite de 2 MiB.", CAMPO);
    }

    static ApiException tipoNaoSuportado() {
        return new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_MEDIA_TYPE",
                "Envie uma imagem JPEG ou PNG.", CAMPO);
    }

    static ApiException imagemGrandeDemais() {
        return new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "IMAGE_TOO_LARGE",
                "A imagem excede 12 megapixels ou 8000 pixels por lado.", CAMPO);
    }

    static ApiException imagemInvalida() {
        return new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "INVALID_IMAGE",
                "Não foi possível decodificar a imagem enviada.", CAMPO);
    }

    static ApiException capaNaoEncontrada(String livroId) {
        return new ApiException(HttpStatus.NOT_FOUND, "COVER_NOT_FOUND", "O livro " + livroId + " não possui capa.", null);
    }

    static ApiException armazenamentoIndisponivel() {
        return new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "STORAGE_UNAVAILABLE",
                "Não foi possível armazenar a capa.", null);
    }
}
