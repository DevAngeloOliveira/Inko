package br.com.inko.catalogo.livro;

import br.com.inko.catalogo.api.ApiException;
import java.util.List;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

@Service
public class CatalogoService {
    private final LivroRepository repository;

    public CatalogoService(LivroRepository repository) {
        this.repository = repository;
    }

    public Livro cadastrar(Livro livro) {
        if (repository.buscar(livro.id()).isPresent()) {
            throw duplicado(livro.id());
        }
        try {
            repository.inserir(livro);
        } catch (DuplicateKeyException exception) {
            throw duplicado(livro.id());
        }
        return livro;
    }

    public Livro buscar(String id) {
        return repository.buscar(id.toUpperCase())
                .orElseThrow(() -> ApiException.naoEncontrado("Livro " + id + " não encontrado."));
    }

    public List<Livro> listar(String categoria, String termo) {
        List<Livro> livros = repository.listar();
        if (categoria != null && !categoria.isBlank()) {
            livros = CatalogoFuncoes.filtrarLivrosPorCategoria(livros, categoria.strip());
        }
        if (termo != null && !termo.isBlank()) {
            livros = CatalogoFuncoes.pesquisar(livros, termo);
        }
        return livros;
    }

    private static ApiException duplicado(String id) {
        return ApiException.conflito("DUPLICATE_ID", "O identificador " + id + " já existe no acervo.", "id");
    }
}
