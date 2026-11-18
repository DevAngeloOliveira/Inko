package br.com.inko.catalogo.capa;

import java.util.Arrays;
import java.util.Iterator;
import java.util.Locale;
import java.util.Optional;
import java.util.function.Function;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriter;

public enum FormatoImagem {
    JPEG("image/jpeg", ".jpg", "jpeg", new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF}),
    PNG("image/png", ".png", "png", new byte[] {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A});

    private final String mimeType;
    private final String extensao;
    private final String nomeImageIo;
    private final byte[] assinatura;

    FormatoImagem(String mimeType, String extensao, String nomeImageIo, byte[] assinatura) {
        this.mimeType = mimeType;
        this.extensao = extensao;
        this.nomeImageIo = nomeImageIo;
        this.assinatura = assinatura;
    }

    public static Optional<FormatoImagem> doMimeType(String declarado) {
        if (declarado == null) {
            return Optional.empty();
        }
        String tipo = declarado.split(";", 2)[0].strip().toLowerCase(Locale.ROOT);
        return Arrays.stream(values()).filter(formato -> formato.mimeType.equals(tipo)).findFirst();
    }

    public String mimeType() {
        return mimeType;
    }

    public String extensao() {
        return extensao;
    }

    boolean assinaturaConfere(byte[] conteudo) {
        return conteudo.length >= assinatura.length
                && Arrays.equals(conteudo, 0, assinatura.length, assinatura, 0, assinatura.length);
    }

    ImageReader novoLeitor() {
        return primeiro(ImageIO::getImageReadersByFormatName);
    }

    ImageWriter novoEscritor() {
        return primeiro(ImageIO::getImageWritersByFormatName);
    }

    private <T> T primeiro(Function<String, Iterator<T>> fonte) {
        Iterator<T> disponiveis = fonte.apply(nomeImageIo);
        if (!disponiveis.hasNext()) {
            throw new IllegalStateException("Codec de imagem indisponível: " + nomeImageIo);
        }
        return disponiveis.next();
    }
}
