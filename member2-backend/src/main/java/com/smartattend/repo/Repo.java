package com.smartattend.repo;

import com.smartattend.util.Time;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

/**
 * All SQL lives here. Unique-constraint violations surface as
 * org.springframework.dao.DuplicateKeyException (the database decides races).
 */
@Repository
public class Repo {

    public record User(long id, String name, String email, String passwordHash, String role, String studentId) {}
    public record Session(long id, String courseCode, String title, String code, long lecturerId,
                          String status, long createdAt, long expiresAt) {}
    public record AttendanceView(long id, String submittedAt, long studentId, String studentName, String studentNumber) {}
    public record HistoryView(long id, String submittedAt, long sessionId, String courseCode, String title) {}

    private static final RowMapper<User> USER = (rs, i) -> new User(rs.getLong("id"), rs.getString("name"),
            rs.getString("email"), rs.getString("password_hash"), rs.getString("role"), rs.getString("student_id"));

    private static final RowMapper<Session> SESSION = (rs, i) -> new Session(rs.getLong("id"),
            rs.getString("course_code"), rs.getString("title"), rs.getString("code"), rs.getLong("lecturer_id"),
            rs.getString("status"), rs.getLong("created_at"), rs.getLong("expires_at"));

    private static final String USER_COLS = "id,name,email,password_hash,role,student_id";
    private static final String SESSION_COLS = "id,course_code,title,code,lecturer_id,status,created_at,expires_at";

    private final JdbcTemplate jdbc;

    public Repo(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private long insert(String sql, Object... args) {
        KeyHolder kh = new GeneratedKeyHolder();
        jdbc.update(con -> {
            PreparedStatement ps = con.prepareStatement(sql, new String[] {"ID"});
            for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
            return ps;
        }, kh);
        return kh.getKey().longValue();
    }

    // ---- users ----
    public long insertUser(String name, String email, String hash, String role, String studentId) {
        return insert("INSERT INTO users (name,email,password_hash,role,student_id,created_at) VALUES (?,?,?,?,?,?)",
                name, email, hash, role, studentId, System.currentTimeMillis());
    }

    public Optional<User> userByEmail(String email) {
        return jdbc.query("SELECT " + USER_COLS + " FROM users WHERE email=?", USER, email).stream().findFirst();
    }

    public Optional<User> userById(long id) {
        return jdbc.query("SELECT " + USER_COLS + " FROM users WHERE id=?", USER, id).stream().findFirst();
    }

    // ---- sessions ----
    public long insertSession(String courseCode, String title, String code, long lecturerId, long createdAt, long expiresAt) {
        return insert("INSERT INTO sessions (course_code,title,code,lecturer_id,created_at,expires_at) VALUES (?,?,?,?,?,?)",
                courseCode, title, code, lecturerId, createdAt, expiresAt);
    }

    public Optional<Session> sessionById(long id) {
        return jdbc.query("SELECT " + SESSION_COLS + " FROM sessions WHERE id=?", SESSION, id).stream().findFirst();
    }

    public Optional<Session> sessionByCode(String code) {
        return jdbc.query("SELECT " + SESSION_COLS + " FROM sessions WHERE code=?", SESSION, code).stream().findFirst();
    }

    public List<Session> allSessions() {
        return jdbc.query("SELECT " + SESSION_COLS + " FROM sessions ORDER BY id DESC", SESSION);
    }

    public List<Session> sessionsByLecturer(long lecturerId) {
        return jdbc.query("SELECT " + SESSION_COLS + " FROM sessions WHERE lecturer_id=? ORDER BY id DESC", SESSION, lecturerId);
    }

    public void closeSession(long id) {
        jdbc.update("UPDATE sessions SET status='closed' WHERE id=?", id);
    }

    // ---- attendance ----
    public long insertAttendance(long sessionId, long studentId, long submittedAt, String ip) {
        return insert("INSERT INTO attendance (session_id,student_id,submitted_at,ip_address) VALUES (?,?,?,?)",
                sessionId, studentId, submittedAt, ip);
    }

    public List<AttendanceView> attendanceSince(long sessionId, long sinceMillis) {
        return jdbc.query("""
                SELECT a.id, a.submitted_at, u.id AS student_id, u.name, u.student_id AS student_number
                FROM attendance a JOIN users u ON u.id = a.student_id
                WHERE a.session_id=? AND a.submitted_at > ?
                ORDER BY a.submitted_at ASC, a.id ASC""",
                (rs, i) -> new AttendanceView(rs.getLong("id"), Time.iso(rs.getLong("submitted_at")),
                        rs.getLong("student_id"), rs.getString("name"), rs.getString("student_number")),
                sessionId, sinceMillis);
    }

    public List<HistoryView> historyForStudent(long studentId) {
        return jdbc.query("""
                SELECT a.id, a.submitted_at, s.id AS session_id, s.course_code, s.title
                FROM attendance a JOIN sessions s ON s.id = a.session_id
                WHERE a.student_id=? ORDER BY a.submitted_at DESC""",
                (rs, i) -> new HistoryView(rs.getLong("id"), Time.iso(rs.getLong("submitted_at")),
                        rs.getLong("session_id"), rs.getString("course_code"), rs.getString("title")),
                studentId);
    }
}
