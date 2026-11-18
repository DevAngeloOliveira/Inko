package br.com.inko.usuarios.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import java.util.regex.Pattern;

public final class TokenSessao {
    private static final int BYTES = 32;
    private static final Pattern FORMATO = Pattern.compile("[A-Za-z0-9_-]{43}");
    private static final String BEARER = "bearer ";
    private static final SecureRandom ALEATORIO = new SecureRandom();

    private TokenSessao() {
    }

    public static String gerar() {
        byte[] bytes = new byte[BYTES];
        ALEATORIO.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public static boolean formatoValido(String token) {
        return token != null && FORMATO.matcher(token).matches();
    }

    public static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.US_ASCII));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 indisponível.", exception);
        }
    }

    public static Optional<String> extrairBearer(String authorization) {
        if (authorization == null || authorization.length() <= BEARER.length()
                || !authorization.regionMatches(true, 0, BEARER, 0, BEARER.length())) {
            return Optional.empty();
        }
        String token = authorization.substring(BEARER.length()).strip();
        return formatoValido(token) ? Optional.of(token) : Optional.empty();
    }
}
