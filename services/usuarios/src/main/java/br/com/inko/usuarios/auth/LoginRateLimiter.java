package br.com.inko.usuarios.auth;

import br.com.inko.usuarios.api.LimiteExcedidoException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

public class LoginRateLimiter {
    static final int LIMITE_CHAVES_PADRAO = 100_000;
    private static final String PREFIXO_EMAIL = "email:";
    private static final String PREFIXO_IP = "ip:";
    private static final String CODIGO = "TOO_MANY_ATTEMPTS";
    private static final String MENSAGEM = "Muitas tentativas de login. Aguarde antes de tentar novamente.";

    public record Reserva(String email, String ip, Instant instante) {
    }

    private final Clock clock;
    private final int maxFalhasEmail;
    private final int maxFalhasIp;
    private final Duration janela;
    private final int limiteChaves;
    private final Map<String, Deque<Instant>> tentativas = new LinkedHashMap<>();

    public LoginRateLimiter(Clock clock, int maxFalhasEmail, int maxFalhasIp, Duration janela) {
        this(clock, maxFalhasEmail, maxFalhasIp, janela, LIMITE_CHAVES_PADRAO);
    }

    public LoginRateLimiter(Clock clock, int maxFalhasEmail, int maxFalhasIp, Duration janela, int limiteChaves) {
        if (maxFalhasEmail < 1 || maxFalhasIp < 1 || limiteChaves < 2 || janela.isNegative() || janela.isZero()) {
            throw new IllegalArgumentException("Limites de tentativas de login inválidos.");
        }
        this.clock = clock;
        this.maxFalhasEmail = maxFalhasEmail;
        this.maxFalhasIp = maxFalhasIp;
        this.janela = janela;
        this.limiteChaves = limiteChaves;
    }

    public synchronized Reserva reservar(String email, String ip) {
        Instant agora = clock.instant();
        String chaveEmail = PREFIXO_EMAIL + email;
        String chaveIp = PREFIXO_IP + ip;
        Duration porEmail = bloqueio(chaveEmail, maxFalhasEmail, agora).orElse(Duration.ZERO);
        Duration porIp = bloqueio(chaveIp, maxFalhasIp, agora).orElse(Duration.ZERO);
        Duration espera = porEmail.compareTo(porIp) >= 0 ? porEmail : porIp;
        if (espera.isPositive()) {
            throw new LimiteExcedidoException(CODIGO, MENSAGEM, espera);
        }
        garantirCapacidade(chaveEmail, chaveIp, agora);
        registrar(chaveEmail, maxFalhasEmail, agora);
        registrar(chaveIp, maxFalhasIp, agora);
        return new Reserva(email, ip, agora);
    }

    public synchronized void confirmarSucesso(Reserva reserva) {
        tentativas.remove(PREFIXO_EMAIL + reserva.email());
        String chaveIp = PREFIXO_IP + reserva.ip();
        Deque<Instant> registros = tentativas.get(chaveIp);
        if (registros != null) {
            registros.removeLastOccurrence(reserva.instante());
            if (registros.isEmpty()) {
                tentativas.remove(chaveIp);
            }
        }
    }

    synchronized int quantidadeChaves() {
        return tentativas.size();
    }

    private void garantirCapacidade(String chaveEmail, String chaveIp, Instant agora) {
        int novas = (tentativas.containsKey(chaveEmail) ? 0 : 1) + (tentativas.containsKey(chaveIp) ? 0 : 1);
        Iterator<Map.Entry<String, Deque<Instant>>> entradas = tentativas.entrySet().iterator();
        while (tentativas.size() + novas > limiteChaves && entradas.hasNext()) {
            Map.Entry<String, Deque<Instant>> entrada = entradas.next();
            String chave = entrada.getKey();
            if (chave.equals(chaveEmail) || chave.equals(chaveIp)) {
                continue;
            }
            if (chave.startsWith(PREFIXO_IP) || descartarExpiradas(entrada.getValue(), agora).isEmpty()) {
                entradas.remove();
            }
        }
        if (tentativas.size() + novas > limiteChaves) {
            throw new LimiteExcedidoException(CODIGO, MENSAGEM, janela);
        }
    }

    private void registrar(String chave, int maximo, Instant agora) {
        Deque<Instant> registros = tentativas.remove(chave);
        if (registros == null) {
            registros = new ArrayDeque<>();
        }
        descartarExpiradas(registros, agora).addLast(agora);
        while (registros.size() > maximo) {
            registros.removeFirst();
        }
        tentativas.put(chave, registros);
    }

    private Optional<Duration> bloqueio(String chave, int maximo, Instant agora) {
        Deque<Instant> registros = tentativas.get(chave);
        if (registros == null) {
            return Optional.empty();
        }
        if (descartarExpiradas(registros, agora).isEmpty()) {
            tentativas.remove(chave);
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
