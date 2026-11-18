package br.com.inko.circulacao.referencia;

import br.com.inko.circulacao.api.ApiException;
import java.net.http.HttpClient;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class HttpReferencias implements Referencias {
    private final RestClient catalogo;
    private final RestClient usuarios;

    public HttpReferencias(
            @Value("${inko.catalogo-url:http://localhost:8081}") String catalogoUrl,
            @Value("${inko.usuarios-url:http://localhost:8082}") String usuariosUrl,
            @Value("${inko.http.connect-timeout:300ms}") Duration connectTimeout,
            @Value("${inko.http.read-timeout:500ms}") Duration readTimeout) {
        this.catalogo = cliente(catalogoUrl, connectTimeout, readTimeout);
        this.usuarios = cliente(usuariosUrl, connectTimeout, readTimeout);
    }

    @Override
    public boolean livroExiste(String livroId) {
        return existe(catalogo, "/api/v1/livros/{id}", livroId, "catálogo");
    }

    @Override
    public boolean usuarioExiste(String usuarioId) {
        return existe(usuarios, "/api/v1/usuarios/{id}", usuarioId, "usuários");
    }

    private static boolean existe(RestClient client, String caminho, String id, String servico) {
        int status;
        try {
            status = client.get().uri(caminho, id).exchange((request, response) -> response.getStatusCode().value());
        } catch (RestClientException exception) {
            throw indisponivel(servico);
        }
        if (status == 200) {
            return true;
        }
        if (status == 404) {
            return false;
        }
        throw indisponivel(servico);
    }

    private static ApiException indisponivel(String servico) {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "DEPENDENCY_UNAVAILABLE",
                "Serviço de " + servico + " indisponível; a operação não foi confirmada.", null);
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
