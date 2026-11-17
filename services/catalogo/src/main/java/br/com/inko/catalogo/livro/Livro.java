package br.com.inko.catalogo.livro;

import br.com.inko.catalogo.api.ApiException;
import java.util.Set;
import java.util.regex.Pattern;

public record Livro(String id, String titulo, String autor, String categoria, String volume, String editora, String tituloOriginal) {
    public static final Set<String> CATEGORIAS = Set.of("Mangá", "HQ", "Graphic novel");
    private static final Pattern IDENTIFICADOR = Pattern.compile("INK-\\d{4}");

    public Livro {
        id = obrigatorio(id, "id", "Informe o identificador.").toUpperCase();
        if (!IDENTIFICADOR.matcher(id).matches()) {
            throw ApiException.invalido("Formato inválido. Use INK- seguido de 4 dígitos.", "id");
        }
        titulo = limitado(obrigatorio(titulo, "titulo", "Informe o título."), "titulo", 160);
        autor = limitado(obrigatorio(autor, "autor", "Informe o autor."), "autor", 120);
        categoria = obrigatorio(categoria, "categoria", "Escolha uma categoria.");
        if (!CATEGORIAS.contains(categoria)) {
            throw ApiException.invalido("Categoria inválida. Use Mangá, HQ ou Graphic novel.", "categoria");
        }
        volume = limitado(opcional(volume), "volume", 40);
        editora = limitado(opcional(editora), "editora", 120);
        tituloOriginal = limitado(opcional(tituloOriginal), "tituloOriginal", 160);
    }

    public boolean pertenceA(String outraCategoria) {
        return categoria.equals(outraCategoria);
    }

    private static String obrigatorio(String valor, String campo, String mensagem) {
        if (valor == null || valor.isBlank()) {
            throw ApiException.invalido(mensagem, campo);
        }
        return valor.strip();
    }

    private static String opcional(String valor) {
        return valor == null || valor.isBlank() ? null : valor.strip();
    }

    private static String limitado(String valor, String campo, int maximo) {
        if (valor != null && valor.length() > maximo) {
            throw ApiException.invalido("O campo excede " + maximo + " caracteres.", campo);
        }
        return valor;
    }
}
