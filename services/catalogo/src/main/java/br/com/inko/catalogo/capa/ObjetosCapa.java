package br.com.inko.catalogo.capa;

import java.io.IOException;
import java.io.InputStream;

public interface ObjetosCapa {
    String gravar(ImagemValidada imagem);
    InputStream abrir(String chave) throws IOException;
    void remover(String chave);
}
