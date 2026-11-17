package br.com.inko.usuarios.usuario;

import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class JdbcUsuarioRepository implements UsuarioRepository {
    private static final RowMapper<Usuario> MAPPER = (rs, row) -> new Usuario(
            rs.getString("id"), rs.getString("nome"), rs.getString("matricula"), rs.getString("email"),
            rs.getObject("cadastrado_em", java.time.LocalDate.class));

    private final JdbcClient jdbc;

    public JdbcUsuarioRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional
    public Usuario inserir(Usuario usuario) {
        return jdbc.sql("""
                INSERT INTO usuarios (id, nome, matricula, email)
                VALUES ('USR-' || lpad(nextval('usuarios_seq')::text, 4, '0'), :nome, :matricula, :email)
                RETURNING id, nome, matricula, email, cadastrado_em
                """)
                .param("nome", usuario.nome())
                .param("matricula", usuario.matricula())
                .param("email", usuario.email())
                .query(MAPPER)
                .single();
    }

    @Override
    public Optional<Usuario> buscar(String id) {
        return jdbc.sql("SELECT * FROM usuarios WHERE id = :id").param("id", id).query(MAPPER).optional();
    }

    @Override
    public List<Usuario> listar() {
        return jdbc.sql("SELECT * FROM usuarios ORDER BY nome, id").query(MAPPER).list();
    }

    @Override
    public boolean existeMatricula(String matricula) {
        return jdbc.sql("SELECT count(*) FROM usuarios WHERE matricula = :matricula")
                .param("matricula", matricula).query(Integer.class).single() > 0;
    }

    @Override
    public boolean existeEmail(String email) {
        return jdbc.sql("SELECT count(*) FROM usuarios WHERE email = :email")
                .param("email", email).query(Integer.class).single() > 0;
    }
}
