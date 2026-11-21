// Test client: auto-reconnect (exponential backoff) + missed-update sync.
//
// Usage: node testClient.js <userId> <role> <sessionId> [flags]
//   --mute      : stop answering heartbeats (simulates a frozen client)
//   --auto      : (lecturer only) mark a student present every 3 seconds
//   --blackout  : after 7 s, simulate a 10 s network outage, then reconnect + sync

const { io } = require('socket.io-client');

const [, , userId = 'student01', role = 'student', sessionId = 'CS101', ...flags] = process.argv;
const mute = flags.includes('--mute');
const auto = flags.includes('--auto');
const wantBlackout = flags.includes('--blackout');

const BASE_DELAY = 1000;  // first retry after 1 s
const MAX_DELAY = 16000;  // never wait longer than 16 s

let lastSeq = 0;          // last attendance event number this client has applied
let attempt = 0;          // failed attempts since the last good connection
let retryTimer = null;
let blackout = false;     // true while we pretend the network is down

const socket = io(process.env.URL || 'http://localhost:3000', {
  reconnection: false, // we do the reconnecting ourselves (see scheduleReconnect)
  // Function form: re-evaluated on every (re)connect, so lastSeq is always fresh.
  auth: (cb) => cb({ userId, role, sessionId, lastSeq }),
});

// ---------- reconnection with exponential backoff ----------
// Wait 1s, 2s, 4s, 8s, 16s, 16s, ... (+ a little random jitter) then try again.
function scheduleReconnect(reason) {
  if (retryTimer || blackout) return; // retry already planned, or outage in progress
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
    (attempt ? ` after ${attempt} failed attempt(s)` : '') + `, last seq applied = #${lastSeq}`);
  attempt = 0; // success -> reset the backoff
});

// Fires for every kind of disconnect, including when the SERVER kicks us.
socket.on('disconnect', (reason) => scheduleReconnect(reason));
// Fires when a connection attempt fails (e.g. the server is down).
socket.on('connect_error', (err) => scheduleReconnect(err.message));

// ---------- heartbeat ----------
socket.on('hb:ping', (sentAt, ack) => {
  if (!mute) ack(); // calling the ack is the "pong"
});

// ---------- attendance updates + sync ----------
function applyEvent(event, tag = '') {
  if (event.seq <= lastSeq) return false; // already have it (duplicate) -> ignore
  lastSeq = event.seq;
  console.log(`${userId}: update #${event.seq} -> ${event.data.studentId} present ${tag}`);
  return true;
}

// Live update. If a number is skipped we missed something -> ask the server.
socket.on('attendance:update', (event) => {
  if (event.seq > lastSeq + 1) {
    console.log(`${userId}: gap detected (have #${lastSeq}, got #${event.seq}) -> requesting sync`);
    socket.emit('sync:request', { lastSeq }, handleSync);
    return;
  }
  applyEvent(event);
});

// Server sends this automatically after (re)connect, or as a reply to sync:request.
function handleSync(payload) {
  if (payload.reset) {
    console.log(`${userId}: server log was reset, resyncing from scratch`);
    lastSeq = 0;
  }
  let recovered = 0;
  payload.events
    .sort((a, b) => a.seq - b.seq)
    .forEach((e) => { if (applyEvent(e, '(synced)')) recovered += 1; });
  console.log(`${userId}: SYNC complete - ${recovered} missed update(s) recovered, now at #${lastSeq}`);
}
socket.on('sync:missed', handleSync);

// ---------- demo helpers ----------
if (auto && role === 'lecturer') {
  let n = 0;
  setInterval(() => {
    if (!socket.connected) return;
    n += 1;
    socket.emit('attendance:mark', { studentId: `student${String(n).padStart(2, '0')}` });
  }, 3000);
}

if (wantBlackout) {
  const OUTAGE_AFTER = 7000;
  const OUTAGE_LENGTH = 10000;
  setTimeout(() => {
    console.log(`${userId}: *** simulated network outage for ${OUTAGE_LENGTH / 1000}s ***`);
    blackout = true;
    socket.disconnect();
    setTimeout(() => {
      blackout = false;
      console.log(`${userId}: *** network is back ***`);
      scheduleReconnect('outage over');
    }, OUTAGE_LENGTH);
  }, OUTAGE_AFTER);
}