package br.com.inko.circulacao.emprestimo;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class JdbcEmprestimoRepository implements EmprestimoRepository {
    private static final RowMapper<Emprestimo> MAPPER = (rs, row) -> new Emprestimo(
            rs.getString("id"), rs.getString("livro_id"), rs.getString("usuario_id"),
            rs.getObject("data_emprestimo", LocalDate.class), rs.getObject("data_prevista", LocalDate.class),
            rs.getObject("data_devolucao", LocalDate.class));

    private final JdbcClient jdbc;

    public JdbcEmprestimoRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional
    public Emprestimo inserir(Emprestimo emprestimo) {
        return jdbc.sql("""
                INSERT INTO emprestimos (id, livro_id, usuario_id, data_emprestimo, data_prevista)
                VALUES ('EMP-' || nextval('emprestimos_seq'), :livroId, :usuarioId, :dataEmprestimo, :dataPrevista)
                RETURNING *
                """)
                .param("livroId", emprestimo.livroId())
                .param("usuarioId", emprestimo.usuarioId())
                .param("dataEmprestimo", emprestimo.dataEmprestimo())
                .param("dataPrevista", emprestimo.dataPrevista())
                .query(MAPPER)
                .single();
    }

    @Override
    @Transactional
    public boolean registrarDevolucao(String id, LocalDate data) {
        return jdbc.sql("UPDATE emprestimos SET data_devolucao = :data WHERE id = :id AND data_devolucao IS NULL")
                .param("data", data)
                .param("id", id)
                .update() == 1;
    }

    @Override
    public Optional<Emprestimo> buscar(String id) {
        return jdbc.sql("SELECT * FROM emprestimos WHERE id = :id").param("id", id).query(MAPPER).optional();
    }

    @Override
    public Optional<Emprestimo> ativoDoLivro(String livroId) {
        return jdbc.sql("SELECT * FROM emprestimos WHERE livro_id = :livroId AND data_devolucao IS NULL")
                .param("livroId", livroId).query(MAPPER).optional();
    }

    @Override
    public List<Emprestimo> listar() {
        return jdbc.sql("SELECT * FROM emprestimos ORDER BY data_emprestimo, id").query(MAPPER).list();
    }
}
