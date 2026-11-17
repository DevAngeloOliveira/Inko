package br.com.inko.relatorios.biblioteca;

import br.com.inko.relatorios.biblioteca.Biblioteca.Estatisticas;
import br.com.inko.relatorios.biblioteca.Biblioteca.RelatorioMultas;
import br.com.inko.relatorios.fonte.FonteBiblioteca;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/relatorios")
public class RelatorioController {
    private final FonteBiblioteca fonte;
    private final Clock relogio = Clock.system(ZoneId.of("America/Sao_Paulo"));

    public RelatorioController(FonteBiblioteca fonte) {
        this.fonte = fonte;
    }

    @GetMapping("/multas")
    public RelatorioMultas multas(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate referenceDate) {
        return fonte.carregar().relatorioMultas(referencia(referenceDate));
    }

    @GetMapping("/estatisticas")
    public Estatisticas estatisticas(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate referenceDate) {
        return fonte.carregar().estatisticas(referencia(referenceDate));
    }

    private LocalDate referencia(LocalDate informada) {
        return informada != null ? informada : LocalDate.now(relogio);
    }
}
