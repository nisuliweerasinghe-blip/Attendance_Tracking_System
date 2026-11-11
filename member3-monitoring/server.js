// Call attachMonitor(io) inside real Socket.IO server instead.

const http = require('http');
const { Server } = require('socket.io');
const { attachMonitor } = require('./heartbeatMonitor');
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
});

const eventLog = new EventLog();

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

// Print the live monitoring table every 10 seconds.
setInterval(() => {
  const rows = monitor.tracker.snapshot();
  if (rows.length) {
    console.log('\n=== Connection monitor ===');
    console.table(rows);
    for (const s of eventLog.sessions()) {
      console.log(`Event log: session ${s} -> last sequence #${eventLog.lastSeq(s)}`);
    }
  }
}, 10000);

httpServer.listen(PORT, () => console.log(`Monitor server listening on :${PORT}`));