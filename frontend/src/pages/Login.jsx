import { useState } from 'react';
import { Activity, ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(form);
      navigate(user.role === 'student' ? '/student' : '/lecturer', { replace: true });
    } catch (err) {
      setError(err.userMessage || 'Unable to sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-decoration decor-one" /><div className="auth-decoration decor-two" />
      <div className="auth-panel">
        <div className="auth-brand"><div className="brand-mark"><Activity size={23} strokeWidth={2.5} /></div><span>SmartAttend</span></div>
        <div className="auth-intro"><span className="eyebrow">WELCOME BACK</span><h1>Attendance, <span>made simple.</span></h1><p>Sign in to manage your classroom sessions and attendance records.</p></div>
        <form className="auth-form" onSubmit={submit}>
          {error && <div className="alert alert-error">{error}</div>}
          <label htmlFor="email">Email address</label>
          <div className="input-with-icon"><Mail size={18} /><input id="email" name="email" type="email" placeholder="you@university.edu" value={form.email} onChange={update} autoComplete="email" required /></div>
          <label htmlFor="password">Password</label>
          <div className="input-with-icon"><LockKeyhole size={18} /><input id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={form.password} onChange={update} autoComplete="current-password" required /><button className="password-toggle" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
          <button className="primary-button auth-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={17} /></button>
        </form>
        <p className="auth-switch">New to SmartAttend? <Link to="/register">Create an account</Link></p>
        <div className="auth-footnote">SMARTATTEND · CLASSROOM ATTENDANCE TRACKING</div>
      </div>
      <div className="auth-side-content"><div className="side-orbit orbit-a" /><div className="side-orbit orbit-b" /><div className="side-message"><span className="side-kicker">SMARTER CLASSROOMS</span><h2>Spend less time on roll call. More time on learning.</h2><p>A simple way for lecturers and students to keep attendance organised.</p><div className="side-metric"><div className="metric-symbol"><Activity size={20} /></div><div><strong>One connected workspace</strong><span>Sessions · Attendance · Records</span></div></div></div></div>
    </div>
  );
}