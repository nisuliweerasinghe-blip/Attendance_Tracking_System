// Per-session log of attendance events. Every event gets a sequence number
// (1, 2, 3, ...) that only goes up. A client that remembers the last number it
// saw can later ask "give me everything after #N"

class EventLog {
  constructor({ maxPerSession = 1000 } = {}) {
    this.events = new Map();   // sessionId -> [event, ...]
    this.counters = new Map(); // sessionId -> last sequence number used
    this.maxPerSession = maxPerSession;
  }

  append(sessionId, type, data = {}) {
    const seq = (this.counters.get(sessionId) || 0) + 1;
    this.counters.set(sessionId, seq);

    const event = { seq, sessionId, type, data, ts: Date.now() };
    if (!this.events.has(sessionId)) this.events.set(sessionId, []);
    const list = this.events.get(sessionId);
    list.push(event);
    if (list.length > this.maxPerSession) list.shift(); // keep memory bounded
    return event;
  }

  // All events of a session after sequence number `lastSeq`.
  since(sessionId, lastSeq = 0) {
    return (this.events.get(sessionId) || []).filter((e) => e.seq > lastSeq);
  }

  lastSeq(sessionId) {
    return this.counters.get(sessionId) || 0;
  }

  sessions() {
    return [...this.counters.keys()];
  }
}

module.exports = { EventLog };