package br.com.inko.usuarios.auth;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcOperadorRepository implements OperadorRepository {
    private static final RowMapper<Operador> OPERADOR = (rs, row) -> new Operador(
            rs.getObject("id", UUID.class), rs.getString("email"), rs.getString("nome"),
            rs.getString("senha_hash"), Papel.valueOf(rs.getString("papel")), rs.getBoolean("ativo"));

    private static final RowMapper<SessaoAutenticada> SESSAO = (rs, row) -> new SessaoAutenticada(
            OPERADOR.mapRow(rs, row),
            instante(rs.getObject("expira_em", OffsetDateTime.class)),
            instante(rs.getObject("revogado_em", OffsetDateTime.class)));

    private final JdbcClient jdbc;

    public JdbcOperadorRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Optional<Operador> buscarPorEmail(String email) {
        return jdbc.sql("SELECT id, email, nome, senha_hash, papel, ativo FROM operadores WHERE email = :email")
                .param("email", email)
                .query(OPERADOR)
                .optional();
    }

    @Override
    public boolean existeEmail(String email) {
        return jdbc.sql("SELECT count(*) FROM operadores WHERE email = :email")
                .param("email", email).query(Integer.class).single() > 0;
    }

    @Override
    public void inserir(Operador operador, Instant criadoEm) {
        jdbc.sql("""
                INSERT INTO operadores (id, email, nome, senha_hash, papel, ativo, criado_em)
                VALUES (:id, :email, :nome, :senhaHash, :papel, :ativo, :criadoEm)
                """)
                .param("id", operador.id())
                .param("email", operador.email())
                .param("nome", operador.nome())
                .param("senhaHash", operador.senhaHash())
                .param("papel", operador.papel().name())
                .param("ativo", operador.ativo())
                .param("criadoEm", utc(criadoEm))
                .update();
    }

    @Override
    public void criarSessao(SessaoOperador sessao) {
        jdbc.sql("""
                INSERT INTO sessoes_operador (id, operador_id, token_hash, criado_em, expira_em)
                VALUES (:id, :operadorId, :tokenHash, :criadoEm, :expiraEm)
                """)
                .param("id", sessao.id())
                .param("operadorId", sessao.operadorId())
                .param("tokenHash", sessao.tokenHash())
                .param("criadoEm", utc(sessao.criadoEm()))
                .param("expiraEm", utc(sessao.expiraEm()))
                .update();
    }

    @Override
    public Optional<SessaoAutenticada> buscarSessao(String tokenHash) {
        return jdbc.sql("""
                SELECT o.id, o.email, o.nome, o.senha_hash, o.papel, o.ativo, s.expira_em, s.revogado_em
                FROM sessoes_operador s
                JOIN operadores o ON o.id = s.operador_id
                WHERE s.token_hash = :tokenHash
                """)
                .param("tokenHash", tokenHash)
                .query(SESSAO)
                .optional();
    }

    @Override
    public void revogarSessao(String tokenHash, Instant revogadoEm) {
        jdbc.sql("UPDATE sessoes_operador SET revogado_em = :revogadoEm WHERE token_hash = :tokenHash AND revogado_em IS NULL")
                .param("revogadoEm", utc(revogadoEm))
                .param("tokenHash", tokenHash)
                .update();
    }

    private static OffsetDateTime utc(Instant instante) {
        return instante.atOffset(ZoneOffset.UTC);
    }

    private static Instant instante(OffsetDateTime valor) {
        return valor == null ? null : valor.toInstant();
    }
}
