package br.com.inko.catalogo.capa;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import br.com.inko.catalogo.api.ApiException;
import br.com.inko.catalogo.livro.Livro;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.support.TransactionOperations;

class CapaArmazenamentoServiceTest {
    private static final Instant AGORA = Instant.parse("2026-11-17T12:00:00Z");

    @TempDir
    Path raiz;

    static class MemoriaCapaRepository implements CapaRepository {
        final Set<String> livros = Set.of("INK-0001");
        final Map<String, CapaLivro> capas = new HashMap<>();
        boolean falharAoSalvar;

        @Override
        public boolean livroExiste(String livroId) {
            return livros.contains(livroId);
        }

        @Override
        public boolean bloquearLivro(String livroId) {
            return livros.contains(livroId);
        }

        @Override
        public Optional<CapaLivro> buscar(String livroId) {
            return Optional.ofNullable(capas.get(livroId));
        }

        @Override
        public void salvar(CapaLivro capa) {
            if (falharAoSalvar) {
                throw new IllegalStateException("falha simulada");
            }
            capas.put(capa.livroId(), capa);
        }

        @Override
        public void remover(String livroId) {
            capas.remove(livroId);
        }
    }

    @Test
    void gravacaoAtomicaUsaChaveUuidComExtensaoDoFormatoReal() throws IOException {
        ArmazenamentoCapas armazenamento = new ArmazenamentoCapas(raiz);
        ImagemValidada imagem = new ValidadorCapa().validar("image/png", Imagens.png(10, 10));

        String chave = armazenamento.gravar(imagem);

        assertTrue(chave.matches("[0-9a-f-]{36}\\.png"));
        assertArrayEquals(imagem.conteudo(), Files.readAllBytes(raiz.resolve(chave)));
        assertEquals(List.of(chave), arquivos());
    }

    @Test
    void falhaNaGravacaoNaoDeixaTemporarios() throws IOException {
        ArmazenamentoCapas armazenamento = new ArmazenamentoCapas(raiz, (origem, destino) -> {
            throw new IOException("disco cheio");
        });
        ImagemValidada imagem = new ValidadorCapa().validar("image/jpeg", Imagens.jpeg(10, 10));

        ValidadorCapaTest.assertErro(HttpStatus.INTERNAL_SERVER_ERROR, "STORAGE_UNAVAILABLE", () -> armazenamento.gravar(imagem));
        assertEquals(List.of(), arquivos());
    }

    @Test
    void chavesComTraversalOuForaDoPadraoSaoRecusadas() {
        ArmazenamentoCapas armazenamento = new ArmazenamentoCapas(raiz);
        for (String chave : new String[] {"../segredo.jpg", "..\\segredo.png", "/etc/passwd", "capa.jpg", null,
                "00000000-0000-0000-0000-000000000000.svg", "00000000-0000-0000-0000-000000000000.jpg/../../x.jpg"}) {
            assertThrows(IllegalArgumentException.class, () -> armazenamento.resolver(chave));
        }
        Path valida = armazenamento.resolver("00000000-0000-0000-0000-000000000000.jpg");
        assertEquals(armazenamento.raiz(), valida.getParent());
    }

    @Test
    void substituicaoRegistraMetadadosERemoveArquivoAntigoAposCommit() throws IOException {
        MemoriaCapaRepository repository = new MemoriaCapaRepository();
        CapaService service = servico(repository);

        CapaLivro primeira = service.substituir("ink-0001", "image/png", Imagens.png(12, 18));
        CapaLivro segunda = service.substituir("INK-0001", "image/jpeg", Imagens.jpeg(20, 30));

        assertEquals("INK-0001", segunda.livroId());
        assertEquals("image/jpeg", segunda.mimeType());
        assertEquals(20, segunda.largura());
        assertEquals(30, segunda.altura());
        assertEquals(AGORA, segunda.atualizadoEm());
        assertEquals(segunda.sha256().substring(0, 16), segunda.versao());
        assertEquals(segunda, repository.capas.get("INK-0001"));
        assertEquals(List.of(segunda.objectKey()), arquivos());
        assertFalse(Files.exists(raiz.resolve(primeira.objectKey())));
        try (InputStream conteudo = service.abrir("INK-0001").conteudo()) {
            assertEquals(segunda.sha256(), ValidadorCapa.sha256(conteudo.readAllBytes()));
        }
    }

    @Test
    void falhaNaTransacaoApagaArquivoNovoEPreservaCapaAnterior() throws IOException {
        MemoriaCapaRepository repository = new MemoriaCapaRepository();
        CapaService service = servico(repository);
        CapaLivro anterior = service.substituir("INK-0001", "image/png", Imagens.png(12, 18));
        repository.falharAoSalvar = true;

        assertThrows(IllegalStateException.class, () -> service.substituir("INK-0001", "image/jpeg", Imagens.jpeg(20, 30)));

        assertEquals(anterior, repository.capas.get("INK-0001"));
        assertEquals(List.of(anterior.objectKey()), arquivos());
    }

    @Test
    void livroInexistenteOuImagemInvalidaNaoGravamArquivos() throws IOException {
        CapaService service = servico(new MemoriaCapaRepository());

        ApiException ausente = assertThrows(ApiException.class, () -> service.substituir("INK-9999", "image/png", Imagens.png(4, 4)));
        assertEquals(HttpStatus.NOT_FOUND, ausente.status());
        ValidadorCapaTest.assertErro(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_MEDIA_TYPE",
                () -> service.substituir("INK-0001", "image/svg+xml", "<svg/>".getBytes()));
        assertEquals(List.of(), arquivos());
    }

    @Test
    void remocaoApagaMetadadosEArquivoESemCapaResponde404() throws IOException {
        MemoriaCapaRepository repository = new MemoriaCapaRepository();
        CapaService service = servico(repository);
        service.substituir("INK-0001", "image/png", Imagens.png(12, 18));

        service.remover("INK-0001");

        assertTrue(repository.capas.isEmpty());
        assertEquals(List.of(), arquivos());
        ValidadorCapaTest.assertErro(HttpStatus.NOT_FOUND, "COVER_NOT_FOUND", () -> service.remover("INK-0001"));
        ValidadorCapaTest.assertErro(HttpStatus.NOT_FOUND, "COVER_NOT_FOUND", () -> service.buscar("INK-0001"));
        ValidadorCapaTest.assertErro(HttpStatus.NOT_FOUND, "COVER_NOT_FOUND", () -> service.abrir("INK-0001"));
    }

    @Test
    void ifNoneMatchReconheceEtagForteFracaListaECuringa() {
        String sha = "a".repeat(64);
        assertTrue(CapaController.corresponde("\"" + sha + "\"", sha));
        assertTrue(CapaController.corresponde("W/\"" + sha + "\"", sha));
        assertTrue(CapaController.corresponde("\"outro\", \"" + sha + "\"", sha));
        assertTrue(CapaController.corresponde("*", sha));
        assertFalse(CapaController.corresponde("\"outro\"", sha));
        assertFalse(CapaController.corresponde(null, sha));
        assertFalse(CapaController.corresponde(sha, sha));
    }

    @Test
    void livroExpoeCapaVersaoOpcionalSemAceitarValorArbitrario() {
        Livro semCapa = new Livro("INK-0001", "Título", "Autor", "HQ", null, null, null);
        Livro comCapa = new Livro("INK-0001", "Título", "Autor", "HQ", null, null, null, "0123456789abcdef");

        assertNull(semCapa.capaVersao());
        assertEquals("0123456789abcdef", comCapa.capaVersao());
        assertNull(new Livro("INK-0001", "Título", "Autor", "HQ", null, null, null, "../x").capaVersao());
        assertNull(comCapa.semCapa().capaVersao());
    }

    private CapaService servico(CapaRepository repository) {
        return new CapaService(repository, new ValidadorCapa(), new ArmazenamentoCapas(raiz),
                TransactionOperations.withoutTransaction(), Clock.fixed(AGORA, ZoneOffset.UTC));
    }

    private List<String> arquivos() throws IOException {
        if (!Files.exists(raiz)) {
            return List.of();
        }
        try (Stream<Path> itens = Files.list(raiz)) {
            return itens.map(caminho -> caminho.getFileName().toString()).sorted().toList();
        }
    }
}
