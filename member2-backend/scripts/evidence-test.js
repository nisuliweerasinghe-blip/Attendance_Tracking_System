/**
 * Runs every key API scenario and prints a PASS/FAIL table with response times.
 * Screenshot the output for your report.
 * Usage (server running):  node scripts/evidence-test.js
 */
const BASE = process.env.BASE_URL || 'http://localhost:4000/api';
const rows = [];

async function call(path, method = 'GET', body, token) {
  const t0 = performance.now();
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  const ms = performance.now() - t0;
  const data = await res.json().catch(() => ({}));
  return { status: res.status, code: data.error?.code, data, ms };
}

function check(name, r, expStatus, expCode) {
  const ok = r.status === expStatus && (!expCode || r.code === expCode);
  rows.push({ Scenario: name, Expected: expCode ? `${expStatus} ${expCode}` : `${expStatus}`,
    Actual: r.code ? `${r.status} ${r.code}` : `${r.status}`, 'Time (ms)': r.ms.toFixed(1), Result: ok ? 'PASS' : 'FAIL' });
}

const run = Date.now();
const register = (role, i) => call('/auth/register', 'POST', {
  name: `${role} ${i}`, email: `${role}${i}_${run}@test.com`, password: 'password123', role,
  ...(role === 'student' && { studentId: `ST${run}${i}` }),
});

(async () => {
  check('Health check', await call('/health'), 200);

  const lec = (await register('lecturer', 1)).data.token;
  const s1 = (await register('student', 1)).data.token;
  const s2 = (await register('student', 2)).data.token;
  const s3 = (await register('student', 3)).data.token;

  check('Wrong password login', await call('/auth/login', 'POST', { email: `student1_${run}@test.com`, password: 'wrongpass1' }), 401, 'BAD_CREDENTIALS');
  check('Duplicate registration', await register('student', 1), 409, 'DUPLICATE_USER');
  check('Submit without token', await call('/attendance', 'POST', { code: 'ABC234' }), 401, 'NO_TOKEN');
  check('Submit with fake token', await call('/attendance', 'POST', { code: 'ABC234' }, 'fake.token.here'), 401, 'INVALID_TOKEN');
  check('Student creates session (role check)', await call('/sessions', 'POST', { courseCode: 'NET101', title: 'x' }, s1), 403, 'FORBIDDEN');
  check('Lecturer submits attendance (role check)', await call('/attendance', 'POST', { code: 'ABC234' }, lec), 403, 'FORBIDDEN');

  const sess = (await call('/sessions', 'POST', { courseCode: 'NET101', title: 'Evidence run' }, lec)).data.session;
  check('Create session', { status: 201, ms: 0 }, 201); rows.pop(); // creation timing shown below

  check('Malformed code', await call('/attendance', 'POST', { code: '12' }, s1), 400, 'VALIDATION_ERROR');
  check('Nonexistent code', await call('/attendance', 'POST', { code: 'ZZZZZZ' }, s1), 404, 'INVALID_CODE');
  check('Valid attendance submission', await call('/attendance', 'POST', { code: sess.code }, s1), 201);
  check('Duplicate submission', await call('/attendance', 'POST', { code: sess.code }, s1), 409, 'ALREADY_MARKED');

  await call(`/sessions/${sess.id}/close`, 'POST', null, lec);
  check('Submit to closed session', await call('/attendance', 'POST', { code: sess.code }, s2), 410, 'SESSION_CLOSED');

  // Race: ONE student, 10 simultaneous requests, exactly one may succeed
  const sess2 = (await call('/sessions', 'POST', { courseCode: 'NET101', title: 'Race' }, lec)).data.session;
  const race = await Promise.all(Array.from({ length: 10 }, () => call('/attendance', 'POST', { code: sess2.code }, s3)));
  const wins = race.filter((r) => r.status === 201).length;
  const dupes = race.filter((r) => r.status === 409).length;
  rows.push({ Scenario: 'Race: 1 student x 10 simultaneous', Expected: '1x201, 9x409',
    Actual: `${wins}x201, ${dupes}x409`, 'Time (ms)': Math.max(...race.map((r) => r.ms)).toFixed(1),
    Result: wins === 1 && dupes === 9 ? 'PASS' : 'FAIL' });

  const list = await call(`/sessions/${sess2.id}/attendance`, 'GET', null, lec);
  rows.push({ Scenario: 'DB has exactly 1 record after race', Expected: '1', Actual: String(list.data.count),
    'Time (ms)': list.ms.toFixed(1), Result: list.data.count === 1 ? 'PASS' : 'FAIL' });

  console.table(rows);
  const failed = rows.filter((r) => r.Result === 'FAIL').length;
  console.log(failed ? `${failed} scenario(s) FAILED` : 'All scenarios passed');
})();
