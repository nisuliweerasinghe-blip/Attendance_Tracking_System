# SmartAttend Frontend

React + Vite frontend for the existing SmartAttend Spring Boot backend.

## 1. Requirements

- Node.js 18 or newer
- Spring Boot backend running on `http://localhost:4001`
- Repository branch: `feature/frontend`

## 2. Install and run

From this `frontend` directory:

```bash
npm install
```

Copy `.env.example` to `.env` and check the API URL:

```env
VITE_API_BASE_URL=http://localhost:4001/api
```

Then start Vite:

```bash
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

## 3. Implemented screens

- Login for student, lecturer, and the seeded admin account.
- Registration for student and lecturer accounts. Student ID is required for students.
- Lecturer dashboard: create sessions, see generated session codes, list sessions, close sessions, and view attendance records.
- Student dashboard: submit a six-character session code and view attendance history.
- Lecturer attendance list automatically refreshes every 8 seconds using the Spring Boot REST endpoint.

## 4. Backend API used

The frontend is aligned with the checked-in Spring Boot controllers:

| Action | Endpoint |
|---|---|
| Register | `POST /api/auth/register` |
| Login | `POST /api/auth/login` |
| Current user | `GET /api/auth/me` |
| Create session | `POST /api/sessions` |
| List lecturer sessions | `GET /api/sessions` |
| Close session | `POST /api/sessions/{id}/close` |
| Session attendance | `GET /api/sessions/{id}/attendance` |
| Mark attendance | `POST /api/attendance` |
| Student attendance history | `GET /api/attendance/me` |

JWTs are sent in the `Authorization: Bearer <token>` header.

## 5. Important integration note

The current `member3-monitoring/server.js` contains a demo `attendance:mark` handler. It does not yet consume the Spring Boot webhook events (`session:created`, `session:closed`, `attendance:recorded`) and broadcast the real attendance payload. Therefore this frontend uses REST polling for lecturer attendance updates. Do not describe the dashboard as Socket.IO real-time until Member 1 connects the Spring Boot `smartattend.webhook-url` to the Node `/internal/events` endpoint and the Node server broadcasts the received event (for example, `attendance:update`) to the relevant session room.

## 6. Demo accounts

The backend's `smartattend.demo-seed=true` setting creates demo accounts. Check Member 2's backend console or README for the seeded credentials. Do not hardcode demo passwords in the frontend.

## 7. Notes

- The backend generates the six-character session code. The frontend does not generate or modify it.
- The backend enforces session ownership, expiry, duplicate attendance, and roles. The frontend displays API error messages returned by Spring Boot.
- For another computer on the same network, change `VITE_API_BASE_URL` to the backend computer's reachable IP and make sure the backend CORS origin and firewall permit the frontend host.
