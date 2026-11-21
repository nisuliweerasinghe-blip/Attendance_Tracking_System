package com.smartattend.util;

import com.smartattend.error.ApiException;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/** Simple in-memory fixed-window limiter (per key). */
@Component
public class RateLimiter {

    private final ConcurrentHashMap<String, long[]> windows = new ConcurrentHashMap<>();

    public void check(String key, int max, long windowMs) {
        long now = System.currentTimeMillis();
        long[] w = windows.compute(key, (k, old) -> {
            if (old == null || now - old[0] >= windowMs) return new long[] {now, 1};
            old[1]++;
            return old;
        });
        if (w[1] > max) throw new ApiException(429, "RATE_LIMITED", "Too many attempts, try again later");
    }
}
