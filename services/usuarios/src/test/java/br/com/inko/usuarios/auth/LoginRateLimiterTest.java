package br.com.inko.usuarios.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import br.com.inko.usuarios.api.ApiException;
import br.com.inko.usuarios.api.LimiteExcedidoException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

class LoginRateLimiterTest {
    private static final Duration JANELA = Duration.ofMinutes(15);

    static class ContadorEncoder implements PasswordEncoder {
        final PasswordEncoder delegado = new BCryptPasswordEncoder(4);
        final AtomicInteger verificacoes = new AtomicInteger();

        @Override
        public String encode(CharSequence senha) {
            return delegado.encode(senha);
        }

        @Override
        public boolean matches(CharSequence senha, String hash) {
            verificacoes.incrementAndGet();
            return delegado.matches(senha, hash);
        }
    }

    private final AuthServiceTest.RelogioAjustavel relogio =
            new AuthServiceTest.RelogioAjustavel(Instant.parse("2026-11-17T12:00:00Z"));

    @Test
    void tentativasSimultaneasNaoUltrapassamLimiteDoEmail() throws Exception {
        ContadorEncoder encoder = new ContadorEncoder();
        AuthServiceTest.MemoriaOperadorRepository repository = new AuthServiceTest.MemoriaOperadorRepository();
        repository.inserir(new Operador(UUID.randomUUID(), "alvo@inko.test", "Alvo", encoder.encode("senha-correta-123"),
                Papel.BIBLIOTECARIO, true), relogio.instant());
        AuthService service = new AuthService(repository, encoder, new LoginRateLimiter(relogio, 5, 20, JANELA),
                relogio, Duration.ofHours(8));
        int threads = 16;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch largada = new CountDownLatch(1);
        List<Future<HttpStatus>> resultados = new ArrayList<>();
        try {
            for (int indice = 0; indice < threads; indice++) {
                String ip = "10.0.1." + indice;
                resultados.add(executor.submit(() -> {
                    largada.await();
                    return assertThrows(ApiException.class,
                            () -> service.login("alvo@inko.test", "senha-errada-xyz", ip)).status();
                }));
            }
            largada.countDown();
            int naoAutorizados = 0;
            int bloqueados = 0;
            for (Future<HttpStatus> resultado : resultados) {
                HttpStatus status = resultado.get(30, TimeUnit.SECONDS);
                if (status == HttpStatus.UNAUTHORIZED) {
                    naoAutorizados++;
                } else if (status == HttpStatus.TOO_MANY_REQUESTS) {
                    bloqueados++;
                }
            }
            assertEquals(5, naoAutorizados);
            assertEquals(threads - 5, bloqueados);
            assertEquals(5, encoder.verificacoes.get());
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void sucessoDevolveReservaDoIpELimpaEmail() {
        LoginRateLimiter limiter = new LoginRateLimiter(relogio, 2, 2, JANELA);
        limiter.reservar("a@inko.test", "ip-1");
        limiter.confirmarSucesso(limiter.reservar("a@inko.test", "ip-1"));
        limiter.reservar("a@inko.test", "ip-1");

        assertEquals(HttpStatus.TOO_MANY_REQUESTS,
                assertThrows(LimiteExcedidoException.class, () -> limiter.reservar("b@inko.test", "ip-1")).status());
        limiter.reservar("a@inko.test", "ip-2");
    }

    @Test
    void mapaCheioDespejaIpsAntesDeEmails() {
        LoginRateLimiter limiter = new LoginRateLimiter(relogio, 2, 20, JANELA, 4);
        limiter.reservar("a@inko.test", "ip-1");
        limiter.reservar("b@inko.test", "ip-2");
        limiter.reservar("c@inko.test", "ip-3");
        assertEquals(4, limiter.quantidadeChaves());

        limiter.reservar("a@inko.test", "ip-3");
        assertEquals(4, limiter.quantidadeChaves());
        assertEquals(HttpStatus.TOO_MANY_REQUESTS,
                assertThrows(LimiteExcedidoException.class, () -> limiter.reservar("a@inko.test", "ip-3")).status());
    }

    @Test
    void inundacaoNaoZeraContadorDoEmailAlvo() {
        LoginRateLimiter limiter = new LoginRateLimiter(relogio, 5, 100, JANELA, 4);
        for (int indice = 0; indice < 4; indice++) {
            limiter.reservar("alvo@inko.test", "ip-a");
        }

        int recusadas = 0;
        for (int indice = 0; indice < 50; indice++) {
            try {
                limiter.reservar("forjado" + indice + "@inko.test", "ip-f" + indice);
            } catch (LimiteExcedidoException cheio) {
                recusadas++;
            }
            assertTrue(limiter.quantidadeChaves() <= 4);
        }
        assertTrue(recusadas > 0);

        limiter.reservar("alvo@inko.test", "ip-x");
        LimiteExcedidoException bloqueado = assertThrows(LimiteExcedidoException.class,
                () -> limiter.reservar("alvo@inko.test", "ip-y"));
        assertEquals("TOO_MANY_ATTEMPTS", bloqueado.code());
        assertEquals(JANELA.toSeconds(), bloqueado.retryAfterSegundos());
    }

    @Test
    void chaveBloqueadaSobreviveAInundacao() {
        LoginRateLimiter limiter = new LoginRateLimiter(relogio, 2, 100, JANELA, 6);
        limiter.reservar("vitima@inko.test", "ip-v");
        limiter.reservar("vitima@inko.test", "ip-v");
        relogio.avancar(Duration.ofMinutes(1));

        for (int indice = 0; indice < 200; indice++) {
            try {
                limiter.reservar("forjado" + indice + "@inko.test", "ip-f" + indice);
            } catch (LimiteExcedidoException cheio) {
                assertEquals("TOO_MANY_ATTEMPTS", cheio.code());
            }
            assertTrue(limiter.quantidadeChaves() <= 6);
        }

        LimiteExcedidoException bloqueado = assertThrows(LimiteExcedidoException.class,
                () -> limiter.reservar("vitima@inko.test", "ip-novo"));
        assertEquals(Duration.ofMinutes(14).toSeconds(), bloqueado.retryAfterSegundos());
    }

    @Test
    void loginLegitimoNaoSofre429PorRotacaoDeIps() {
        AuthServiceTest.MemoriaOperadorRepository repository = new AuthServiceTest.MemoriaOperadorRepository();
        PasswordEncoder encoder = new BCryptPasswordEncoder(4);
        repository.inserir(new Operador(UUID.randomUUID(), "legitimo@inko.test", "Legitimo",
                encoder.encode("senha-correta-123"), Papel.BIBLIOTECARIO, true), relogio.instant());
        LoginRateLimiter limiter = new LoginRateLimiter(relogio, 500, 20, JANELA, 8);
        AuthService service = new AuthService(repository, encoder, limiter, relogio, Duration.ofHours(8));

        for (int indice = 0; indice < 50; indice++) {
            String ip = "198.51.100." + indice;
            assertEquals(HttpStatus.UNAUTHORIZED,
                    assertThrows(ApiException.class, () -> service.login("forjado@inko.test", "senha-errada-xyz", ip))
                            .status());
        }

        assertEquals("legitimo@inko.test", service.login("legitimo@inko.test", "senha-correta-123", "203.0.113.7")
                .operador().email());
        assertTrue(limiter.quantidadeChaves() <= 8);
    }

    @Test
    void semChaveDescartavelRecusaChaveNovaAteAJanelaExpirar() {
        LoginRateLimiter limiter = new LoginRateLimiter(relogio, 1, 1, JANELA, 2);
        limiter.reservar("a@inko.test", "ip-1");

        LimiteExcedidoException cheio = assertThrows(LimiteExcedidoException.class,
                () -> limiter.reservar("b@inko.test", "ip-2"));
        assertEquals("TOO_MANY_ATTEMPTS", cheio.code());
        assertEquals(JANELA.toSeconds(), cheio.retryAfterSegundos());
        assertTrue(limiter.quantidadeChaves() <= 2);

        relogio.avancar(JANELA);
        limiter.reservar("b@inko.test", "ip-2");
    }
}
