import React, { useState } from 'react';
import { X, Clock, Calendar, UserCheck } from 'lucide-react';
import { User } from '../../types';

interface AdminManualPunchModalProps {
  users: User[];
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminManualPunchModal: React.FC<AdminManualPunchModalProps> = ({
  users,
  onClose,
  onSuccess
}) => {
  // Only regular staff employees
  const staffUsers = users.filter(u => u.role === 'user');

  const [userId, setUserId] = useState<number>(staffUsers.length > 0 ? staffUsers[0].id : 0);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [checkIn, setCheckIn] = useState<string>('10:00');
  const [checkOut, setCheckOut] = useState<string>('19:00');
  const [status, setStatus] = useState<'P' | 'L' | 'Leave' | 'Half Day' | 'Weekly Off'>('P');
  const [reason, setReason] = useState<string>('Manual Punch by Admin');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      alert('Please select an employee');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/super_admin/attendance/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: Number(userId),
          date,
          checkIn: checkIn ? `${checkIn}:00` : undefined,
          checkOut: checkOut ? `${checkOut}:00` : undefined,
          status,
          reason
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert('Manual attendance recorded successfully!');
        onSuccess();
        onClose();
      } else {
        alert(data.message || 'Failed to save manual attendance');
      }
    } catch (err: any) {
      alert('Error saving record: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 max-w-md w-full shadow-2xl space-y-4 text-xs">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Record Manual Attendance</h3>
              <p className="text-[11px] text-slate-400">Add or override timesheet record</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Select Employee */}
          <div>
            <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
              Select Staff Member:
            </label>
            <select
              value={userId}
              onChange={(e) => setUserId(Number(e.target.value))}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-amber-500"
              required
            >
              {staffUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.registration_id ? `[${u.registration_id}] ` : ''}{u.name} - {u.designation || 'Staff'} ({u.site_name || 'HQ'})
                </option>
              ))}
            </select>
          </div>

          {/* Date & Status */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">Date:</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">Status:</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                <option value="P">Present (P)</option>
                <option value="L">Late (L)</option>
                <option value="Leave">Leave</option>
                <option value="Half Day">Half Day</option>
                <option value="Weekly Off">Weekly Off</option>
              </select>
            </div>
          </div>

          {/* In-Time & Out-Time */}
          {(status === 'P' || status === 'L' || status === 'Half Day') && (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">Check-in Time:</label>
                <input
                  type="time"
                  required
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">Check-out Time:</label>
                <input
                  type="time"
                  required
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-800 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* Reason / Admin Notes */}
          <div>
            <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">Reason / Remarks:</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Field visit, System correction, Manual approval"
              className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-2/3 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-md active:scale-98 transition-all disabled:opacity-50"
            >
              {submitting ? 'Saving Record...' : 'Save Manual Record'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
