package br.com.inko.catalogo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import org.junit.jupiter.api.Test;

class HealthControllerTest {
    @Test
    void returnsServiceAndStatus() {
        var result = new HealthController().ping();
        assertEquals("catalogo", result.get("service"));
        assertEquals("ok", result.get("status"));
    }
}
