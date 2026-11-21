import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

function readSavedAuth() {
  try {
    return JSON.parse(localStorage.getItem('smartattend_auth') || 'null');
  } catch {
    localStorage.removeItem('smartattend_auth');
    return null;
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readSavedAuth);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    if (!auth?.token) {
      setReady(true);
      return () => { active = false; };
    }
    api.get('/auth/me')
      .then(({ data }) => {
        if (!active) return;
        const next = { ...auth, user: data.user };
        setAuth(next);
        localStorage.setItem('smartattend_auth', JSON.stringify(next));
      })
      .catch((error) => {
        if (!active) return;
        if (error.response?.status === 401) {
          localStorage.removeItem('smartattend_auth');
          setAuth(null);
        }
      })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
    // Validate the token once when the provider mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSession = (data) => {
    const next = { token: data.token, user: data.user };
    localStorage.setItem('smartattend_auth', JSON.stringify(next));
    setAuth(next);
    setReady(true);
    return data.user;
  };

  const login = async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    return saveSession(data);
  };

  const register = async (details) => {
    const { data } = await api.post('/auth/register', details);
    return saveSession(data);
  };

  const logout = () => {
    localStorage.removeItem('smartattend_auth');
    setAuth(null);
  };

  const value = useMemo(() => ({ user: auth?.user || null, token: auth?.token || null, ready, login, register, logout }), [auth, ready]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}