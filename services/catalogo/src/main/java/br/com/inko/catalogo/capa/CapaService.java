package br.com.inko.catalogo.capa;

import br.com.inko.catalogo.api.ApiException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.NoSuchFileException;
import java.time.Clock;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.support.TransactionOperations;

public class CapaService {
    private static final Logger LOG = LoggerFactory.getLogger(CapaService.class);
    private static final int TENTATIVAS_LEITURA = 2;

    private final CapaRepository repository;
    private final ValidadorCapa validador;
    private final ObjetosCapa armazenamento;
    private final TransactionOperations transacao;
    private final Clock relogio;

    public CapaService(CapaRepository repository, ValidadorCapa validador, ObjetosCapa armazenamento,
            TransactionOperations transacao, Clock relogio) {
        this.repository = repository;
        this.validador = validador;
        this.armazenamento = armazenamento;
        this.transacao = transacao;
        this.relogio = relogio;
    }

    public record CapaConteudo(CapaLivro capa, InputStream conteudo) {
    }

    public CapaLivro substituir(String livroIdInformado, String mimeDeclarado, byte[] conteudo) {
        String livroId = normalizar(livroIdInformado);
        if (!repository.livroExiste(livroId)) {
            throw livroNaoEncontrado(livroId);
        }
        ImagemValidada imagem = validador.validar(mimeDeclarado, conteudo);
        String chave = armazenamento.gravar(imagem);
        CapaLivro nova = new CapaLivro(livroId, chave, imagem.formato().mimeType(), imagem.tamanhoBytes(), imagem.sha256(),
                imagem.largura(), imagem.altura(), relogio.instant());
        Optional<CapaLivro> anterior;
        try {
            anterior = Objects.requireNonNullElse(transacao.execute(status -> {
                exigirLivroBloqueado(livroId);
                Optional<CapaLivro> atual = repository.buscar(livroId);
                repository.salvar(nova);
                return atual;
            }), Optional.empty());
        } catch (RuntimeException falha) {
            armazenamento.remover(chave);
            throw falha;
        }
        anterior.map(CapaLivro::objectKey).filter(antiga -> !antiga.equals(chave)).ifPresent(armazenamento::remover);
        return nova;
    }

    public CapaLivro buscar(String livroIdInformado) {
        String livroId = normalizar(livroIdInformado);
        return repository.buscar(livroId).orElseThrow(() -> CapaErros.capaNaoEncontrada(livroId));
    }

    public CapaConteudo abrir(String livroIdInformado) {
        for (int tentativa = 1; tentativa <= TENTATIVAS_LEITURA; tentativa++) {
            CapaLivro capa = buscar(livroIdInformado);
            try {
                return new CapaConteudo(capa, armazenamento.abrir(capa.objectKey()));
            } catch (NoSuchFileException ausente) {
                LOG.warn("Arquivo da capa do livro {} ausente na tentativa {}.", capa.livroId(), tentativa);
            } catch (IOException falha) {
                LOG.error("Falha ao ler a capa do livro {}.", capa.livroId(), falha);
                throw CapaErros.armazenamentoIndisponivel();
            }
        }
        throw CapaErros.capaNaoEncontrada(normalizar(livroIdInformado));
    }

    public void remover(String livroIdInformado) {
        String livroId = normalizar(livroIdInformado);
        CapaLivro removida = Objects.requireNonNull(transacao.execute(status -> {
            exigirLivroBloqueado(livroId);
            CapaLivro atual = repository.buscar(livroId).orElseThrow(() -> CapaErros.capaNaoEncontrada(livroId));
            repository.remover(livroId);
            return atual;
        }));
        armazenamento.remover(removida.objectKey());
    }

    private void exigirLivroBloqueado(String livroId) {
        if (!repository.bloquearLivro(livroId)) {
            throw livroNaoEncontrado(livroId);
        }
    }

    private static String normalizar(String livroId) {
        return livroId == null ? "" : livroId.strip().toUpperCase(Locale.ROOT);
    }

    private static ApiException livroNaoEncontrado(String livroId) {
        return ApiException.naoEncontrado("Livro " + livroId + " não encontrado.");
    }
}
