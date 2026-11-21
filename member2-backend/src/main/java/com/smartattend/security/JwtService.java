package com.smartattend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class JwtService {

    private final SecretKey key;
    private final long ttlMs;

    public JwtService(@Value("${smartattend.jwt.secret}") String secret,
                      @Value("${smartattend.jwt.expires-hours}") long hours) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)); // secret must be >= 32 chars
        this.ttlMs = hours * 3_600_000L;
    }

    public String sign(long id, String role, String name) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .subject(Long.toString(id))
                .claim("role", role)
                .claim("name", name)
                .issuedAt(new Date(now))
                .expiration(new Date(now + ttlMs))
                .signWith(key)
                .compact();
    }

    public CurrentUser parse(String token) {
        Claims c = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        return new CurrentUser(Long.parseLong(c.getSubject()), c.get("role", String.class), c.get("name", String.class));
    }
}
