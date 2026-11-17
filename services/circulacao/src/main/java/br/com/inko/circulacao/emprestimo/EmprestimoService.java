package br.com.inko.circulacao.emprestimo;

import br.com.inko.circulacao.api.ApiException;
import br.com.inko.circulacao.referencia.Referencias;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

@Service
public class EmprestimoService {
    public static final int PRAZO_PADRAO_DIAS = 14;

    private final EmprestimoRepository repository;
    private final Referencias referencias;
    private final Clock relogio;

    public EmprestimoService(EmprestimoRepository repository, Referencias referencias, Clock relogio) {
        this.repository = repository;
        this.referencias = referencias;
        this.relogio = relogio;
    }

    public record NovoEmprestimo(String livroId, String usuarioId, LocalDate dataEmprestimo, LocalDate dataPrevista) {
    }

    public record Disponibilidade(String livroId, boolean disponivel, String emprestimoId, String usuarioId, LocalDate dataPrevista) {
    }

    public Emprestimo registrar(NovoEmprestimo dados) {
        LocalDate inicio = dados.dataEmprestimo() != null ? dados.dataEmprestimo() : LocalDate.now(relogio);
        LocalDate prevista = dados.dataPrevista() != null ? dados.dataPrevista() : inicio.plusDays(PRAZO_PADRAO_DIAS);
        Emprestimo emprestimo = new Emprestimo(null, dados.livroId(), dados.usuarioId(), inicio, prevista, null);
        if (!referencias.livroExiste(emprestimo.livroId())) {
            throw ApiException.invalido("A obra " + emprestimo.livroId() + " não existe no catálogo.", "livroId");
        }
        if (!referencias.usuarioExiste(emprestimo.usuarioId())) {
            throw ApiException.invalido("O usuário " + emprestimo.usuarioId() + " não está cadastrado.", "usuarioId");
        }
        try {
            return repository.inserir(emprestimo);
        } catch (DuplicateKeyException exception) {
            throw indisponivel(emprestimo.livroId());
        }
    }

    public Emprestimo devolver(String id, LocalDate data) {
        Emprestimo atual = buscar(id);
        Emprestimo devolvido = atual.devolver(data != null ? data : LocalDate.now(relogio));
        if (!repository.registrarDevolucao(devolvido.id(), devolvido.dataDevolucao())) {
            throw ApiException.conflito("ALREADY_RETURNED", "O empréstimo " + devolvido.id() + " já foi devolvido.", null);
        }
        return devolvido;
    }

    public Disponibilidade disponibilidade(String livroId) {
        String id = livroId.toUpperCase();
        if (!referencias.livroExiste(id)) {
            throw ApiException.naoEncontrado("Livro " + id + " não encontrado.");
        }
        return repository.ativoDoLivro(id)
                .map(ativo -> new Disponibilidade(id, false, ativo.id(), ativo.usuarioId(), ativo.dataPrevista()))
                .orElseGet(() -> new Disponibilidade(id, true, null, null, null));
    }

    public Emprestimo buscar(String id) {
        return repository.buscar(id.toUpperCase())
                .orElseThrow(() -> ApiException.naoEncontrado("Empréstimo " + id + " não encontrado."));
    }

    public List<Emprestimo> listar(String usuarioId, String livroId) {
        return repository.listar().stream()
                .filter(emprestimo -> usuarioId == null || usuarioId.isBlank() || emprestimo.usuarioId().equalsIgnoreCase(usuarioId.strip()))
                .filter(emprestimo -> livroId == null || livroId.isBlank() || emprestimo.livroId().equalsIgnoreCase(livroId.strip()))
                .toList();
    }

    public List<Emprestimo> ativos() {
        return CirculacaoFuncoes.filtrarAtivos(repository.listar());
    }

    public List<Emprestimo> atrasados(LocalDate referencia) {
        LocalDate data = referencia != null ? referencia : LocalDate.now(relogio);
        return CirculacaoFuncoes.identificarEmprestimosAtrasados(repository.listar(), data);
    }

    private ApiException indisponivel(String livroId) {
        String detalhe = repository.ativoDoLivro(livroId)
                .map(ativo -> " Emprestada a " + ativo.usuarioId() + " até " + ativo.dataPrevista() + ".")
                .orElse("");
        return ApiException.conflito("BOOK_UNAVAILABLE", "Obra indisponível: já existe um empréstimo ativo." + detalhe, "livroId");
    }
}
