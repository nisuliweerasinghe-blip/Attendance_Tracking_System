// Per-session log of attendance events. Every event gets a sequence number
// (1, 2, 3, ...) that only goes up. A client that remembers the last number it
// saw can ask "give me everything after #N" (used for sync after reconnecting).
// If filePath is given, the log is saved to disk so it survives server restarts.

const fs = require('fs');

class EventLog {
  constructor({ maxPerSession = 1000, filePath = null } = {}) {
    this.events = new Map();   // sessionId -> [event, ...]
    this.counters = new Map(); // sessionId -> last sequence number used
    this.maxPerSession = maxPerSession;
    this.filePath = filePath;
    if (filePath) this._load();
  }

  append(sessionId, type, data = {}) {
    const seq = (this.counters.get(sessionId) || 0) + 1;
    this.counters.set(sessionId, seq);

    const event = { seq, sessionId, type, data, ts: Date.now() };
    if (!this.events.has(sessionId)) this.events.set(sessionId, []);
    const list = this.events.get(sessionId);
    list.push(event);
    if (list.length > this.maxPerSession) list.shift(); // keep memory bounded
    this._save();
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

  _save() {
    if (!this.filePath) return;
    try {
      const data = {
        counters: Object.fromEntries(this.counters),
        events: Object.fromEntries(this.events),
      };
      fs.writeFileSync(this.filePath, JSON.stringify(data));
    } catch (err) {
      console.error('[log] could not save event log:', err.message);
    }
  }

  _load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      let total = 0;
      for (const [s, list] of Object.entries(raw.events || {})) {
        this.events.set(s, list);
        total += list.length;
      }
      for (const [s, n] of Object.entries(raw.counters || {})) this.counters.set(s, n);
      console.log(`[log] restored ${total} event(s) from ${this.filePath}`);
    } catch (err) {
      if (err.code !== 'ENOENT') console.error('[log] could not load event log:', err.message);
    }
  }
}

module.exports = { EventLog };