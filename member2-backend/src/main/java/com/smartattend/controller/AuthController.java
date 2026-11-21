package com.smartattend.controller;

import com.smartattend.error.ApiException;
import com.smartattend.repo.Repo;
import com.smartattend.security.CurrentUser;
import com.smartattend.security.JwtService;
import com.smartattend.util.RateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public record RegisterRequest(
            @NotBlank @Size(min = 2, max = 100) String name,
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, max = 100, message = "Password must be at least 8 characters") String password,
            @NotBlank @Pattern(regexp = "student|lecturer", message = "Role must be student or lecturer") String role,
            @Size(min = 3, max = 30) String studentId) {}

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}

    public record UserDto(long id, String name, String email, String role, String studentId) {}
    public record AuthResponse(String token, UserDto user) {}

    private static final long WINDOW_MS = 15 * 60 * 1000L;

    private final Repo repo;
    private final JwtService jwt;
    private final BCryptPasswordEncoder encoder;
    private final RateLimiter limiter;
    private final int authMax;

    public AuthController(Repo repo, JwtService jwt, BCryptPasswordEncoder encoder, RateLimiter limiter,
                          @Value("${smartattend.rate.auth-max}") int authMax) {
        this.repo = repo;
        this.jwt = jwt;
        this.encoder = encoder;
        this.limiter = limiter;
        this.authMax = authMax;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest req, HttpServletRequest http) {
        limiter.check("auth:" + http.getRemoteAddr(), authMax, WINDOW_MS);
        String email = req.email().trim().toLowerCase();
        String studentId = req.studentId() == null || req.studentId().isBlank() ? null : req.studentId().trim();
        if ("student".equals(req.role()) && studentId == null) {
            throw ApiException.validation("studentId", "studentId is required for students");
        }
        try {
            long id = repo.insertUser(req.name().trim(), email, encoder.encode(req.password()), req.role(), studentId);
            UserDto user = new UserDto(id, req.name().trim(), email, req.role(), studentId);
            return ResponseEntity.status(201).body(new AuthResponse(jwt.sign(id, user.role(), user.name()), user));
        } catch (DuplicateKeyException e) {
            throw new ApiException(409, "DUPLICATE_USER", "Email or student ID already registered");
        }
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req, HttpServletRequest http) {
        limiter.check("auth:" + http.getRemoteAddr(), authMax, WINDOW_MS);
        Repo.User u = repo.userByEmail(req.email().trim().toLowerCase()).orElse(null);
        // Same message for both failures so attackers can't enumerate accounts
        if (u == null || !encoder.matches(req.password(), u.passwordHash())) {
            throw new ApiException(401, "BAD_CREDENTIALS", "Incorrect email or password");
        }
        UserDto user = new UserDto(u.id(), u.name(), u.email(), u.role(), u.studentId());
        return new AuthResponse(jwt.sign(u.id(), u.role(), u.name()), user);
    }

    @GetMapping("/me")
    public Map<String, Object> me(@RequestAttribute("user") CurrentUser current) {
        Repo.User u = repo.userById(current.id())
                .orElseThrow(() -> new ApiException(404, "USER_NOT_FOUND", "User no longer exists"));
        return Map.of("user", new UserDto(u.id(), u.name(), u.email(), u.role(), u.studentId()));
    }
}
