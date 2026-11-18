package br.com.inko.relatorios.fonte;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.Test;

class HttpFonteBibliotecaTest {
    @Test
    void carregaAsTresFontesSemSolicitarUpgradeParaHttp2() throws IOException {
        Set<String> caminhos = ConcurrentHashMap.newKeySet();
        HttpServer proxy = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        proxy.createContext("/api/v1/", exchange -> {
            try (exchange) {
                caminhos.add(exchange.getRequestURI().getPath());
                if (exchange.getRequestHeaders().containsKey("Upgrade")) {
                    exchange.sendResponseHeaders(502, -1);
                    return;
                }
                byte[] resposta = "[]".getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, resposta.length);
                exchange.getResponseBody().write(resposta);
            }
        });
        proxy.start();
        try {
            String url = "http://127.0.0.1:" + proxy.getAddress().getPort();
            HttpFonteBiblioteca fonte = new HttpFonteBiblioteca(url, url, url,
                    Duration.ofSeconds(2), Duration.ofSeconds(2), Duration.ofSeconds(5));

            fonte.carregar();

            assertEquals(Set.of("/api/v1/livros", "/api/v1/usuarios", "/api/v1/emprestimos"), caminhos);
        } finally {
            proxy.stop(0);
        }
    }
}
