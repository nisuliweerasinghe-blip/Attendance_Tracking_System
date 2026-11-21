package com.smartattend.event;

import java.util.Map;

/**
 * Internal event published by the REST layer (the Java version of events.js).
 * Types: "session:created", "session:closed", "attendance:recorded".
 * Member 1 can consume these via @EventListener, or via the webhook (see WebhookNotifier).
 */
public record AppEvent(String type, Map<String, Object> payload) {}
