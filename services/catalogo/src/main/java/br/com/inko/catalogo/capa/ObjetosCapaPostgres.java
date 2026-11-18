package br.com.inko.catalogo.capa;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.file.NoSuchFileException;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;

final class ObjetosCapaPostgres implements ObjetosCapa {
    private final JdbcTemplate jdbc;

    ObjetosCapaPostgres(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public String gravar(ImagemValidada imagem) {
        String chave = UUID.randomUUID() + imagem.formato().extensao();
        jdbc.update("INSERT INTO capa_objetos (chave, conteudo) VALUES (?, ?)", chave, imagem.conteudo());
        return chave;
    }

    public InputStream abrir(String chave) throws NoSuchFileException {
        byte[] dados = jdbc.query("SELECT conteudo FROM capa_objetos WHERE chave = ?",
                rs -> rs.next() ? rs.getBytes(1) : null, chave);
        if (dados == null) {
            throw new NoSuchFileException(chave);
        }
        return new ByteArrayInputStream(dados);
    }

    public void remover(String chave) {
        jdbc.update("DELETE FROM capa_objetos WHERE chave = ?", chave);
    }
}
