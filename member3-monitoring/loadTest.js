// Load + failure test for the monitoring module (Member 3, Day 4).
//
// Starts its own server (unless --url is given), connects 1 lecturer + N students
// at the same time, then runs one scenario and prints / saves the results.
//
// Usage: node loadTest.js --scenario=<name> [--clients=100] [--duration=30]
//                         [--rate=1000] [--stagger=0] [--port=3100] [--url=http://...]
//
// Scenarios:
//   steady    : everyone connected, lecturer marks attendance every --rate ms
//   mass-drop : half of the students lose the network for 8 s, then reconnect + sync
//   crash     : the server is killed (5 s down), restarted; everyone must recover
//   mute      : 10% of the students freeze (stop answering heartbeats) and must be dropped

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { io } = require('socket.io-client');

// ---------- options ----------
const args = {};
for (const a of process.argv.slice(2)) {
  const [k, v] = a.replace(/^--/, '').split('=');
  args[k] = v === undefined ? true : v;
}
const DEFAULT_DURATION = { steady: 30, 'mass-drop': 40, crash: 45, mute: 30 };
const SCENARIO = args.scenario || 'steady';
if (!(SCENARIO in DEFAULT_DURATION)) {
  console.error(`Unknown scenario "${SCENARIO}". Use: ${Object.keys(DEFAULT_DURATION).join(', ')}`);
  process.exit(1);
}
const N = Number(args.clients) || 50;                          // students
const DURATION = Number(args.duration) || DEFAULT_DURATION[SCENARIO]; // seconds
const RATE = Number(args.rate) || 1000;                        // ms between attendance marks
const STAGGER = Number(args.stagger) || 0;                     // ms between client starts (0 = all at once)
const PORT = Number(args.port) || 3100;
const EXTERNAL_URL = args.url && args.url !== true ? args.url : null;
const URL = EXTERNAL_URL || `http://localhost:${PORT}`;
const SESSION = 'LOAD101';

const OUT = path.join(__dirname, 'results');
const TAG = `${SCENARIO}_${N}clients_${new Date().toISOString().replace(/[:.]/g, '-')}`;

// ---------- small helpers ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
const max = (a) => (a.length ? a.reduce((x, y) => Math.max(x, y), a[0]) : null);
const pct = (a, p) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};

// ---------- server control (so the crash scenario can kill/restart it) ----------
const serverEnv = {
  ...process.env,
  PORT: String(PORT),
  HB_INTERVAL: '2000',
  HB_TIMEOUT: '1000',
  MAX_MISSED: '3',
  EVENT_LOG_FILE: path.join(OUT, `${TAG}_eventlog.json`),
  LATENCY_CSV: path.join(OUT, `${TAG}_latency.csv`),
};
let serverProc = null;
let serverLog = null;

function startServer() {
  return new Promise((resolve, reject) => {
    serverProc = spawn(process.execPath, [path.join(__dirname, 'server.js')], { env: serverEnv });
    let ready = false;
    serverProc.stdout.on('data', (d) => {
      serverLog.write(d);
      if (!ready && d.toString().includes('listening')) { ready = true; resolve(); }
    });
    serverProc.stderr.on('data', (d) => serverLog.write(d));
    setTimeout(() => { if (!ready) reject(new Error('server did not start in 10 s')); }, 10000);
  });
}

// ---------- simulated client ----------
class SimClient {
  constructor(userId, role, muted = false) {
    this.userId = userId;
    this.role = role;
    this.muted = muted;           // frozen client: never answers heartbeats
    this.lastSeq = 0;
    this.applied = 0;             // events applied (must equal lastSeq if nothing was missed)
    this.syncedCount = 0;         // events recovered through sync
    this.liveLatency = [];        // server->client broadcast delay (ms)
    this.restoreMs = [];          // fault cleared -> reconnected (ms)
    this.disconnects = 0;
    this.attempt = 0;
    this.retryTimer = null;
    this.blackout = false;
    this.stopped = false;
    this.finished = false;
    this.createdAt = null;
    this.firstConnectAt = null;
    this.connectMs = null;
    this.healedAt = null;
    this.kickedMs = null;         // frozen client: connect -> dropped by server (ms)
    this.markCount = 0;
  }

  start() {
    this.createdAt = Date.now();
    this.socket = io(URL, {
      reconnection: false,
      auth: (cb) => cb({ userId: this.userId, role: this.role, sessionId: SESSION, lastSeq: this.lastSeq }),
    });
    const s = this.socket;

    s.on('connect', () => {
      const now = Date.now();
      if (this.firstConnectAt === null) { this.firstConnectAt = now; this.connectMs = now - this.createdAt; }
      if (this.healedAt) { this.restoreMs.push(now - this.healedAt); this.healedAt = null; }
      this.attempt = 0;
    });
    s.on('disconnect', (reason) => {
      this.disconnects += 1;
      if (this.muted && reason === 'io server disconnect') {
        this.kickedMs = Date.now() - this.firstConnectAt; // detected + dropped by the server
        this.stopped = true;
        return;
      }
      this.scheduleReconnect();
    });
    s.on('connect_error', () => this.scheduleReconnect());
    s.on('hb:ping', (t, ack) => { if (!this.muted) ack(); });
    s.on('attendance:update', (ev) => {
      if (ev.seq > this.lastSeq + 1) { // gap -> ask the server for what we missed
        s.emit('sync:request', { lastSeq: this.lastSeq }, (p) => this.handleSync(p));
        return;
      }
      this.apply(ev, false);
    });
    s.on('sync:missed', (p) => this.handleSync(p));
  }

  apply(ev, synced) {
    if (ev.seq <= this.lastSeq) return false; // duplicate
    this.lastSeq = ev.seq;
    this.applied += 1;
    if (synced) this.syncedCount += 1;
    else this.liveLatency.push(Date.now() - ev.ts);
    return true;
  }

  handleSync(p) {
    if (p.reset) { this.lastSeq = 0; this.applied = 0; }
    p.events.sort((a, b) => a.seq - b.seq).forEach((e) => this.apply(e, true));
  }

  scheduleReconnect() {
    if (this.retryTimer || this.blackout || this.stopped || this.finished) return;
    const backoff = Math.min(500 * 2 ** this.attempt, 4000);
    const delay = backoff + Math.random() * 0.2 * backoff;
    this.attempt += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.stopped && !this.finished) this.socket.connect();
    }, delay);
  }

  outage(ms) { // pretend the network is down for `ms`
    this.blackout = true;
    this.socket.disconnect();
    setTimeout(() => {
      this.blackout = false;
      this.healedAt = Date.now();
      this.scheduleReconnect();
    }, ms);
  }

  markHealed() { if (!this.socket.connected) this.healedAt = Date.now(); }

  close() { this.finished = true; this.socket.disconnect(); }
}

// ---------- read the server's heartbeat CSV ----------
function readHeartbeatStats() {
  if (EXTERNAL_URL) return null;
  try {
    const lines = fs.readFileSync(serverEnv.LATENCY_CSV, 'utf8').trim().split('\n').slice(1);
    const rtts = [];
    let miss = 0;
    for (const l of lines) {
      const parts = l.split(',');
      if (parts[3] === 'ok') rtts.push(Number(parts[4])); else miss += 1;
    }
    const total = rtts.length + miss;
    return {
      samples: total, avg: avg(rtts), p95: pct(rtts, 95), max: max(rtts),
      lossPct: total ? Math.round((miss / total) * 1000) / 10 : 0,
    };
  } catch { return null; }
}

// ---------- main ----------
async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  if (EXTERNAL_URL && SCENARIO === 'crash') {
    console.error('The crash scenario kills the server, so it cannot be used with --url.');
    process.exit(1);
  }
  if (!EXTERNAL_URL) {
    serverLog = fs.createWriteStream(path.join(OUT, `${TAG}_server.log`), { flags: 'a' });
    await startServer();
  }
  console.log(`Scenario: ${SCENARIO} | ${N} students + 1 lecturer | ${DURATION}s | server ${URL}`);

  const lecturer = new SimClient('lecturer01', 'lecturer');
  const mutedCount = SCENARIO === 'mute' ? Math.max(1, Math.round(N * 0.1)) : 0;
  const students = [];
  for (let i = 1; i <= N; i++) {
    students.push(new SimClient(`student${String(i).padStart(3, '0')}`, 'student', i <= mutedCount));
  }
  const clients = [lecturer, ...students];

  // All clients connect at the same time (simultaneous-connection test).
  lecturer.start();
  for (const c of students) { c.start(); if (STAGGER) await sleep(STAGGER); }

  const t0 = Date.now();
  const markTimer = setInterval(() => {
    if (!lecturer.socket.connected) return;
    lecturer.markCount += 1;
    lecturer.socket.emit('attendance:mark', { studentId: `S${lecturer.markCount}` });
  }, RATE);
  const progress = setInterval(() => {
    const up = clients.filter((c) => c.socket.connected).length;
    const ref = clients.reduce((m, c) => Math.max(m, c.lastSeq), 0);
    console.log(`  t=${Math.round((Date.now() - t0) / 1000)}s  connected=${up}/${clients.length}  latest event=#${ref}`);
  }, 5000);

  // ---- scenario-specific faults ----
  let victims = [];
  if (SCENARIO === 'mass-drop') {
    victims = students.slice(-Math.round(N / 2));
    setTimeout(() => {
      console.log(`  >>> network outage (8 s) for ${victims.length} students`);
      victims.forEach((v) => v.outage(8000));
    }, (DURATION * 1000) / 3);
  }
  if (SCENARIO === 'crash') {
    setTimeout(() => { console.log('  >>> SERVER CRASH (killed)'); serverProc.kill('SIGKILL'); }, 10000);
    setTimeout(async () => {
      console.log('  >>> restarting server');
      clients.forEach((c) => c.markHealed());
      await startServer();
    }, 15000);
  }

  await sleep(DURATION * 1000);
  clearInterval(markTimer);
  await sleep(4000); // let the last syncs finish
  clearInterval(progress);

  // ---------- analyse ----------
  const live = clients.filter((c) => !c.muted);
  const ref = clients.reduce((m, c) => Math.max(m, c.lastSeq), 0);
  const connectedLive = live.filter((c) => c.socket.connected).length;
  const inSync = live.filter((c) => c.lastSeq === ref && c.applied === c.lastSeq).length;
  const connectTimes = clients.map((c) => c.connectMs).filter((x) => x !== null);
  const bLat = students.flatMap((c) => c.liveLatency);
  const restore = clients.flatMap((c) => c.restoreMs);
  const recovered = clients.reduce((a, c) => a + c.syncedCount, 0);
  const kicked = students.filter((c) => c.muted && c.kickedMs !== null);

  clients.forEach((c) => c.close());
  if (serverProc) { serverProc.kill(); await sleep(500); }
  const hb = readHeartbeatStats();

  const checks = [
    ['All non-frozen clients connected at the end', connectedLive === live.length],
    ['All non-frozen clients fully in sync (no gaps)', inSync === live.length],
  ];
  if (SCENARIO === 'mass-drop') {
    checks.push(['Dropped clients reconnected and recovered missed events',
      victims.every((v) => v.socket.connected === false || v.syncedCount > 0)]);
  }
  if (SCENARIO === 'mute') {
    checks.push([`All ${mutedCount} frozen clients detected and dropped by the server`, kicked.length === mutedCount]);
  }
  const passed = checks.every((c) => c[1]);

  const metrics = {
    'Scenario': SCENARIO,
    'Clients (students + lecturer)': `${N} + 1`,
    'Test duration (s)': DURATION,
    'Connected at end': `${connectedLive}/${live.length} (non-frozen)`,
    'Connect time avg / p95 / max (ms)': `${avg(connectTimes)} / ${pct(connectTimes, 95)} / ${max(connectTimes)}`,
    'Attendance events logged': ref,
    'Clients fully in sync': `${inSync}/${live.length}`,
    'Broadcast delay avg / p95 / max (ms)': `${avg(bLat)} / ${pct(bLat, 95)} / ${max(bLat)}`,
    'Events recovered by sync': recovered,
    'Reconnections measured': restore.length,
    'Time to reconnect after fault cleared avg / max (ms)': restore.length ? `${avg(restore)} / ${max(restore)}` : 'n/a',
    'Frozen clients dropped': SCENARIO === 'mute'
      ? `${kicked.length}/${mutedCount}, detection avg / max ${avg(kicked.map((c) => c.kickedMs))} / ${max(kicked.map((c) => c.kickedMs))} ms`
      : 'n/a',
    'Heartbeat RTT avg / p95 / max (ms)': hb ? `${hb.avg} / ${hb.p95} / ${hb.max}` : 'n/a',
    'Heartbeat samples / loss %': hb ? `${hb.samples} / ${hb.lossPct}%` : 'n/a',
    'RESULT': passed ? 'PASS' : 'FAIL',
  };

  console.log(`\n=== LOAD TEST RESULT ===`);
  console.table(Object.entries(metrics).map(([metric, value]) => ({ metric, value })));
  checks.forEach(([name, ok]) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`));

  // ---------- save evidence ----------
  fs.writeFileSync(path.join(OUT, `${TAG}.json`), JSON.stringify({ metrics, checks }, null, 2));
  const csvFile = path.join(OUT, 'summary.csv');
  if (!fs.existsSync(csvFile)) {
    fs.writeFileSync(csvFile, 'timestamp,scenario,students,duration_s,connected_end,in_sync,events,' +
      'connect_avg_ms,connect_p95_ms,broadcast_avg_ms,broadcast_p95_ms,recovered_events,' +
      'reconnect_avg_ms,hb_avg_ms,hb_p95_ms,hb_loss_pct,result\n');
  }
  fs.appendFileSync(csvFile, [
    new Date().toISOString(), SCENARIO, N, DURATION, connectedLive, inSync, ref,
    avg(connectTimes), pct(connectTimes, 95), avg(bLat), pct(bLat, 95), recovered,
    avg(restore), hb ? hb.avg : '', hb ? hb.p95 : '', hb ? hb.lossPct : '', passed ? 'PASS' : 'FAIL',
  ].join(',') + '\n');
  console.log(`\nSaved: results/${TAG}.json, results/summary.csv, results/${TAG}_server.log`);

  process.exit(passed ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });