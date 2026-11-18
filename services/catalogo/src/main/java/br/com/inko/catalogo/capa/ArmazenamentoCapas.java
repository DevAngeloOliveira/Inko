package br.com.inko.catalogo.capa;

import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ArmazenamentoCapas implements ObjetosCapa {
    private static final Logger LOG = LoggerFactory.getLogger(ArmazenamentoCapas.class);
    private static final Pattern CHAVE = Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png)");
    private static final Set<PosixFilePermission> PERMISSOES = PosixFilePermissions.fromString("rw-r-----");

    private final Path raiz;
    private final boolean posix;
    private final Movimentacao movimentacao;

    public ArmazenamentoCapas(Path raiz) {
        this(raiz, (origem, destino) -> Files.move(origem, destino, StandardCopyOption.ATOMIC_MOVE));
    }

    ArmazenamentoCapas(Path raiz, Movimentacao movimentacao) {
        this.raiz = raiz.toAbsolutePath().normalize();
        this.posix = this.raiz.getFileSystem().supportedFileAttributeViews().contains("posix");
        this.movimentacao = movimentacao;
    }

    @FunctionalInterface
    interface Movimentacao {
        void mover(Path origem, Path destino) throws IOException;
    }

    public String gravar(ImagemValidada imagem) {
        String chave = UUID.randomUUID() + imagem.formato().extensao();
        Path destino = resolver(chave);
        Path temporario = null;
        try {
            Files.createDirectories(raiz);
            temporario = Files.createTempFile(raiz, ".upload-", ".tmp");
            escrever(temporario, imagem.conteudo());
            if (posix) {
                Files.setPosixFilePermissions(temporario, PERMISSOES);
            }
            movimentacao.mover(temporario, destino);
            temporario = null;
            sincronizarDiretorio();
            return chave;
        } catch (IOException falha) {
            LOG.error("Falha ao gravar capa no armazenamento local.", falha);
            throw CapaErros.armazenamentoIndisponivel();
        } finally {
            if (temporario != null) {
                apagarSilenciosamente(temporario);
            }
        }
    }

    public InputStream abrir(String chave) throws IOException {
        return Files.newInputStream(resolver(chave), StandardOpenOption.READ);
    }

    public void remover(String chave) {
        apagarSilenciosamente(resolver(chave));
    }

    public boolean existe(String chave) {
        return Files.isRegularFile(resolver(chave));
    }

    Path resolver(String chave) {
        if (chave == null || !CHAVE.matcher(chave).matches()) {
            throw new IllegalArgumentException("Chave de objeto inválida.");
        }
        Path caminho = raiz.resolve(chave).normalize();
        if (!caminho.startsWith(raiz) || !raiz.equals(caminho.getParent())) {
            throw new IllegalArgumentException("Chave de objeto fora da raiz de mídia.");
        }
        return caminho;
    }

    Path raiz() {
        return raiz;
    }

    private static void escrever(Path arquivo, byte[] conteudo) throws IOException {
        try (FileChannel canal = FileChannel.open(arquivo, StandardOpenOption.WRITE, StandardOpenOption.TRUNCATE_EXISTING)) {
            ByteBuffer buffer = ByteBuffer.wrap(conteudo);
            while (buffer.hasRemaining()) {
                canal.write(buffer);
            }
            canal.force(true);
        }
    }

    private void sincronizarDiretorio() {
        if (!posix) {
            return;
        }
        try (FileChannel canal = FileChannel.open(raiz, StandardOpenOption.READ)) {
            canal.force(true);
        } catch (IOException falha) {
            LOG.debug("Sincronização do diretório de mídia não suportada.", falha);
        }
    }

    private static void apagarSilenciosamente(Path arquivo) {
        try {
            Files.deleteIfExists(arquivo);
        } catch (IOException falha) {
            LOG.warn("Não foi possível remover o arquivo de mídia {}.", arquivo.getFileName(), falha);
        }
    }
}
