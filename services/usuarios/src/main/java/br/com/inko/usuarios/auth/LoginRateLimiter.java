package br.com.inko.usuarios.auth;

import br.com.inko.usuarios.api.LimiteExcedidoException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

public class LoginRateLimiter {
    private static final int LIMITE_CHAVES = 10_000;
    private static final String PREFIXO_EMAIL = "email:";
    private static final String PREFIXO_IP = "ip:";

    private final Clock clock;
    private final int maxFalhasEmail;
    private final int maxFalhasIp;
    private final Duration janela;
    private final Map<String, Deque<Instant>> falhas = new HashMap<>();

    public LoginRateLimiter(Clock clock, int maxFalhasEmail, int maxFalhasIp, Duration janela) {
        if (maxFalhasEmail < 1 || maxFalhasIp < 1 || janela.isNegative() || janela.isZero()) {
            throw new IllegalArgumentException("Limites de tentativas de login inválidos.");
        }
        this.clock = clock;
        this.maxFalhasEmail = maxFalhasEmail;
        this.maxFalhasIp = maxFalhasIp;
        this.janela = janela;
    }

    public synchronized void verificar(String email, String ip) {
        Instant agora = clock.instant();
        Duration porEmail = bloqueio(PREFIXO_EMAIL + email, maxFalhasEmail, agora).orElse(Duration.ZERO);
        Duration porIp = bloqueio(PREFIXO_IP + ip, maxFalhasIp, agora).orElse(Duration.ZERO);
        Duration espera = porEmail.compareTo(porIp) >= 0 ? porEmail : porIp;
        if (espera.isPositive()) {
            throw new LimiteExcedidoException("TOO_MANY_ATTEMPTS",
                    "Muitas tentativas de login. Aguarde antes de tentar novamente.", espera);
        }
    }

    public synchronized void registrarFalha(String email, String ip) {
        Instant agora = clock.instant();
        if (falhas.size() >= LIMITE_CHAVES) {
            falhas.values().removeIf(registros -> descartarExpiradas(registros, agora).isEmpty());
        }
        registrar(PREFIXO_EMAIL + email, maxFalhasEmail, agora);
        registrar(PREFIXO_IP + ip, maxFalhasIp, agora);
    }

    public synchronized void limpar(String email) {
        falhas.remove(PREFIXO_EMAIL + email);
    }

    private void registrar(String chave, int maximo, Instant agora) {
        Deque<Instant> registros = falhas.computeIfAbsent(chave, ignorada -> new ArrayDeque<>());
        descartarExpiradas(registros, agora).addLast(agora);
        while (registros.size() > maximo) {
            registros.removeFirst();
        }
    }

    private Optional<Duration> bloqueio(String chave, int maximo, Instant agora) {
        Deque<Instant> registros = falhas.get(chave);
        if (registros == null) {
            return Optional.empty();
        }
        if (descartarExpiradas(registros, agora).isEmpty()) {
            falhas.remove(chave);
            return Optional.empty();
        }
        if (registros.size() < maximo) {
            return Optional.empty();
        }
        return Optional.of(Duration.between(agora, registros.getFirst().plus(janela)));
    }

    private Deque<Instant> descartarExpiradas(Deque<Instant> registros, Instant agora) {
        Instant limite = agora.minus(janela);
        while (!registros.isEmpty() && !registros.getFirst().isAfter(limite)) {
            registros.removeFirst();
        }
        return registros;
    }
}
