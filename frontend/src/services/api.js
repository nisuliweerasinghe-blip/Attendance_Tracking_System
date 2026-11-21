import axios from 'axios';

const baseURL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001/api').replace(/\/$/, '');

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000
});

api.interceptors.request.use((config) => {
  try {
    const saved = JSON.parse(localStorage.getItem('smartattend_auth') || 'null');
    if (saved?.token) config.headers.Authorization = `Bearer ${saved.token}`;
  } catch {
    localStorage.removeItem('smartattend_auth');
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiMessage = error.response?.data?.error?.message || error.response?.data?.message;
    if (!error.response) {
      error.userMessage = 'Cannot reach the backend. Check that Spring Boot is running on port 4001.';
    } else {
      error.userMessage = apiMessage || `Request failed (${error.response.status}).`;
    }
    return Promise.reject(error);
  }
);

export default api;