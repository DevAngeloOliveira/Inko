package br.com.inko.usuarios.auth;

import java.time.Clock;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration(proxyBeanMethods = false)
public class AuthConfiguration {
    @Bean
    Clock relogioAutenticacao() {
        return Clock.systemUTC();
    }

    @Bean
    PasswordEncoder passwordEncoder(@Value("${inko.auth.bcrypt-strength:12}") int strength) {
        return new BCryptPasswordEncoder(strength);
    }

    @Bean
    LoginRateLimiter loginRateLimiter(Clock clock,
            @Value("${inko.auth.login.max-falhas-email:5}") int maxFalhasEmail,
            @Value("${inko.auth.login.max-falhas-ip:20}") int maxFalhasIp,
            @Value("${inko.auth.login.janela:15m}") Duration janela,
            @Value("${inko.auth.login.max-chaves:100000}") int maxChaves) {
        return new LoginRateLimiter(clock, maxFalhasEmail, maxFalhasIp, janela, maxChaves);
    }

    @Bean
    AuthService authService(OperadorRepository repository, PasswordEncoder encoder, LoginRateLimiter limiter,
            Clock clock, @Value("${inko.auth.session-ttl:8h}") Duration ttl) {
        return new AuthService(repository, encoder, limiter, clock, ttl);
    }
}
