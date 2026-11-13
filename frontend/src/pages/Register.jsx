import { useState } from 'react';
import { Activity, ArrowRight, GraduationCap, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student', studentId: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    const payload = { name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role };
    if (form.role === 'student') payload.studentId = form.studentId.trim();
    try {
      const user = await register(payload);
      navigate(user.role === 'student' ? '/student' : '/lecturer', { replace: true });
    } catch (err) {
      setError(err.userMessage || 'Unable to create your account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page register-page">
      <div className="auth-decoration decor-one" /><div className="auth-decoration decor-two" />
      <div className="auth-panel register-panel">
        <div className="auth-brand"><div className="brand-mark"><Activity size={23} strokeWidth={2.5} /></div><span>SmartAttend</span></div>
        <div className="auth-intro"><span className="eyebrow">GET STARTED</span><h1>Create your <span>account.</span></h1><p>Join your classroom workspace with a student or lecturer account.</p></div>
        <form className="auth-form" onSubmit={submit}>
          {error && <div className="alert alert-error">{error}</div>}
          <label htmlFor="name">Full name</label><input className="plain-input" id="name" name="name" placeholder="Your full name" value={form.name} onChange={update} minLength={2} maxLength={100} required />
          <label htmlFor="reg-email">Email address</label><input className="plain-input" id="reg-email" name="email" type="email" placeholder="you@university.edu" value={form.email} onChange={update} required />
          <label>Account type</label>
          <div className="role-options">
            <button type="button" className={`role-option ${form.role === 'student' ? 'selected' : ''}`} onClick={() => setForm({ ...form, role: 'student' })}><GraduationCap size={19} /><span><strong>Student</strong><small>Join sessions</small></span></button>
            <button type="button" className={`role-option ${form.role === 'lecturer' ? 'selected' : ''}`} onClick={() => setForm({ ...form, role: 'lecturer' })}><UserRound size={19} /><span><strong>Lecturer</strong><small>Manage sessions</small></span></button>
          </div>
          {form.role === 'student' && <><label htmlFor="studentId">Student ID</label><input className="plain-input" id="studentId" name="studentId" placeholder="e.g. ENG/2023/001" value={form.studentId} onChange={update} minLength={3} maxLength={30} required /></>}
          <label htmlFor="reg-password">Password</label><input className="plain-input" id="reg-password" name="password" type="password" placeholder="At least 8 characters" value={form.password} onChange={update} minLength={8} maxLength={100} autoComplete="new-password" required />
          <button className="primary-button auth-submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'} <ArrowRight size={17} /></button>
        </form>
        <p className="auth-switch">Already registered? <Link to="/login">Sign in</Link></p>
        <div className="auth-footnote">SMARTATTEND · CLASSROOM ATTENDANCE TRACKING</div>
      </div>
      <div className="auth-side-content"><div className="side-orbit orbit-a" /><div className="side-orbit orbit-b" /><div className="side-message"><span className="side-kicker">BUILT FOR LEARNING</span><h2>Everyone stays in sync.</h2><p>Lecturers create attendance sessions. Students join with a short session code.</p><div className="side-metric"><div className="metric-symbol"><GraduationCap size={21} /></div><div><strong>Simple by design</strong><span>Sign in · Join · Stay organised</span></div></div></div></div>
    </div>
  );
}