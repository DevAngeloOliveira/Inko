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
    void tetoDeChavesFalhaFechadoSemAfetarChavesExistentes() {
        LoginRateLimiter limiter = new LoginRateLimiter(relogio, 5, 20, JANELA, 4);
        limiter.reservar("a@inko.test", "ip-1");
        limiter.reservar("b@inko.test", "ip-1");
        relogio.avancar(Duration.ofMinutes(1));

        LimiteExcedidoException cheio = assertThrows(LimiteExcedidoException.class,
                () -> limiter.reservar("c@inko.test", "ip-2"));
        assertEquals("TOO_MANY_ATTEMPTS", cheio.code());
        assertEquals(JANELA.toSeconds(), cheio.retryAfterSegundos());

        limiter.reservar("c@inko.test", "ip-1");
        LimiteExcedidoException semEspaco = assertThrows(LimiteExcedidoException.class,
                () -> limiter.reservar("d@inko.test", "ip-1"));
        assertEquals(JANELA.toSeconds(), semEspaco.retryAfterSegundos());

        limiter.reservar("a@inko.test", "ip-1");
        limiter.reservar("b@inko.test", "ip-1");

        relogio.avancar(JANELA);
        assertTrue(limiter.reservar("c@inko.test", "ip-2").instante().isAfter(Instant.parse("2026-11-17T12:00:00Z")));
    }
}
