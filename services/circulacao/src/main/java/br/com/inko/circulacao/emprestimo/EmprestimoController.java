package br.com.inko.circulacao.emprestimo;

import br.com.inko.circulacao.emprestimo.EmprestimoService.Disponibilidade;
import br.com.inko.circulacao.emprestimo.EmprestimoService.NovoEmprestimo;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class EmprestimoController {
    private final EmprestimoService service;

    public EmprestimoController(EmprestimoService service) {
        this.service = service;
    }

    public record Devolucao(LocalDate dataDevolucao) {
    }

    @GetMapping("/api/v1/livros/{id}/disponibilidade")
    public Disponibilidade disponibilidade(@PathVariable String id) {
        return service.disponibilidade(id);
    }

    @GetMapping("/api/v1/emprestimos")
    public List<Emprestimo> listar(@RequestParam(required = false) String usuarioId, @RequestParam(required = false) String livroId) {
        return service.listar(usuarioId, livroId);
    }

    @GetMapping("/api/v1/emprestimos/ativos")
    public List<Emprestimo> ativos() {
        return service.ativos();
    }

    @GetMapping("/api/v1/emprestimos/atrasados")
    public List<Emprestimo> atrasados(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate referenceDate) {
        return service.atrasados(referenceDate);
    }

    @GetMapping("/api/v1/emprestimos/{id}")
    public Emprestimo buscar(@PathVariable String id) {
        return service.buscar(id);
    }

    @PostMapping("/api/v1/emprestimos")
    @ResponseStatus(HttpStatus.CREATED)
    public Emprestimo registrar(@RequestBody NovoEmprestimo dados) {
        return service.registrar(dados);
    }

    @PostMapping("/api/v1/emprestimos/{id}/devolucao")
    public Emprestimo devolver(@PathVariable String id, @RequestBody(required = false) Devolucao dados) {
        return service.devolver(id, dados == null ? null : dados.dataDevolucao());
    }
}
