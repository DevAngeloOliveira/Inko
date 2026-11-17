package br.com.inko.usuarios.auth;

public final class IpCliente {
    private static final String DESCONHECIDO = "desconhecido";

    private IpCliente() {
    }

    public static String resolver(String forwardedFor, String remoteAddr) {
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            String ultimo = forwardedFor.substring(forwardedFor.lastIndexOf(',') + 1).strip();
            if (!ultimo.isEmpty()) {
                return ultimo;
            }
        }
        return remoteAddr == null || remoteAddr.isBlank() ? DESCONHECIDO : remoteAddr.strip();
    }
}
