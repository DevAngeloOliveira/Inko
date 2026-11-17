package br.com.inko.usuarios.usuario;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import br.com.inko.usuarios.api.ApiException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class UsuarioTest {
    static class MemoriaUsuarioRepository implements UsuarioRepository {
        final List<Usuario> usuarios = new ArrayList<>();

        @Override
        public Usuario inserir(Usuario usuario) {
            Usuario salvo = usuario.comIdentificador("USR-%04d".formatted(1000 + usuarios.size()), LocalDate.of(2026, 11, 9));
            usuarios.add(salvo);
            return salvo;
        }

        @Override
        public Optional<Usuario> buscar(String id) {
            return usuarios.stream().filter(usuario -> usuario.id().equals(id)).findFirst();
        }

        @Override
        public List<Usuario> listar() {
            return List.copyOf(usuarios);
        }

        @Override
        public boolean existeMatricula(String matricula) {
            return usuarios.stream().anyMatch(usuario -> usuario.matricula().equals(matricula));
        }

        @Override
        public boolean existeEmail(String email) {
            return usuarios.stream().anyMatch(usuario -> email.equals(usuario.email()));
        }
    }

    private static Usuario novo(String nome, String matricula, String email) {
        return new Usuario(null, nome, matricula, email, null);
    }

    @Test
    void usuarioValidoNormalizaCampos() {
        Usuario usuario = novo("  Lia   Sato ", " 2025203 ", " LIA.SATO@Exemplo.com ");
        assertEquals("Lia Sato", usuario.nome());
        assertEquals("2025203", usuario.matricula());
        assertEquals("lia.sato@exemplo.com", usuario.email());
        assertNull(novo("Davi Nogueira", "2025110", "").email());
    }

    @Test
    void usuarioInvalidoInformaCampo() {
        assertEquals("nome", assertThrows(ApiException.class, () -> novo("Al", "2025203", null)).field());
        assertEquals("matricula", assertThrows(ApiException.class, () -> novo("Lia Sato", " ", null)).field());
        assertEquals("matricula", assertThrows(ApiException.class, () -> novo("Lia Sato", "20 25", null)).field());
        assertEquals("email", assertThrows(ApiException.class, () -> novo("Lia Sato", "2025203", "lia@")).field());
    }

    @Test
    void cadastroGeraIdentificadorERecusaMatriculaDuplicada() {
        UsuarioService service = new UsuarioService(new MemoriaUsuarioRepository());
        Usuario criado = service.cadastrar(novo("Lia Sato", "2025203", "lia.sato@exemplo.com"));
        assertEquals("USR-1000", criado.id());

        ApiException matricula = assertThrows(ApiException.class, () -> service.cadastrar(novo("Outra Pessoa", "2025203", null)));
        assertEquals(HttpStatus.CONFLICT, matricula.status());
        assertEquals("matricula", matricula.field());

        ApiException email = assertThrows(ApiException.class, () -> service.cadastrar(novo("Outra Pessoa", "2025999", "lia.sato@exemplo.com")));
        assertEquals("email", email.field());
    }

    @Test
    void consultaPorIdentificadorEListagem() {
        UsuarioService service = new UsuarioService(new MemoriaUsuarioRepository());
        Usuario lia = service.cadastrar(novo("Lia Sato", "2025203", null));
        service.cadastrar(novo("Rafael Moura", "2025014", null));

        assertEquals(lia, service.buscar("usr-1000"));
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ApiException.class, () -> service.buscar("USR-9999")).status());
        assertEquals(2, service.listar(null).size());
        assertEquals(List.of(lia), service.listar("sato"));
        assertEquals(List.of(lia), service.listar("2025203"));
    }
}
