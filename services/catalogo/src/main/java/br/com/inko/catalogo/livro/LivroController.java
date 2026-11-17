package br.com.inko.catalogo.livro;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/livros")
public class LivroController {
    private final CatalogoService service;

    public LivroController(CatalogoService service) {
        this.service = service;
    }

    @GetMapping
    public List<Livro> listar(@RequestParam(required = false) String categoria, @RequestParam(required = false) String q) {
        return service.listar(categoria, q);
    }

    @GetMapping("/{id}")
    public Livro buscar(@PathVariable String id) {
        return service.buscar(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Livro cadastrar(@RequestBody Livro livro) {
        return service.cadastrar(livro);
    }
}
