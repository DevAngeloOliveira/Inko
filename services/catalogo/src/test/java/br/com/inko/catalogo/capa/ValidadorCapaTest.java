package br.com.inko.catalogo.capa;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import br.com.inko.catalogo.api.ApiException;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class ValidadorCapaTest {
    private final ValidadorCapa validador = new ValidadorCapa();

    @Test
    void jpegValidoEhReencodadoComDimensoesEHash() throws IOException {
        ImagemValidada imagem = validador.validar("image/jpeg", Imagens.jpeg(40, 60));

        assertEquals(FormatoImagem.JPEG, imagem.formato());
        assertEquals(40, imagem.largura());
        assertEquals(60, imagem.altura());
        assertEquals(ValidadorCapa.sha256(imagem.conteudo()), imagem.sha256());
        assertEquals(64, imagem.sha256().length());
        assertTrue(FormatoImagem.JPEG.assinaturaConfere(imagem.conteudo()));
        BufferedImage decodificada = ImageIO.read(new ByteArrayInputStream(imagem.conteudo()));
        assertNotNull(decodificada);
        assertFalse(decodificada.getColorModel().hasAlpha());
        assertEquals(3, decodificada.getRaster().getNumBands());
    }

    @Test
    void pngValidoMantemFormatoEAceitaParametrosNoMime() {
        ImagemValidada imagem = validador.validar("Image/PNG; charset=binary", Imagens.png(30, 20));

        assertEquals(FormatoImagem.PNG, imagem.formato());
        assertEquals(30, imagem.largura());
        assertEquals(20, imagem.altura());
        assertArrayEquals(Imagens.ASSINATURA_PNG, Arrays.copyOf(imagem.conteudo(), 8));
    }

    @Test
    void reencodeRemoveMetadadosExifETexto() {
        byte[] jpegComExif = Imagens.jpegComExif(Imagens.jpeg(16, 16), "SEGREDO-GPS");
        byte[] pngComTexto = Imagens.pngComTexto(Imagens.png(16, 16), "Comment", "SEGREDO-AUTOR");
        assertTrue(Imagens.contem(jpegComExif, "SEGREDO-GPS"));
        assertTrue(Imagens.contem(pngComTexto, "SEGREDO-AUTOR"));

        byte[] jpeg = validador.validar("image/jpeg", jpegComExif).conteudo();
        byte[] png = validador.validar("image/png", pngComTexto).conteudo();

        assertFalse(Imagens.contem(jpeg, "SEGREDO-GPS"));
        assertFalse(Imagens.contem(jpeg, "Exif"));
        assertFalse(Imagens.contem(png, "SEGREDO-AUTOR"));
        assertFalse(Imagens.contem(png, "tEXt"));
    }

    @Test
    void mimeDeclaradoNaoSuportadoEhRecusadoCom415() {
        byte[] png = Imagens.png(8, 8);
        for (String mime : new String[] {null, "", "image/svg+xml", "text/html", "image/gif", "application/zip", "image/webp"}) {
            assertErro(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_MEDIA_TYPE", () -> validador.validar(mime, png));
        }
    }

    @Test
    void conteudoQueNaoBateComTipoDeclaradoEhRecusadoCom415() {
        byte[] svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>".getBytes(StandardCharsets.UTF_8);
        byte[] html = "<!doctype html><html><body>x</body></html>".getBytes(StandardCharsets.UTF_8);
        byte[] gif = "GIF89a\u0001\u0000\u0001\u0000".getBytes(StandardCharsets.ISO_8859_1);
        byte[] zip = {0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00};

        assertErro(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_MEDIA_TYPE", () -> validador.validar("image/jpeg", Imagens.png(8, 8)));
        assertErro(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_MEDIA_TYPE", () -> validador.validar("image/png", Imagens.jpeg(8, 8)));
        for (byte[] falso : new byte[][] {svg, html, gif, zip, {(byte) 0xFF}}) {
            assertErro(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_MEDIA_TYPE", () -> validador.validar("image/png", falso));
            assertErro(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_MEDIA_TYPE", () -> validador.validar("image/jpeg", falso));
        }
    }

    @Test
    void arquivoVazioEhRecusadoCom400() {
        assertErro(HttpStatus.BAD_REQUEST, "EMPTY_FILE", () -> validador.validar("image/png", new byte[0]));
        assertErro(HttpStatus.BAD_REQUEST, "EMPTY_FILE", () -> validador.validar("image/png", null));
    }

    @Test
    void arquivoAcimaDe2MiBEhRecusadoCom413() {
        byte[] grande = Arrays.copyOf(Imagens.png(8, 8), (int) ValidadorCapa.TAMANHO_MAXIMO_BYTES + 1);
        assertErro(HttpStatus.CONTENT_TOO_LARGE, "PAYLOAD_TOO_LARGE", () -> validador.validar("image/png", grande));
    }

    @Test
    void dimensoesAcimaDoLimiteSaoRecusadasAntesDeDecodificar() {
        assertErro(HttpStatus.UNPROCESSABLE_CONTENT, "IMAGE_TOO_LARGE", () -> validador.validar("image/png", Imagens.pngComCabecalho(50_000, 50_000)));
        assertErro(HttpStatus.UNPROCESSABLE_CONTENT, "IMAGE_TOO_LARGE", () -> validador.validar("image/png", Imagens.pngComCabecalho(5000, 5000)));
        assertErro(HttpStatus.UNPROCESSABLE_CONTENT, "IMAGE_TOO_LARGE", () -> validador.validar("image/png", Imagens.pngComCabecalho(8001, 10)));
        assertTrue(ValidadorCapa.excedeLimites(4000, 3001));
        assertFalse(ValidadorCapa.excedeLimites(4000, 3000));
        assertFalse(ValidadorCapa.excedeLimites(8000, 1500));
    }

    @Test
    void bytesCorrompidosSaoRecusadosCom422() {
        byte[] jpeg = Imagens.jpeg(32, 32);
        byte[] truncado = Arrays.copyOf(jpeg, 40);
        byte[] lixo = Arrays.copyOf(new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF}, 300);
        byte[] pngSemDados = Imagens.pngComCabecalho(20, 20);

        assertErro(HttpStatus.UNPROCESSABLE_CONTENT, "INVALID_IMAGE", () -> validador.validar("image/jpeg", truncado));
        assertErro(HttpStatus.UNPROCESSABLE_CONTENT, "INVALID_IMAGE", () -> validador.validar("image/jpeg", lixo));
        assertErro(HttpStatus.UNPROCESSABLE_CONTENT, "INVALID_IMAGE", () -> validador.validar("image/png", Arrays.copyOf(Imagens.ASSINATURA_PNG, 20)));
        assertErro(HttpStatus.UNPROCESSABLE_CONTENT, "INVALID_IMAGE", () -> validador.validar("image/png", pngSemDados));
    }

    static void assertErro(HttpStatus status, String codigo, Runnable acao) {
        ApiException erro = assertThrows(ApiException.class, acao::run);
        assertEquals(status, erro.status());
        assertEquals(codigo, erro.code());
    }
}
