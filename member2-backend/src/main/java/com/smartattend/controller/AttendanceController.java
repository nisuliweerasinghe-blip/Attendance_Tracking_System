package com.smartattend.controller;

import com.smartattend.error.ApiException;
import com.smartattend.event.AppEvent;
import com.smartattend.repo.Repo;
import com.smartattend.security.CurrentUser;
import com.smartattend.util.RateLimiter;
import com.smartattend.util.Time;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {

    public record SubmitRequest(String code) {}

    private final Repo repo;
    private final ApplicationEventPublisher events;
    private final RateLimiter limiter;
    private final int attendanceMax;

    public AttendanceController(Repo repo, ApplicationEventPublisher events, RateLimiter limiter,
                                @Value("${smartattend.rate.attendance-max}") int attendanceMax) {
        this.repo = repo;
        this.events = events;
        this.limiter = limiter;
        this.attendanceMax = attendanceMax;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> submit(@RequestBody SubmitRequest req,
                                                      @RequestAttribute("user") CurrentUser user,
                                                      HttpServletRequest http) {
        user.require("student");
        limiter.check("att:" + user.id(), attendanceMax, 60_000L); // per-student: stops code guessing / spamming

        String code = req.code() == null ? "" : req.code().trim().toUpperCase();
        if (!code.matches("^[A-Z0-9]{6}$")) {
            throw ApiException.validation("code", "Code must be 6 letters/numbers");
        }

        Repo.Session session = repo.sessionByCode(code)
                .orElseThrow(() -> new ApiException(404, "INVALID_CODE", "That session code does not exist"));

        long now = System.currentTimeMillis();
        if (!"active".equals(session.status()) || now > session.expiresAt()) {
            throw new ApiException(410, "SESSION_CLOSED", "This attendance session has ended");
        }

        // UNIQUE(session_id, student_id) makes this safe under simultaneous requests:
        // the database, not application code, decides the winner.
        long recordId;
        try {
            recordId = repo.insertAttendance(session.id(), user.id(), now, http.getRemoteAddr());
        } catch (DuplicateKeyException e) {
            throw new ApiException(409, "ALREADY_MARKED", "Your attendance is already recorded for this session");
        }

        String studentNumber = repo.userById(user.id()).map(Repo.User::studentId).orElse(null);
        Map<String, Object> record = new LinkedHashMap<>();
        record.put("id", recordId);
        record.put("sessionId", session.id());
        record.put("studentId", user.id());
        record.put("studentName", user.name());
        record.put("studentNumber", studentNumber);
        record.put("submittedAt", Time.iso(now));

        events.publishEvent(new AppEvent("attendance:recorded", record)); // Member 1 broadcasts this

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", "Attendance recorded");
        body.put("session", Map.of("id", session.id(), "courseCode", session.courseCode(), "title", session.title()));
        body.put("record", record);
        return ResponseEntity.status(201).body(body);
    }

    @GetMapping("/me")
    public Map<String, Object> mine(@RequestAttribute("user") CurrentUser user) {
        user.require("student");
        List<Repo.HistoryView> records = repo.historyForStudent(user.id());
        return Map.of("count", records.size(), "records", records);
    }
}
