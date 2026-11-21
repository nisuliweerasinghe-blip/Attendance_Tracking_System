import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BookOpen, CheckCircle2, Clipboard, Clock3, Plus, RefreshCw, Users, X } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import StatCard from '../components/StatCard';
import AttendanceTable from '../components/AttendanceTable';
import api from '../services/api';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function isEffectivelyActive(session) {
  return session.status === 'active' && new Date(session.expiresAt).getTime() > Date.now();
}

export default function LecturerDashboard() {
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ courseCode: '', title: '', durationMinutes: 15 });

  const selectedSession = useMemo(() => sessions.find((session) => String(session.id) === String(selectedId)) || null, [sessions, selectedId]);
  const activeCount = sessions.filter(isEffectivelyActive).length;
  const totalAttendance = attendance.length;

  const loadSessions = useCallback(async (keepSelection = true) => {
    try {
      const { data } = await api.get('/sessions');
      const next = data.sessions || [];
      setSessions(next);
      if (!keepSelection || !next.some((item) => String(item.id) === String(selectedId))) {
        setSelectedId(next.length ? next[0].id : null);
      }
      setError('');
    } catch (err) {
      setError(err.userMessage || 'Could not load sessions.');
    } finally {
      setLoadingSessions(false);
    }
  }, [selectedId]);

  const loadAttendance = useCallback(async (sessionId, quiet = false) => {
    if (!sessionId) return;
    if (!quiet) setLoadingAttendance(true);
    try {
      const { data } = await api.get(`/sessions/${sessionId}/attendance`);
      setAttendance(data.records || []);
      setError('');
    } catch (err) {
      if (!quiet) setError(err.userMessage || 'Could not load attendance records.');
    } finally {
      if (!quiet) setLoadingAttendance(false);
    }
  }, []);

  useEffect(() => { loadSessions(false); }, []); // initial fetch

  useEffect(() => {
    if (!selectedSession) { setAttendance([]); return undefined; }
    loadAttendance(selectedSession.id);
    if (!isEffectivelyActive(selectedSession)) return undefined;
    const timer = window.setInterval(() => loadAttendance(selectedSession.id, true), 8000);
    return () => window.clearInterval(timer);
  }, [selectedSession?.id, selectedSession?.status, selectedSession?.expiresAt, loadAttendance]);

  const createSession = async (event) => {
    event.preventDefault();
    setError(''); setNotice(''); setCreating(true);
    try {
      const { data } = await api.post('/sessions', {
        courseCode: form.courseCode.trim(),
        title: form.title.trim(),
        durationMinutes: Number(form.durationMinutes)
      });
      const created = data.session;
      setSessions((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setSelectedId(created.id);
      setForm({ courseCode: '', title: '', durationMinutes: 15 });
      setShowCreate(false);
      setNotice('Attendance session created. Share the code with your students.');
    } catch (err) {
      setError(err.userMessage || 'Could not create the session.');
    } finally { setCreating(false); }
  };

  const closeSession = async () => {
    if (!selectedSession || !window.confirm('Close this attendance session? Students will no longer be able to submit attendance.')) return;
    setClosing(true); setError(''); setNotice('');
    try {
      await api.post(`/sessions/${selectedSession.id}/close`);
      setSessions((current) => current.map((item) => item.id === selectedSession.id ? { ...item, status: 'closed' } : item));
      setNotice('The attendance session has been closed.');
    } catch (err) { setError(err.userMessage || 'Could not close the session.'); }
    finally { setClosing(false); }
  };

  const copyCode = async () => {
    if (!selectedSession?.code) return;
    try {
      await navigator.clipboard.writeText(selectedSession.code);
      setCopied(true); window.setTimeout(() => setCopied(false), 1600);
    } catch { setError('Could not copy the code. Please copy it manually.'); }
  };

  const selectedActive = selectedSession ? isEffectivelyActive(selectedSession) : false;

  return (
    <AppLayout mode="lecturer">
      <div className="page-heading">
        <div><span className="eyebrow">LECTURER WORKSPACE</span><h1>Attendance sessions</h1><p>Create a session, share its code, and follow attendance as students join.</p></div>
        <button className="primary-button" onClick={() => { setShowCreate(!showCreate); setNotice(''); }}><Plus size={18} /> New session</button>
      </div>

      {error && <div className="alert alert-error page-alert">{error}<button onClick={() => setError('')} aria-label="Dismiss"><X size={16} /></button></div>}
      {notice && <div className="alert alert-success page-alert"><CheckCircle2 size={17} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={16} /></button></div>}

      {showCreate && <section className="create-panel">
        <div className="section-heading"><div><span className="eyebrow">NEW SESSION</span><h2>Set up attendance</h2></div><button className="icon-button" onClick={() => setShowCreate(false)} aria-label="Close"><X size={18} /></button></div>
        <form className="create-form" onSubmit={createSession}>
          <div className="field-group"><label htmlFor="courseCode">Course code</label><input id="courseCode" value={form.courseCode} onChange={(e) => setForm({ ...form, courseCode: e.target.value })} placeholder="e.g. EC5205" minLength={2} maxLength={20} required /></div>
          <div className="field-group"><label htmlFor="title">Session title</label><input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Network Programming - Lecture 05" minLength={2} maxLength={120} required /></div>
          <div className="field-group duration-field"><label htmlFor="duration">Duration</label><div className="select-with-suffix"><select id="duration" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}><option value="5">5</option><option value="10">10</option><option value="15">15</option><option value="30">30</option><option value="45">45</option><option value="60">60</option><option value="90">90</option><option value="120">120</option><option value="180">180</option><option value="240">240</option></select><span>minutes</span></div></div>
          <button className="primary-button create-submit" disabled={creating}>{creating ? 'Creating…' : 'Create session'} <ArrowRightFallback /></button>
        </form>
        <p className="form-note">A unique six-character attendance code will be generated by the backend.</p>
      </section>}

      <section className="stats-grid">
        <StatCard label="Total sessions" value={sessions.length} hint="Created by your account" icon={BookOpen} tone="violet" />
        <StatCard label="Active sessions" value={activeCount} hint="Accepting attendance" icon={Activity} tone="green" />
        <StatCard label="Present in selected" value={totalAttendance} hint={selectedSession ? selectedSession.courseCode : 'Select a session'} icon={Users} tone="blue" />
      </section>

      <div className="dashboard-grid">
        <section className="surface-card sessions-card">
          <div className="card-heading"><div><h2>Your sessions</h2><p>Choose a session to view its attendance.</p></div><button className="icon-button" title="Refresh sessions" onClick={() => loadSessions(true)}><RefreshCw size={17} /></button></div>
          {loadingSessions ? <div className="inline-loader">Loading sessions…</div> : sessions.length === 0 ? <div className="empty-state"><div className="empty-icon"><BookOpen size={23} /></div><strong>No sessions created</strong><span>Create your first attendance session to get started.</span><button className="text-button" onClick={() => setShowCreate(true)}>Create a session <span>→</span></button></div> : <div className="session-list">
            {sessions.map((session) => {
              const active = isEffectivelyActive(session);
              return <button key={session.id} className={`session-item ${String(selectedId) === String(session.id) ? 'selected' : ''}`} onClick={() => { setSelectedId(session.id); setNotice(''); }}>
                <div className="session-item-top"><span className="course-pill">{session.courseCode}</span><span className={`status-dot-label ${active ? 'online' : 'offline'}`}><i />{active ? 'Active' : session.status === 'closed' ? 'Closed' : 'Expired'}</span></div>
                <strong>{session.title}</strong><span className="session-date"><Clock3 size={13} />{formatDate(session.createdAt)}</span>
              </button>;
            })}
          </div>}
        </section>

        <section className="surface-card detail-card">
          {!selectedSession ? <div className="empty-state detail-empty"><div className="empty-icon"><Clipboard size={24} /></div><strong>Select an attendance session</strong><span>Your session code and attendance records will appear here.</span></div> : <>
            <div className="card-heading detail-heading"><div><span className="eyebrow">SESSION OVERVIEW</span><h2>{selectedSession.title}</h2><p>{selectedSession.courseCode} · Created {formatDate(selectedSession.createdAt)}</p></div><span className={`status-badge ${selectedActive ? 'active' : 'closed'}`}>{selectedActive ? 'Active' : selectedSession.status === 'closed' ? 'Closed' : 'Expired'}</span></div>
            <div className="code-panel"><div><span>SHARE THIS CODE WITH STUDENTS</span><strong>{selectedSession.code}</strong><small>Students enter this code to mark attendance.</small></div><button className={`copy-button ${copied ? 'copied' : ''}`} onClick={copyCode}><Clipboard size={16} />{copied ? 'Copied' : 'Copy code'}</button></div>
            <div className="session-meta-grid"><div><span>Session ends</span><strong>{formatDate(selectedSession.expiresAt)}</strong></div><div><span>Attendance recorded</span><strong>{attendance.length} students</strong></div></div>
            <div className="attendance-heading"><div><h3>Attendance records</h3><p>Students who successfully submitted this code.</p></div><button className="icon-button" onClick={() => loadAttendance(selectedSession.id)} title="Refresh attendance"><RefreshCw size={16} /></button></div>
            {loadingAttendance ? <div className="inline-loader">Loading attendance…</div> : <AttendanceTable records={attendance} />}
            <div className="detail-footer"><span><span className="live-indicator" />Auto-refreshes every 8 seconds while active</span>{selectedActive && <button className="danger-button" onClick={closeSession} disabled={closing}>{closing ? 'Closing…' : 'End session'}</button>}</div>
          </>}
        </section>
      </div>
    </AppLayout>
  );
}

function ArrowRightFallback() { return <span aria-hidden="true">→</span>; }