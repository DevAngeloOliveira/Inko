package br.com.inko.usuarios.auth;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class BootstrapAdministrador implements ApplicationRunner {
    static final int MIN_SENHA = 12;
    private static final int MAX_EMAIL = 160;
    private static final int MAX_NOME = 120;
    private static final Logger LOG = LoggerFactory.getLogger(BootstrapAdministrador.class);
    private static final Pattern EMAIL = Pattern.compile("[^@\\s]+@[^@\\s]+\\.[^@\\s]+");
    private static final String NOME_PADRAO = "Administrador INKO";
    private static final String JA_EXISTE = "Operador administrador inicial já existe; nenhuma alteração realizada.";

    public enum Resultado {
        NAO_CONFIGURADO,
        CRIADO,
        EXISTENTE
    }

    private final OperadorRepository repository;
    private final PasswordEncoder encoder;
    private final Clock clock;
    private final String email;
    private final String senha;
    private final String nome;

    public BootstrapAdministrador(OperadorRepository repository, PasswordEncoder encoder, Clock clock,
            @Value("${inko.auth.bootstrap-admin.email:}") String email,
            @Value("${inko.auth.bootstrap-admin.password:}") String senha,
            @Value("${inko.auth.bootstrap-admin.name:" + NOME_PADRAO + "}") String nome) {
        this.repository = repository;
        this.encoder = encoder;
        this.clock = clock;
        this.email = email;
        this.senha = senha;
        this.nome = nome == null || nome.isBlank() ? NOME_PADRAO : nome.strip();
    }

    @Override
    public void run(ApplicationArguments args) {
        executar();
    }

    public Resultado executar() {
        boolean semEmail = email == null || email.isBlank();
        boolean semSenha = senha == null || senha.isEmpty();
        if (semEmail && semSenha) {
            LOG.info("Nenhum operador administrador inicial foi criado: INKO_BOOTSTRAP_ADMIN_EMAIL e INKO_BOOTSTRAP_ADMIN_PASSWORD não definidos.");
            return Resultado.NAO_CONFIGURADO;
        }
        if (semEmail || semSenha) {
            throw new IllegalStateException(
                    "Defina INKO_BOOTSTRAP_ADMIN_EMAIL e INKO_BOOTSTRAP_ADMIN_PASSWORD juntos para criar o administrador inicial.");
        }
        String normalizado = Operador.normalizarEmail(email);
        validar(normalizado);
        if (repository.existeEmail(normalizado)) {
            LOG.info(JA_EXISTE);
            return Resultado.EXISTENTE;
        }
        Operador administrador = new Operador(UUID.randomUUID(), normalizado, nome, encoder.encode(senha), Papel.ADMIN, true);
        try {
            repository.inserir(administrador, clock.instant());
        } catch (DuplicateKeyException exception) {
            LOG.info(JA_EXISTE);
            return Resultado.EXISTENTE;
        }
        LOG.info("Operador administrador inicial criado.");
        return Resultado.CRIADO;
    }

    private void validar(String normalizado) {
        if (normalizado.length() > MAX_EMAIL || !EMAIL.matcher(normalizado).matches()) {
            throw new IllegalStateException("INKO_BOOTSTRAP_ADMIN_EMAIL não contém um e-mail válido.");
        }
        if (senha.length() < MIN_SENHA) {
            throw new IllegalStateException(
                    "INKO_BOOTSTRAP_ADMIN_PASSWORD deve ter pelo menos " + MIN_SENHA + " caracteres.");
        }
        if (senha.getBytes(StandardCharsets.UTF_8).length > AuthService.MAX_BYTES_SENHA) {
            throw new IllegalStateException(
                    "INKO_BOOTSTRAP_ADMIN_PASSWORD deve ter no máximo " + AuthService.MAX_BYTES_SENHA + " bytes.");
        }
        if (nome.length() > MAX_NOME) {
            throw new IllegalStateException("INKO_BOOTSTRAP_ADMIN_NAME deve ter no máximo " + MAX_NOME + " caracteres.");
        }
    }
}
