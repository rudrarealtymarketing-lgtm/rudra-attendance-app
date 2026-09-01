import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Calendar, Clock, CheckCircle2, XCircle, Shield, 
  MapPin, Plus, Edit, Trash2, Download, Search, Building2, 
  Smartphone, Lock, RefreshCw, AlertTriangle, Check, Layers,
  FileSpreadsheet, ExternalLink, Globe, Key, UserCheck, Eye,
  ArrowLeft, X, Printer, CalendarRange, ChevronRight, User as UserIcon,
  CheckCircle
} from 'lucide-react';
import { User, AttendanceRecord, AttendanceRequest, Site } from '../types';
import { generateMonthlyAttendancePDF } from '../utils/pdfGenerator';
import { formatRequestDateTime } from '../utils/dateFormatter';
import { AdminStaffTab } from './admin/AdminStaffTab';
import { AdminSitesTab } from './admin/AdminSitesTab';
import { AdminManualPunchModal } from './admin/AdminManualPunchModal';
import { AdminSheetsTab } from './admin/AdminSheetsTab';
import { ChangePasswordModal } from './ChangePasswordModal';

interface AdminConsoleProps {
  currentUser: User;
  onRefreshData: () => void;
  lang?: 'en' | 'hi';
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({ 
  currentUser, 
  onRefreshData,
  lang = 'en'
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'attendance' | 'requests' | 'staff' | 'sites' | 'sheets'>('dashboard');
  const [requestFilter, setRequestFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  // Data states
  const [users, setUsers] = useState<User[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [requests, setRequests] = useState<AttendanceRequest[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  // Global / Dashboard Filters
  const [selectedSite, setSelectedSite] = useState<string>('All');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState('');

  // Master Attendance Filter states
  const now = new Date();
  const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentMonthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
  
  const [rangeStartDate, setRangeStartDate] = useState<string>(currentMonthStart);
  const [rangeEndDate, setRangeEndDate] = useState<string>(currentMonthEnd);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('ALL');
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState('');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<'ALL' | 'ON_TIME' | 'LATE' | 'ABSENT' | 'LEAVE'>('ALL');

  // Drill-down Modal State
  const [selectedStaffUser, setSelectedStaffUser] = useState<User | null>(null);

  // Modal States
  const [showManualPunchModal, setShowManualPunchModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Fetch all admin data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, attRes, reqRes, siteRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/super_admin/attendance'),
        fetch('/api/attendance/requests'),
        fetch('/api/sites')
      ]);

      if (usersRes.ok) setUsers(await usersRes.json());
      if (attRes.ok) setAttendance(await attRes.json());
      if (reqRes.ok) setRequests(await reqRes.json());
      if (siteRes.ok) setSites(await siteRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ONLY regular staff members (exclude Admin & Director)
  const regularStaffUsers = useMemo(() => {
    return users.filter(u => {
      const r = (u.role || 'user').toLowerCase();
      return r !== 'super_admin' && r !== 'admin' && r !== 'director';
    });
  }, [users]);

  // Filtered users for Dashboard Search & Directory
  const dashboardFilteredUsers = useMemo(() => {
    return regularStaffUsers.filter(u => {
      if (selectedSite !== 'All' && u.site_name !== selectedSite) return false;
      if (dashboardSearchQuery.trim()) {
        const q = dashboardSearchQuery.toLowerCase().trim();
        const matchesName = u.name.toLowerCase().includes(q);
        const matchesRegId = u.registration_id?.toLowerCase().includes(q);
        const matchesDesig = u.designation?.toLowerCase().includes(q);
        const matchesPhone = u.phone?.toLowerCase().includes(q);
        const matchesSite = u.site_name?.toLowerCase().includes(q);
        if (!matchesName && !matchesRegId && !matchesDesig && !matchesPhone && !matchesSite) return false;
      }
      return true;
    });
  }, [regularStaffUsers, selectedSite, dashboardSearchQuery]);

  // Filtered attendance records for selected date
  const selectedDateRecords = useMemo(() => {
    const staffIds = new Set(regularStaffUsers.map(u => u.id));
    return attendance.filter(a => {
      if (a.date !== selectedDate) return false;
      if (!staffIds.has(a.user_id)) return false;
      if (selectedSite !== 'All' && a.user_site_name !== selectedSite) return false;
      return true;
    });
  }, [attendance, selectedDate, selectedSite, regularStaffUsers]);

  // Dashboard Stats (Strictly excludes Admin and Director accounts)
  const dashboardStats = useMemo(() => {
    const staffPool = selectedSite === 'All' 
      ? regularStaffUsers 
      : regularStaffUsers.filter(u => u.site_name === selectedSite);
    const staffUserIds = new Set(staffPool.map(u => u.id));
    const totalStaff = staffPool.length;

    const present = selectedDateRecords.filter(r => r.status === 'P' && (!r.is_late || r.is_late === 0) && staffUserIds.has(r.user_id)).length;
    const late = selectedDateRecords.filter(r => (r.status === 'L' || (r.is_late && r.is_late > 0)) && staffUserIds.has(r.user_id)).length;
    const leaves = selectedDateRecords.filter(r => (r.status === 'Leave' || r.status === 'Half Day') && staffUserIds.has(r.user_id)).length;
    const absent = Math.max(0, totalStaff - (present + late + leaves));

    return { present, late, leaves, absent, totalStaff };
  }, [selectedDateRecords, regularStaffUsers, selectedSite]);

  // Handle clicking dashboard KPI boxes to navigate directly to filtered Master Attendance
  const handleFilterDashboardCategory = (statusType: 'ALL' | 'ON_TIME' | 'LATE' | 'ABSENT') => {
    setAttendanceStatusFilter(statusType);
    setRangeStartDate(selectedDate);
    setRangeEndDate(selectedDate);
    setSelectedEmployeeId('ALL');
    setActiveTab('attendance');
  };

  // Filtered Master Attendance Records based on Date Range, Site, Employee, and Search
  const filteredMasterAttendance = useMemo(() => {
    const staffIds = new Set(regularStaffUsers.map(u => u.id));
    return attendance.filter(rec => {
      // Must be regular staff
      if (!staffIds.has(rec.user_id)) return false;

      // Date range filter
      if (rangeStartDate && rangeEndDate) {
        if (rec.date < rangeStartDate || rec.date > rangeEndDate) return false;
      } else if (rangeStartDate) {
        if (rec.date < rangeStartDate) return false;
      } else if (rangeEndDate) {
        if (rec.date > rangeEndDate) return false;
      }

      // Site filter
      if (selectedSite !== 'All' && rec.user_site_name !== selectedSite) {
        return false;
      }

      // Employee Filter
      if (selectedEmployeeId !== 'ALL' && rec.user_id !== Number(selectedEmployeeId)) {
        return false;
      }

      // Status filter
      if (attendanceStatusFilter === 'ON_TIME') {
        if (rec.status !== 'P' || (rec.is_late && rec.is_late > 0)) return false;
      } else if (attendanceStatusFilter === 'LATE') {
        if (rec.status !== 'L' && (!rec.is_late || rec.is_late === 0)) return false;
      } else if (attendanceStatusFilter === 'LEAVE') {
        if (rec.status !== 'Leave' && rec.status !== 'Half Day') return false;
      }

      // Optional text search inside master attendance
      if (attendanceSearchQuery.trim()) {
        const q = attendanceSearchQuery.toLowerCase().trim();
        const matchesName = rec.user_name?.toLowerCase().includes(q);
        const matchesDate = rec.date.includes(q);
        const matchesRegId = rec.registration_id?.toLowerCase().includes(q);
        const matchesReason = rec.late_reason?.toLowerCase().includes(q) || rec.early_checkout_reason?.toLowerCase().includes(q);
        if (!matchesName && !matchesDate && !matchesRegId && !matchesReason) return false;
      }

      return true;
    });
  }, [attendance, rangeStartDate, rangeEndDate, selectedSite, selectedEmployeeId, attendanceStatusFilter, attendanceSearchQuery, regularStaffUsers]);

  // List of absentees for the selected date
  const absentStaffList = useMemo(() => {
    if (attendanceStatusFilter !== 'ABSENT') return [];
    const staffPool = selectedSite === 'All' 
      ? regularStaffUsers 
      : regularStaffUsers.filter(u => u.site_name === selectedSite);
    const punchedUserIds = new Set(selectedDateRecords.map(r => r.user_id));
    return staffPool.filter(u => !punchedUserIds.has(u.id));
  }, [attendanceStatusFilter, regularStaffUsers, selectedSite, selectedDateRecords]);

  // Selected Employee object if single user filter is active
  const activeFilteredEmployee = useMemo(() => {
    if (selectedEmployeeId === 'ALL') return null;
    return regularStaffUsers.find(u => u.id === Number(selectedEmployeeId)) || null;
  }, [regularStaffUsers, selectedEmployeeId]);

  // Quick Date Range Preset Handlers
  const handleSetQuickRange = (type: 'this_month' | 'today' | 'last_7_days' | 'last_30_days' | 'prev_month' | 'all_time') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (type === 'this_month') {
      const firstDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDayNum = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const lastDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;
      setRangeStartDate(firstDay);
      setRangeEndDate(lastDay);
    } else if (type === 'today') {
      setRangeStartDate(todayStr);
      setRangeEndDate(todayStr);
    } else if (type === 'last_7_days') {
      const past = new Date(today);
      past.setDate(today.getDate() - 6);
      setRangeStartDate(past.toISOString().split('T')[0]);
      setRangeEndDate(todayStr);
    } else if (type === 'last_30_days') {
      const past = new Date(today);
      past.setDate(today.getDate() - 29);
      setRangeStartDate(past.toISOString().split('T')[0]);
      setRangeEndDate(todayStr);
    } else if (type === 'prev_month') {
      const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const firstDay = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDayNum = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate();
      const lastDay = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;
      setRangeStartDate(firstDay);
      setRangeEndDate(lastDay);
    } else if (type === 'all_time') {
      setRangeStartDate('');
      setRangeEndDate('');
    }
  };

  // Jump to Master Attendance for a specific employee
  const handleNavigateToUserAttendance = (user: User) => {
    setSelectedEmployeeId(String(user.id));
    setAttendanceStatusFilter('ALL');
    setActiveTab('attendance');
    setSelectedStaffUser(null);
  };

  // Request Approval Handlers
  const handleApproveRequest = async (id: number) => {
    const comment = prompt('Enter admin note for approval (Optional):', 'Approved by Admin');
    const approver = currentUser.name ? `${currentUser.name} (Admin)` : 'Admin';
    try {
      const res = await fetch(`/api/attendance/requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminComment: comment || 'Approved by Admin', actionedBy: approver })
      });
      if (res.ok) {
        alert('Request approved.');
        fetchData();
        onRefreshData();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleRejectRequest = async (id: number) => {
    const comment = prompt('Enter reason for declining request:', 'Declined by Admin');
    const rejector = currentUser.name ? `${currentUser.name} (Admin)` : 'Admin';
    try {
      const res = await fetch(`/api/attendance/requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminComment: comment || 'Declined by Admin', actionedBy: rejector })
      });
      if (res.ok) {
        alert('Request declined.');
        fetchData();
        onRefreshData();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  // PDF Export
  const handleExportPDF = () => {
    let periodLabel = 'All Time History';
    if (rangeStartDate && rangeEndDate) {
      periodLabel = `${rangeStartDate} to ${rangeEndDate}`;
    } else if (rangeStartDate) {
      periodLabel = `From ${rangeStartDate}`;
    } else if (rangeEndDate) {
      periodLabel = `Up to ${rangeEndDate}`;
    }

    const targetUser = activeFilteredEmployee || selectedStaffUser || null;
    generateMonthlyAttendancePDF(filteredMasterAttendance, targetUser, periodLabel, selectedSite);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col justify-between pb-24 px-3 sm:px-4 pt-3 max-w-5xl mx-auto font-sans transition-colors">
      
      <div>
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center border border-amber-200 dark:border-amber-800 shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Admin Master Console
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Staff, Geofencing, Shifts & Google Sheets Sync
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPasswordModal(true)}
              title="Change Admin Password"
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100 rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition-all active:scale-95"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Password</span>
            </button>
            <button
              onClick={handlePrint}
              title="Print Report"
              className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold shadow-xs hover:bg-slate-100 cursor-pointer transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1 px-3.5 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-semibold shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-1 rounded-2xl mb-4 shadow-xs overflow-x-auto scrollbar-none gap-1">
          {[
            { id: 'dashboard', label: '📊 Dashboard' },
            { id: 'attendance', label: `📋 Master Attendance ${activeFilteredEmployee ? `(${activeFilteredEmployee.name})` : ''}` },
            { id: 'requests', label: `📬 Requests (${requests.filter(r => r.status === 'PENDING').length})` },
            { id: 'staff', label: '👥 Staff & Shifts' },
            { id: 'sites', label: '📍 Sites & Geofence' },
            { id: 'sheets', label: '📑 Google Sheets' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as any); setSelectedStaffUser(null); }}
              className={`py-2 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex-1 text-center cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ===================== TAB 1: DASHBOARD ===================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            
            {/* Quick Search */}
            <div className="bg-gradient-to-br from-amber-900/10 via-orange-900/5 to-slate-900/10 dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-900 border border-amber-200/80 dark:border-amber-900/60 rounded-3xl p-3.5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950 dark:text-amber-200">
                  <Search className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Search Staff / Timesheet</span>
                </div>
                <span className="text-[10px] text-slate-400">Search by Name, ID, or Designation</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={dashboardSearchQuery}
                  onChange={(e) => setDashboardSearchQuery(e.target.value)}
                  placeholder="Search Employee by Name, ID (e.g. EMP-1001), Site, or Role..."
                  className="w-full pl-9 pr-8 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-800 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500 shadow-inner"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                {dashboardSearchQuery && (
                  <button
                    onClick={() => setDashboardSearchQuery('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Bar: Site Selection + Single Date Picker */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">Site:</span>
                <select
                  value={selectedSite}
                  onChange={(e) => setSelectedSite(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
                >
                  <option value="All">All Construction Sites</option>
                  {sites.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 font-mono"
                />
              </div>
            </div>

            {/* KPI Metric Cards (Clickable to Filter Master Attendance) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Card 1: On-Time Present */}
              <div 
                onClick={() => handleFilterDashboardCategory('ON_TIME')}
                className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/60 hover:border-emerald-400 dark:hover:border-emerald-600 rounded-2xl p-3.5 shadow-xs text-center cursor-pointer group active:scale-98 transition-all"
                title="Click to view list of On-Time Present staff in Master Attendance"
              >
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <p className="text-[10px] text-emerald-600 font-bold uppercase">On-Time Present</p>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-0.5 group-hover:text-emerald-600 transition-colors">
                  {dashboardStats.present}
                </p>
                <p className="text-[10px] text-slate-400 mt-1 flex items-center justify-center gap-0.5 group-hover:text-emerald-500">
                  <span>View List</span>
                  <ChevronRight className="w-3 h-3" />
                </p>
              </div>

              {/* Card 2: Late Arrivals */}
              <div 
                onClick={() => handleFilterDashboardCategory('LATE')}
                className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 hover:border-amber-400 dark:hover:border-amber-600 rounded-2xl p-3.5 shadow-xs text-center cursor-pointer group active:scale-98 transition-all"
                title="Click to view list of Late staff in Master Attendance"
              >
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <p className="text-[10px] text-amber-600 font-bold uppercase">Late Arrivals</p>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-0.5 group-hover:text-amber-600 transition-colors">
                  {dashboardStats.late}
                </p>
                <p className="text-[10px] text-slate-400 mt-1 flex items-center justify-center gap-0.5 group-hover:text-amber-500">
                  <span>View List</span>
                  <ChevronRight className="w-3 h-3" />
                </p>
              </div>

              {/* Card 3: Absentees */}
              <div 
                onClick={() => handleFilterDashboardCategory('ABSENT')}
                className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 hover:border-rose-400 dark:hover:border-rose-600 rounded-2xl p-3.5 shadow-xs text-center cursor-pointer group active:scale-98 transition-all"
                title="Click to view list of Absent staff in Master Attendance"
              >
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  <p className="text-[10px] text-rose-600 font-bold uppercase">Absentees</p>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-0.5 group-hover:text-rose-600 transition-colors">
                  {dashboardStats.absent}
                </p>
                <p className="text-[10px] text-slate-400 mt-1 flex items-center justify-center gap-0.5 group-hover:text-rose-500">
                  <span>View List</span>
                  <ChevronRight className="w-3 h-3" />
                </p>
              </div>

              {/* Card 4: Total Staff */}
              <div 
                onClick={() => handleFilterDashboardCategory('ALL')}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-600 rounded-2xl p-3.5 shadow-xs text-center cursor-pointer group active:scale-98 transition-all"
                title="Click to view complete employee list in Master Attendance"
              >
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Users className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 font-bold uppercase">Total Staff</p>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-0.5 group-hover:text-amber-600 transition-colors">
                  {dashboardStats.totalStaff}
                </p>
                <p className="text-[10px] text-slate-400 mt-1 flex items-center justify-center gap-0.5 group-hover:text-amber-500">
                  <span>All Records</span>
                  <ChevronRight className="w-3 h-3" />
                </p>
              </div>
            </div>

            {/* Staff Directory & Live Punch List */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Staff Directory & Live Status ({selectedDate})
                  </h3>
                  <p className="text-[11px] text-slate-400">Click any employee to open their timesheet & history</p>
                </div>
                <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-xl">
                  {dashboardFilteredUsers.length} Staff Members
                </span>
              </div>

              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {dashboardFilteredUsers.map(user => {
                  const todayRec = attendance.find(a => a.user_id === user.id && a.date === selectedDate);
                  const isPresent = todayRec?.status === 'P' && (!todayRec.is_late || todayRec.is_late === 0);
                  const isLate = todayRec?.status === 'L' || (todayRec?.is_late && todayRec.is_late > 0);

                  return (
                    <div
                      key={user.id}
                      onClick={() => handleNavigateToUserAttendance(user)}
                      className="p-3 bg-slate-50/80 dark:bg-slate-800/60 hover:bg-amber-50/70 dark:hover:bg-amber-950/40 hover:border-amber-300 dark:hover:border-amber-700 border border-slate-200/80 dark:border-slate-700 rounded-2xl flex items-center justify-between cursor-pointer transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-600 text-white font-bold text-xs flex items-center justify-center overflow-hidden shadow-xs shrink-0">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                          ) : (
                            user.name.charAt(0).toUpperCase()
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                              {user.name}
                            </span>
                            <span className="text-[10px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400 font-semibold">
                              {user.registration_id || 'EMP-ID'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {user.designation || 'Staff'} • {user.site_name || 'Site'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {todayRec ? (
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            isPresent ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300' :
                            isLate ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300' :
                            'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300'
                          }`}>
                            {todayRec.check_in?.slice(0, 5)} ({isPresent ? 'Present' : isLate ? 'Late' : todayRec.status})
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 rounded-full text-[10px] font-bold">
                            Absent
                          </span>
                        )}
                        <span className="p-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-amber-600 opacity-80 group-hover:opacity-100 transition-all">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* ===================== TAB 2: MASTER ATTENDANCE ===================== */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            
            {/* Active Single-User Filter Banner */}
            {activeFilteredEmployee && (
              <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-2xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-600 text-white font-bold text-xs flex items-center justify-center">
                    {activeFilteredEmployee.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-amber-950 dark:text-amber-100">
                        {activeFilteredEmployee.name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 bg-white dark:bg-slate-900 text-amber-600 rounded border border-amber-200">
                        {activeFilteredEmployee.registration_id}
                      </span>
                    </div>
                    <p className="text-[10px] text-amber-700/80 dark:text-amber-300">
                      Filtered Individual History • {activeFilteredEmployee.designation} • Shift: {activeFilteredEmployee.work_start_time || '10:00 AM'} - {activeFilteredEmployee.work_end_time || '07:00 PM'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedStaffUser(activeFilteredEmployee)}
                    className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 rounded-xl text-xs font-semibold hover:bg-amber-100"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => {
                      setSelectedEmployeeId('ALL');
                      setAttendanceStatusFilter('ALL');
                    }}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Show All Staff</span>
                  </button>
                </div>
              </div>
            )}

            {/* Filter Control Box */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 shadow-xs space-y-3.5">
              
              {/* Site & Employee Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Construction Site Filter:
                  </label>
                  <select
                    value={selectedSite}
                    onChange={(e) => setSelectedSite(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="All">All Construction Sites</option>
                    {sites.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Select Specific Employee / User:
                  </label>
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="ALL">All Staff & Employees ({regularStaffUsers.length})</option>
                    {regularStaffUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.registration_id ? `[${u.registration_id}] ` : ''}{u.name} - {u.designation || 'Staff'} ({u.site_name || 'HQ'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">Filter Status:</span>
                {[
                  { id: 'ALL', label: 'All Records' },
                  { id: 'ON_TIME', label: '🟢 On-Time Present' },
                  { id: 'LATE', label: '🟡 Late Arrivals' },
                  { id: 'ABSENT', label: '🔴 Absentees' },
                  { id: 'LEAVE', label: '🔵 Leave / Half Day' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setAttendanceStatusFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      attendanceStatusFilter === tab.id
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Full Date Range Calendar Pickers */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <CalendarRange className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Date Range Filter (Calendar From & To)</span>
                  </span>
                  
                  {(rangeStartDate || rangeEndDate) && (
                    <button
                      onClick={() => handleSetQuickRange('all_time')}
                      className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold hover:underline flex items-center gap-0.5"
                    >
                      <X className="w-3 h-3" />
                      <span>Reset Date Range</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">Start Date (From)</span>
                    <input
                      type="date"
                      value={rangeStartDate}
                      onChange={(e) => {
                        setRangeStartDate(e.target.value);
                        if (rangeEndDate && rangeEndDate < e.target.value) setRangeEndDate(e.target.value);
                      }}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white font-mono"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">End Date (To)</span>
                    <input
                      type="date"
                      value={rangeEndDate}
                      min={rangeStartDate}
                      onChange={(e) => setRangeEndDate(e.target.value)}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white font-mono"
                    />
                  </div>
                </div>

                {/* Quick Date Range Buttons */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    { id: 'this_month', label: '📅 This Month' },
                    { id: 'today', label: '📍 Today' },
                    { id: 'last_7_days', label: '⏱️ Last 7 Days' },
                    { id: 'last_30_days', label: '📊 Last 30 Days' },
                    { id: 'prev_month', label: '⏪ Previous Month' },
                    { id: 'all_time', label: '♾️ All Time' }
                  ].map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => handleSetQuickRange(preset.id as any)}
                      className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:border-amber-300 transition-all cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="text-xs text-slate-500">
                  Total Matching Records: <strong className="text-amber-600 dark:text-amber-400 font-bold">
                    {attendanceStatusFilter === 'ABSENT' ? absentStaffList.length : filteredMasterAttendance.length}
                  </strong>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowManualPunchModal(true)}
                    className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 rounded-xl text-xs font-semibold flex items-center gap-1 shadow-xs hover:bg-amber-100 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Manual Punch</span>
                  </button>
                  <button
                    onClick={handlePrint}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs hover:bg-slate-100 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Table</span>
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{activeFilteredEmployee ? `Export ${activeFilteredEmployee.name}'s PDF` : 'Export Filtered Master PDF'}</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Attendance Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 shadow-xs">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {attendanceStatusFilter === 'ABSENT' ? `Absentees List (${selectedDate})` : (activeFilteredEmployee ? `${activeFilteredEmployee.name}'s Attendance Records` : 'Master Attendance Records')} 
                  <span className="text-slate-400 font-normal ml-1">
                    ({rangeStartDate && rangeEndDate ? `${rangeStartDate} to ${rangeEndDate}` : 'All Dates'})
                  </span>
                </h3>
              </div>
              
              {attendanceStatusFilter === 'ABSENT' ? (
                absentStaffList.length === 0 ? (
                  <div className="py-12 text-center text-emerald-600 text-xs bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                    No absentees! 100% staff attendance recorded for {selectedDate}.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[550px] overflow-y-auto">
                    {absentStaffList.map(emp => (
                      <div
                        key={emp.id}
                        className="p-3 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-2xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-rose-600 text-white font-bold flex items-center justify-center">
                            {emp.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">{emp.name}</span>
                            <p className="text-[11px] text-slate-500">
                              {emp.registration_id} • {emp.designation || 'Staff'} • {emp.site_name || 'Headquarters'}
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-rose-600 text-white font-bold rounded-full text-[10px]">
                          Absent (No Punch)
                        </span>
                      </div>
                    ))}
                  </div>
                )
              ) : filteredMasterAttendance.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                  No attendance records found for the selected filters.
                </div>
              ) : (
                <div className="space-y-2 max-h-[550px] overflow-y-auto">
                  {filteredMasterAttendance.map(rec => {
                    const isLateRec = rec.status === 'L' || (rec.is_late && rec.is_late > 0);
                    return (
                      <div
                        key={rec.id}
                        className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span 
                                onClick={() => {
                                  const foundUser = regularStaffUsers.find(u => u.id === rec.user_id);
                                  if (foundUser) setSelectedStaffUser(foundUser);
                                }}
                                className="font-bold text-slate-900 dark:text-white hover:text-amber-600 cursor-pointer"
                              >
                                {rec.user_name || `User #${rec.user_id}`}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">{rec.date}</span>
                              {rec.registration_id && (
                                <span className="text-[10px] font-mono px-1 py-0.2 bg-white dark:bg-slate-900 rounded text-slate-500 border border-slate-200">
                                  {rec.registration_id}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              In: <strong className="text-slate-700 dark:text-slate-300 font-mono">{rec.check_in || '--'}</strong> | Out: <strong className="text-slate-700 dark:text-slate-300 font-mono">{rec.check_out || '--'}</strong> | Site: {rec.user_site_name || 'HQ'}
                            </p>
                          </div>

                          <div>
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                              rec.status === 'P' && !isLateRec ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              isLateRec ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {rec.status === 'P' && !isLateRec ? 'Present (On-Time)' : isLateRec ? 'Late' : rec.status}
                            </span>
                          </div>
                        </div>

                        {rec.late_reason && (
                          <p className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 p-1.5 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                            <strong>Late Reason:</strong> {rec.late_reason}
                          </p>
                        )}
                        {rec.early_checkout_reason && (
                          <p className="text-[10px] bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                            <strong>Early Exit:</strong> {rec.early_checkout_reason}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ===================== TAB 3: REQUESTS & APPROVALS ===================== */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            
            {/* Filter Tabs */}
            <div className="flex bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-1 rounded-2xl shadow-xs gap-1">
              {[
                { id: 'PENDING', label: `⏳ Pending (${requests.filter(r => r.status === 'PENDING').length})` },
                { id: 'APPROVED', label: `✅ Approved (${requests.filter(r => r.status === 'APPROVED').length})` },
                { id: 'REJECTED', label: `❌ Declined (${requests.filter(r => r.status === 'REJECTED').length})` },
                { id: 'ALL', label: `📋 All Requests (${requests.length})` }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setRequestFilter(f.id as any)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all text-center cursor-pointer ${
                    requestFilter === f.id
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Requests Cards List */}
            <div className="space-y-3">
              {requests.filter(r => requestFilter === 'ALL' || r.status === requestFilter).length === 0 ? (
                <div className="py-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center text-slate-400 text-xs">
                  No {requestFilter.toLowerCase()} requests found.
                </div>
              ) : (
                requests.filter(r => requestFilter === 'ALL' || r.status === requestFilter).map(req => {
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
                      className="p-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-xs space-y-3 text-xs"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-amber-600/10 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center border border-amber-200 dark:border-amber-900/60">
                            {req.user_name ? req.user_name.charAt(0) : 'U'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white text-sm">
                                {req.user_name || `User #${req.user_id}`}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-md">
                                {req.registration_id || 'Staff'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400">
                              {req.designation || 'Staff'} • {req.user_site_name || req.site_name || 'Headquarters'}
                            </p>
                          </div>
                        </div>

                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          isPending ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' :
                          isApproved ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' :
                          'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                        }`}>
                          {req.status}
                        </span>
                      </div>

                      {/* Request Details Box */}
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 pb-1 border-b border-slate-200/60 dark:border-slate-700/60">
                          <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>Request Received on: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{formatRequestDateTime(req.created_at)}</strong></span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                          <p className="text-slate-700 dark:text-slate-300">
                            Type: <strong className="text-amber-600 dark:text-amber-400 font-semibold uppercase">{displayType}</strong>
                          </p>
                          <p className="text-slate-700 dark:text-slate-300">
                            Target Date: <strong className="text-slate-900 dark:text-white font-semibold">{dateDisplay}</strong>
                          </p>
                        </div>

                        {req.half_day_slot && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400">
                            Half Day Slot: <strong>{req.half_day_slot === 'FIRST_HALF' ? 'First Half (Morning to 2:30 PM)' : 'Second Half (2:30 PM to Evening)'}</strong>
                          </p>
                        )}

                        {(req.check_in || req.requested_check_in) && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                            Requested Timings: <strong>{req.check_in || req.requested_check_in} → {req.check_out || req.requested_check_out || '19:00'}</strong>
                          </p>
                        )}

                        {req.reason && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 italic bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                            "{req.reason}"
                          </p>
                        )}

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

                      {isPending && (
                        <div className="flex gap-2 pt-1">
                          <button 
                            onClick={() => handleApproveRequest(req.id)} 
                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs shadow-xs active:scale-95 transition-all cursor-pointer"
                          >
                            Approve Request
                          </button>
                          <button 
                            onClick={() => handleRejectRequest(req.id)} 
                            className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold text-xs shadow-xs active:scale-95 transition-all cursor-pointer"
                          >
                            Decline Request
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 4: STAFF & SHIFTS ===================== */}
        {activeTab === 'staff' && (
          <AdminStaffTab
            users={users}
            sites={sites}
            onRefresh={() => {
              fetchData();
              onRefreshData();
            }}
          />
        )}

        {/* ===================== TAB 5: SITES & GEOFENCE ===================== */}
        {activeTab === 'sites' && (
          <AdminSitesTab
            sites={sites}
            onRefresh={() => {
              fetchData();
              onRefreshData();
            }}
          />
        )}

        {/* ===================== TAB 6: GOOGLE SHEETS ===================== */}
        {activeTab === 'sheets' && (
          <AdminSheetsTab
            currentUser={currentUser}
            onRefresh={() => {
              fetchData();
              onRefreshData();
            }}
          />
        )}

      </div>

      {/* Drill-down Modal for Employee Details */}
      {selectedStaffUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 max-w-md w-full max-h-[88vh] flex flex-col shadow-2xl">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
                  {selectedStaffUser.avatar_url ? (
                    <img src={selectedStaffUser.avatar_url} alt={selectedStaffUser.name} className="w-full h-full object-cover rounded-2xl" />
                  ) : (
                    selectedStaffUser.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{selectedStaffUser.name}</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold rounded-md border border-amber-200 dark:border-amber-800">
                      {selectedStaffUser.registration_id || 'ID-N/A'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {selectedStaffUser.designation} • {selectedStaffUser.site_name || 'Headquarters'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Shift Timing: {selectedStaffUser.work_start_time || '10:00 AM'} - {selectedStaffUser.work_end_time || '07:00 PM'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStaffUser(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 overflow-y-auto space-y-3 flex-1 my-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-center border border-emerald-200 dark:border-emerald-900/60">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase block">Present</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-white">
                    {attendance.filter(a => a.user_id === selectedStaffUser.id && a.status === 'P' && (!a.is_late || a.is_late === 0)).length}
                  </span>
                </div>
                <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-center border border-amber-200 dark:border-amber-900/60">
                  <span className="text-[10px] font-bold text-amber-600 uppercase block">Late</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-white">
                    {attendance.filter(a => a.user_id === selectedStaffUser.id && (a.status === 'L' || (a.is_late && a.is_late > 0))).length}
                  </span>
                </div>
                <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-center border border-blue-200 dark:border-blue-900/60">
                  <span className="text-[10px] font-bold text-blue-600 uppercase block">Leaves</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-white">
                    {attendance.filter(a => a.user_id === selectedStaffUser.id && (a.status === 'Leave' || a.status === 'Half Day')).length}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Recent Logs ({selectedStaffUser.name})
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {attendance.filter(a => a.user_id === selectedStaffUser.id).slice(0, 10).map(r => (
                    <div key={r.id} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-white font-mono">{r.date}</span>
                        <p className="text-[10px] text-slate-400">
                          In: {r.check_in?.slice(0, 5) || '--'} | Out: {r.check_out?.slice(0, 5) || '--'}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        r.status === 'P' ? 'bg-emerald-100 text-emerald-800' :
                        r.status === 'L' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {r.status === 'P' ? 'Present' : r.status === 'L' ? 'Late' : r.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
              <button
                onClick={() => handleNavigateToUserAttendance(selectedStaffUser)}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <CalendarRange className="w-4 h-4" />
                <span>Open Full Master Attendance for {selectedStaffUser.name}</span>
              </button>

              <button
                onClick={handleExportPDF}
                className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Individual Timesheet PDF</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Manual Attendance Modal */}
      {showManualPunchModal && (
        <AdminManualPunchModal
          users={users}
          onClose={() => setShowManualPunchModal(false)}
          onSuccess={() => {
            fetchData();
            onRefreshData();
          }}
        />
      )}

      {/* Printable Element for Browser Print Command */}
      <div id="printable-attendance-report" className="hidden">
        <div className="p-6">
          <div className="border-b-2 border-slate-900 pb-4 mb-4">
            <h1 className="text-2xl font-bold text-slate-900">RUDRA INFRA WORLD</h1>
            <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Attendance & Shift Timing Master Report</h2>
            <p className="text-xs text-slate-500 mt-1">
              Generated on: {new Date().toLocaleDateString()} | Site: {selectedSite} | Period: {rangeStartDate || 'Start'} to {rangeEndDate || 'End'}
            </p>
          </div>

          {activeFilteredEmployee && (
            <div className="border border-slate-300 rounded-lg p-3 mb-4 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div><strong>Employee:</strong> {activeFilteredEmployee.name}</div>
                <div><strong>Emp ID:</strong> {activeFilteredEmployee.registration_id}</div>
                <div><strong>Designation:</strong> {activeFilteredEmployee.designation}</div>
                <div><strong>Site:</strong> {activeFilteredEmployee.site_name || 'Headquarters'}</div>
                <div><strong>Shift:</strong> {activeFilteredEmployee.work_start_time || '10:00 AM'} - {activeFilteredEmployee.work_end_time || '07:00 PM'}</div>
                <div><strong>Phone:</strong> {activeFilteredEmployee.phone || 'N/A'}</div>
              </div>
            </div>
          )}

          <table className="w-full border-collapse border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-900">
                <th className="border border-slate-300 p-2 text-left">#</th>
                <th className="border border-slate-300 p-2 text-left">Date</th>
                <th className="border border-slate-300 p-2 text-left">Employee</th>
                <th className="border border-slate-300 p-2 text-left">Emp ID</th>
                <th className="border border-slate-300 p-2 text-center">In</th>
                <th className="border border-slate-300 p-2 text-center">Out</th>
                <th className="border border-slate-300 p-2 text-center">Status</th>
                <th className="border border-slate-300 p-2 text-left">Site</th>
                <th className="border border-slate-300 p-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredMasterAttendance.map((r, idx) => (
                <tr key={r.id} className="border-b border-slate-200">
                  <td className="border border-slate-300 p-2 text-center">{idx + 1}</td>
                  <td className="border border-slate-300 p-2">{r.date}</td>
                  <td className="border border-slate-300 p-2 font-semibold">{r.user_name || 'Staff'}</td>
                  <td className="border border-slate-300 p-2 font-mono">{r.registration_id || '--'}</td>
                  <td className="border border-slate-300 p-2 text-center font-mono">{r.check_in?.slice(0, 5) || '--'}</td>
                  <td className="border border-slate-300 p-2 text-center font-mono">{r.check_out?.slice(0, 5) || '--'}</td>
                  <td className="border border-slate-300 p-2 text-center font-semibold">{r.status}</td>
                  <td className="border border-slate-300 p-2">{r.user_site_name || 'HQ'}</td>
                  <td className="border border-slate-300 p-2">{r.early_checkout_reason || r.late_reason || '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-8 pt-4 border-t border-slate-300 flex justify-between text-xs text-slate-500">
            <span>Rudra Infra World Confidential System Record</span>
            <span>Authorized Signatory: __________________________</span>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <ChangePasswordModal
          currentUser={currentUser}
          onClose={() => setShowPasswordModal(false)}
          onPasswordChanged={() => {
            onRefreshData();
          }}
          lang={lang}
        />
      )}

      {/* Footer Branding */}
      <div className="text-center pt-5 pb-1">
        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">
          Designed & Developed by <span className="text-slate-700 dark:text-slate-300 font-semibold">Abhishek Bhatt</span>
        </p>
      </div>

    </div>
  );
};
