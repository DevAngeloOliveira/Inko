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
    static final int MAX_VARREDURA = 256;
    private static final String CODIGO = "TOO_MANY_ATTEMPTS";
    private static final String MENSAGEM = "Muitas tentativas de login. Aguarde antes de tentar novamente.";

    public record Reserva(String email, String ip, Instant instante) {
    }

    private final Clock clock;
    private final int maxFalhasEmail;
    private final int maxFalhasIp;
    private final Duration janela;
    private final int limiteChaves;
    private final Map<String, Deque<Instant>> porEmail = new LinkedHashMap<>();
    private final Map<String, Deque<Instant>> porIp = new LinkedHashMap<>();

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
        Duration esperaEmail = bloqueio(porEmail, email, maxFalhasEmail, agora).orElse(Duration.ZERO);
        Duration esperaIp = bloqueio(porIp, ip, maxFalhasIp, agora).orElse(Duration.ZERO);
        Duration espera = esperaEmail.compareTo(esperaIp) >= 0 ? esperaEmail : esperaIp;
        if (espera.isPositive()) {
            throw new LimiteExcedidoException(CODIGO, MENSAGEM, espera);
        }
        garantirCapacidade(email, ip, agora);
        registrar(porEmail, email, maxFalhasEmail, agora);
        registrar(porIp, ip, maxFalhasIp, agora);
        return new Reserva(email, ip, agora);
    }

    public synchronized void confirmarSucesso(Reserva reserva) {
        porEmail.remove(reserva.email());
        Deque<Instant> registros = porIp.get(reserva.ip());
        if (registros != null) {
            registros.removeLastOccurrence(reserva.instante());
            if (registros.isEmpty()) {
                porIp.remove(reserva.ip());
            }
        }
    }

    synchronized int quantidadeChaves() {
        return porEmail.size() + porIp.size();
    }

    private void garantirCapacidade(String email, String ip, Instant agora) {
        int novas = (porEmail.containsKey(email) ? 0 : 1) + (porIp.containsKey(ip) ? 0 : 1);
        int orcamento = despejar(porIp, ip, maxFalhasIp, novas, agora, MAX_VARREDURA);
        despejar(porEmail, email, 1, novas, agora, orcamento);
        if (quantidadeChaves() + novas > limiteChaves) {
            throw new LimiteExcedidoException(CODIGO, MENSAGEM, janela);
        }
    }

    private int despejar(Map<String, Deque<Instant>> mapa, String preservada, int vivasPermitidas, int novas,
            Instant agora, int orcamento) {
        Iterator<Map.Entry<String, Deque<Instant>>> entradas = mapa.entrySet().iterator();
        while (quantidadeChaves() + novas > limiteChaves && entradas.hasNext() && orcamento > 0) {
            orcamento--;
            Map.Entry<String, Deque<Instant>> entrada = entradas.next();
            if (!entrada.getKey().equals(preservada)
                    && descartarExpiradas(entrada.getValue(), agora).size() < vivasPermitidas) {
                entradas.remove();
            }
        }
        return orcamento;
    }

    private void registrar(Map<String, Deque<Instant>> mapa, String chave, int maximo, Instant agora) {
        Deque<Instant> registros = mapa.remove(chave);
        if (registros == null) {
            registros = new ArrayDeque<>();
        }
        descartarExpiradas(registros, agora).addLast(agora);
        while (registros.size() > maximo) {
            registros.removeFirst();
        }
        mapa.put(chave, registros);
    }

    private Optional<Duration> bloqueio(Map<String, Deque<Instant>> mapa, String chave, int maximo, Instant agora) {
        Deque<Instant> registros = mapa.get(chave);
        if (registros == null) {
            return Optional.empty();
        }
        if (descartarExpiradas(registros, agora).isEmpty()) {
            mapa.remove(chave);
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
