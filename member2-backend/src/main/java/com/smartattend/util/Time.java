package com.smartattend.util;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

public final class Time {
    private static final DateTimeFormatter ISO =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC);

    private Time() {}

    /** Epoch millis -> "2026-11-12T09:48:00.462Z" (always 3 fractional digits). */
    public static String iso(long epochMillis) {
        return ISO.format(Instant.ofEpochMilli(epochMillis));
    }
}
