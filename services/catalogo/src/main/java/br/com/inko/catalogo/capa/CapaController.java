package br.com.inko.catalogo.capa;

import java.io.IOException;
import java.util.Arrays;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/livros/{id}/capa")
public class CapaController {
    static final String CACHE_CONTROL = "public, max-age=300, must-revalidate";
    static final String NOSNIFF = "nosniff";
    private static final String X_CONTENT_TYPE_OPTIONS = "X-Content-Type-Options";

    private final CapaService service;

    public CapaController(CapaService service) {
        this.service = service;
    }

    @PutMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public CapaResposta enviar(@PathVariable String id, @RequestPart("arquivo") MultipartFile arquivo) {
        if (arquivo.isEmpty()) {
            throw CapaErros.vazio();
        }
        if (arquivo.getSize() > ValidadorCapa.TAMANHO_MAXIMO_BYTES) {
            throw CapaErros.grandeDemais();
        }
        byte[] conteudo;
        try {
            conteudo = arquivo.getBytes();
        } catch (IOException falha) {
            throw CapaErros.vazio();
        }
        return CapaResposta.de(service.substituir(id, arquivo.getContentType(), conteudo));
    }

    @GetMapping
    public ResponseEntity<Resource> obter(@PathVariable String id,
            @RequestHeader(name = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {
        CapaLivro atual = service.buscar(id);
        if (corresponde(ifNoneMatch, atual.sha256())) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED)
                    .eTag(etag(atual.sha256()))
                    .header(HttpHeaders.CACHE_CONTROL, CACHE_CONTROL)
                    .header(X_CONTENT_TYPE_OPTIONS, NOSNIFF)
                    .build();
        }
        CapaService.CapaConteudo aberta = service.abrir(id);
        CapaLivro capa = aberta.capa();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(capa.mimeType()))
                .contentLength(capa.tamanhoBytes())
                .eTag(etag(capa.sha256()))
                .header(HttpHeaders.CACHE_CONTROL, CACHE_CONTROL)
                .header(X_CONTENT_TYPE_OPTIONS, NOSNIFF)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().build().toString())
                .body(new InputStreamResource(aberta.conteudo()));
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remover(@PathVariable String id) {
        service.remover(id);
    }

    static String etag(String sha256) {
        return "\"" + sha256 + "\"";
    }

    static boolean corresponde(String ifNoneMatch, String sha256) {
        if (ifNoneMatch == null || ifNoneMatch.isBlank()) {
            return false;
        }
        String esperado = etag(sha256);
        return Arrays.stream(ifNoneMatch.split(","))
                .map(String::strip)
                .map(valor -> valor.startsWith("W/") ? valor.substring(2) : valor)
                .anyMatch(valor -> valor.equals("*") || valor.equals(esperado));
    }
}
