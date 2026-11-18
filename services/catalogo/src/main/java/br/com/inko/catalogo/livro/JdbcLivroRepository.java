package br.com.inko.catalogo.livro;

import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcLivroRepository implements LivroRepository {
    private static final RowMapper<Livro> MAPPER = (rs, row) -> new Livro(
            rs.getString("id"), rs.getString("titulo"), rs.getString("autor"), rs.getString("categoria"),
            rs.getString("volume"), rs.getString("editora"), rs.getString("titulo_original"), rs.getString("capa_versao"),
            rs.getString("descricao") == null ? null : new Livro.FichaEditorial(rs.getString("descricao"),
                    rs.getString("capa_editorial"), rs.getString("fonte"), rs.getString("isbn"), rs.getString("generos")));
    private static final String CONSULTA = """
            SELECT l.*, substr(c.sha256, 1, 16) AS capa_versao
            FROM livros l LEFT JOIN capas_livros c ON c.livro_id = l.id
            """;

    private final JdbcClient jdbc;

    public JdbcLivroRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void inserir(Livro livro) {
        jdbc.sql("""
                INSERT INTO livros (id, titulo, autor, categoria, volume, editora, titulo_original)
                VALUES (:id, :titulo, :autor, :categoria, :volume, :editora, :tituloOriginal)
                """)
                .param("id", livro.id())
                .param("titulo", livro.titulo())
                .param("autor", livro.autor())
                .param("categoria", livro.categoria())
                .param("volume", livro.volume())
                .param("editora", livro.editora())
                .param("tituloOriginal", livro.tituloOriginal())
                .update();
    }

    @Override
    public Optional<Livro> buscar(String id) {
        return jdbc.sql(CONSULTA + " WHERE l.id = :id").param("id", id).query(MAPPER).optional();
    }

    @Override
    public List<Livro> listar() {
        return jdbc.sql(CONSULTA + " ORDER BY l.id").query(MAPPER).list();
    }
}
