import { Activity, BookOpenCheck, LogOut, UserRound } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AppLayout({ children, mode = 'lecturer' }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isStudent = mode === 'student';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><Activity size={22} strokeWidth={2.5} /></div>
          <div><span className="brand-name">SmartAttend</span><span className="brand-caption">CLASSROOM SYSTEM</span></div>
        </div>
        <div className="side-section-label">WORKSPACE</div>
        <nav className="side-nav">
          <NavLink to={isStudent ? '/student' : '/lecturer'} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
            <BookOpenCheck size={18} /> <span>{isStudent ? 'My attendance' : 'Attendance sessions'}</span>
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help"><span className="help-dot" /> <div><strong>System status</strong><small>Connected to workspace</small></div></div>
          <button className="side-link logout-link" onClick={handleLogout}><LogOut size={18} /><span>Sign out</span></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><div className="brand-mark"><Activity size={19} /></div><strong>SmartAttend</strong></div>
          <div className="topbar-spacer" />
          <div className="profile-chip">
            <div className="avatar"><UserRound size={17} /></div>
            <div className="profile-copy"><strong>{user?.name || 'User'}</strong><span>{user?.role || 'member'}</span></div>
          </div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}