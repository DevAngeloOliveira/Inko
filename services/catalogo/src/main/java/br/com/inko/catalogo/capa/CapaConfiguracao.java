package br.com.inko.catalogo.capa;

import java.nio.file.Path;
import java.time.Clock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Configuration(proxyBeanMethods = false)
public class CapaConfiguracao {
    @Bean
    ValidadorCapa validadorCapa() {
        return new ValidadorCapa();
    }

    @Bean
    ArmazenamentoCapas armazenamentoCapas(@Value("${inko.media.root:/var/lib/inko/covers}") String raiz) {
        return new ArmazenamentoCapas(Path.of(raiz));
    }

    @Bean
    CapaService capaService(CapaRepository repository, ValidadorCapa validador, ArmazenamentoCapas armazenamento,
            PlatformTransactionManager transacoes) {
        return new CapaService(repository, validador, armazenamento, new TransactionTemplate(transacoes), Clock.systemUTC());
    }
}
