// Later: call attachMonitor(io) and attachSync(io, eventLog) 
// Socket.IO server instead.

const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { attachMonitor } = require('./heartbeatMonitor');
const { attachSync } = require('./syncManager');
const { EventLog } = require('./eventLog');

const PORT = process.env.PORT || 3000;
const httpServer = http.createServer();

const io = new Server(httpServer, {
  cors: { origin: '*' },
  pingInterval: 10000, // Engine.IO heartbeat (transport level)
  pingTimeout: 5000,
});

const monitor = attachMonitor(io, {
  interval: Number(process.env.HB_INTERVAL) || 5000,
  timeout: Number(process.env.HB_TIMEOUT) || 3000,
  maxMissed: Number(process.env.MAX_MISSED) || 3,
  csvPath: process.env.LATENCY_CSV || path.join(__dirname, 'latency_log.csv'),
});

const eventLog = new EventLog({
  filePath: process.env.EVENT_LOG_FILE || path.join(__dirname, 'eventlog.json'),
});

// ---- DEMO STAND-IN for rooms/broadcast and attendance API ----
// A lecturer client emits "attendance:mark"; we log it with a sequence number
// and broadcast it to everyone in the same session room.
io.on('connection', (socket) => {
  const { sessionId, role } = socket.handshake.auth || {};
  if (sessionId) socket.join(sessionId);

  socket.on('attendance:mark', (data) => {
    if (role !== 'lecturer' || !sessionId) return;
    const event = eventLog.append(sessionId, 'attendance:marked', data);
    io.to(sessionId).emit('attendance:update', event);
    console.log(`[#${event.seq}] ${sessionId}: ${data.studentId} marked present`);
  });
});
// -------------------------------------------------------------------------------------

// Missed-update sync after reconnect (Member 3).
attachSync(io, eventLog);

// Print the live monitoring table every 10 seconds.
setInterval(() => {
  const rows = monitor.tracker.snapshot();
  if (rows.length) {
    const s = monitor.tracker.summary();
    console.log('\n=== Connection monitor ===');
    console.table(rows);
    console.log(`Network: ${s.online}/${s.known} online | avg RTT ${s.avgRtt} ms | ` +
      `p95 RTT ${s.p95Rtt} ms | heartbeat loss ${s.lossPct}%`);
    for (const sid of eventLog.sessions()) {
      console.log(`Event log: session ${sid} -> last sequence #${eventLog.lastSeq(sid)}`);
    }
  }
}, 10000);

httpServer.listen(PORT, () => console.log(`Monitor server listening on :${PORT}`));