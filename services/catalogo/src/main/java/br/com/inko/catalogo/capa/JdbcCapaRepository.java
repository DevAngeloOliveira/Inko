package br.com.inko.catalogo.capa;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcCapaRepository implements CapaRepository {
    private static final RowMapper<CapaLivro> MAPPER = (rs, row) -> new CapaLivro(
            rs.getString("livro_id"), rs.getString("object_key"), rs.getString("mime_type"), rs.getInt("tamanho_bytes"),
            rs.getString("sha256"), rs.getInt("largura"), rs.getInt("altura"),
            rs.getObject("atualizado_em", OffsetDateTime.class).toInstant());

    private final JdbcClient jdbc;

    public JdbcCapaRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public boolean livroExiste(String livroId) {
        return jdbc.sql("SELECT id FROM livros WHERE id = :id").param("id", livroId).query(String.class).optional().isPresent();
    }

    @Override
    public boolean bloquearLivro(String livroId) {
        return jdbc.sql("SELECT id FROM livros WHERE id = :id FOR UPDATE").param("id", livroId)
                .query(String.class).optional().isPresent();
    }

    @Override
    public Optional<CapaLivro> buscar(String livroId) {
        return jdbc.sql("""
                SELECT livro_id, object_key, mime_type, tamanho_bytes, sha256, largura, altura, atualizado_em
                FROM capas_livros WHERE livro_id = :livroId
                """).param("livroId", livroId).query(MAPPER).optional();
    }

    @Override
    public void salvar(CapaLivro capa) {
        OffsetDateTime momento = OffsetDateTime.ofInstant(capa.atualizadoEm(), ZoneOffset.UTC);
        jdbc.sql("""
                INSERT INTO capas_livros
                    (id, livro_id, object_key, mime_type, tamanho_bytes, sha256, largura, altura, criado_em, atualizado_em)
                VALUES (:id, :livroId, :objectKey, :mimeType, :tamanhoBytes, :sha256, :largura, :altura, :momento, :momento)
                ON CONFLICT (livro_id) DO UPDATE SET
                    object_key = EXCLUDED.object_key,
                    mime_type = EXCLUDED.mime_type,
                    tamanho_bytes = EXCLUDED.tamanho_bytes,
                    sha256 = EXCLUDED.sha256,
                    largura = EXCLUDED.largura,
                    altura = EXCLUDED.altura,
                    atualizado_em = EXCLUDED.atualizado_em
                """)
                .param("id", UUID.randomUUID())
                .param("livroId", capa.livroId())
                .param("objectKey", capa.objectKey())
                .param("mimeType", capa.mimeType())
                .param("tamanhoBytes", capa.tamanhoBytes())
                .param("sha256", capa.sha256())
                .param("largura", capa.largura())
                .param("altura", capa.altura())
                .param("momento", momento)
                .update();
    }

    @Override
    public void remover(String livroId) {
        jdbc.sql("DELETE FROM capas_livros WHERE livro_id = :livroId").param("livroId", livroId).update();
    }
}
