// Keeps the state of every client (lecturer/student) known to the server.
// Records are keyed by userId so a client that reconnects keeps its history.

class ConnectionTracker {
  constructor({ maxSamples = 50 } = {}) {
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
      missedHeartbeats: 0,         // consecutive misses (resets on success)
      sent: prev ? prev.sent : 0,  // total heartbeats sent (kept across reconnects)
      lost: prev ? prev.lost : 0,  // total heartbeats not answered in time
      rttSamples: prev ? prev.rttSamples : [], // last N round-trip times (ms)
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

  recordSent(socketId) {
    const rec = this.bySocket(socketId);
    if (rec) rec.sent += 1;
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

  // Heartbeat timed out. Returns the new consecutive-miss count.
  recordMiss(socketId) {
    const rec = this.bySocket(socketId);
    if (!rec) return 0;
    rec.missedHeartbeats += 1;
    rec.lost += 1;
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

  // avg / min / max / jitter / p95 of a list of RTT samples (ms).
  // jitter = average difference between consecutive samples.
  static stats(samples) {
    if (!samples.length) return { avg: null, min: null, max: null, jitter: null, p95: null };
    const sorted = [...samples].sort((a, b) => a - b);
    const sum = samples.reduce((a, b) => a + b, 0);
    let diff = 0;
    for (let i = 1; i < samples.length; i++) diff += Math.abs(samples[i] - samples[i - 1]);
    return {
      avg: Math.round(sum / samples.length),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      jitter: samples.length > 1 ? Math.round(diff / (samples.length - 1)) : 0,
      p95: sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)],
    };
  }

  static lossPct(rec) {
    return rec.sent ? Math.round((rec.lost / rec.sent) * 1000) / 10 : 0;
  }

  // Table-friendly snapshot (console.table, dashboard, API).
  snapshot() {
    const now = Date.now();
    return [...this.clients.values()].map((r) => {
      const s = ConnectionTracker.stats(r.rttSamples);
      return {
        userId: r.userId,
        role: r.role,
        status: r.status,
        'rtt avg': s.avg,
        'rtt min': s.min,
        'rtt max': s.max,
        'jitter': s.jitter,
        'loss %': ConnectionTracker.lossPct(r),
        missed: r.missedHeartbeats,
        reconnects: r.reconnects,
        'last seen (s)': Math.round((now - r.lastSeen) / 1000),
      };
    });
  }

  // Whole-network summary.
  summary() {
    const recs = [...this.clients.values()];
    const s = ConnectionTracker.stats(recs.flatMap((r) => r.rttSamples));
    const sent = recs.reduce((a, r) => a + r.sent, 0);
    const lost = recs.reduce((a, r) => a + r.lost, 0);
    return {
      known: recs.length,
      online: recs.filter((r) => r.status !== 'offline').length,
      avgRtt: s.avg,
      p95Rtt: s.p95,
      lossPct: sent ? Math.round((lost / sent) * 1000) / 10 : 0,
    };
  }
}

module.exports = { ConnectionTracker };