package br.com.inko.catalogo.livro;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import br.com.inko.catalogo.api.ApiException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class CatalogoTest {
    private static final Livro MARE = new Livro("INK-0001", "Maré de Tinta", "Aiko Tanabe", "Mangá", "Vol. 3", null, "墨の潮");
    private static final Livro RONIN = new Livro("INK-0002", "O Último Ronin", "Kenji Arata", "Mangá", "Vol. 12", null, null);
    private static final Livro FERRUGEM = new Livro("INK-0003", "Capitão Ferrugem", "Rafael Moura", "HQ", "#27", null, null);
    private static final Livro NOITE = new Livro("INK-0006", "Noite Sem Lua", "Lia Sato", "Graphic novel", " ", null, null);

    static class MemoriaLivroRepository implements LivroRepository {
        final Map<String, Livro> livros = new LinkedHashMap<>();

        @Override
        public void inserir(Livro livro) {
            livros.put(livro.id(), livro);
        }

        @Override
        public Optional<Livro> buscar(String id) {
            return Optional.ofNullable(livros.get(id));
        }

        @Override
        public List<Livro> listar() {
            return List.copyOf(livros.values());
        }
    }

    @Test
    void livroValidoNormalizaIdentificadorECamposOpcionais() {
        Livro livro = new Livro(" ink-0042 ", " Kitsune Express ", "Haru Mizuki", "Mangá", "", null, null);
        assertEquals("INK-0042", livro.id());
        assertEquals("Kitsune Express", livro.titulo());
        assertNull(livro.volume());
        assertNull(NOITE.volume());
    }

    @Test
    void livroInvalidoInformaCampoComErroSemantico() {
        assertEquals("id", campoInvalido(() -> new Livro("INK-12", "Título", "Autor", "HQ", null, null, null)));
        assertEquals("titulo", campoInvalido(() -> new Livro("INK-0100", " ", "Autor", "HQ", null, null, null)));
        assertEquals("autor", campoInvalido(() -> new Livro("INK-0100", "Título", null, "HQ", null, null, null)));
        assertEquals("categoria", campoInvalido(() -> new Livro("INK-0100", "Título", "Autor", "Romance", null, null, null)));
    }

    @Test
    void filtroPorCategoriaEPuroENaoAlteraAEntrada() {
        List<Livro> acervo = List.of(MARE, FERRUGEM, RONIN, NOITE);
        List<Livro> copia = new ArrayList<>(acervo);

        assertEquals(List.of(MARE, RONIN), CatalogoFuncoes.filtrarLivrosPorCategoria(acervo, "Mangá"));
        assertEquals(List.of(FERRUGEM), CatalogoFuncoes.filtrarLivrosPorCategoria(acervo, "HQ"));
        assertEquals(List.of(), CatalogoFuncoes.filtrarLivrosPorCategoria(acervo, "Romance"));
        assertEquals(List.of(), CatalogoFuncoes.filtrarLivrosPorCategoria(List.of(), "Mangá"));
        assertEquals(copia, acervo);
        assertEquals(CatalogoFuncoes.filtrarLivrosPorCategoria(acervo, "Mangá"), CatalogoFuncoes.filtrarLivrosPorCategoria(acervo, "Mangá"));
    }

    @Test
    void contagemPorCategoriaAgregaColecao() {
        assertEquals(Map.of("Mangá", 2L, "HQ", 1L, "Graphic novel", 1L),
                CatalogoFuncoes.contabilizarLivrosPorCategoria(List.of(MARE, FERRUGEM, RONIN, NOITE)));
    }

    @Test
    void pesquisaIgnoraAcentosEMaiusculas() {
        assertEquals(List.of(MARE), CatalogoFuncoes.pesquisar(List.of(MARE, RONIN), "mare"));
        assertEquals(List.of(RONIN), CatalogoFuncoes.pesquisar(List.of(MARE, RONIN), "ink-0002"));
    }

    @Test
    void cadastroRecusaIdentificadorDuplicadoComConflito() {
        CatalogoService service = new CatalogoService(new MemoriaLivroRepository());
        service.cadastrar(MARE);
        ApiException erro = assertThrows(ApiException.class, () -> service.cadastrar(MARE));
        assertEquals(HttpStatus.CONFLICT, erro.status());
        assertEquals("id", erro.field());
    }

    @Test
    void consultaPorIdentificadorRetornaLivroOuNaoEncontrado() {
        MemoriaLivroRepository repository = new MemoriaLivroRepository();
        CatalogoService service = new CatalogoService(repository);
        service.cadastrar(MARE);
        int antes = repository.livros.size();

        assertEquals(MARE, service.buscar("ink-0001"));
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ApiException.class, () -> service.buscar("INK-9999")).status());
        assertEquals(antes, repository.livros.size());
    }

    @Test
    void listagemAplicaCategoriaEPesquisa() {
        CatalogoService service = new CatalogoService(new MemoriaLivroRepository());
        List.of(MARE, RONIN, FERRUGEM).forEach(service::cadastrar);
        assertEquals(3, service.listar(null, null).size());
        assertEquals(List.of(MARE, RONIN), service.listar("Mangá", ""));
        assertTrue(service.listar("HQ", "ronin").isEmpty());
    }

    private static String campoInvalido(Runnable criacao) {
        ApiException erro = assertThrows(ApiException.class, criacao::run);
        assertEquals(HttpStatus.UNPROCESSABLE_CONTENT, erro.status());
        return erro.field();
    }
}
