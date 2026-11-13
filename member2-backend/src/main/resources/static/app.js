const API = '/api';
const $ = (id) => document.getElementById(id);
let mode = 'login';

const store = {
  get token() { try { return localStorage.getItem('token'); } catch { return null; } },
  set token(v) { try { v ? localStorage.setItem('token', v) : localStorage.removeItem('token'); } catch {} },
};

async function api(path, method = 'GET', body) {
  let res;
  try {
    res = await fetch(API + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(store.token && { Authorization: `Bearer ${store.token}` }) },
      body: body && JSON.stringify(body),
    });
  } catch {
    throw new Error('Cannot reach the server. Check your connection.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data.error || {};
    const err = new Error(e.details?.[0] ? `${e.details[0].field}: ${e.details[0].message}` : e.message || 'Request failed');
    err.status = res.status; err.code = e.code;
    throw err;
  }
  return data;
}

function say(el, text, ok) { el.textContent = text; el.className = 'msg ' + (text ? (ok ? 'ok' : 'err') : ''); }

function setMode(m) {
  mode = m;
  const reg = m === 'register';
  $('tab-login').classList.toggle('active', !reg);
  $('tab-register').classList.toggle('active', reg);
  $('f-name').hidden = $('f-sid').hidden = !reg;
  $('auth-submit').textContent = reg ? 'Create student account' : 'Log in';
  say($('auth-msg'), '');
}

function showDash(user) {
  $('auth-view').hidden = true; $('dash-view').hidden = false; $('userbox').hidden = false;
  $('username').textContent = user.name;
  loadHistory();
}

function showAuth() {
  store.token = null;
  $('auth-view').hidden = false; $('dash-view').hidden = true; $('userbox').hidden = true;
}

async function loadHistory() {
  try {
    const { records, count } = await api('/attendance/me');
    const tbody = $('history'); tbody.replaceChildren();
    for (const r of records) {
      const tr = document.createElement('tr');
      for (const text of [r.courseCode, r.title, new Date(r.submittedAt).toLocaleString()]) {
        const td = document.createElement('td'); td.textContent = text; tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    $('count').textContent = `(${count})`;
    $('empty').hidden = count > 0;
  } catch (err) {
    if (err.status === 401) showAuth();
  }
}

$('tab-login').onclick = () => setMode('login');
$('tab-register').onclick = () => setMode('register');
$('logout').onclick = showAuth;

$('auth-form').onsubmit = async (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  const btn = $('auth-submit'); btn.disabled = true; say($('auth-msg'), '');
  try {
    const body = mode === 'register'
      ? { name: f.name, email: f.email, password: f.password, role: 'student', studentId: f.studentId }
      : { email: f.email, password: f.password };
    const data = await api(`/auth/${mode}`, 'POST', body);
    if (data.user.role !== 'student') throw new Error('This dashboard is for students only.');
    store.token = data.token;
    e.target.reset();
    showDash(data.user);
  } catch (err) { say($('auth-msg'), err.message); }
  finally { btn.disabled = false; }
};

$('code-form').onsubmit = async (e) => {
  e.preventDefault();
  const btn = $('code-submit'); btn.disabled = true; say($('code-msg'), '');
  try {
    const data = await api('/attendance', 'POST', { code: $('code').value });
    say($('code-msg'), `Attendance recorded for ${data.session.courseCode} - ${data.session.title}`, true);
    $('code').value = '';
    loadHistory();
  } catch (err) {
    say($('code-msg'), err.code === 'ALREADY_MARKED' ? 'You are already marked present for this session.' : err.message);
    if (err.status === 401) showAuth();
  } finally { btn.disabled = false; }
};

// Restore an existing login on page load
(async () => {
  if (!store.token) return;
  try { showDash((await api('/auth/me')).user); } catch { showAuth(); }
})();
