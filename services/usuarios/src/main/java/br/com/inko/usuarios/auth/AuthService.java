package br.com.inko.usuarios.auth;

import br.com.inko.usuarios.api.ApiException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

public class AuthService {
    static final int MAX_BYTES_SENHA = 72;
    static final String MENSAGEM_CREDENCIAIS = "E-mail ou senha inválidos.";
    static final String MENSAGEM_SESSAO = "Sessão ausente, inválida ou expirada.";
    private static final int MAX_EMAIL = 160;

    private final OperadorRepository repository;
    private final PasswordEncoder encoder;
    private final LoginRateLimiter limiter;
    private final Clock clock;
    private final Duration ttl;
    private final String hashReferencia;

    public AuthService(OperadorRepository repository, PasswordEncoder encoder, LoginRateLimiter limiter, Clock clock,
            Duration ttl) {
        if (ttl.isNegative() || ttl.isZero()) {
            throw new IllegalArgumentException("A duração da sessão deve ser positiva.");
        }
        this.repository = repository;
        this.encoder = encoder;
        this.limiter = limiter;
        this.clock = clock;
        this.ttl = ttl;
        this.hashReferencia = encoder.encode(TokenSessao.gerar());
    }

    public record LoginResultado(String token, Instant expiraEm, Operador operador) {
        @Override
        public String toString() {
            return "LoginResultado[expiraEm=" + expiraEm + ", operador=" + operador + "]";
        }
    }

    public LoginResultado login(String email, String senha, String ip) {
        if (email == null || email.isBlank()) {
            throw ApiException.invalido("Informe o e-mail.", "email");
        }
        if (senha == null || senha.isEmpty()) {
            throw ApiException.invalido("Informe a senha.", "senha");
        }
        String normalizado = Operador.normalizarEmail(email);
        if (normalizado.length() > MAX_EMAIL) {
            throw ApiException.invalido("Informe um e-mail válido.", "email");
        }
        limiter.verificar(normalizado, ip);
        Optional<Operador> encontrado = repository.buscarPorEmail(normalizado);
        boolean senhaConfere = senhaConfere(senha, encontrado.map(Operador::senhaHash).orElse(hashReferencia));
        if (encontrado.isEmpty() || !encontrado.get().ativo() || !senhaConfere) {
            limiter.registrarFalha(normalizado, ip);
            throw credenciaisInvalidas();
        }
        limiter.limpar(normalizado);
        Operador operador = encontrado.get();
        String token = TokenSessao.gerar();
        Instant agora = clock.instant();
        Instant expiraEm = agora.plus(ttl);
        repository.criarSessao(new SessaoOperador(UUID.randomUUID(), operador.id(), TokenSessao.hash(token), agora, expiraEm));
        return new LoginResultado(token, expiraEm, operador);
    }

    public SessaoAutenticada sessao(String token) {
        if (!TokenSessao.formatoValido(token)) {
            throw naoAutenticado();
        }
        return repository.buscarSessao(TokenSessao.hash(token))
                .filter(sessao -> sessao.validaEm(clock.instant()))
                .orElseThrow(AuthService::naoAutenticado);
    }

    public void logout(String token) {
        if (TokenSessao.formatoValido(token)) {
            repository.revogarSessao(TokenSessao.hash(token), clock.instant());
        }
    }

    private boolean senhaConfere(String senha, String hash) {
        if (senha.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES_SENHA) {
            return false;
        }
        return encoder.matches(senha, hash);
    }

    static ApiException credenciaisInvalidas() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", MENSAGEM_CREDENCIAIS, null);
    }

    static ApiException naoAutenticado() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", MENSAGEM_SESSAO, null);
    }
}
