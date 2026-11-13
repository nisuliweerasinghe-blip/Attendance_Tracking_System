import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import LecturerDashboard from './pages/LecturerDashboard';
import StudentDashboard from './pages/StudentDashboard';
import { LoaderCircle } from 'lucide-react';

function PageLoader() {
  return <div className="page-loader"><LoaderCircle className="spin" size={28} /><span>Loading SmartAttend…</span></div>;
}

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'student' ? '/student' : '/lecturer'} replace />;
}

function GuestOnly({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <PageLoader />;
  if (user) return <HomeRedirect />;
  return children;
}

function Protected({ children, allowed }) {
  const { user, ready } = useAuth();
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (allowed && !allowed.includes(user.role)) return <HomeRedirect />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      <Route path="/lecturer" element={<Protected allowed={['lecturer', 'admin']}><LecturerDashboard /></Protected>} />
      <Route path="/student" element={<Protected allowed={['student']}><StudentDashboard /></Protected>} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}