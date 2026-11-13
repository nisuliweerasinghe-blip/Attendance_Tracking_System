import { Clock3, Users } from 'lucide-react';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AttendanceTable({ records = [], emptyMessage = 'No attendance records yet.' }) {
  if (!records.length) {
    return <div className="empty-state compact-empty"><div className="empty-icon"><Users size={22} /></div><strong>No students recorded yet</strong><span>{emptyMessage}</span></div>;
  }

  return (
    <div className="table-wrap">
      <table className="attendance-table">
        <thead><tr><th>STUDENT</th><th>STUDENT ID</th><th>SUBMITTED AT</th></tr></thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td><div className="student-cell"><span className="student-avatar">{(record.studentName || 'S').slice(0, 1).toUpperCase()}</span><strong>{record.studentName || `Student ${record.studentId || ''}`}</strong></div></td>
              <td>{record.studentNumber || '—'}</td>
              <td><span className="time-cell"><Clock3 size={14} />{formatDate(record.submittedAt)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}