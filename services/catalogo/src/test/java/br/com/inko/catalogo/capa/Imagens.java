package br.com.inko.catalogo.capa;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.zip.CRC32;
import javax.imageio.ImageIO;

final class Imagens {
    static final byte[] ASSINATURA_PNG = {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};

    private Imagens() {
    }

    static byte[] jpeg(int largura, int altura) {
        return codificar(imagem(largura, altura, BufferedImage.TYPE_INT_RGB), "jpeg");
    }

    static byte[] png(int largura, int altura) {
        return codificar(imagem(largura, altura, BufferedImage.TYPE_INT_ARGB), "png");
    }

    static byte[] pngComCabecalho(int largura, int altura) {
        ByteBuffer ihdr = ByteBuffer.allocate(13).putInt(largura).putInt(altura)
                .put((byte) 8).put((byte) 2).put((byte) 0).put((byte) 0).put((byte) 0);
        ByteArrayOutputStream saida = new ByteArrayOutputStream();
        saida.writeBytes(ASSINATURA_PNG);
        saida.writeBytes(chunk("IHDR", ihdr.array()));
        saida.writeBytes(chunk("IDAT", new byte[] {0x78, (byte) 0x9C, 0x03, 0x00}));
        saida.writeBytes(chunk("IEND", new byte[0]));
        return saida.toByteArray();
    }

    static byte[] pngComTexto(byte[] png, String chave, String valor) {
        int fimIhdr = ASSINATURA_PNG.length + 8 + 13 + 4;
        byte[] texto = (chave + "\0" + valor).getBytes(StandardCharsets.ISO_8859_1);
        ByteArrayOutputStream saida = new ByteArrayOutputStream();
        saida.write(png, 0, fimIhdr);
        saida.writeBytes(chunk("tEXt", texto));
        saida.write(png, fimIhdr, png.length - fimIhdr);
        return saida.toByteArray();
    }

    static byte[] jpegComExif(byte[] jpeg, String marcador) {
        byte[] dados = ("Exif\0\0" + marcador).getBytes(StandardCharsets.ISO_8859_1);
        int tamanho = dados.length + 2;
        ByteArrayOutputStream saida = new ByteArrayOutputStream();
        saida.write(jpeg, 0, 2);
        saida.writeBytes(new byte[] {(byte) 0xFF, (byte) 0xE1, (byte) (tamanho >> 8), (byte) tamanho});
        saida.writeBytes(dados);
        saida.write(jpeg, 2, jpeg.length - 2);
        return saida.toByteArray();
    }

    static boolean contem(byte[] conteudo, String texto) {
        byte[] procurado = texto.getBytes(StandardCharsets.ISO_8859_1);
        for (int inicio = 0; inicio + procurado.length <= conteudo.length; inicio++) {
            if (Arrays.equals(conteudo, inicio, inicio + procurado.length, procurado, 0, procurado.length)) {
                return true;
            }
        }
        return false;
    }

    private static BufferedImage imagem(int largura, int altura, int tipo) {
        BufferedImage imagem = new BufferedImage(largura, altura, tipo);
        for (int x = 0; x < largura; x++) {
            for (int y = 0; y < altura; y++) {
                imagem.setRGB(x, y, new Color((x * 7) % 256, (y * 13) % 256, 120).getRGB());
            }
        }
        return imagem;
    }

    private static byte[] codificar(BufferedImage imagem, String formato) {
        try {
            ByteArrayOutputStream saida = new ByteArrayOutputStream();
            ImageIO.write(imagem, formato, saida);
            return saida.toByteArray();
        } catch (IOException falha) {
            throw new UncheckedIOException(falha);
        }
    }

    private static byte[] chunk(String tipo, byte[] dados) {
        byte[] nome = tipo.getBytes(StandardCharsets.US_ASCII);
        CRC32 crc = new CRC32();
        crc.update(nome);
        crc.update(dados);
        return ByteBuffer.allocate(12 + dados.length).putInt(dados.length).put(nome).put(dados).putInt((int) crc.getValue()).array();
    }
}
