package br.com.inko.catalogo.api;

import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final String field;

    public ApiException(HttpStatus status, String code, String message, String field) {
        super(message);
        this.status = status;
        this.code = code;
        this.field = field;
    }

    public static ApiException naoEncontrado(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", message, null);
    }

    public static ApiException conflito(String code, String message, String field) {
        return new ApiException(HttpStatus.CONFLICT, code, message, field);
    }

    public static ApiException invalido(String message, String field) {
        return new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "VALIDATION_ERROR", message, field);
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }

    public String field() {
        return field;
    }
}
