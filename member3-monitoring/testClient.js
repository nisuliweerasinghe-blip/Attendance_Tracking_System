// Test client with automatic reconnection (exponential backoff).
//
// Usage: node testClient.js <userId> <role> <sessionId> [--mute] [--auto]
//   --mute : stop answering heartbeats (simulates a frozen client)
//   --auto : (lecturer only) mark a student present every 3 seconds

const { io } = require('socket.io-client');

const [, , userId = 'student01', role = 'student', sessionId = 'CS101', ...flags] = process.argv;
const mute = flags.includes('--mute');
const auto = flags.includes('--auto');

const BASE_DELAY = 1000;  // first retry after 1 s
const MAX_DELAY = 16000;  // never wait longer than 16 s

let lastSeq = 0;          // last attendance event number this client has seen
let attempt = 0;          // failed attempts since the last good connection
let retryTimer = null;

const socket = io(process.env.URL || 'http://localhost:3000', {
  reconnection: false, // we do the reconnecting ourselves (see scheduleReconnect)
  // Function form: re-evaluated on every (re)connect, so lastSeq is always fresh.
  auth: (cb) => cb({ userId, role, sessionId, lastSeq }),
});

// Wait 1s, 2s, 4s, 8s, 16s, 16s, ... (+ a little random jitter) then try again.
function scheduleReconnect(reason) {
  if (retryTimer) return; // a retry is already planned
  const backoff = Math.min(BASE_DELAY * 2 ** attempt, MAX_DELAY);
  const delay = Math.round(backoff + Math.random() * 0.2 * backoff);
  attempt += 1;
  console.log(`${userId}: lost connection (${reason}). Retry #${attempt} in ${delay} ms`);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    socket.connect();
  }, delay);
}

socket.on('connect', () => {
  console.log(`${userId}: connected (${socket.id})` +
    (attempt ? ` after ${attempt} failed attempt(s)` : '') + `, last seq seen = ${lastSeq}`);
  attempt = 0; // success -> reset the backoff
});

// Fires for every kind of disconnect, including when the SERVER kicks us
// ("io server disconnect"). Socket.IO's built-in retry does not cover that
// case, which is why we reconnect manually.
socket.on('disconnect', (reason) => scheduleReconnect(reason));

// Fires when a connection attempt fails (e.g. the server is down).
socket.on('connect_error', (err) => scheduleReconnect(err.message));

// Heartbeat: calling the ack is the "pong".
socket.on('hb:ping', (sentAt, ack) => {
  if (!mute) ack();
});

socket.on('attendance:update', (event) => {
  lastSeq = event.seq;
  console.log(`${userId}: update #${event.seq} -> ${event.data.studentId} present`);
});

// Lecturer demo: keep marking students so there is traffic to log.
if (auto && role === 'lecturer') {
  let n = 0;
  setInterval(() => {
    if (!socket.connected) return;
    n += 1;
    socket.emit('attendance:mark', { studentId: `student${String(n).padStart(2, '0')}` });
  }, 3000);
}