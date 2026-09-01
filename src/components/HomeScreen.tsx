import React, { useState, useEffect } from 'react';
import { 
  Sun, Sunset, Moon, Sunrise, MapPin, Clock, CheckCircle2, 
  AlertTriangle, ChevronRight, Sparkles, Building2, 
  Calendar, ShieldCheck, RefreshCw, XCircle, Bell, User as UserIcon
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { User, AttendanceRecord, Site } from '../types';
import { useTranslation } from '../utils/translations';
import { NotificationsModal } from './NotificationsModal';

interface HomeScreenProps {
  currentUser: User;
  onOpenLeaveModal: () => void;
  onNavigateHistory: () => void;
  onNavigateProfile: () => void;
  onRefreshData: () => void;
  lang?: 'en' | 'hi';
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  currentUser,
  onOpenLeaveModal,
  onNavigateHistory,
  onNavigateProfile,
  onRefreshData,
  lang = 'en'
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [todayRequests, setTodayRequests] = useState<any[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const t = useTranslation(lang);
  
  // Late check-in reason modal
  const [showLateCheckinModal, setShowLateCheckinModal] = useState(false);
  const [lateReason, setLateReason] = useState('');
  const [lateMins, setLateMins] = useState(0);

  // Early checkout reason modal
  const [showEarlyCheckoutModal, setShowEarlyCheckoutModal] = useState(false);
  const [earlyReason, setEarlyReason] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  
  // Welcome / Goodbye popup toast
  const [greetingToast, setGreetingToast] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'welcome' | 'goodbye';
  }>({ show: false, title: '', message: '', type: 'welcome' });

  // Compute shift timings considering user settings and approved/pending half-day or time-change requests
  const getTodayShiftTimes = () => {
    let startMinutes = 10 * 60; // 10:00 AM
    let endMinutes = 19 * 60; // 07:00 PM

    if (currentUser.work_start_time) {
      const parts = currentUser.work_start_time.split(':');
      if (parts.length >= 2) startMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    if (currentUser.work_end_time) {
      const parts = currentUser.work_end_time.split(':');
      if (parts.length >= 2) endMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const halfDayReq = todayRequests.find((r: any) => 
      (r.type === 'HALF_DAY' || r.type === 'TIME_CHANGE') &&
      (r.date === todayStr || (r.start_date && r.end_date && todayStr >= r.start_date && todayStr <= r.end_date)) &&
      r.status !== 'REJECTED'
    );

    if (halfDayReq) {
      if (halfDayReq.check_in) {
        const parts = halfDayReq.check_in.split(':');
        if (parts.length >= 2) startMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      } else if (halfDayReq.half_day_slot === 'SECOND_HALF') {
        startMinutes = 14 * 60 + 30; // 02:30 PM
      }

      if (halfDayReq.check_out) {
        const parts = halfDayReq.check_out.split(':');
        if (parts.length >= 2) endMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      } else if (halfDayReq.half_day_slot === 'FIRST_HALF') {
        endMinutes = 14 * 60 + 30; // 02:30 PM
      }
    }

    return { startMinutes, endMinutes, isHalfDay: !!halfDayReq };
  };

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch(`/api/notifications?userId=${currentUser.id}&role=${currentUser.role}`);
      if (res.ok) {
        const notifs = await res.json();
        const unread = notifs.filter((n: any) => !n.is_read).length;
        setUnreadNotifCount(unread);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch today's record and sites
  const fetchTodayData = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/attendance/history/${currentUser.id}`);
      if (res.ok) {
        const history: AttendanceRecord[] = await res.json();
        const found = history.find(r => r.date === todayStr);
        setTodayRecord(found || null);
      }

      const reqRes = await fetch(`/api/attendance/requests/user/${currentUser.id}`);
      if (reqRes.ok) {
        const userReqs = await reqRes.json();
        setTodayRequests(userReqs || []);
      }

      const sitesRes = await fetch('/api/sites');
      if (sitesRes.ok) {
        const data = await sitesRes.json();
        setSites(data);
      }

      fetchUnreadCount();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTodayData();

    // Get current GPS location silently
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setGpsLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
          setGpsError(null);
        },
        err => {
          setGpsError(err.message);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [currentUser.id]);

  // Dynamic Time Greeting
  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 12) {
      return { 
        text: 'Good Morning', 
        icon: Sunrise, 
        color: 'text-amber-500', 
        hindi: 'शुभ प्रभात'
      };
    } else if (hour >= 12 && hour < 17) {
      return { 
        text: 'Good Afternoon', 
        icon: Sun, 
        color: 'text-amber-500', 
        hindi: 'शुभ दोपहर'
      };
    } else if (hour >= 17 && hour < 21) {
      return { 
        text: 'Good Evening', 
        icon: Sunset, 
        color: 'text-orange-500', 
        hindi: 'शुभ संध्या'
      };
    } else {
      return { 
        text: 'Good Night', 
        icon: Moon, 
        color: 'text-indigo-500', 
        hindi: 'शुभ रात्रि'
      };
    }
  };

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  // Status computation & Active Special Requests for Today
  const todayStr = new Date().toISOString().split('T')[0];
  const todayApprovedSpecial = todayRequests.find((r: any) => 
    r.status === 'APPROVED' &&
    (r.date === todayStr || (r.start_date && r.end_date && todayStr >= r.start_date && todayStr <= r.end_date)) &&
    ['WEEKLY_OFF', 'ADVANCE_LEAVE', 'EMERGENCY_LEAVE', 'LEAVE', 'HALF_DAY'].includes(r.type)
  );

  const isTodayWeeklyOff = todayRecord?.status === 'Weekly Off' || todayApprovedSpecial?.type === 'WEEKLY_OFF';
  const isTodayLeave = todayRecord?.status === 'Leave' || todayApprovedSpecial?.type === 'ADVANCE_LEAVE' || todayApprovedSpecial?.type === 'EMERGENCY_LEAVE' || todayApprovedSpecial?.type === 'LEAVE';
  const isTodayHalfDay = todayRecord?.status === 'Half Day' || todayApprovedSpecial?.type === 'HALF_DAY';

  // Handle Check-In initiation (Prompt for reason if checking in late, respecting half-day/time-change shifts)
  const handleCheckInClick = () => {
    setModalError(null);
    const hour = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const totalMinutes = hour * 60 + minutes;

    const { startMinutes } = getTodayShiftTimes();

    // If after shift start time, ask for late arrival reason (unless within 5 min grace)
    if (totalMinutes > startMinutes + 5) {
      setLateMins(totalMinutes - startMinutes);
      setShowLateCheckinModal(true);
    } else {
      performCheckIn('');
    }
  };

  // Perform Check-In API call
  const performCheckIn = async (reason: string) => {
    if (loading) return;
    setLoading(true);
    setModalError(null);

    try {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const timeStr = new Date().toTimeString().split(' ')[0]; // HH:MM:SS
      const deviceId = localStorage.getItem('staffsync_device_fingerprint') || `device_${navigator.userAgent.slice(0, 20)}`;
      localStorage.setItem('staffsync_device_fingerprint', deviceId);

      const finalReason = reason && reason.trim() ? reason.trim() : (showLateCheckinModal ? 'Late Arrival (Acknowledged)' : undefined);

      // Attempt fresh location if available
      let loc = gpsLocation;
      if (!loc && navigator.geolocation) {
        try {
          const pos: any = await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 3000 });
          });
          if (pos && pos.coords) {
            loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            setGpsLocation(loc);
          }
        } catch (e) {}
      }

      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          date: todayDateStr,
          time: timeStr,
          location: loc,
          method: 'app',
          deviceId,
          deviceInfo: navigator.userAgent.slice(0, 40),
          lateReason: finalReason
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setModalError(data.message || 'Check-in failed. Please verify your GPS permissions or contact admin.');
        setLoading(false);
        return;
      }

      setShowLateCheckinModal(false);
      setLateReason('');
      setModalError(null);

      // Celebration Confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}

      // Energetic Welcome Toast
      setGreetingToast({
        show: true,
        title: lang === 'hi' ? 'शुभ प्रभात! काम पर स्वागत है!' : `${greeting.text}! Welcome to Work!`,
        message: lang === 'hi' ? 'आपका आज का दिन सफल और ऊर्जावान रहे!' : 'Have a productive, successful and energetic work day!',
        type: 'welcome'
      });

      await fetchTodayData();
      onRefreshData();
    } catch (err: any) {
      setModalError('Error during check-in: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Check-Out initiation (Respects Half Day schedule)
  const handleCheckOutClick = () => {
    setModalError(null);
    const hour = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const totalMinutes = hour * 60 + minutes;
    
    const { endMinutes } = getTodayShiftTimes();

    // If before shift end time (e.g. 7 PM or 2:30 PM for 1st half), ask for early departure reason
    if (totalMinutes < endMinutes) {
      setShowEarlyCheckoutModal(true);
    } else {
      performCheckOut('');
    }
  };

  // Perform Check-Out API call
  const performCheckOut = async (reason: string) => {
    if (loading) return;
    setLoading(true);
    setModalError(null);
    try {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const timeStr = new Date().toTimeString().split(' ')[0];
      const finalReason = reason && reason.trim() ? reason.trim() : (showEarlyCheckoutModal ? 'Early Departure (Acknowledged)' : undefined);

      const res = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          date: todayDateStr,
          time: timeStr,
          earlyCheckoutReason: finalReason
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setModalError(data.message || 'Check-out failed.');
        setLoading(false);
        return;
      }

      setShowEarlyCheckoutModal(false);
      setEarlyReason('');
      setModalError(null);

      // Goodbye Toast
      setGreetingToast({
        show: true,
        title: lang === 'hi' ? 'अलविदा! शुभ संध्या!' : 'Good Bye! Shift Concluded!',
        message: lang === 'hi' ? 'आज के काम के लिए धन्यवाद। सुरक्षित घर पहुंचे!' : 'Great job today! Rest well and see you tomorrow.',
        type: 'goodbye'
      });

      await fetchTodayData();
      onRefreshData();
    } catch (err: any) {
      setModalError('Error during check-out: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Status computation
  const isCheckedIn = !!todayRecord?.check_in;
  const isCheckedOut = !!todayRecord?.check_out;

  const currentStatusLabel = isTodayWeeklyOff
    ? (lang === 'hi' ? 'साप्ताहिक अवकाश' : 'Weekly Off')
    : isTodayLeave
    ? (lang === 'hi' ? 'स्वीकृत अवकाश' : 'On Leave')
    : isTodayHalfDay
    ? (lang === 'hi' ? 'हाफ डे शिफ्ट' : 'Half Day')
    : !isCheckedIn
    ? t('notCheckedIn')
    : isCheckedOut
    ? t('checkedOutComplete')
    : todayRecord?.status === 'L'
    ? t('checkedInLate')
    : t('checkedInOnTime');

  const statusBadgeStyle = isTodayWeeklyOff
    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60'
    : isTodayLeave
    ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60'
    : isTodayHalfDay
    ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60'
    : !isCheckedIn
    ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60'
    : isCheckedOut
    ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60'
    : todayRecord?.status === 'L'
    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60'
    : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col justify-between pb-24 px-4 pt-3 max-w-md mx-auto font-sans transition-colors">
      
      {/* Top Header with Notification & Profile Avatar on LEFT side */}
      <div>
        <div className="flex items-center justify-between py-1 mb-2.5">
          
          {/* Top Left: Notification Bell & Profile Avatar */}
          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <button
              id="top-left-notifications-btn"
              onClick={() => setShowNotifModal(true)}
              className="relative p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs cursor-pointer active:scale-95"
              title="View Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white font-bold text-[9px] rounded-full flex items-center justify-center animate-pulse">
                  {unreadNotifCount}
                </span>
              )}
            </button>

            {/* Profile Avatar Icon - Click to Open Profile */}
            <button
              id="top-left-profile-avatar-btn"
              onClick={onNavigateProfile}
              className="flex items-center gap-2 p-1 pr-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs group text-left cursor-pointer active:scale-95"
              title="Open Profile"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs overflow-hidden shadow-xs shrink-0">
                {currentUser.avatar_url ? (
                  <img src={currentUser.avatar_url} alt={currentUser.name} className="w-full h-full object-cover" />
                ) : (
                  currentUser.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 pr-1">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[100px]">
                  {currentUser.name}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono leading-none">
                  {currentUser.registration_id || 'Staff'}
                </p>
              </div>
            </button>
          </div>

          {/* Top Right: Location Site Pill & Large Clear Date */}
          <div className="flex flex-col items-end">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-xs">
              <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="truncate max-w-[110px]">
                {currentUser.site_name || 'Headquarters'}
              </span>
            </div>
            {/* Prominent Day, Month, Date */}
            <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mt-1 tracking-tight">
              {currentTime.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

        </div>

        {/* Active Leave / Weekly Off Notice Card if today is scheduled */}
        {(isTodayWeeklyOff || isTodayLeave || isTodayHalfDay) && (
          <div className={`p-4 rounded-3xl border mb-3.5 shadow-xs animate-in fade-in duration-200 ${
            isTodayWeeklyOff
              ? 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-indigo-200 dark:border-indigo-800/80 text-indigo-900 dark:text-indigo-200'
              : isTodayLeave
              ? 'bg-gradient-to-r from-blue-500/10 to-teal-500/10 border-blue-200 dark:border-blue-800/80 text-blue-900 dark:text-blue-200'
              : 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 text-white font-bold shadow-xs ${
                isTodayWeeklyOff ? 'bg-indigo-600' : isTodayLeave ? 'bg-blue-600' : 'bg-amber-600'
              }`}>
                {isTodayWeeklyOff ? '🏖️' : isTodayLeave ? '🌴' : '🌓'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    {isTodayWeeklyOff
                      ? (lang === 'hi' ? 'साप्ताहिक अवकाश सक्रिय' : 'Weekly Off Scheduled')
                      : isTodayLeave
                      ? (lang === 'hi' ? 'स्वीकृत अवकाश' : 'Approved Leave Active')
                      : (lang === 'hi' ? 'हाफ डे शिफ्ट' : 'Half-Day Shift Active')}
                  </h4>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/80 dark:bg-slate-900/80 border border-current/20">
                    {todayApprovedSpecial?.status || 'APPROVED'}
                  </span>
                </div>
                <p className="text-[11px] mt-1 leading-relaxed opacity-90">
                  {isTodayWeeklyOff
                    ? (lang === 'hi' ? 'आज आपका निर्धारित साप्ताहिक अवकाश है। कोई उपस्थिति अनिवार्य नहीं है।' : 'Today is recorded as your official weekly roster off day. Relax and enjoy your break!')
                    : isTodayLeave
                    ? (todayApprovedSpecial?.reason ? `Reason: "${todayApprovedSpecial.reason}"` : 'Your leave for today is approved and marked in the company attendance ledger.')
                    : (todayApprovedSpecial?.half_day_slot === 'FIRST_HALF' ? 'First half shift (Morning until 02:30 PM)' : 'Second half shift (Afternoon 02:30 PM onwards)')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Greeting Banner (No Gujarati) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 shadow-xs mb-3.5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400">
                <GreetingIcon className={`w-4 h-4 ${greeting.color}`} />
                <span>{lang === 'hi' ? greeting.hindi : greeting.text}</span>
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5">
                {currentUser.name}
              </h2>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                {currentUser.designation || 'Corporate Staff'}
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Official Time</span>
              <span className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        {/* Status Box & Official Shift Hours */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 shadow-xs mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('dailyStatus')}
            </span>
            <div className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${statusBadgeStyle}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
              <span>{currentStatusLabel}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
            <div className="bg-slate-50 dark:bg-slate-950/60 rounded-2xl p-2.5 border border-slate-100 dark:border-slate-800/60">
              <p className="text-[10px] text-slate-400 font-medium">{t('officeHours')}</p>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                {currentUser.work_start_time || '10:00 AM'} - {currentUser.work_end_time || '07:00 PM'}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950/60 rounded-2xl p-2.5 border border-slate-100 dark:border-slate-800/60">
              <p className="text-[10px] text-slate-400 font-medium">{t('todayInOut')}</p>
              <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                {todayRecord?.check_in ? todayRecord.check_in.slice(0, 5) : '--:--'}
                {' '}/ {' '}
                {todayRecord?.check_out ? todayRecord.check_out.slice(0, 5) : '--:--'}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Interactive Attendance Circle (Zero-Jank Fixed Dimension Layout) */}
      <div className="my-auto py-2 flex flex-col items-center justify-center">
        
        <div className="w-64 h-64 relative flex items-center justify-center select-none">
          
          {/* Subtle Ambient Ring Layer */}
          <div className={`absolute w-56 h-56 rounded-full transition-opacity duration-500 pointer-events-none ${
            !isCheckedIn
              ? 'bg-blue-500/10 ring-4 ring-blue-500/20'
              : !isCheckedOut
              ? 'bg-emerald-500/10 ring-4 ring-emerald-500/20'
              : 'bg-slate-200/20 dark:bg-slate-800/30'
          }`}></div>

          {/* Core Interactive Touch Button */}
          <button
            id="attendance-action-circle-btn"
            disabled={loading || (isCheckedIn && isCheckedOut)}
            onClick={!isCheckedIn ? handleCheckInClick : !isCheckedOut ? handleCheckOutClick : undefined}
            className={`relative z-10 w-44 h-44 rounded-full flex flex-col items-center justify-center p-4 text-center shadow-xl transition-all active:scale-95 border-4 ${
              !isCheckedIn
                ? 'bg-gradient-to-b from-blue-600 to-indigo-700 border-blue-200 text-white shadow-blue-500/25 hover:shadow-blue-500/40 cursor-pointer'
                : !isCheckedOut
                ? 'bg-gradient-to-b from-emerald-600 to-teal-700 border-emerald-200 text-white shadow-emerald-500/25 hover:shadow-emerald-500/40 cursor-pointer'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 cursor-default'
            }`}
          >
            {loading ? (
              <div className="flex flex-col items-center">
                <RefreshCw className="w-7 h-7 animate-spin text-white mb-2" />
                <span className="text-xs font-semibold">Verifying GPS...</span>
              </div>
            ) : !isCheckedIn ? (
              <>
                <Clock className="w-8 h-8 stroke-[2.2] text-blue-100 mb-1" />
                <span className="text-sm font-bold tracking-tight uppercase">{t('tapToCheckIn')}</span>
                <span className="text-[10px] text-blue-100/90 mt-1 font-medium">Shift Start: 10:00 AM</span>
              </>
            ) : !isCheckedOut ? (
              <>
                <CheckCircle2 className="w-8 h-8 stroke-[2.2] text-emerald-100 mb-1" />
                <span className="text-sm font-bold tracking-tight uppercase">{t('tapToCheckOut')}</span>
                <span className="text-[10px] text-emerald-100/90 mt-1 font-medium">Shift End: 07:00 PM</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-8 h-8 text-emerald-500 mb-1" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase">{t('dayCompleted')}</span>
                <span className="text-[10px] text-slate-400 mt-0.5">{t('attendanceRecorded')}</span>
                <span className="text-[9px] text-blue-600 dark:text-blue-400 mt-1 font-medium">{t('seeYouTomorrow')}</span>
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center max-w-xs font-normal">
          {!isCheckedIn
            ? '💡 Click the circle above to record your morning entry.'
            : !isCheckedOut
            ? '🕒 Checked in. Tap to check out when completing your shift.'
            : '✨ You have successfully finished your work today.'}
        </p>
      </div>

      {/* Footer Branding */}
      <div className="text-center pt-2 pb-1">
        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">
          Designed & Developed by <span className="text-slate-700 dark:text-slate-300 font-semibold">Abhishek Bhatt</span>
        </p>
      </div>

      {/* Notifications Slide-over Modal */}
      <NotificationsModal
        currentUser={currentUser}
        isOpen={showNotifModal}
        onClose={() => setShowNotifModal(false)}
        onRefreshBadge={fetchUnreadCount}
        lang={lang}
      />

      {/* Welcome / Goodbye Popup Toast */}
      {greetingToast.show && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-xs w-full shadow-2xl text-center">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md ${
              greetingToast.type === 'welcome'
                ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                : 'bg-blue-600 text-white shadow-blue-500/30'
            }`}>
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {greetingToast.title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
              {greetingToast.message}
            </p>
            <button
              onClick={() => setGreetingToast({ ...greetingToast, show: false })}
              className="mt-5 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-md transition-all"
            >
              Continue to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Early Checkout Reason Modal */}
      {showEarlyCheckoutModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 max-w-xs w-full shadow-2xl">
            <div className="flex items-center gap-2 mb-3 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Early Check-Out</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Office shift concludes at 07:00 PM. Please state your reason for early departure:
            </p>

            {modalError && (
              <div className="p-2.5 mb-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{modalError}</span>
              </div>
            )}

            <textarea
              rows={3}
              value={earlyReason}
              onChange={(e) => setEarlyReason(e.target.value)}
              placeholder="e.g. Site meeting, Personal emergency, Half-day approval..."
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
            />
            <div className="flex gap-2">
              <button
                type="button"
                id="cancel-early-checkout-btn"
                onClick={() => {
                  setShowEarlyCheckoutModal(false);
                  setModalError(null);
                }}
                className="w-1/2 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-early-checkout-btn"
                disabled={loading}
                onClick={() => performCheckOut(earlyReason.trim() || 'Early Departure (Acknowledged)')}
                className="w-1/2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-all cursor-pointer shadow-xs"
              >
                {loading ? 'Submitting...' : 'Confirm Exit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Late Check-In Reason Modal (Prompts employee if arriving after official start time) */}
      {showLateCheckinModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-amber-300/80 dark:border-amber-700/80 rounded-3xl p-5 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 mb-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {lang === 'hi' ? 'देर से आने का कारण' : 'Late Arrival Reason Required'}
              </h3>
            </div>
            
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/50 rounded-2xl p-2.5 mb-2.5">
              <p className="text-xs text-amber-900 dark:text-amber-200 font-medium">
                {lang === 'hi'
                  ? `कार्यालय का निर्धारित समय सुबह 10:00 बजे है। आप ${lateMins} मिनट देरी से चेक-इन कर रहे हैं।`
                  : `Office shift begins at 10:00 AM. You are checking in ${lateMins} mins delayed.`
                }
              </p>
            </div>

            {modalError && (
              <div className="p-2.5 mb-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{modalError}</span>
              </div>
            )}

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              {lang === 'hi' ? 'कृपया देर से आने का कारण दर्ज करें:' : 'Please provide the reason for your late arrival:'}
            </p>

            {/* Quick Reason Chips for fast 1-tap input */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {[
                { en: 'Heavy Traffic', hi: 'भारी ट्रैफिक' },
                { en: 'Vehicle Breakdown', hi: 'गाड़ी में खराबी' },
                { en: 'Client Site Visit', hi: 'साइट विजिट' },
                { en: 'Family Emergency', hi: 'पारिवारिक कार्य' },
                { en: 'Transport Delay', hi: 'बस / ट्रेन विलंब' },
                { en: 'Health Issue', hi: 'अस्वस्थता' }
              ].map(chip => (
                <button
                  key={chip.en}
                  type="button"
                  onClick={() => setLateReason(lang === 'hi' ? chip.hi : chip.en)}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-900/50 hover:text-amber-800 dark:hover:text-amber-200 text-[11px] font-medium text-slate-700 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
                >
                  {lang === 'hi' ? chip.hi : chip.en}
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={lateReason}
              onChange={(e) => setLateReason(e.target.value)}
              placeholder={lang === 'hi' ? 'उदा. भारी ट्रैफिक, वाहन खराबी, साइट विजिट...' : 'e.g. Traffic jam on highway, flat tyre, customer meeting... (optional)'}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 mb-3"
            />

            <div className="flex gap-2">
              <button
                type="button"
                id="cancel-late-checkin-btn"
                onClick={() => {
                  setShowLateCheckinModal(false);
                  setLateReason('');
                  setModalError(null);
                }}
                className="w-1/2 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                type="button"
                id="confirm-late-checkin-btn"
                disabled={loading}
                onClick={() => performCheckIn(lateReason.trim() || 'Late Arrival (Acknowledged)')}
                className="w-1/2 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-all shadow-xs cursor-pointer"
              >
                {loading ? 'Submitting...' : (lang === 'hi' ? 'पुष्टि करें व चेक-इन' : 'Confirm Check-In')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
