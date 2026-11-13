// Application-level heartbeat on top of Socket.IO.
//
// Two layers of detection:
//  1. Engine.IO ping/pong (pingInterval / pingTimeout, set when creating the Server)
//     -> detects dead TCP connections.
//  2. This module: server sends "hb:ping" every `interval` ms and expects an ack
//     within `timeout` ms. The ack time is the round-trip latency. After
//     `maxMissed` consecutive misses the client is declared disconnected.
//
// If csvPath is given, every heartbeat result is appended to a CSV file
// (useful evidence + data for graphs in the report).

const fs = require('fs');
const { ConnectionTracker } = require('./connectionTracker');

function csvWriter(path) {
  if (!path) return () => {};
  if (!fs.existsSync(path)) fs.writeFileSync(path, 'timestamp,userId,role,result,rtt_ms\n');
  return (row) => fs.appendFile(path, row + '\n', () => {});
}

function attachMonitor(io, opts = {}) {
  const {
    interval = 5000,     // how often to ping each client
    timeout = 3000,      // how long to wait for the pong
    maxMissed = 3,       // consecutive misses before we drop the client
    csvPath = null,      // optional latency log file
    onChange = () => {}, // callback(event, record) - Member 1 can use it to broadcast
  } = opts;

  const tracker = new ConnectionTracker();
  const logCsv = csvWriter(csvPath);

  io.on('connection', (socket) => {
    const rec = tracker.connect(socket);
    console.log(`[+] ${rec.userId} (${rec.role}) connected  socket=${socket.id}` +
      (rec.reconnects ? `  [reconnect #${rec.reconnects}]` : ''));
    onChange('connected', rec);

    socket.on('disconnect', (reason) => {
      const r = tracker.disconnect(socket.id, reason);
      if (r) {
        console.log(`[-] ${r.userId} disconnected (${reason})`);
        onChange('disconnected', r);
      }
    });
  });

  const timer = setInterval(() => {
    for (const rec of tracker.online()) {
      const socket = io.sockets.sockets.get(rec.socketId);
      if (!socket) continue;

      const sentAt = Date.now();
      tracker.recordSent(socket.id);
      socket.timeout(timeout).emit('hb:ping', sentAt, (err) => {
        const now = new Date().toISOString();
        if (err) {
          const missed = tracker.recordMiss(socket.id);
          logCsv(`${now},${rec.userId},${rec.role},miss,`);
          console.log(`[!] ${rec.userId} missed heartbeat (${missed}/${maxMissed})`);
          onChange('unstable', rec);
          if (missed >= maxMissed) {
            console.log(`[x] ${rec.userId} timed out -> disconnecting`);
            socket.disconnect(true);
          }
        } else {
          const rtt = Date.now() - sentAt;
          tracker.recordPong(socket.id, rtt);
          logCsv(`${now},${rec.userId},${rec.role},ok,${rtt}`);
        }
      });
    }
  }, interval);

  return { tracker, stop: () => clearInterval(timer) };
}

module.exports = { attachMonitor };