// Keeps the state of every client (lecturer/student) known to the server.
// Records are keyed by userId so a client that reconnects keeps its history
// (needed for reconnection + missed-update sync).

class ConnectionTracker {
  constructor({ maxSamples = 20 } = {}) {
    this.clients = new Map(); // userId -> record
    this.maxSamples = maxSamples;
  }

  // Called on every new socket connection.
  connect(socket) {
    const { userId, role = 'student', sessionId = null } = socket.handshake.auth || {};
    const id = userId || socket.id;
    const prev = this.clients.get(id);
    const now = Date.now();

    const rec = {
      userId: id,
      role,
      sessionId,
      socketId: socket.id,
      status: 'online',            // online | unstable | offline
      connectedAt: now,
      lastSeen: now,
      disconnectedAt: null,
      disconnectReason: null,
      missedHeartbeats: 0,
      rttSamples: [],              // last N round-trip times (ms)
      reconnects: prev ? prev.reconnects + 1 : 0,
    };
    this.clients.set(id, rec);
    return rec;
  }

  bySocket(socketId) {
    for (const rec of this.clients.values()) {
      if (rec.socketId === socketId) return rec;
    }
    return null;
  }

  // Heartbeat answered in time.
  recordPong(socketId, rtt) {
    const rec = this.bySocket(socketId);
    if (!rec) return;
    rec.lastSeen = Date.now();
    rec.missedHeartbeats = 0;
    rec.status = 'online';
    rec.rttSamples.push(rtt);
    if (rec.rttSamples.length > this.maxSamples) rec.rttSamples.shift();
  }

  // Heartbeat timed out. Returns the new miss count.
  recordMiss(socketId) {
    const rec = this.bySocket(socketId);
    if (!rec) return 0;
    rec.missedHeartbeats += 1;
    rec.status = 'unstable';
    return rec.missedHeartbeats;
  }

  // Socket closed (network drop, tab closed, server kick, ...).
  disconnect(socketId, reason) {
    const rec = this.bySocket(socketId); // ignores stale sockets of a user who already reconnected
    if (!rec) return null;
    rec.status = 'offline';
    rec.disconnectedAt = Date.now();
    rec.disconnectReason = reason;
    return rec;
  }

  online() {
    return [...this.clients.values()].filter((r) => r.status !== 'offline');
  }

  static stats(samples) {
    if (!samples.length) return { avg: null, min: null, max: null };
    const sum = samples.reduce((a, b) => a + b, 0);
    return {
      avg: Math.round(sum / samples.length),
      min: Math.min(...samples),
      max: Math.max(...samples),
    };
  }

  // Table-friendly snapshot (console.table, dashboard, API).
  snapshot() {
    const now = Date.now();
    return [...this.clients.values()].map((r) => {
      const s = ConnectionTracker.stats(r.rttSamples);
      return {
        userId: r.userId,
        role: r.role,
        session: r.sessionId,
        status: r.status,
        'rtt avg(ms)': s.avg,
        'rtt min': s.min,
        'rtt max': s.max,
        missed: r.missedHeartbeats,
        reconnects: r.reconnects,
        'last seen (s)': Math.round((now - r.lastSeen) / 1000),
      };
    });
  }
}

module.exports = { ConnectionTracker };