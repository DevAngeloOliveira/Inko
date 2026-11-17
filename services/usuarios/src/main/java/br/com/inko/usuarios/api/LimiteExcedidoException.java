package br.com.inko.usuarios.api;

import java.time.Duration;
import org.springframework.http.HttpStatus;

public class LimiteExcedidoException extends ApiException {
    private final transient Duration retryAfter;

    public LimiteExcedidoException(String code, String message, Duration retryAfter) {
        super(HttpStatus.TOO_MANY_REQUESTS, code, message, null);
        this.retryAfter = retryAfter;
    }

    public long retryAfterSegundos() {
        long segundos = retryAfter.toSeconds() + (retryAfter.toNanosPart() > 0 ? 1 : 0);
        return Math.max(1, segundos);
    }
}
