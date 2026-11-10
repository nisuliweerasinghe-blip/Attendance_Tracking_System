const http = require('http');
const { Server } = require('socket.io');
const { attachMonitor } = require('./heartbeatMonitor');

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

// Print the live monitoring table every 10 seconds.
setInterval(() => {
  const rows = monitor.tracker.snapshot();
  if (rows.length) {
    console.log('\n=== Connection monitor ===');
    console.table(rows);
  }
}, 10000);

httpServer.listen(PORT, () => console.log(`Monitor server listening on :${PORT}`));