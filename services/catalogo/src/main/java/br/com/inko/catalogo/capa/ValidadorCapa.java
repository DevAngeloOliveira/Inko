package br.com.inko.catalogo.capa;

import br.com.inko.catalogo.api.ApiException;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import javax.imageio.IIOImage;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import javax.imageio.stream.MemoryCacheImageInputStream;
import javax.imageio.stream.MemoryCacheImageOutputStream;

public class ValidadorCapa {
    public static final long TAMANHO_MAXIMO_BYTES = 2_097_152L;
    static final long PIXELS_MAXIMOS = 12_000_000L;
    static final int LADO_MAXIMO = 8000;
    private static final float QUALIDADE_JPEG = 0.9f;

    public ImagemValidada validar(String mimeDeclarado, byte[] conteudo) {
        if (conteudo == null || conteudo.length == 0) {
            throw CapaErros.vazio();
        }
        if (conteudo.length > TAMANHO_MAXIMO_BYTES) {
            throw CapaErros.grandeDemais();
        }
        FormatoImagem formato = FormatoImagem.doMimeType(mimeDeclarado).orElseThrow(CapaErros::tipoNaoSuportado);
        if (!formato.assinaturaConfere(conteudo)) {
            throw CapaErros.tipoNaoSuportado();
        }
        BufferedImage imagem = decodificar(formato, conteudo);
        byte[] normalizado = codificar(formato, imagem);
        return new ImagemValidada(formato, normalizado, imagem.getWidth(), imagem.getHeight(), sha256(normalizado));
    }

    static boolean excedeLimites(int largura, int altura) {
        return largura > LADO_MAXIMO || altura > LADO_MAXIMO || (long) largura * altura > PIXELS_MAXIMOS;
    }

    private static BufferedImage decodificar(FormatoImagem formato, byte[] conteudo) {
        ImageReader leitor = formato.novoLeitor();
        try (ImageInputStream entrada = new MemoryCacheImageInputStream(new ByteArrayInputStream(conteudo))) {
            leitor.setInput(entrada, true, true);
            int largura = leitor.getWidth(0);
            int altura = leitor.getHeight(0);
            if (largura <= 0 || altura <= 0) {
                throw CapaErros.imagemInvalida();
            }
            if (excedeLimites(largura, altura)) {
                throw CapaErros.imagemGrandeDemais();
            }
            BufferedImage imagem = leitor.read(0);
            if (imagem == null) {
                throw CapaErros.imagemInvalida();
            }
            return imagem;
        } catch (ApiException falha) {
            throw falha;
        } catch (IOException | RuntimeException falha) {
            throw CapaErros.imagemInvalida();
        } finally {
            leitor.dispose();
        }
    }

    private static byte[] codificar(FormatoImagem formato, BufferedImage imagem) {
        BufferedImage origem = formato == FormatoImagem.JPEG ? paraRgb(imagem) : imagem;
        ImageWriter escritor = formato.novoEscritor();
        ByteArrayOutputStream saida = new ByteArrayOutputStream();
        try (ImageOutputStream destino = new MemoryCacheImageOutputStream(saida)) {
            escritor.setOutput(destino);
            escritor.write(null, new IIOImage(origem, null, null), parametros(formato, escritor));
        } catch (IOException | RuntimeException falha) {
            throw CapaErros.imagemInvalida();
        } finally {
            escritor.dispose();
        }
        return saida.toByteArray();
    }

    private static ImageWriteParam parametros(FormatoImagem formato, ImageWriter escritor) {
        ImageWriteParam parametros = escritor.getDefaultWriteParam();
        if (formato == FormatoImagem.JPEG) {
            parametros.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            parametros.setCompressionQuality(QUALIDADE_JPEG);
        }
        return parametros;
    }

    private static BufferedImage paraRgb(BufferedImage imagem) {
        if (imagem.getType() == BufferedImage.TYPE_INT_RGB) {
            return imagem;
        }
        BufferedImage rgb = new BufferedImage(imagem.getWidth(), imagem.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D grafico = rgb.createGraphics();
        try {
            grafico.setColor(Color.WHITE);
            grafico.fillRect(0, 0, imagem.getWidth(), imagem.getHeight());
            grafico.drawImage(imagem, 0, 0, null);
        } finally {
            grafico.dispose();
        }
        return rgb;
    }

    static String sha256(byte[] conteudo) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(conteudo));
        } catch (NoSuchAlgorithmException falha) {
            throw new IllegalStateException("SHA-256 indisponível.", falha);
        }
    }
}
