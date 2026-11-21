import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock3, History, KeyRound, Send, X } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import StatCard from '../components/StatCard';
import api from '../services/api';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function StudentDashboard() {
  const [code, setCode] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await api.get('/attendance/me');
      setHistory(data.records || []);
      setError('');
    } catch (err) {
      setError(err.userMessage || 'Could not load your attendance history.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const submitCode = async (event) => {
    event.preventDefault();
    setError(''); setSuccess(null);
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(normalized)) {
      setError('Enter the six-character session code shared by your lecturer.');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/attendance', { code: normalized });
      setSuccess({ ...data, code: normalized });
      setCode('');
      await loadHistory();
    } catch (err) {
      setError(err.userMessage || 'Could not submit attendance.');
    } finally { setSubmitting(false); }
  };

  return (
    <AppLayout mode="student">
      <div className="page-heading student-page-heading"><div><span className="eyebrow">STUDENT WORKSPACE</span><h1>My attendance</h1><p>Enter the code shared by your lecturer to record your presence.</p></div></div>
      {error && <div className="alert alert-error page-alert">{error}<button onClick={() => setError('')} aria-label="Dismiss"><X size={16} /></button></div>}
      {success && <div className="alert alert-success page-alert"><CheckCircle2 size={18} /><span><strong>Attendance recorded!</strong> Your presence for {success.session?.courseCode} — {success.session?.title} has been saved.</span><button onClick={() => setSuccess(null)} aria-label="Dismiss"><X size={16} /></button></div>}

      <div className="student-layout-grid">
        <section className="surface-card mark-card">
          <div className="mark-card-art"><div className="mark-art-ring ring-one" /><div className="mark-art-ring ring-two" /><div className="mark-art-icon"><KeyRound size={27} /></div></div>
          <span className="eyebrow">MARK ATTENDANCE</span><h2>Have a session code?</h2><p>Enter the six-character code displayed by your lecturer. Make sure you are signed in with your own student account.</p>
          <form className="code-entry-form" onSubmit={submitCode}>
            <label htmlFor="session-code">SESSION CODE</label>
            <input id="session-code" className="code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder="A B C 1 2 3" maxLength={6} autoComplete="off" spellCheck="false" />
            <button className="primary-button submit-code-button" disabled={submitting || code.length !== 6}>{submitting ? 'Submitting…' : 'Submit attendance'} <Send size={16} /></button>
          </form>
          <div className="mark-card-note"><CheckCircle2 size={15} /><span>Each student can mark attendance once per session.</span></div>
        </section>

        <div className="student-side-column">
          <StatCard label="Attendance records" value={history.length} hint="Successfully recorded sessions" icon={History} tone="violet" />
          <div className="tip-card"><div className="tip-icon"><Clock3 size={18} /></div><div><strong>Remember</strong><p>Session codes expire when the lecturer closes the session or the session duration ends.</p></div></div>
        </div>
      </div>

      <section className="surface-card history-card">
        <div className="card-heading"><div><h2>Attendance history</h2><p>Your previously recorded sessions.</p></div><span className="record-count">{history.length} {history.length === 1 ? 'record' : 'records'}</span></div>
        {loading ? <div className="inline-loader">Loading your records…</div> : history.length === 0 ? <div className="empty-state"><div className="empty-icon"><History size={23} /></div><strong>No attendance history yet</strong><span>Once you submit a valid session code, your record will show up here.</span></div> : <div className="table-wrap"><table className="attendance-table"><thead><tr><th>COURSE</th><th>SESSION</th><th>DATE RECORDED</th><th>STATUS</th></tr></thead><tbody>{history.map((record) => <tr key={record.id}><td><span className="course-pill">{record.courseCode}</span></td><td><strong>{record.title}</strong></td><td><span className="time-cell"><Clock3 size={14} />{formatDate(record.submittedAt)}</span></td><td><span className="status-badge active">Recorded</span></td></tr>)}</tbody></table></div>}
      </section>
    </AppLayout>
  );
}