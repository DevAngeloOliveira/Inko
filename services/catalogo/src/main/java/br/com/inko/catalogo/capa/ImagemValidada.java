package br.com.inko.catalogo.capa;

public final class ImagemValidada {
    private final FormatoImagem formato;
    private final byte[] conteudo;
    private final int largura;
    private final int altura;
    private final String sha256;

    ImagemValidada(FormatoImagem formato, byte[] conteudo, int largura, int altura, String sha256) {
        this.formato = formato;
        this.conteudo = conteudo.clone();
        this.largura = largura;
        this.altura = altura;
        this.sha256 = sha256;
    }

    public FormatoImagem formato() {
        return formato;
    }

    public byte[] conteudo() {
        return conteudo.clone();
    }

    public int tamanhoBytes() {
        return conteudo.length;
    }

    public int largura() {
        return largura;
    }

    public int altura() {
        return altura;
    }

    public String sha256() {
        return sha256;
    }
}
