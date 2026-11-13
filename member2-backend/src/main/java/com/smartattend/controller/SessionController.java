package com.smartattend.controller;

import com.smartattend.error.ApiException;
import com.smartattend.event.AppEvent;
import com.smartattend.repo.Repo;
import com.smartattend.security.CurrentUser;
import com.smartattend.util.Codes;
import com.smartattend.util.Time;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sessions")
public class SessionController {

    public record CreateSessionRequest(String courseCode, String title, Integer durationMinutes) {}

    public record SessionView(long id, String courseCode, String title, String code, String status,
                              String createdAt, String expiresAt) {}

    private final Repo repo;
    private final ApplicationEventPublisher events;

    public SessionController(Repo repo, ApplicationEventPublisher events) {
        this.repo = repo;
        this.events = events;
    }

    static SessionView view(Repo.Session s) {
        return new SessionView(s.id(), s.courseCode(), s.title(), s.code(), s.status(),
                Time.iso(s.createdAt()), Time.iso(s.expiresAt()));
    }

    private Repo.Session ownedSession(long id, CurrentUser user) {
        Repo.Session s = repo.sessionById(id)
                .orElseThrow(() -> new ApiException(404, "SESSION_NOT_FOUND", "Session not found"));
        if (!"admin".equals(user.role()) && s.lecturerId() != user.id()) {
            throw new ApiException(403, "NOT_SESSION_OWNER", "You do not own this session");
        }
        return s;
    }

    // Role check runs first, then validation (same order as the Node version)
    @PostMapping
    public ResponseEntity<Map<String, Object>> create(@RequestBody CreateSessionRequest req,
                                                      @RequestAttribute("user") CurrentUser user) {
        user.require("lecturer", "admin");

        String courseCode = req.courseCode() == null ? "" : req.courseCode().trim();
        String title = req.title() == null ? "" : req.title().trim();
        int minutes = req.durationMinutes() == null ? 15 : req.durationMinutes();
        if (courseCode.length() < 2 || courseCode.length() > 20)
            throw ApiException.validation("courseCode", "courseCode must be 2-20 characters");
        if (title.length() < 2 || title.length() > 120)
            throw ApiException.validation("title", "title must be 2-120 characters");
        if (minutes < 1 || minutes > 240)
            throw ApiException.validation("durationMinutes", "durationMinutes must be 1-240");

        long now = System.currentTimeMillis();
        long expires = now + minutes * 60_000L;

        for (int attempt = 0; attempt < 5; attempt++) { // retry on the rare code collision
            String code = Codes.generate();
            try {
                long id = repo.insertSession(courseCode, title, code, user.id(), now, expires);
                SessionView s = new SessionView(id, courseCode, title, code, "active", Time.iso(now), Time.iso(expires));
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("sessionId", id);
                payload.put("courseCode", courseCode);
                payload.put("title", title);
                payload.put("code", code);
                payload.put("expiresAt", s.expiresAt());
                events.publishEvent(new AppEvent("session:created", payload));
                return ResponseEntity.status(201).body(Map.of("session", s));
            } catch (DuplicateKeyException ignored) {
                // generate another code
            }
        }
        throw new ApiException(500, "CODE_GENERATION_FAILED", "Could not generate a unique session code");
    }

    @GetMapping
    public Map<String, Object> list(@RequestAttribute("user") CurrentUser user) {
        user.require("lecturer", "admin");
        List<Repo.Session> rows = "admin".equals(user.role()) ? repo.allSessions() : repo.sessionsByLecturer(user.id());
        return Map.of("sessions", rows.stream().map(SessionController::view).toList());
    }

    @PostMapping("/{id}/close")
    public Map<String, Object> close(@PathVariable long id, @RequestAttribute("user") CurrentUser user) {
        user.require("lecturer", "admin");
        Repo.Session s = ownedSession(id, user);
        repo.closeSession(s.id());
        events.publishEvent(new AppEvent("session:closed", Map.of("sessionId", s.id())));
        return Map.of("message", "Session closed", "sessionId", s.id());
    }

    /** ?since=<ISO time> returns only newer records (used to sync updates missed while offline). */
    @GetMapping("/{id}/attendance")
    public Map<String, Object> attendance(@PathVariable long id,
                                          @RequestParam(required = false) String since,
                                          @RequestAttribute("user") CurrentUser user) {
        user.require("lecturer", "admin");
        Repo.Session s = ownedSession(id, user);
        long sinceMs = 0;
        if (since != null && !since.isBlank()) {
            try {
                sinceMs = Instant.parse(since).toEpochMilli();
            } catch (DateTimeParseException e) {
                throw ApiException.validation("since", "since must be an ISO date-time, e.g. 2026-11-12T09:00:00.000Z");
            }
        }
        List<Repo.AttendanceView> records = repo.attendanceSince(s.id(), sinceMs);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("sessionId", s.id());
        body.put("status", s.status());
        body.put("count", records.size());
        body.put("serverTime", Time.iso(System.currentTimeMillis()));
        body.put("records", records);
        return body;
    }
}
