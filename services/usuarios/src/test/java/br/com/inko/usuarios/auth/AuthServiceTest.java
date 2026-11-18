package br.com.inko.usuarios.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import br.com.inko.usuarios.api.ApiException;
import br.com.inko.usuarios.api.ApiExceptionHandler;
import br.com.inko.usuarios.api.LimiteExcedidoException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

class AuthServiceTest {
    private static final String EMAIL = "admin@inko.test";
    private static final String SENHA = "senha-de-teste-forte";
    private static final String IP = "10.0.0.1";

    static class RelogioAjustavel extends Clock {
        private Instant agora;

        RelogioAjustavel(Instant agora) {
            this.agora = agora;
        }

        void avancar(Duration duracao) {
            agora = agora.plus(duracao);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return agora;
        }
    }

    static class MemoriaOperadorRepository implements OperadorRepository {
        final Map<String, Operador> operadores = new HashMap<>();
        final List<SessaoOperador> sessoes = new ArrayList<>();
        final Map<String, Instant> revogacoes = new HashMap<>();

        @Override
        public Optional<Operador> buscarPorEmail(String email) {
            return Optional.ofNullable(operadores.get(email));
        }

        @Override
        public boolean existeEmail(String email) {
            return operadores.containsKey(email);
        }

        @Override
        public void inserir(Operador operador, Instant criadoEm) {
            operadores.put(operador.email(), operador);
        }

        @Override
        public void criarSessao(SessaoOperador sessao) {
            sessoes.add(sessao);
        }

        @Override
        public Optional<SessaoAutenticada> buscarSessao(String tokenHash) {
            return sessoes.stream()
                    .filter(sessao -> sessao.tokenHash().equals(tokenHash))
                    .findFirst()
                    .flatMap(sessao -> operadores.values().stream()
                            .filter(operador -> operador.id().equals(sessao.operadorId()))
                            .findFirst()
                            .map(operador -> new SessaoAutenticada(operador, sessao.expiraEm(), revogacoes.get(tokenHash))));
        }

        @Override
        public void revogarSessao(String tokenHash, Instant revogadoEm) {
            if (sessoes.stream().anyMatch(sessao -> sessao.tokenHash().equals(tokenHash))) {
                revogacoes.putIfAbsent(tokenHash, revogadoEm);
            }
        }
    }

    private final PasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private RelogioAjustavel relogio;
    private MemoriaOperadorRepository repository;
    private AuthService service;

    @BeforeEach
    void preparar() {
        relogio = new RelogioAjustavel(Instant.parse("2026-11-17T12:00:00Z"));
        repository = new MemoriaOperadorRepository();
        service = new AuthService(repository, encoder, new LoginRateLimiter(relogio, 5, 20, Duration.ofMinutes(15)),
                relogio, Duration.ofHours(8));
        cadastrar(EMAIL, SENHA, true);
    }

    private Operador cadastrar(String email, String senha, boolean ativo) {
        Operador operador = new Operador(UUID.randomUUID(), email, "Operadora Teste", encoder.encode(senha),
                Papel.BIBLIOTECARIO, ativo);
        repository.inserir(operador, relogio.instant());
        return operador;
    }

    private ApiException falhaLogin(String email, String senha, String ip) {
        return assertThrows(ApiException.class, () -> service.login(email, senha, ip));
    }

    @Test
    void senhaArmazenadaComoHashBcrypt() {
        String hash = repository.buscarPorEmail(EMAIL).orElseThrow().senhaHash();
        assertNotEquals(SENHA, hash);
        assertTrue(hash.startsWith("$2"));
        assertTrue(encoder.matches(SENHA, hash));
        assertFalse(encoder.matches("outra-senha-qualquer", hash));
    }

    @Test
    void loginValidoCriaSessaoComHashDoToken() {
        AuthService.LoginResultado resultado = service.login("  Admin@INKO.test ", SENHA, IP);

        assertEquals(43, resultado.token().length());
        assertTrue(TokenSessao.formatoValido(resultado.token()));
        assertEquals(Instant.parse("2026-11-17T20:00:00Z"), resultado.expiraEm());
        assertEquals(EMAIL, resultado.operador().email());
        assertEquals(1, repository.sessoes.size());
        String armazenado = repository.sessoes.get(0).tokenHash();
        assertTrue(armazenado.matches("[0-9a-f]{64}"));
        assertNotEquals(resultado.token(), armazenado);
        assertEquals(TokenSessao.hash(resultado.token()), armazenado);
        assertFalse(resultado.toString().contains(resultado.token()));
    }

    @Test
    void credenciaisInvalidasDevolvem401Generico() {
        cadastrar("inativo@inko.test", SENHA, false);

        ApiException senhaErrada = falhaLogin(EMAIL, "senha-incorreta-aqui", IP);
        ApiException inexistente = falhaLogin("ninguem@inko.test", SENHA, IP);
        ApiException inativo = falhaLogin("inativo@inko.test", SENHA, IP);

        for (ApiException erro : List.of(senhaErrada, inexistente, inativo)) {
            assertEquals(HttpStatus.UNAUTHORIZED, erro.status());
            assertEquals("INVALID_CREDENTIALS", erro.code());
            assertEquals(AuthService.MENSAGEM_CREDENCIAIS, erro.getMessage());
            assertNull(erro.field());
        }
        assertTrue(repository.sessoes.isEmpty());
    }

    @Test
    void senhaAcimaDe72BytesNaoAutentica() {
        assertEquals("INVALID_CREDENTIALS", falhaLogin(EMAIL, "x".repeat(80), IP).code());
    }

    @Test
    void corpoInvalidoDevolve422() {
        assertEquals("email", falhaLogin(" ", SENHA, IP).field());
        assertEquals("senha", falhaLogin(EMAIL, null, IP).field());
        assertEquals(HttpStatus.UNPROCESSABLE_CONTENT, falhaLogin(null, SENHA, IP).status());
    }

    @Test
    void sessaoValidaAteExpirar() {
        String token = service.login(EMAIL, SENHA, IP).token();

        SessaoAutenticada sessao = service.sessao(token);
        assertEquals(EMAIL, sessao.operador().email());
        assertEquals(Instant.parse("2026-11-17T20:00:00Z"), sessao.expiraEm());

        relogio.avancar(Duration.ofHours(8));
        ApiException expirada = assertThrows(ApiException.class, () -> service.sessao(token));
        assertEquals(HttpStatus.UNAUTHORIZED, expirada.status());
        assertEquals("UNAUTHENTICATED", expirada.code());
    }

    @Test
    void tokenDesconhecidoOuMalformadoDevolve401() {
        assertEquals("UNAUTHENTICATED", assertThrows(ApiException.class, () -> service.sessao(TokenSessao.gerar())).code());
        assertEquals("UNAUTHENTICATED", assertThrows(ApiException.class, () -> service.sessao("curto")).code());
        assertEquals("UNAUTHENTICATED", assertThrows(ApiException.class, () -> service.sessao(null)).code());
    }

    @Test
    void operadorDesativadoPerdeSessao() {
        String token = service.login(EMAIL, SENHA, IP).token();
        Operador ativo = repository.buscarPorEmail(EMAIL).orElseThrow();
        repository.inserir(new Operador(ativo.id(), ativo.email(), ativo.nome(), ativo.senhaHash(), ativo.papel(), false),
                relogio.instant());

        assertEquals("UNAUTHENTICATED", assertThrows(ApiException.class, () -> service.sessao(token)).code());
    }

    @Test
    void logoutRevogaSessaoEReplayFalha() {
        String token = service.login(EMAIL, SENHA, IP).token();
        relogio.avancar(Duration.ofMinutes(5));

        service.logout(token);

        assertEquals(Instant.parse("2026-11-17T12:05:00Z"), repository.revogacoes.get(TokenSessao.hash(token)));
        assertEquals("UNAUTHENTICATED", assertThrows(ApiException.class, () -> service.sessao(token)).code());
    }

    @Test
    void logoutIdempotente() {
        String token = service.login(EMAIL, SENHA, IP).token();
        service.logout(token);
        relogio.avancar(Duration.ofMinutes(1));
        service.logout(token);
        service.logout(TokenSessao.gerar());
        service.logout("invalido");

        assertEquals(Instant.parse("2026-11-17T12:00:00Z"), repository.revogacoes.get(TokenSessao.hash(token)));
        assertEquals(1, repository.revogacoes.size());
    }

    @Test
    void limitePorEmailDevolve429ComRetryAfter() {
        for (int tentativa = 0; tentativa < 5; tentativa++) {
            assertEquals(HttpStatus.UNAUTHORIZED, falhaLogin(EMAIL, "senha-incorreta-aqui", IP).status());
        }
        relogio.avancar(Duration.ofMinutes(5));

        ApiException bloqueado = falhaLogin(EMAIL.toUpperCase(), SENHA, "10.0.0.2");
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, bloqueado.status());
        assertEquals("TOO_MANY_ATTEMPTS", bloqueado.code());
        assertEquals(600, ((LimiteExcedidoException) bloqueado).retryAfterSegundos());
        assertEquals("600", new ApiExceptionHandler().limite((LimiteExcedidoException) bloqueado)
                .getHeaders().getFirst(HttpHeaders.RETRY_AFTER));
        assertTrue(repository.sessoes.isEmpty());

        relogio.avancar(Duration.ofMinutes(10));
        assertEquals(EMAIL, service.login(EMAIL, SENHA, IP).operador().email());
    }

    @Test
    void sucessoLimpaContadorDoEmail() {
        for (int tentativa = 0; tentativa < 4; tentativa++) {
            falhaLogin(EMAIL, "senha-incorreta-aqui", IP);
        }
        service.login(EMAIL, SENHA, IP);
        for (int tentativa = 0; tentativa < 4; tentativa++) {
            assertEquals(HttpStatus.UNAUTHORIZED, falhaLogin(EMAIL, "senha-incorreta-aqui", "10.0.0.9").status());
        }
        assertEquals(EMAIL, service.login(EMAIL, SENHA, "10.0.0.9").operador().email());
    }

    @Test
    void limitePorIpBloqueiaEmailsDistintos() {
        for (int tentativa = 0; tentativa < 20; tentativa++) {
            assertEquals(HttpStatus.UNAUTHORIZED, falhaLogin("alvo" + tentativa + "@inko.test", SENHA, IP).status());
        }
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, falhaLogin(EMAIL, SENHA, IP).status());
        assertEquals(EMAIL, service.login(EMAIL, SENHA, "10.0.0.3").operador().email());
    }

    @Test
    void ipResolvidoPeloUltimoValorDoForwardedFor() {
        assertEquals("203.0.113.9", IpCliente.resolver("198.51.100.1, 203.0.113.9", "127.0.0.1"));
        assertEquals("203.0.113.9", IpCliente.resolver(" 203.0.113.9 ", "127.0.0.1"));
        assertEquals("127.0.0.1", IpCliente.resolver(null, "127.0.0.1"));
        assertEquals("127.0.0.1", IpCliente.resolver("  ", "127.0.0.1"));
    }

    @Test
    void bearerExtraidoSomenteComFormatoValido() {
        String token = TokenSessao.gerar();
        assertEquals(Optional.of(token), TokenSessao.extrairBearer("Bearer " + token));
        assertEquals(Optional.of(token), TokenSessao.extrairBearer("bearer " + token));
        assertTrue(TokenSessao.extrairBearer(null).isEmpty());
        assertTrue(TokenSessao.extrairBearer("Basic " + token).isEmpty());
        assertTrue(TokenSessao.extrairBearer("Bearer abc").isEmpty());
        assertNotEquals(TokenSessao.gerar(), TokenSessao.gerar());
    }
}
