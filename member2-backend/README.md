# SmartAttend Backend - Java / Spring Boot (Member 2)

Same REST API as the Node version, so the student dashboard and any frontend work unchanged.

## Run in Eclipse
1. Install a JDK 17+ (Eclipse Temurin) and use "Eclipse IDE for Enterprise Java and Web Developers".
2. File > Import > Maven > Existing Maven Projects > select this folder > Finish (wait for dependencies).
3. Right-click `SmartAttendApplication.java` > Run As > Java Application.
4. Open http://localhost:4000. The console prints a demo session code and the Network URL.

## Run from a terminal
    mvn spring-boot:run

## Settings: src/main/resources/application.properties
Port, JWT secret, rate limits, optional webhook to Member 1's Socket.IO service.

## Tests (needs Node installed; server running)
    node scripts/evidence-test.js
    node scripts/concurrent-test.js 50     # first set smartattend.rate.auth-max=1000 and attendance-max=30

## Integration
- Member 1 (Socket.IO is Node): set `smartattend.webhook-url=http://<their-ip>:<port>/internal/events`.
  Each event is POSTed as {"event":"attendance:recorded","payload":{...}}; their Node server then does io.to(room).emit(...).
  Events: session:created, session:closed, attendance:recorded.
- Member 3: GET /api/health for latency; GET /api/sessions/{id}/attendance?since=<ISO> for missed-update sync.

## API (identical to Node version)
POST /api/auth/register | POST /api/auth/login | GET /api/auth/me
POST /api/sessions | GET /api/sessions | POST /api/sessions/{id}/close | GET /api/sessions/{id}/attendance?since=
POST /api/attendance {"code":"AB3K9Z"} | GET /api/attendance/me | GET /api/health
Errors: {"error":{"code","message","details"}} with 400/401/403/404/409/410/429.
