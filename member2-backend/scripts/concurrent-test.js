/**
 * Simulates many students submitting the same code at once (Node 18+).
 * Usage: node scripts/concurrent-test.js [numStudents]
 * Start the server first.
 */
const BASE = process.env.BASE_URL || 'http://localhost:4000/api';
const N = Number(process.argv[2]) || 50;

const call = async (path, method, body, token) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
};

(async () => {
  const run = Date.now();
  const lec = await call('/auth/register', 'POST',
    { name: 'Load Lecturer', email: `lec${run}@test.com`, password: 'password123', role: 'lecturer' });
  const { data: { session } } = await call('/sessions', 'POST', { courseCode: 'NET101', title: 'Load test' }, lec.data.token);

  const students = await Promise.all(Array.from({ length: N }, (_, i) =>
    call('/auth/register', 'POST',
      { name: `Student ${i}`, email: `s${run}_${i}@test.com`, password: 'password123', role: 'student', studentId: `ST${run}${i}` })));

  const t0 = performance.now();
  const results = await Promise.all(students.map((s) => call('/attendance', 'POST', { code: session.code }, s.data.token)));
  const ms = performance.now() - t0;

  // Same student double-submitting simultaneously: exactly one should win
  const dup = await Promise.all(Array.from({ length: 10 }, () => call('/attendance', 'POST', { code: session.code }, students[0].data.token)));

  const tally = (arr) => arr.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
  console.log(`${N} students, simultaneous submit:`, tally(results), `in ${ms.toFixed(0)} ms`);
  console.log('Same student x10 duplicate submits:', tally(dup), '(expect only 409s, already marked)');

  const list = await call(`/sessions/${session.id}/attendance`, 'GET', null, lec.data.token);
  console.log(`Records in DB: ${list.data.count} (expected ${N})`);
})();
