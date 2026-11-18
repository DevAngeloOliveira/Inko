package br.com.inko.circulacao.referencia;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.time.Duration;
import org.junit.jupiter.api.Test;

class HttpReferenciasTest {
    @Test
    void consultaCatalogoEUsuariosSemSolicitarUpgradeParaHttp2() throws IOException {
        HttpServer proxy = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        proxy.createContext("/api/v1/", exchange -> {
            try (exchange) {
                if (exchange.getRequestHeaders().containsKey("Upgrade")) {
                    exchange.sendResponseHeaders(502, -1);
                    return;
                }
                String path = exchange.getRequestURI().getPath();
                int status = switch (path) {
                    case "/api/v1/livros/INK-0002", "/api/v1/usuarios/USR-0726" -> 200;
                    default -> 404;
                };
                exchange.sendResponseHeaders(status, -1);
            }
        });
        proxy.start();
        try {
            String url = "http://127.0.0.1:" + proxy.getAddress().getPort();
            HttpReferencias referencias = new HttpReferencias(url, url, Duration.ofSeconds(2), Duration.ofSeconds(2));

            assertTrue(referencias.livroExiste("INK-0002"));
            assertTrue(referencias.usuarioExiste("USR-0726"));
            assertFalse(referencias.livroExiste("AUSENTE"));
        } finally {
            proxy.stop(0);
        }
    }
}
