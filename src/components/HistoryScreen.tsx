import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, Clock, Download, Filter, Search, CheckCircle2, 
  AlertTriangle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Building2, Sparkles, User, RefreshCw, CalendarRange, X
} from 'lucide-react';
import { AttendanceRecord, User as UserType, Site } from '../types';
import { generateMonthlyAttendancePDF } from '../utils/pdfGenerator';
import { useTranslation } from '../utils/translations';

interface HistoryScreenProps {
  currentUser: UserType;
  lang?: 'en' | 'hi';
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ currentUser, lang = 'en' }) => {
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<Site[]>([]);
  const t = useTranslation(lang);

  // Active view: 'list' | 'calendar' | 'range'
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'range'>('list');

  // Month & Year state
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(new Date().getMonth()); // 0-11

  // Date Range Filters
  const [rangeStartDate, setRangeStartDate] = useState<string>('');
  const [rangeEndDate, setRangeEndDate] = useState<string>('');
  const [selectedSingleDate, setSelectedSingleDate] = useState<string | null>(null);

  // Status and Search Filters
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Derived Month string YYYY-MM
  const activeMonthStr = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}`;

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance/history/${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }

      const sitesRes = await fetch('/api/sites');
      if (sitesRes.ok) {
        const siteData = await sitesRes.json();
        setSites(siteData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [currentUser.id]);

  // Handle Month Navigation
  const handlePrevMonth = () => {
    if (currentMonthIndex === 0) {
      setCurrentMonthIndex(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonthIndex(prev => prev - 1);
    }
    setSelectedSingleDate(null);
  };

  const handleNextMonth = () => {
    if (currentMonthIndex === 11) {
      setCurrentMonthIndex(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonthIndex(prev => prev + 1);
    }
    setSelectedSingleDate(null);
  };

  // Preset Quick Range Handlers
  const handleSetQuickRange = (type: 'this_month' | 'last_7_days' | 'last_15_days' | 'last_30_days') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (type === 'this_month') {
      const firstDay = `${activeMonthStr}-01`;
      const lastDayNum = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
      const lastDay = `${activeMonthStr}-${String(lastDayNum).padStart(2, '0')}`;
      setRangeStartDate(firstDay);
      setRangeEndDate(lastDay);
    } else if (type === 'last_7_days') {
      const past = new Date(today);
      past.setDate(today.getDate() - 6);
      setRangeStartDate(past.toISOString().split('T')[0]);
      setRangeEndDate(todayStr);
    } else if (type === 'last_15_days') {
      const past = new Date(today);
      past.setDate(today.getDate() - 14);
      setRangeStartDate(past.toISOString().split('T')[0]);
      setRangeEndDate(todayStr);
    } else if (type === 'last_30_days') {
      const past = new Date(today);
      past.setDate(today.getDate() - 29);
      setRangeStartDate(past.toISOString().split('T')[0]);
      setRangeEndDate(todayStr);
    }
    setSelectedSingleDate(null);
  };

  // Calendar Click Handler for Date Range / Selection
  const handleCalendarDayClick = (dateStr: string) => {
    if (viewMode === 'range') {
      if (!rangeStartDate || (rangeStartDate && rangeEndDate)) {
        // Start new range selection
        setRangeStartDate(dateStr);
        setRangeEndDate('');
      } else if (rangeStartDate && !rangeEndDate) {
        if (dateStr < rangeStartDate) {
          setRangeStartDate(dateStr);
          setRangeEndDate(rangeStartDate);
        } else {
          setRangeEndDate(dateStr);
        }
      }
      setSelectedSingleDate(null);
    } else {
      // Toggle single day selection
      setSelectedSingleDate(prev => prev === dateStr ? null : dateStr);
    }
  };

  // Filtered list
  const filteredRecords = useMemo(() => {
    return history.filter(record => {
      // Custom Date Range filter
      if (rangeStartDate && rangeEndDate) {
        if (record.date < rangeStartDate || record.date > rangeEndDate) {
          return false;
        }
      } else if (rangeStartDate && !rangeEndDate) {
        if (record.date !== rangeStartDate) return false;
      } else if (selectedSingleDate) {
        if (record.date !== selectedSingleDate) return false;
      } else {
        // Default to Active Month
        if (!record.date.startsWith(activeMonthStr)) {
          return false;
        }
      }

      // Status match
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'LATE' && !(record.status === 'L' || (record.is_late && record.is_late > 0))) {
          return false;
        }
        if (selectedStatus === 'PRESENT' && record.status !== 'P') {
          return false;
        }
        if (selectedStatus === 'LEAVE' && !(record.status === 'Leave' || record.status === 'Half Day')) {
          return false;
        }
        if (selectedStatus === 'WEEKLY_OFF' && record.status !== 'Weekly Off') {
          return false;
        }
      }

      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDate = record.date.toLowerCase().includes(q);
        const matchesReason = record.early_checkout_reason?.toLowerCase().includes(q) || record.late_reason?.toLowerCase().includes(q);
        if (!matchesDate && !matchesReason) return false;
      }

      return true;
    });
  }, [history, activeMonthStr, rangeStartDate, rangeEndDate, selectedSingleDate, selectedStatus, searchQuery]);

  // Statistics calculation for the current filter scope
  const stats = useMemo(() => {
    const presentCount = filteredRecords.filter(r => r.status === 'P').length;
    const lateCount = filteredRecords.filter(r => r.status === 'L' || (r.is_late && r.is_late > 0)).length;
    const leaveCount = filteredRecords.filter(r => r.status === 'Leave' || r.status === 'Half Day').length;
    const weeklyOffCount = filteredRecords.filter(r => r.status === 'Weekly Off').length;
    
    let totalLateMinutes = 0;
    let totalOvertimeHours = 0;

    filteredRecords.forEach(r => {
      if (r.late_minutes) totalLateMinutes += Number(r.late_minutes);
      if (r.overtime_hours) totalOvertimeHours += Number(r.overtime_hours);
    });

    return {
      presentCount,
      lateCount,
      leaveCount,
      weeklyOffCount,
      totalLateMinutes,
      totalOvertimeHours,
      totalDaysWorked: presentCount + lateCount,
      totalRecords: filteredRecords.length
    };
  }, [filteredRecords]);

  // Google Calendar style matrix for activeMonth
  const calendarDays = useMemo(() => {
    const year = currentYear;
    const month = currentMonthIndex;
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days: ({ day: number; dateStr: string; record?: AttendanceRecord; isInRange?: boolean; isStart?: boolean; isEnd?: boolean } | null)[] = [];
    
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const rec = history.find(r => r.date === dateStr);
      
      const isStart = rangeStartDate === dateStr;
      const isEnd = rangeEndDate === dateStr;
      const isInRange = Boolean(rangeStartDate && rangeEndDate && dateStr >= rangeStartDate && dateStr <= rangeEndDate);

      days.push({ 
        day: d, 
        dateStr, 
        record: rec,
        isInRange,
        isStart,
        isEnd
      });
    }

    return days;
  }, [currentYear, currentMonthIndex, history, rangeStartDate, rangeEndDate]);

  // Month names for Google Calendar dropdown
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const yearsList = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 3 + i);

  // PDF Export Trigger (Generates custom date range or monthly report)
  const handleDownloadPDF = () => {
    let periodLabel = new Date(activeMonthStr + '-01').toLocaleString('default', { month: 'long', year: 'numeric' });
    if (rangeStartDate && rangeEndDate) {
      periodLabel = `${rangeStartDate} to ${rangeEndDate}`;
    } else if (rangeStartDate) {
      periodLabel = `Date: ${rangeStartDate}`;
    } else if (selectedSingleDate) {
      periodLabel = `Date: ${selectedSingleDate}`;
    }

    generateMonthlyAttendancePDF(
      filteredRecords, 
      currentUser, 
      periodLabel, 
      currentUser.site_name || 'Headquarters'
    );
  };

  const clearRangeFilter = () => {
    setRangeStartDate('');
    setRangeEndDate('');
    setSelectedSingleDate(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col justify-between pb-24 px-4 pt-3 max-w-md mx-auto font-sans transition-colors">
      
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{t('timesheet')}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Attendance Calendar & Timesheet Logs</p>
          </div>
          
          <button
            id="download-timesheet-pdf-btn"
            onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF Export</span>
          </button>
        </div>

        {/* Date Range Filter Box */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 mb-3 shadow-xs space-y-2.5">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <CalendarRange className="w-3.5 h-3.5 text-blue-600" />
                <span>Date Range Filter (Start → End)</span>
              </span>
              {(rangeStartDate || rangeEndDate || selectedSingleDate) && (
                <button
                  id="reset-range-filter-btn"
                  onClick={clearRangeFilter}
                  className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">Start Date</span>
                <input
                  type="date"
                  id="filter-start-date-input"
                  value={rangeStartDate}
                  onChange={(e) => {
                    setRangeStartDate(e.target.value);
                    if (rangeEndDate && rangeEndDate < e.target.value) setRangeEndDate(e.target.value);
                    setSelectedSingleDate(null);
                  }}
                  className="w-full p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-white"
                />
              </div>

              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">End Date</span>
                <input
                  type="date"
                  id="filter-end-date-input"
                  value={rangeEndDate}
                  min={rangeStartDate}
                  onChange={(e) => {
                    setRangeEndDate(e.target.value);
                    setSelectedSingleDate(null);
                  }}
                  className="w-full p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-white"
                />
              </div>
            </div>

            {/* Quick 1-tap presets */}
            <div className="flex flex-wrap gap-1 pt-0.5">
              <button
                type="button"
                id="quick-range-month-btn"
                onClick={() => handleSetQuickRange('this_month')}
                className="px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-[10px] font-medium hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer"
              >
                Full Month
              </button>
              <button
                type="button"
                id="quick-range-7days-btn"
                onClick={() => handleSetQuickRange('last_7_days')}
                className="px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-[10px] font-medium hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer"
              >
                Last 7 Days
              </button>
              <button
                type="button"
                id="quick-range-15days-btn"
                onClick={() => handleSetQuickRange('last_15_days')}
                className="px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-[10px] font-medium hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer"
              >
                Last 15 Days
              </button>
              <button
                type="button"
                id="quick-range-30days-btn"
                onClick={() => handleSetQuickRange('last_30_days')}
                className="px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-[10px] font-medium hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer"
              >
                Last 30 Days
              </button>
            </div>
          </div>
        </div>

        {/* Summary Metric KPI Cards */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {/* Present */}
          <div className="bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/60 rounded-2xl p-2 text-center shadow-xs">
            <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">{t('present')}</p>
            <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{stats.presentCount}</p>
            <p className="text-[8px] text-slate-400">On-Time</p>
          </div>

          {/* Late */}
          <div className="bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/60 rounded-2xl p-2 text-center shadow-xs">
            <p className="text-[9px] text-amber-600 dark:text-amber-400 font-bold uppercase">{t('late')}</p>
            <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{stats.lateCount}</p>
            <p className="text-[8px] text-slate-400">{stats.totalLateMinutes}m delay</p>
          </div>

          {/* Leaves */}
          <div className="bg-white dark:bg-slate-900 border border-blue-200/80 dark:border-blue-900/60 rounded-2xl p-2 text-center shadow-xs">
            <p className="text-[9px] text-blue-600 dark:text-blue-400 font-bold uppercase">{t('leave')}</p>
            <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{stats.leaveCount}</p>
            <p className="text-[8px] text-slate-400">Approved</p>
          </div>

          {/* Weekly Offs */}
          <div className="bg-white dark:bg-slate-900 border border-indigo-200/80 dark:border-indigo-900/60 rounded-2xl p-2 text-center shadow-xs">
            <p className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold uppercase">{t('weekly_off')}</p>
            <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{stats.weeklyOffCount}</p>
            <p className="text-[8px] text-slate-400">Off Days</p>
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 text-xs scrollbar-none">
          {[
            { id: 'ALL', label: `All Records (${filteredRecords.length})` },
            { id: 'PRESENT', label: 'Present' },
            { id: 'LATE', label: 'Late' },
            { id: 'LEAVE', label: 'Leaves' },
            { id: 'WEEKLY_OFF', label: 'Weekly Offs' }
          ].map(chip => (
            <button
              key={chip.id}
              onClick={() => setSelectedStatus(chip.id)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedStatus === chip.id
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Timesheet List Cards */}
        <div className="space-y-2.5">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
              <span>Loading timesheet logs...</span>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center text-slate-400 text-xs">
              No attendance records found for the selected period.
            </div>
          ) : (
            filteredRecords.map(record => {
              const isExpanded = expandedId === record.id;
              const isP = record.status === 'P';
              const isL = record.status === 'L' || (record.is_late && record.is_late > 0);
              const isLeave = record.status === 'Leave' || record.status === 'Half Day';
              const isWOff = record.status === 'Weekly Off';

              return (
                <div
                  key={record.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 shadow-xs"
                >
                  <div 
                    onClick={() => setExpandedId(isExpanded ? null : record.id)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${
                        isP ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' :
                        isL ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' :
                        isLeave ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' :
                        'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                      }`}>
                        {isP ? 'P' : isL ? 'L' : isLeave ? 'LV' : 'WO'}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{record.date}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {record.check_in ? record.check_in.slice(0, 5) : '--:--'}
                          {' → '}
                          {record.check_out ? record.check_out.slice(0, 5) : '--:--'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                        isP ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300' :
                        isL ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300' :
                        isLeave ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300' :
                        'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300'
                      }`}>
                        {isP ? 'Present' : isL ? 'Late' : record.status}
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[11px] space-y-1.5 text-slate-600 dark:text-slate-300">
                      {record.late_minutes && record.late_minutes > 0 ? (
                        <p className="text-amber-600 dark:text-amber-400 font-medium">
                          ⚠️ Late Arrival: {record.late_minutes} minutes delayed
                        </p>
                      ) : null}
                      {record.late_reason && (
                        <p className="bg-amber-50 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-200/80 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 font-medium">
                          <span className="font-bold">Late Reason:</span> {record.late_reason}
                        </p>
                      )}
                      {record.overtime_hours && record.overtime_hours > 0 ? (
                        <p className="text-purple-600 dark:text-purple-400 font-medium">
                          ⏳ Overtime Logged: {record.overtime_hours} hours
                        </p>
                      ) : null}
                      {record.early_checkout_reason && (
                        <p className="bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                          <span className="font-bold">Early Departure Reason:</span> {record.early_checkout_reason}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400">
                        Method: {record.method || 'Mobile App'} • Verified Check-In
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* Footer Branding */}
      <div className="text-center pt-6 pb-2">
        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">
          Designed & Developed by <span className="text-slate-700 dark:text-slate-300 font-semibold">Abhishek Bhatt</span>
        </p>
      </div>

    </div>
  );
};
