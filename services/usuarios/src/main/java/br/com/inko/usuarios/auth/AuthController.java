package br.com.inko.usuarios.auth;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private static final String FORWARDED_FOR = "X-Forwarded-For";

    private final AuthService service;

    public AuthController(AuthService service) {
        this.service = service;
    }

    public record LoginRequest(String email, String senha) {
        @Override
        public String toString() {
            return "LoginRequest[]";
        }
    }

    public record OperadorResponse(UUID id, String nome, String email, String papel) {
        static OperadorResponse de(Operador operador) {
            return new OperadorResponse(operador.id(), operador.nome(), operador.email(), operador.papel().name());
        }
    }

    public record LoginResponse(String token, Instant expiraEm, OperadorResponse operador) {
        @Override
        public String toString() {
            return "LoginResponse[expiraEm=" + expiraEm + "]";
        }
    }

    public record SessaoResponse(UUID id, String nome, String email, String papel, Instant expiraEm) {
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest dados,
            @RequestHeader(value = FORWARDED_FOR, required = false) String forwardedFor, HttpServletRequest request) {
        String ip = IpCliente.resolver(forwardedFor, request.getRemoteAddr());
        AuthService.LoginResultado resultado = service.login(dados.email(), dados.senha(), ip);
        LoginResponse corpo = new LoginResponse(resultado.token(), resultado.expiraEm(),
                OperadorResponse.de(resultado.operador()));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(corpo);
    }

    @GetMapping("/session")
    public ResponseEntity<SessaoResponse> sessao(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        String token = TokenSessao.extrairBearer(authorization).orElseThrow(AuthService::naoAutenticado);
        SessaoAutenticada sessao = service.sessao(token);
        Operador operador = sessao.operador();
        SessaoResponse corpo = new SessaoResponse(operador.id(), operador.nome(), operador.email(),
                operador.papel().name(), sessao.expiraEm());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(corpo);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        TokenSessao.extrairBearer(authorization).ifPresent(service::logout);
        return ResponseEntity.noContent().build();
    }
}
