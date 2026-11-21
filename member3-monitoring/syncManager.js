// Missed-update synchronisation.
//
// When a client (re)connects it sends the last sequence number it saw
// (auth.lastSeq). The server replies with every event after that number
// ("sync:missed"). A client can also ask at any time ("sync:request"), e.g. when
// it notices a gap in the numbers.
//
// Special case: if the client's lastSeq is HIGHER than the server's, the server
// lost its log (restart without persistence). The reply is flagged reset=true and
// contains the full history, so the client starts counting again.

function attachSync(io, eventLog) {
  function buildSync(sessionId, lastSeq) {
    const serverLastSeq = eventLog.lastSeq(sessionId);
    const reset = lastSeq > serverLastSeq;
    const events = eventLog.since(sessionId, reset ? 0 : lastSeq);
    return { sessionId, reset, serverLastSeq, events };
  }

  io.on('connection', (socket) => {
    const { sessionId, userId, lastSeq } = socket.handshake.auth || {};
    if (!sessionId) return;

    // 1) Automatic sync right after (re)connecting.
    const payload = buildSync(sessionId, Number(lastSeq) || 0);
    if (payload.events.length > 0 || payload.reset) {
      socket.emit('sync:missed', payload);
      console.log(`[sync] ${userId}: sent ${payload.events.length} missed event(s)` +
        ` (client was at #${Number(lastSeq) || 0}, server at #${payload.serverLastSeq})` +
        (payload.reset ? ' [reset]' : ''));
    }

    // 2) On-demand sync (client detected a gap).
    socket.on('sync:request', (data, cb) => {
      const p = buildSync(sessionId, Number(data && data.lastSeq) || 0);
      console.log(`[sync] ${userId}: requested sync from #${data && data.lastSeq}` +
        ` -> ${p.events.length} event(s)`);
      if (typeof cb === 'function') cb(p);
    });
  });
}

module.exports = { attachSync };