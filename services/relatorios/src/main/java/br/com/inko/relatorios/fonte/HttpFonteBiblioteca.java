package br.com.inko.relatorios.fonte;

import br.com.inko.relatorios.api.ApiException;
import br.com.inko.relatorios.biblioteca.Biblioteca;
import br.com.inko.relatorios.biblioteca.EmprestimoResumo;
import br.com.inko.relatorios.biblioteca.LivroResumo;
import br.com.inko.relatorios.biblioteca.UsuarioResumo;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

@Component
public class HttpFonteBiblioteca implements FonteBiblioteca {
    private static final Logger LOG = LoggerFactory.getLogger(HttpFonteBiblioteca.class);
    private final RestClient catalogo;
    private final RestClient usuarios;
    private final RestClient circulacao;
    private final Duration orcamento;
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    public HttpFonteBiblioteca(
            @Value("${inko.catalogo-url:http://localhost:8081}") String catalogoUrl,
            @Value("${inko.usuarios-url:http://localhost:8082}") String usuariosUrl,
            @Value("${inko.circulacao-url:http://localhost:8083}") String circulacaoUrl,
            @Value("${inko.http.connect-timeout:300ms}") Duration connectTimeout,
            @Value("${inko.http.read-timeout:700ms}") Duration readTimeout,
            @Value("${inko.http.budget:1000ms}") Duration orcamento) {
        this.catalogo = cliente(catalogoUrl, connectTimeout, readTimeout);
        this.usuarios = cliente(usuariosUrl, connectTimeout, readTimeout);
        this.circulacao = cliente(circulacaoUrl, connectTimeout, readTimeout);
        this.orcamento = orcamento;
    }

    @Override
    public Biblioteca carregar() {
        CompletableFuture<List<LivroResumo>> livros = buscar(catalogo, "/api/v1/livros", new ParameterizedTypeReference<>() {
        });
        CompletableFuture<List<UsuarioResumo>> pessoas = buscar(usuarios, "/api/v1/usuarios", new ParameterizedTypeReference<>() {
        });
        CompletableFuture<List<EmprestimoResumo>> emprestimos = buscar(circulacao, "/api/v1/emprestimos", new ParameterizedTypeReference<>() {
        });
        try {
            CompletableFuture.allOf(livros, pessoas, emprestimos).get(orcamento.toMillis(), TimeUnit.MILLISECONDS);
            return new Biblioteca(livros.join(), pessoas.join(), emprestimos.join());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw indisponivel();
        } catch (TimeoutException | ExecutionException | CompletionException exception) {
            List.of(livros, pessoas, emprestimos).forEach(futuro -> futuro.cancel(true));
            throw indisponivel();
        }
    }

    private <T> CompletableFuture<List<T>> buscar(RestClient client, String caminho, ParameterizedTypeReference<List<T>> tipo) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                List<T> corpo = client.get().uri(caminho).retrieve().body(tipo);
                return corpo == null ? List.of() : corpo;
            } catch (RestClientResponseException exception) {
                LOG.warn("Falha na fonte {} dos relatórios: HTTP {}", caminho, exception.getStatusCode().value());
                throw exception;
            } catch (RestClientException exception) {
                LOG.warn("Falha na fonte {} dos relatórios: {}", caminho,
                        NestedExceptionUtils.getMostSpecificCause(exception).getClass().getSimpleName());
                throw exception;
            }
        }, executor);
    }

    private static ApiException indisponivel() {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "DEPENDENCY_UNAVAILABLE",
                "Não foi possível obter os dados de catálogo, usuários e circulação para o relatório.", null);
    }

    private static RestClient cliente(String url, Duration connectTimeout, Duration readTimeout) {
        HttpClient http = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(connectTimeout)
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(readTimeout);
        return RestClient.builder().baseUrl(url).requestFactory(factory).build();
    }
}
