package br.com.inko.circulacao;

import java.time.Clock;
import java.time.ZoneId;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class CirculacaoApplication {
    public static void main(String[] args) {
        SpringApplication.run(CirculacaoApplication.class, args);
    }

    @Bean
    Clock relogio() {
        return Clock.system(ZoneId.of("America/Sao_Paulo"));
    }
}
