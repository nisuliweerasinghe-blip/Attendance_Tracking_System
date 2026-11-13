CREATE TABLE IF NOT EXISTS users (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role          VARCHAR(10)  NOT NULL,
  student_id    VARCHAR(30)  UNIQUE,
  created_at    BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  course_code VARCHAR(20)  NOT NULL,
  title       VARCHAR(120) NOT NULL,
  code        VARCHAR(6)   NOT NULL UNIQUE,
  lecturer_id BIGINT NOT NULL REFERENCES users(id),
  status      VARCHAR(10) DEFAULT 'active' NOT NULL,
  created_at  BIGINT NOT NULL,
  expires_at  BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id   BIGINT NOT NULL REFERENCES sessions(id),
  student_id   BIGINT NOT NULL REFERENCES users(id),
  submitted_at BIGINT NOT NULL,
  ip_address   VARCHAR(64),
  -- One record per student per session, even under simultaneous requests
  CONSTRAINT uq_attendance UNIQUE (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(session_id, submitted_at);
