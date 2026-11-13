package com.smartattend.security;

import com.smartattend.error.ApiException;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/** Validates the Bearer token on every protected /api route and exposes the user as request attribute "user". */
@Component
public class AuthInterceptor implements HandlerInterceptor {

    private final JwtService jwt;

    public AuthInterceptor(JwtService jwt) {
        this.jwt = jwt;
    }

    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
        if ("OPTIONS".equalsIgnoreCase(req.getMethod())) return true; // CORS preflight

        String header = req.getHeader("Authorization");
        String[] parts = header == null ? new String[0] : header.trim().split(" ");
        if (parts.length != 2 || !"Bearer".equals(parts[0])) {
            throw new ApiException(401, "NO_TOKEN", "Missing or malformed Authorization header");
        }
        try {
            req.setAttribute("user", jwt.parse(parts[1]));
            return true;
        } catch (ExpiredJwtException e) {
            throw new ApiException(401, "TOKEN_EXPIRED", "Token expired, please log in again");
        } catch (JwtException | IllegalArgumentException e) {
            throw new ApiException(401, "INVALID_TOKEN", "Invalid token");
        }
    }
}
