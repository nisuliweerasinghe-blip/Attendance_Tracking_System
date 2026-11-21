package com.smartattend.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Logs every event and, if smartattend.webhook-url is set, POSTs it as JSON
 * {"event": "...", "payload": {...}} so a Node/Socket.IO service can broadcast it.
 */
@Component
public class WebhookNotifier {

    private static final Logger log = LoggerFactory.getLogger(WebhookNotifier.class);

    private final String url;
    private final ObjectMapper mapper;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();

    public WebhookNotifier(@Value("${smartattend.webhook-url:}") String url, ObjectMapper mapper) {
        this.url = url;
        this.mapper = mapper;
    }

    @EventListener
    public void on(AppEvent e) {
        log.info("[event] {} {}", e.type(), e.payload());
        if (url == null || url.isBlank()) return;
        try {
            String json = mapper.writeValueAsString(Map.of("event", e.type(), "payload", e.payload()));
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(3))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();
            client.sendAsync(req, HttpResponse.BodyHandlers.discarding())
                    .exceptionally(ex -> { log.warn("Webhook failed: {}", ex.getMessage()); return null; });
        } catch (Exception ex) {
            log.warn("Webhook error: {}", ex.getMessage());
        }
    }
}
