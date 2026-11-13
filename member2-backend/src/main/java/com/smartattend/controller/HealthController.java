package com.smartattend.controller;

import com.smartattend.util.Time;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

    /** Availability / latency probe for Member 3. */
    @GetMapping("/api/health")
    public Map<String, Object> health() {
        return Map.of("status", "ok", "serverTime", Time.iso(System.currentTimeMillis()));
    }
}
