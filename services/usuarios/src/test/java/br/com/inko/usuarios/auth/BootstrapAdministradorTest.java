package br.com.inko.usuarios.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

class BootstrapAdministradorTest {
    private static final String SENHA = "senha-bootstrap-forte";

    private final PasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private final Clock relogio = Clock.fixed(Instant.parse("2026-11-17T12:00:00Z"), ZoneOffset.UTC);
    private final AuthServiceTest.MemoriaOperadorRepository repository = new AuthServiceTest.MemoriaOperadorRepository();

    private BootstrapAdministrador bootstrap(String email, String senha, String nome) {
        return new BootstrapAdministrador(repository, encoder, relogio, email, senha, nome);
    }

    @Test
    void criaAdministradorUmaVezComHash() {
        assertEquals(BootstrapAdministrador.Resultado.CRIADO, bootstrap(" Admin@INKO.test ", SENHA, "").executar());
        assertEquals(BootstrapAdministrador.Resultado.EXISTENTE, bootstrap("admin@inko.test", "outra-senha-forte-x", null).executar());

        Operador admin = repository.buscarPorEmail("admin@inko.test").orElseThrow();
        assertEquals(1, repository.operadores.size());
        assertEquals(Papel.ADMIN, admin.papel());
        assertEquals("Administrador INKO", admin.nome());
        assertTrue(admin.ativo());
        assertNotEquals(SENHA, admin.senhaHash());
        assertTrue(encoder.matches(SENHA, admin.senhaHash()));
    }

    @Test
    void semVariaveisNaoCriaNada() {
        assertEquals(BootstrapAdministrador.Resultado.NAO_CONFIGURADO, bootstrap("", "", null).executar());
        assertTrue(repository.operadores.isEmpty());
    }

    @Test
    void rejeitaConfiguracaoIncompletaOuFraca() {
        IllegalStateException fraca = assertThrows(IllegalStateException.class,
                () -> bootstrap("admin@inko.test", "curta-11ch", null).executar());
        assertTrue(fraca.getMessage().contains("12 caracteres"));
        assertFalse(fraca.getMessage().contains("curta-11ch"));

        assertThrows(IllegalStateException.class, () -> bootstrap("admin@inko.test", "", null).executar());
        assertThrows(IllegalStateException.class, () -> bootstrap("", SENHA, null).executar());
        assertThrows(IllegalStateException.class, () -> bootstrap("nao-e-email", SENHA, null).executar());
        assertThrows(IllegalStateException.class, () -> bootstrap("admin@inko.test", "x".repeat(73), null).executar());
        assertTrue(repository.operadores.isEmpty());
    }
}
