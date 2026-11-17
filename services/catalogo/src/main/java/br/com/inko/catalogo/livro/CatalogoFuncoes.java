package br.com.inko.catalogo.livro;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

public final class CatalogoFuncoes {
    private CatalogoFuncoes() {
    }

    public static List<Livro> filtrarLivrosPorCategoria(List<Livro> livros, String categoria) {
        return livros.stream()
                .filter(livro -> livro.pertenceA(categoria))
                .toList();
    }

    public static List<Livro> pesquisar(List<Livro> livros, String termo) {
        String procurado = normalizar(termo);
        return livros.stream()
                .filter(livro -> normalizar(livro.id() + " " + livro.titulo() + " " + livro.autor()).contains(procurado))
                .toList();
    }

    public static Map<String, Long> contabilizarLivrosPorCategoria(List<Livro> livros) {
        return livros.stream()
                .collect(Collectors.groupingBy(Livro::categoria, TreeMap::new, Collectors.counting()));
    }

    static String normalizar(String texto) {
        return Normalizer.normalize(texto.strip().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
    }
}
