package br.com.inko.usuarios;

import static org.junit.jupiter.api.Assertions.assertEquals;
import org.junit.jupiter.api.Test;

class HealthControllerTest {
    @Test
    void returnsServiceAndStatus() {
        var result = new HealthController().ping();
        assertEquals("usuarios", result.get("service"));
        assertEquals("ok", result.get("status"));
    }
}
