package br.com.inko.circulacao.emprestimo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import br.com.inko.circulacao.api.ApiException;
import br.com.inko.circulacao.emprestimo.EmprestimoService.NovoEmprestimo;
import br.com.inko.circulacao.referencia.Referencias;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;

class EmprestimoTest {
    private static final LocalDate REFERENCIA = LocalDate.of(2026, 11, 9);
    private static final Clock RELOGIO = Clock.fixed(REFERENCIA.atStartOfDay().toInstant(ZoneOffset.UTC), ZoneOffset.UTC);

    static class MemoriaEmprestimoRepository implements EmprestimoRepository {
        final List<Emprestimo> emprestimos = new ArrayList<>();

        @Override
        public Emprestimo inserir(Emprestimo emprestimo) {
            if (ativoDoLivro(emprestimo.livroId()).isPresent()) {
                throw new DuplicateKeyException("uq_emprestimo_ativo_livro");
            }
            Emprestimo salvo = new Emprestimo("EMP-" + (10500 + emprestimos.size()), emprestimo.livroId(), emprestimo.usuarioId(),
                    emprestimo.dataEmprestimo(), emprestimo.dataPrevista(), null);
            emprestimos.add(salvo);
            return salvo;
        }

        @Override
        public boolean registrarDevolucao(String id, LocalDate data) {
            for (int i = 0; i < emprestimos.size(); i++) {
                Emprestimo atual = emprestimos.get(i);
                if (atual.id().equals(id) && atual.ativo()) {
                    emprestimos.set(i, atual.devolver(data));
                    return true;
                }
            }
            return false;
        }

        @Override
        public Optional<Emprestimo> buscar(String id) {
            return emprestimos.stream().filter(e -> e.id().equals(id)).findFirst();
        }

        @Override
        public Optional<Emprestimo> ativoDoLivro(String livroId) {
            return emprestimos.stream().filter(Emprestimo::ativo).filter(e -> e.livroId().equals(livroId)).findFirst();
        }

        @Override
        public List<Emprestimo> listar() {
            return List.copyOf(emprestimos);
        }
    }

    record ReferenciasFixas(Set<String> livros, Set<String> usuarios, boolean disponivel) implements Referencias {
        @Override
        public boolean livroExiste(String livroId) {
            exigirDisponivel();
            return livros.contains(livroId);
        }

        @Override
        public boolean usuarioExiste(String usuarioId) {
            exigirDisponivel();
            return usuarios.contains(usuarioId);
        }

        private void exigirDisponivel() {
            if (!disponivel) {
                throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "DEPENDENCY_UNAVAILABLE", "indisponível", null);
            }
        }
    }

    private static final Referencias REFERENCIAS = new ReferenciasFixas(Set.of("INK-0004", "INK-0006"), Set.of("USR-0110", "USR-0203"), true);

    private static Emprestimo emprestimo(String id, String livro, LocalDate inicio, LocalDate prevista, LocalDate devolucao) {
        return new Emprestimo(id, livro, "USR-0110", inicio, prevista, devolucao);
    }

    private static EmprestimoService servico(MemoriaEmprestimoRepository repository, Referencias referencias) {
        return new EmprestimoService(repository, referencias, RELOGIO);
    }

    @Test
    void atrasoExigeAtivoEVencimentoAnteriorAReferencia() {
        Emprestimo venceHoje = emprestimo("EMP-1", "INK-0001", REFERENCIA.minusDays(14), REFERENCIA, null);
        Emprestimo venceuOntem = emprestimo("EMP-2", "INK-0002", REFERENCIA.minusDays(15), REFERENCIA.minusDays(1), null);
        Emprestimo devolvido = emprestimo("EMP-3", "INK-0003", REFERENCIA.minusDays(30), REFERENCIA.minusDays(16), REFERENCIA.minusDays(2));

        assertFalse(venceHoje.atrasadoEm(REFERENCIA));
        assertEquals(0, venceHoje.diasDeAtraso(REFERENCIA));
        assertTrue(venceuOntem.atrasadoEm(REFERENCIA));
        assertEquals(1, venceuOntem.diasDeAtraso(REFERENCIA));
        assertFalse(devolvido.atrasadoEm(REFERENCIA));
    }

    @Test
    void funcoesPurasFiltramSemAlterarEntrada() {
        Emprestimo ativoEmDia = emprestimo("EMP-1", "INK-0001", REFERENCIA.minusDays(1), REFERENCIA.plusDays(13), null);
        Emprestimo ativoAtrasado = emprestimo("EMP-2", "INK-0002", REFERENCIA.minusDays(20), REFERENCIA.minusDays(6), null);
        Emprestimo devolvido = emprestimo("EMP-3", "INK-0003", REFERENCIA.minusDays(30), REFERENCIA.minusDays(16), REFERENCIA.minusDays(2));
        List<Emprestimo> entrada = List.of(ativoEmDia, ativoAtrasado, devolvido);
        List<Emprestimo> copia = new ArrayList<>(entrada);

        assertEquals(List.of(ativoEmDia, ativoAtrasado), CirculacaoFuncoes.filtrarAtivos(entrada));
        assertEquals(List.of(ativoAtrasado), CirculacaoFuncoes.identificarEmprestimosAtrasados(entrada, REFERENCIA));
        assertEquals(List.of(), CirculacaoFuncoes.identificarEmprestimosAtrasados(List.of(), REFERENCIA));
        assertEquals(Optional.of(ativoAtrasado), CirculacaoFuncoes.emprestimoAtivoDoLivro(entrada, "INK-0002"));
        assertEquals(Optional.empty(), CirculacaoFuncoes.emprestimoAtivoDoLivro(entrada, "INK-0003"));
        assertEquals(copia, entrada);
    }

    @Test
    void prazoInvalidoERecusado() {
        assertEquals("dataPrevista", assertThrows(ApiException.class,
                () -> emprestimo(null, "INK-0001", REFERENCIA, REFERENCIA, null)).field());
        assertEquals("dataPrevista", assertThrows(ApiException.class,
                () -> emprestimo(null, "INK-0001", REFERENCIA, REFERENCIA.plusDays(61), null)).field());
        assertEquals("dataDevolucao", assertThrows(ApiException.class,
                () -> emprestimo(null, "INK-0001", REFERENCIA, REFERENCIA.plusDays(14), REFERENCIA.minusDays(1))).field());
    }

    @Test
    void emprestimoValidoUsaPrazoPadraoETornaLivroIndisponivel() {
        MemoriaEmprestimoRepository repository = new MemoriaEmprestimoRepository();
        EmprestimoService service = servico(repository, REFERENCIAS);

        Emprestimo criado = service.registrar(new NovoEmprestimo("ink-0004", "usr-0110", null, null));

        assertEquals("INK-0004", criado.livroId());
        assertEquals(REFERENCIA, criado.dataEmprestimo());
        assertEquals(REFERENCIA.plusDays(14), criado.dataPrevista());
        assertNull(criado.dataDevolucao());
        assertFalse(service.disponibilidade("INK-0004").disponivel());
        assertTrue(service.disponibilidade("INK-0006").disponivel());
    }

    @Test
    void livroIndisponivelGeraConflito() {
        MemoriaEmprestimoRepository repository = new MemoriaEmprestimoRepository();
        EmprestimoService service = servico(repository, REFERENCIAS);
        service.registrar(new NovoEmprestimo("INK-0004", "USR-0110", REFERENCIA, REFERENCIA.plusDays(7)));

        ApiException conflito = assertThrows(ApiException.class,
                () -> service.registrar(new NovoEmprestimo("INK-0004", "USR-0203", REFERENCIA, REFERENCIA.plusDays(7))));
        assertEquals(HttpStatus.CONFLICT, conflito.status());
        assertEquals("BOOK_UNAVAILABLE", conflito.code());
        assertEquals(1, repository.emprestimos.size());
    }

    @Test
    void referenciasInexistentesOuIndisponiveisNaoGravam() {
        MemoriaEmprestimoRepository repository = new MemoriaEmprestimoRepository();
        EmprestimoService service = servico(repository, REFERENCIAS);
        assertEquals("livroId", assertThrows(ApiException.class,
                () -> service.registrar(new NovoEmprestimo("INK-9999", "USR-0110", null, null))).field());
        assertEquals("usuarioId", assertThrows(ApiException.class,
                () -> service.registrar(new NovoEmprestimo("INK-0004", "USR-9999", null, null))).field());

        EmprestimoService semCatalogo = servico(repository, new ReferenciasFixas(Set.of(), Set.of(), false));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, assertThrows(ApiException.class,
                () -> semCatalogo.registrar(new NovoEmprestimo("INK-0004", "USR-0110", null, null))).status());
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, assertThrows(ApiException.class,
                () -> semCatalogo.disponibilidade("INK-0004")).status());
        assertTrue(repository.emprestimos.isEmpty());
    }

    @Test
    void devolucaoEncerraLiberaLivroERecusaRepeticao() {
        MemoriaEmprestimoRepository repository = new MemoriaEmprestimoRepository();
        EmprestimoService service = servico(repository, REFERENCIAS);
        Emprestimo criado = service.registrar(new NovoEmprestimo("INK-0004", "USR-0110", REFERENCIA.minusDays(20), REFERENCIA.minusDays(6)));

        Emprestimo devolvido = service.devolver(criado.id(), REFERENCIA);
        assertEquals(REFERENCIA, devolvido.dataDevolucao());
        assertTrue(service.disponibilidade("INK-0004").disponivel());

        ApiException repetida = assertThrows(ApiException.class, () -> service.devolver(criado.id(), REFERENCIA.plusDays(1)));
        assertEquals(HttpStatus.CONFLICT, repetida.status());
        assertEquals(REFERENCIA, service.buscar(criado.id()).dataDevolucao());

        Emprestimo novo = service.registrar(new NovoEmprestimo("INK-0004", "USR-0203", REFERENCIA, REFERENCIA.plusDays(14)));
        assertEquals("USR-0203", novo.usuarioId());
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ApiException.class, () -> service.devolver("EMP-1", REFERENCIA)).status());
    }

    @Test
    void consultasDeAtivosEAtrasadosUsamReferenciaExplicita() {
        MemoriaEmprestimoRepository repository = new MemoriaEmprestimoRepository();
        EmprestimoService service = servico(repository, REFERENCIAS);
        service.registrar(new NovoEmprestimo("INK-0004", "USR-0110", REFERENCIA.minusDays(20), REFERENCIA.minusDays(6)));
        service.registrar(new NovoEmprestimo("INK-0006", "USR-0203", REFERENCIA, REFERENCIA.plusDays(14)));

        assertEquals(2, service.ativos().size());
        assertEquals(1, service.atrasados(REFERENCIA).size());
        assertEquals(0, service.atrasados(REFERENCIA.minusDays(10)).size());
        assertEquals(1, service.listar("USR-0203", null).size());
    }
}
