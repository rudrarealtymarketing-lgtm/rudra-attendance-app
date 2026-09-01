import React, { useState, useEffect } from 'react';
import { 
  X, Calendar, Clock, AlertCircle, CheckCircle2, ShieldAlert, 
  Sparkles, PlusCircle, History, Edit3, Check, RefreshCw, ChevronDown
} from 'lucide-react';
import { User, AttendanceRequest } from '../types';
import { useTranslation } from '../utils/translations';
import { formatRequestDateTime } from '../utils/dateFormatter';

interface LeaveModalProps {
  currentUser: User;
  onClose: () => void;
  onRequestSubmitted: () => void;
  lang?: 'en' | 'hi';
}

type RequestCategory = 'TIME_CHANGE' | 'ADVANCE_LEAVE' | 'EMERGENCY_LEAVE' | 'HALF_DAY' | 'WEEKLY_OFF';

export const LeaveModal: React.FC<LeaveModalProps> = ({
  currentUser,
  onClose,
  onRequestSubmitted,
  lang = 'en'
}) => {
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [category, setCategory] = useState<RequestCategory>('TIME_CHANGE');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [correctionCount, setCorrectionCount] = useState<number>(0);
  const [weeklyOffCount, setWeeklyOffCount] = useState<number>(0);
  const t = useTranslation(lang);

  // Time selections (HH:MM)
  const [requestedCheckIn, setRequestedCheckIn] = useState('10:00');
  const [requestedCheckOut, setRequestedCheckOut] = useState('19:00');
  const [halfDayStart, setHalfDayStart] = useState('10:00');
  const [halfDayEnd, setHalfDayEnd] = useState('14:30');

  // History State
  const [historyRequests, setHistoryRequests] = useState<AttendanceRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editingRequest, setEditingRequest] = useState<AttendanceRequest | null>(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Fetch correction quota and weekly off quota used this month and history requests
  const fetchUserData = async () => {
    try {
      setLoadingHistory(true);
      const res = await fetch(`/api/attendance/requests/user/${currentUser.id}`);
      if (res.ok) {
        const reqs = await res.json();
        setHistoryRequests(reqs || []);
        
        const currentMonth = new Date().toISOString().slice(0, 7);
        const thisMonthCorrections = reqs.filter((r: any) => 
          (r.type === 'TIME_CHANGE' || r.type === 'CORRECTION') && 
          r.date?.startsWith(currentMonth) &&
          r.status !== 'REJECTED'
        ).length;
        setCorrectionCount(thisMonthCorrections);

        const thisMonthWeeklyOffs = reqs.filter((r: any) =>
          r.type === 'WEEKLY_OFF' &&
          r.date?.startsWith(currentMonth) &&
          r.status !== 'REJECTED'
        ).length;
        setWeeklyOffCount(thisMonthWeeklyOffs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [currentUser.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const targetDate = (category === 'ADVANCE_LEAVE' || category === 'EMERGENCY_LEAVE') ? startDate : date;

    if (!targetDate) {
      setErrorMsg('Please select a valid date.');
      return;
    }

    if (!reason.trim()) {
      setErrorMsg('Please provide a short explanation / reason.');
      return;
    }

    if (category === 'TIME_CHANGE' && currentUser.role === 'user' && correctionCount >= 3) {
      setErrorMsg('You have reached the limit of 3 Time Corrections this month. Please contact your Director / Super Admin.');
      return;
    }

    if (category === 'WEEKLY_OFF' && currentUser.role === 'user' && weeklyOffCount >= 4) {
      setErrorMsg('You have reached the monthly limit of 4 Weekly Offs. Maximum 4 Weekly Offs are allowed per month.');
      return;
    }

    setLoading(true);

    try {
      let finalReason = reason.trim();
      if (category === 'HALF_DAY') {
        finalReason = `[Half-Day Window: ${halfDayStart} to ${halfDayEnd}] - ${finalReason}`;
      } else if (category === 'ADVANCE_LEAVE' || category === 'EMERGENCY_LEAVE') {
        if (startDate !== endDate) {
          finalReason = `[Date Range: ${startDate} to ${endDate}] - ${finalReason}`;
        }
      }

      const res = await fetch('/api/attendance/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          type: category,
          date: targetDate,
          startDate: startDate || targetDate,
          endDate: endDate || targetDate,
          reason: finalReason,
          requested_check_in: category === 'TIME_CHANGE' ? requestedCheckIn : (category === 'HALF_DAY' ? halfDayStart : undefined),
          requested_check_out: category === 'TIME_CHANGE' ? requestedCheckOut : (category === 'HALF_DAY' ? halfDayEnd : undefined)
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.message || `Server returned error (${res.status}). Please try again.`);
        setLoading(false);
        return;
      }

      setSuccessMsg('Your request has been submitted successfully for Director review.');
      setReason('');
      fetchUserData();
      onRequestSubmitted();
      setTimeout(() => {
        setActiveTab('history');
        setSuccessMsg('');
      }, 1200);
    } catch (e: any) {
      setErrorMsg('Network or Server Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Edit / Reschedule Pending Request
  const handleStartEdit = (req: AttendanceRequest) => {
    setEditingRequest(req);
    setEditStartDate(req.start_date || req.date || '');
    setEditEndDate(req.end_date || req.date || '');
    setEditReason(req.reason || '');
  };

  const handleSaveEdit = async () => {
    if (!editingRequest) return;
    if (!editStartDate || !editEndDate) {
      alert('Please choose valid dates.');
      return;
    }
    setEditLoading(true);
    try {
      const res = await fetch(`/api/attendance/requests/${editingRequest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          date: editStartDate,
          startDate: editStartDate,
          endDate: editEndDate,
          reason: editReason
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.message || 'Failed to update request.');
      } else {
        alert('Request dates and details rescheduled successfully.');
        setEditingRequest(null);
        fetchUserData();
        onRequestSubmitted();
      }
    } catch (err: any) {
      alert('Error updating request: ' + err.message);
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center border border-blue-100 dark:border-blue-900/50 shadow-xs">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Attendance & Leave Desk
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Submit & Manage official requests
              </p>
            </div>
          </div>

          <button
            id="close-leave-modal-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={() => setActiveTab('new')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'new'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Request</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Request History</span>
            {historyRequests.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {historyRequests.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: NEW REQUEST FORM */}
        {activeTab === 'new' && (
          <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-4 flex-1">
            
            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Compact Request Category Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Select Request Type
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as RequestCategory)}
                  className="w-full p-3 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none shadow-xs"
                >
                  <option value="TIME_CHANGE">⏱️ 1. Time Duration / Correction (Max 3/month)</option>
                  <option value="ADVANCE_LEAVE">📅 2. Advance Leave (Start to End Date)</option>
                  <option value="EMERGENCY_LEAVE">🚨 3. Emergency Leave (Urgent medical/personal)</option>
                  <option value="HALF_DAY">🌓 4. Half Day (Shift Timing Window)</option>
                  <option value="WEEKLY_OFF">🏖️ 5. Weekly Off (Roster Off Day)</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
              </div>
            </div>

            {/* Time Change Monthly Quota Badge */}
            {category === 'TIME_CHANGE' && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Monthly Quota: <strong>{correctionCount} / 3 used</strong></span>
                </div>
                <span className="text-[10px] font-semibold bg-amber-200/60 dark:bg-amber-900/60 px-2 py-0.5 rounded-full">
                  {3 - correctionCount > 0 ? `${3 - correctionCount} remaining` : 'Limit reached'}
                </span>
              </div>
            )}

            {/* Weekly Off Monthly Limit Badge (Max 4/Month for Corporate Employees) */}
            {category === 'WEEKLY_OFF' && (
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl text-xs text-indigo-850 dark:text-indigo-250 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🏖️</span>
                  <span>Weekly Off Limit: <strong>{weeklyOffCount} / 4 used this month</strong></span>
                </div>
                <span className="text-[10px] font-bold bg-indigo-200/80 dark:bg-indigo-900/60 px-2.5 py-0.5 rounded-full text-indigo-900 dark:text-indigo-200">
                  {4 - weeklyOffCount > 0 ? `${4 - weeklyOffCount} remaining` : 'Max 4 limit reached'}
                </span>
              </div>
            )}

            {/* Date Selector for Single-Day requests (TIME CHANGE, HALF DAY, WEEKLY OFF) */}
            {category !== 'ADVANCE_LEAVE' && category !== 'EMERGENCY_LEAVE' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Select Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Date Range Selector for ADVANCE LEAVE and EMERGENCY LEAVE (Start Date to End Date) */}
            {(category === 'ADVANCE_LEAVE' || category === 'EMERGENCY_LEAVE') && (
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Leave Duration (Start Date to End Date)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Start Date</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        if (endDate < e.target.value) setEndDate(e.target.value);
                      }}
                      required
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">End Date</span>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Time Range Selector for TIME CHANGE */}
            {category === 'TIME_CHANGE' && (
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Requested Check-In
                  </label>
                  <div className="relative">
                    <input
                      type="time"
                      value={requestedCheckIn}
                      onChange={(e) => setRequestedCheckIn(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Requested Check-Out
                  </label>
                  <div className="relative">
                    <input
                      type="time"
                      value={requestedCheckOut}
                      onChange={(e) => setRequestedCheckOut(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Time Selection for HALF DAY (Start & End Time) */}
            {category === 'HALF_DAY' && (
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Half-Day Shift Timing
                </label>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400">Shift Start</span>
                    <input
                      type="time"
                      value={halfDayStart}
                      onChange={(e) => setHalfDayStart(e.target.value)}
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Shift End</span>
                    <input
                      type="time"
                      value={halfDayEnd}
                      onChange={(e) => setHalfDayEnd(e.target.value)}
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Preset Quick Chips */}
                <div className="flex gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => { setHalfDayStart('10:00'); setHalfDayEnd('14:30'); }}
                    className="px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-[10px] font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    1st Half (10:00 - 14:30)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setHalfDayStart('14:30'); setHalfDayEnd('19:00'); }}
                    className="px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-[10px] font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    2nd Half (14:30 - 19:00)
                  </button>
                </div>
              </div>
            )}

            {/* Reason Field */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Reason / Remarks
              </label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Site inspection, Planned family trip, Medical appointment..."
                required
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Submit Action */}
            <button
              id="submit-leave-request-btn"
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-600/25 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>Submitting Request...</span>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  <span>Submit to Director</span>
                </>
              )}
            </button>

          </form>
        )}

        {/* TAB 2: REQUEST HISTORY & RESCHEDULE */}
        {activeTab === 'history' && (
          <div className="p-4 overflow-y-auto space-y-3 flex-1">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Your Submitted Requests ({historyRequests.length})
              </p>
              <button
                type="button"
                onClick={fetchUserData}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {historyRequests.length === 0 ? (
              <div className="py-12 text-center text-slate-400 dark:text-slate-500">
                <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">No past requests found.</p>
              </div>
            ) : (
              historyRequests.map((req) => {
                const isPending = req.status === 'PENDING';
                const isApproved = req.status === 'APPROVED';
                const isRejected = req.status === 'REJECTED';

                const displayType = (req.type || 'CORRECTION').replace(/_/g, ' ');
                const dateDisplay = (req.start_date && req.end_date && req.start_date !== req.end_date)
                  ? `${req.start_date} to ${req.end_date}`
                  : req.date;

                return (
                  <div 
                    key={req.id}
                    className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                          {displayType}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isApproved ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' :
                          isRejected ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300' :
                          'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                        }`}>
                          {req.status}
                        </span>
                      </div>

                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        #{req.id}
                      </span>
                    </div>

                    {/* Applied Date & Time */}
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span>Applied on: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{formatRequestDateTime(req.created_at)}</strong></span>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 space-y-1.5">
                      <p>
                        <strong className="text-slate-500 dark:text-slate-400">Requested For:</strong> <span className="font-semibold text-slate-800 dark:text-slate-200">{dateDisplay}</span>
                      </p>
                      {req.half_day_slot && (
                        <p>
                          <strong className="text-slate-500 dark:text-slate-400">Half Day Slot:</strong> {req.half_day_slot === 'FIRST_HALF' ? 'First Half (Morning to 2:30 PM)' : 'Second Half (2:30 PM to Evening)'}
                        </p>
                      )}
                      {req.check_in && (
                        <p>
                          <strong className="text-slate-500 dark:text-slate-400">Correction Timings:</strong> {req.check_in} - {req.check_out || '19:00'}
                        </p>
                      )}
                      {req.reason && (
                        <p className="text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg">
                          "{req.reason}"
                        </p>
                      )}

                      {/* Approval / Rejection Decision Details */}
                      {!isPending && (
                        <div className={`mt-2 pt-2 border-t text-[11px] space-y-1 ${
                          isApproved ? 'border-emerald-100 dark:border-emerald-950/60' : 'border-rose-100 dark:border-rose-950/60'
                        }`}>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${isApproved ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {isApproved ? 'Approved' : 'Declined'} on: <strong>{formatRequestDateTime(req.actioned_at || req.created_at)}</strong>
                            </span>
                          </div>
                          {req.actioned_by && (
                            <p className="text-slate-500 dark:text-slate-400">
                              Decision by: <strong className="text-slate-700 dark:text-slate-300">{req.actioned_by}</strong>
                            </p>
                          )}
                          {req.admin_comment && (
                            <p className={`font-medium ${isApproved ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                              <strong>Remarks:</strong> {req.admin_comment}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Reschedule Button if Pending */}
                    {isPending && (
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(req)}
                          className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Change Date / Reschedule</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Inline Reschedule Dialog */}
            {editingRequest && (
              <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Edit3 className="w-4 h-4 text-blue-600" />
                      <span>Reschedule Request Dates</span>
                    </h4>
                    <button 
                      onClick={() => setEditingRequest(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Modify your dates or reason for this pending request.
                  </p>

                  <div className="space-y-2.5 text-xs">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={editStartDate}
                        onChange={(e) => {
                          setEditStartDate(e.target.value);
                          if (editEndDate < e.target.value) setEditEndDate(e.target.value);
                        }}
                        className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={editEndDate}
                        min={editStartDate}
                        onChange={(e) => setEditEndDate(e.target.value)}
                        className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Updated Reason / Program Change
                      </label>
                      <textarea
                        rows={2}
                        value={editReason}
                        onChange={(e) => setEditReason(e.target.value)}
                        className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                        placeholder="e.g. Program date postponed to next week..."
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingRequest(null)}
                      className="w-1/2 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={editLoading}
                      onClick={handleSaveEdit}
                      className="w-1/2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-all shadow-xs flex items-center justify-center gap-1"
                    >
                      {editLoading ? 'Updating...' : 'Save & Resubmit'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
