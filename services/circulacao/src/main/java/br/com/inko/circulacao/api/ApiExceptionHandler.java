package br.com.inko.circulacao.api;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class ApiExceptionHandler {
    private static final MediaType PROBLEM = MediaType.APPLICATION_PROBLEM_JSON;

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> handle(ApiException exception) {
        return problem(exception.status(), exception.code(), exception.getMessage(), exception.field());
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<Map<String, Object>> malformed(Exception exception) {
        return problem(HttpStatus.BAD_REQUEST, "MALFORMED_REQUEST", "Requisição malformada.", null);
    }

    static ResponseEntity<Map<String, Object>> problem(HttpStatus status, String code, String detail, String field) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", "about:blank");
        body.put("title", status.getReasonPhrase());
        body.put("status", status.value());
        body.put("code", code);
        body.put("detail", detail);
        if (field != null) {
            body.put("field", field);
        }
        return ResponseEntity.status(status).contentType(PROBLEM).body(body);
    }
}
