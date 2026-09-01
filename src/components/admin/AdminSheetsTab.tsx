import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, RefreshCw, CheckCircle2, AlertCircle, 
  ExternalLink, Key, Database, ArrowRight, ShieldCheck, Check,
  Lock, Unlock, Copy, Play, ArrowDownToLine, ArrowUpFromLine,
  Layers, Globe, CheckCircle, Code2, BookOpen, Sparkles, Terminal,
  HelpCircle, ChevronRight
} from 'lucide-react';
import { User } from '../../types';

interface AdminSheetsTabProps {
  onRefresh?: () => void;
  currentUser?: User;
}

export const CODE_GS_SCRIPT = `/**
 * ==============================================================================
 * STAFFSYNC / RUDRA REALTY - GOOGLE APPS SCRIPT LIVE CLOUD DATABASE CONNECTOR
 * ==============================================================================
 * 
 * QUICK 5-STEP SETUP GUIDE:
 * ------------------------------------------------------------------------------
 * 1. Open your Google Spreadsheet (create a new blank spreadsheet if needed).
 * 2. In Google Sheets menu, click "Extensions" > "Apps Script".
 * 3. Delete any code in the editor, paste this entire file, and click "Save" (Ctrl+S).
 * 4. INITIALIZE ALL SHEETS (One-Click):
 *    - In toolbar dropdown at top, select "setupSheets" (NOT doGet or doPost).
 *    - Click "Run" (▶) and grant permissions on first run.
 *    - All 9 database sheets with colored headers are instantly created!
 * 5. DEPLOY AS WEB APP:
 *    - Click "Deploy" (top right) > "New deployment".
 *    - Select type: "Web app"
 *    - Set "Execute as: Me" and "Who has access: Anyone"  <-- CRITICAL!
 *    - Click "Deploy" and COPY the "Web app URL" (ending in /exec).
 *    - Paste it in the App Deployment URL bar, test it, and Lock it!
 * ==============================================================================
 */

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Users Sheet
  setupTab(ss, "Users", [
    "User ID", "Employee Code", "Username", "Full Name", "Designation", 
    "Role", "Phone", "Email", "Branch / Site", "Work Start", "Work End", 
    "Monthly Salary (₹)", "Allowed Devices", "Joining Date", "Password", "Created At"
  ], "#1E293B");

  // 2. Attendance Sheet
  setupTab(ss, "Attendance", [
    "Record ID", "Date", "Employee Code", "Name", "Designation", 
    "Branch / Site", "Check In", "Check Out", "Status", "Late (Min)", 
    "Overtime (Hrs)", "Method", "Device ID", "Latitude", "Longitude", 
    "IP Address", "Photo URL", "Early Checkout Reason", "Late Reason", "Created At"
  ], "#0F766E");

  // 3. Sites Sheet
  setupTab(ss, "Sites", [
    "Site ID", "Site Name", "Address", "Latitude", "Longitude", 
    "Radius (Meters)", "Shift Start", "Shift End", "Created At"
  ], "#1E3A8A");

  // 4. Designations Sheet
  setupTab(ss, "Designations", [
    "Designation ID", "Designation Name", "Created At"
  ], "#312E81");

  // 5. Departments Sheet
  setupTab(ss, "Departments", [
    "Department ID", "Department Name", "Description"
  ], "#4C1D95");

  // 6. Attendance Requests & Approvals
  setupTab(ss, "AttendanceRequests", [
    "Request ID", "Employee Code", "Employee Name", "Date", "Request Type", 
    "Check In", "Check Out", "Status", "Site Name", "Employee Reason", 
    "Admin Comment", "Actioned At", "Created At"
  ], "#701A75");

  // 7. Salary Advances & Loans
  setupTab(ss, "SalaryAdvances", [
    "Advance ID", "Date", "Employee Code", "Employee Name", "Type", 
    "Amount (₹)", "Notes / Reason", "Created At"
  ], "#831843");

  // 8. Holidays Sheet
  setupTab(ss, "Holidays", [
    "Holiday ID", "Holiday Date", "Holiday Name", "Created At"
  ], "#881337");

  // 9. Geofencing Settings Sheet
  setupTab(ss, "Geofencing", [
    "ID", "Geofence Enabled (1/0)", "Default Latitude", "Default Longitude", "Default Radius (Meters)"
  ], "#134E4A");

  Logger.log("✅ Successfully initialized and formatted all 9 database sheets!");
}

function setupTab(ss, name, headers, headerColor) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground(headerColor || "#1E293B");
  headerRange.setFontColor("#FFFFFF");
  headerRange.setFontWeight("bold");
  headerRange.setFontSize(10);
  headerRange.setVerticalAlignment("middle");
  sheet.setRowHeight(1, 32);
  sheet.setFrozenRows(1);
  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
    const w = sheet.getColumnWidth(i);
    if (w < 110) sheet.setColumnWidth(i, 120);
    if (w > 260) sheet.setColumnWidth(i, 260);
  }
  return sheet;
}

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "ping";

    if (action === "ping") {
      const sheetsList = ss.getSheets().map(s => ({
        name: s.getName(),
        rows: s.getLastRow() > 1 ? s.getLastRow() - 1 : 0
      }));
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        status: "active",
        spreadsheet_name: ss.getName(),
        spreadsheet_id: ss.getId(),
        sheets_count: sheetsList.length,
        sheets: sheetsList,
        server_timestamp: new Date().toISOString(),
        message: "Google Apps Script Live Sync Web App is fully operational."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "getAllData") {
      const data = {
        users: getSheetData("Users", [
          "id", "registration_id", "username", "name", "designation", 
          "role", "phone", "email", "site_name", "work_start_time", "work_end_time", 
          "monthly_salary", "allowed_devices", "date_of_joining", "password", "created_at"
        ]),
        attendance: getSheetData("Attendance", [
          "id", "date", "registration_id", "name", "designation", 
          "site_name", "check_in", "check_out", "status", "late_minutes", 
          "overtime_hours", "method", "device_id", "latitude", "longitude", 
          "ip_address", "photo_url", "early_checkout_reason", "late_reason", "created_at"
        ]),
        sites: getSheetData("Sites", [
          "id", "name", "address", "latitude", "longitude", 
          "radius", "work_start_time", "work_end_time", "created_at"
        ]),
        designations: getSheetData("Designations", ["id", "name", "created_at"]),
        departments: getSheetData("Departments", ["id", "name", "description"]),
        approvals: getSheetData("AttendanceRequests", [
          "id", "registration_id", "user_name", "date", "type", 
          "check_in", "check_out", "status", "site_name", "reason", 
          "admin_comment", "actioned_at", "created_at"
        ]),
        salary_advances: getSheetData("SalaryAdvances", [
          "id", "date", "registration_id", "user_name", "type", 
          "amount", "notes", "created_at"
        ]),
        holidays: getSheetData("Holidays", ["id", "date", "name", "created_at"]),
        geofencing: getSheetData("Geofencing", ["id", "enabled", "latitude", "longitude", "radius"])
      };
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: data })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Apps Script connector active." })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No JSON payload received in POST request.");
    }
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    // Fast Single-User Password Update
    if (action === "updateUserPassword") {
      const targetUserId = String(payload.userId || payload.id || payload.registration_id || "");
      const newPassword = String(payload.newPassword || payload.password || "");
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName("Users");
      
      if (sheet && targetUserId && newPassword) {
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          const idData = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
          for (let i = 0; i < idData.length; i++) {
            const rowId = String(idData[i][0]);
            const rowEmp = String(idData[i][1]);
            if (rowId === targetUserId || rowEmp === targetUserId) {
              sheet.getRange(i + 2, 15).setValue(newPassword);
              return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Password updated in Google Sheet." })).setMimeType(ContentService.MimeType.JSON);
            }
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: "User not found for password update." })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "exportAllData") {
      const data = payload.data || {};
      if (Array.isArray(data.users)) {
        replaceSheetData("Users", [
          "User ID", "Employee Code", "Username", "Full Name", "Designation", 
          "Role", "Phone", "Email", "Branch / Site", "Work Start", "Work End", 
          "Monthly Salary (₹)", "Allowed Devices", "Joining Date", "Password", "Created At"
        ], data.users.map(u => [
          u.id || "", u.registration_id || "", u.username || "", u.name || "", u.designation || "Staff",
          u.role || "user", u.phone || "", u.email || "", u.site_name || "Headquarters", u.work_start_time || "10:00", u.work_end_time || "19:00",
          u.monthly_salary || 0, u.allowed_devices || 1, u.date_of_joining || "", u.password || "", u.created_at || ""
        ]), "#1E293B");
      }
      if (Array.isArray(data.attendance)) {
        replaceSheetData("Attendance", [
          "Record ID", "Date", "Employee Code", "Name", "Designation", 
          "Branch / Site", "Check In", "Check Out", "Status", "Late (Min)", 
          "Overtime (Hrs)", "Method", "Device ID", "Latitude", "Longitude", 
          "IP Address", "Photo URL", "Early Checkout Reason", "Late Reason", "Created At"
        ], data.attendance.map(a => [
          a.id || "", a.date || "", a.registration_id || "", a.name || "", a.designation || "",
          a.site_name || "", a.check_in || "", a.check_out || "", a.status || "", a.late_minutes || 0,
          a.overtime_hours || 0, a.method || "App", a.device_id || "", a.latitude || "", a.longitude || "",
          a.ip_address || "", a.photo_url || "", a.early_checkout_reason || "", a.late_reason || "", a.created_at || ""
        ]), "#0F766E");
      }
      if (Array.isArray(data.sites)) {
        replaceSheetData("Sites", [
          "Site ID", "Site Name", "Address", "Latitude", "Longitude", 
          "Radius (Meters)", "Shift Start", "Shift End", "Created At"
        ], data.sites.map(s => [
          s.id || "", s.name || "", s.address || "", s.latitude || "", s.longitude || "",
          s.radius || 150, s.work_start_time || "10:00", s.work_end_time || "19:00", s.created_at || ""
        ]), "#1E3A8A");
      }
      if (Array.isArray(data.designations)) {
        replaceSheetData("Designations", [
          "Designation ID", "Designation Name", "Created At"
        ], data.designations.map(d => [
          d.id || "", d.name || "", d.created_at || ""
        ]), "#312E81");
      }
      if (Array.isArray(data.departments)) {
        replaceSheetData("Departments", [
          "Department ID", "Department Name", "Description"
        ], data.departments.map(d => [
          d.id || "", d.name || "", d.description || ""
        ]), "#4C1D95");
      }
      if (Array.isArray(data.approvals || data.attendance_requests)) {
        const reqs = data.approvals || data.attendance_requests;
        replaceSheetData("AttendanceRequests", [
          "Request ID", "Employee Code", "Employee Name", "Date", "Request Type", 
          "Check In", "Check Out", "Status", "Site Name", "Employee Reason", 
          "Admin Comment", "Actioned At", "Created At"
        ], reqs.map(r => [
          r.id || "", r.registration_id || "", r.user_name || r.name || "", r.date || "", r.type || "PUNCH_CORRECTION",
          r.check_in || "", r.check_out || "", r.status || "PENDING", r.site_name || "", r.reason || "",
          r.admin_comment || "", r.actioned_at || "", r.created_at || ""
        ]), "#701A75");
      }
      if (Array.isArray(data.salary_advances)) {
        replaceSheetData("SalaryAdvances", [
          "Advance ID", "Date", "Employee Code", "Employee Name", "Type", 
          "Amount (₹)", "Notes / Reason", "Created At"
        ], data.salary_advances.map(sa => [
          sa.id || "", sa.date || "", sa.registration_id || "", sa.user_name || sa.name || "", sa.type || "Advance",
          sa.amount || 0, sa.notes || "", sa.created_at || ""
        ]), "#831843");
      }
      if (Array.isArray(data.holidays)) {
        replaceSheetData("Holidays", [
          "Holiday ID", "Holiday Date", "Holiday Name", "Created At"
        ], data.holidays.map(h => [
          h.id || "", h.date || "", h.name || "", h.created_at || ""
        ]), "#881337");
      }
      if (Array.isArray(data.geofencing)) {
        replaceSheetData("Geofencing", [
          "ID", "Geofence Enabled (1/0)", "Default Latitude", "Default Longitude", "Default Radius (Meters)"
        ], data.geofencing.map(g => [
          g.id || 1, g.enabled || 0, g.latitude || "", g.longitude || "", g.radius || 150
        ]), "#134E4A");
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Synchronized all data tables to Google Sheets." })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "appendAttendance") {
      const r = payload.record || {};
      const sheet = setupTab(SpreadsheetApp.getActiveSpreadsheet(), "Attendance", [
        "Record ID", "Date", "Employee Code", "Name", "Designation", 
        "Branch / Site", "Check In", "Check Out", "Status", "Late (Min)", 
        "Overtime (Hrs)", "Method", "Device ID", "Latitude", "Longitude", 
        "IP Address", "Photo URL", "Early Checkout Reason", "Late Reason", "Created At"
      ], "#0F766E");

      const regId = String(r.registration_id || "");
      const punchDate = String(r.date || "");
      let rowToUpdate = -1;
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const dataRange = sheet.getRange(2, 2, lastRow - 1, 2).getValues();
        for (let i = dataRange.length - 1; i >= 0; i--) {
          if (String(dataRange[i][0]) === punchDate && String(dataRange[i][1]) === regId) {
            rowToUpdate = i + 2;
            break;
          }
        }
      }
      const rowValues = [
        r.id || "", r.date || "", r.registration_id || "", r.name || "", r.designation || "",
        r.site_name || "", r.check_in || "", r.check_out || "", r.status || "", r.late_minutes || 0,
        r.overtime_hours || 0, r.method || "App", r.device_id || "", r.latitude || "", r.longitude || "",
        r.ip_address || "", r.photo_url || "", r.early_checkout_reason || "", r.late_reason || "", r.created_at || new Date().toISOString()
      ];
      if (rowToUpdate > 1) {
        sheet.getRange(rowToUpdate, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Logged punch." })).setMimeType(ContentService.MimeType.JSON);
    }

    throw new Error("Unsupported action: " + action);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheetData(sheetName, customFields) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return [];
  const headerValues = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const dataValues = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const rows = [];
  for (let i = 0; i < dataValues.length; i++) {
    const row = dataValues[i];
    const item = {};
    for (let c = 0; c < lastCol; c++) {
      const headerKey = customFields && customFields[c] ? customFields[c] : String(headerValues[c]).toLowerCase().replace(/[^a-z0-9_]/g, '_');
      item[headerKey] = row[c];
    }
    if (Object.values(item).some(v => v !== "" && v !== null && v !== undefined)) {
      rows.push(item);
    }
  }
  return rows;
}

function replaceSheetData(sheetName, headers, rows, headerColor) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  sheet.clear();
  sheet.appendRow(headers);
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground(headerColor || "#1E293B");
  headerRange.setFontColor("#FFFFFF");
  headerRange.setFontWeight("bold");
  headerRange.setFontSize(10);
  headerRange.setVerticalAlignment("middle");
  sheet.setRowHeight(1, 30);
  sheet.setFrozenRows(1);
  if (rows && rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
    const w = sheet.getColumnWidth(i);
    if (w < 110) sheet.setColumnWidth(i, 120);
    if (w > 260) sheet.setColumnWidth(i, 260);
  }
}`;

export const AdminSheetsTab: React.FC<AdminSheetsTabProps> = ({ onRefresh, currentUser }) => {
  const [loading, setLoading] = useState(true);
  
  // Initialize state directly from LocalStorage (Instant Load on refresh)
  const [webAppUrl, setWebAppUrl] = useState<string>(() => {
    return localStorage.getItem('staffsync_sheet_url') || '';
  });
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    const localLocked = localStorage.getItem('staffsync_sheet_locked');
    return localLocked !== null ? localLocked === 'true' : true;
  });
  const [syncEnabled, setSyncEnabled] = useState<boolean>(true);
  const [spreadsheetId, setSpreadsheetId] = useState<string>(() => {
    return localStorage.getItem('staffsync_sheet_id') || '';
  });
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    return localStorage.getItem('staffsync_last_sync') || null;
  });

  // Status & Progress states
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs?: number; message: string; sheetName?: string; sheetsCount?: number } | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [pullingAll, setPullingAll] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [syncErrorMsg, setSyncErrorMsg] = useState<string | null>(null);

  // UI state
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'control' | 'code' | 'guide' | 'schema'>('control');

  const isSuperAdmin = currentUser ? (currentUser.role === 'super_admin' || currentUser.role === 'director') : true;

  // Load Settings on Mount & Sync LocalStorage with Backend
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/sheet-settings');
      if (res.ok) {
        const data = await res.json();
        const activeUrl = data.web_app_url || localStorage.getItem('staffsync_sheet_url') || '';
        const activeLocked = data.is_locked !== undefined ? (data.is_locked === 1 || data.is_locked === true) : true;
        const activeSpreadsheetId = data.spreadsheet_id || localStorage.getItem('staffsync_sheet_id') || '';

        setWebAppUrl(activeUrl);
        setIsLocked(activeLocked);
        setSyncEnabled(data.sync_enabled === 1 || data.sync_enabled === true);
        setSpreadsheetId(activeSpreadsheetId);

        if (activeUrl) {
          localStorage.setItem('staffsync_sheet_url', activeUrl);
          localStorage.setItem('staffsync_sheet_locked', String(activeLocked));
        }
        if (activeSpreadsheetId) {
          localStorage.setItem('staffsync_sheet_id', activeSpreadsheetId);
        }
        if (data.last_sync_timestamp) {
          const formatted = new Date(data.last_sync_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setLastSyncTime(formatted);
          localStorage.setItem('staffsync_last_sync', formatted);
        }
      }
    } catch (e: any) {
      console.error("Failed to load sheet settings:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Save Settings with Double-Layer Lock (LocalStorage + SQLite)
  const handleSaveSettings = async (overrideLocked?: boolean, customUrl?: string) => {
    setIsSaving(true);
    setSyncSuccessMsg(null);
    setSyncErrorMsg(null);
    
    const finalUrl = (customUrl !== undefined ? customUrl : webAppUrl).trim();
    const finalLocked = overrideLocked !== undefined ? overrideLocked : isLocked;

    // Immediately save to LocalStorage
    localStorage.setItem('staffsync_sheet_url', finalUrl);
    localStorage.setItem('staffsync_sheet_locked', String(finalLocked));

    try {
      const payload = {
        web_app_url: finalUrl,
        sync_enabled: syncEnabled ? 1 : 0,
        is_locked: finalLocked ? 1 : 0,
        spreadsheet_id: spreadsheetId
      };
      const res = await fetch('/api/sheet-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncSuccessMsg("Settings locked and saved permanently system-wide!");
        setTimeout(() => setSyncSuccessMsg(null), 4000);
      } else {
        setSyncErrorMsg(data.message || "Failed to save settings");
      }
    } catch (err: any) {
      setSyncErrorMsg("Error saving settings: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Lock
  const handleToggleLock = () => {
    if (!isSuperAdmin) {
      alert("Only Super Admin can modify the Google Apps Script deployment URL.");
      return;
    }
    const nextLocked = !isLocked;
    setIsLocked(nextLocked);
    handleSaveSettings(nextLocked);
  };

  // Test Connection
  const handleTestConnection = async () => {
    const cleanUrl = webAppUrl.trim();
    if (!cleanUrl) {
      setTestResult({
        success: false,
        message: "Please enter your Google Apps Script Deployment URL first."
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setSyncSuccessMsg(null);
    setSyncErrorMsg(null);

    try {
      const res = await fetch('/api/sheet-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ web_app_url: cleanUrl })
      });
      const result = await res.json();

      if (res.ok && result.success) {
        setTestResult({
          success: true,
          latencyMs: result.latencyMs,
          message: "Google Apps Script connection verified successfully!",
          sheetName: result.data?.spreadsheet_name,
          sheetsCount: result.data?.sheets_count
        });
        if (result.data?.spreadsheet_id) {
          setSpreadsheetId(result.data.spreadsheet_id);
          localStorage.setItem('staffsync_sheet_id', result.data.spreadsheet_id);
        }
      } else {
        setTestResult({
          success: false,
          message: result.message || "Could not connect to Google Apps Script. Check deployment settings."
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: "Connection failed: " + err.message
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Push All Data (Export)
  const handlePushAllData = async () => {
    const cleanUrl = webAppUrl.trim();
    if (!cleanUrl) {
      alert("Please paste and configure your Google Apps Script Deployment URL first.");
      return;
    }
    setSyncingAll(true);
    setSyncSuccessMsg(null);
    setSyncErrorMsg(null);

    try {
      const res = await fetch('/api/sheet-settings/export-all', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSyncTime(time);
        localStorage.setItem('staffsync_last_sync', time);
        setSyncSuccessMsg(`Full database snapshot exported to Google Sheet successfully at ${time}!`);
        if (onRefresh) onRefresh();
      } else {
        setSyncErrorMsg(data.message || "Failed to push data to Google Sheets.");
      }
    } catch (err: any) {
      setSyncErrorMsg("Push error: " + err.message);
    } finally {
      setSyncingAll(false);
    }
  };

  // Pull All Data (Import)
  const handlePullAllData = async () => {
    const cleanUrl = webAppUrl.trim();
    if (!cleanUrl) {
      alert("Please configure your Google Apps Script Deployment URL first.");
      return;
    }

    if (!window.confirm("Are you sure you want to pull data from Google Sheets? This will update local records with sheet contents.")) {
      return;
    }

    setPullingAll(true);
    setSyncSuccessMsg(null);
    setSyncErrorMsg(null);

    try {
      const res = await fetch('/api/sheet-settings/pull-all', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSyncTime(time);
        localStorage.setItem('staffsync_last_sync', time);
        setSyncSuccessMsg("Data successfully pulled from Google Sheets into the application!");
        if (onRefresh) onRefresh();
      } else {
        setSyncErrorMsg(data.message || "Failed to pull data from Google Sheets.");
      }
    } catch (err: any) {
      setSyncErrorMsg("Pull error: " + err.message);
    } finally {
      setPullingAll(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(CODE_GS_SCRIPT);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
  };

  const handleCopyUrl = () => {
    if (!webAppUrl) return;
    navigator.clipboard.writeText(webAppUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 3000);
  };

  const directSheetLink = spreadsheetId 
    ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` 
    : 'https://docs.google.com/spreadsheets';

  return (
    <div className="space-y-4 text-xs font-sans">
      
      {/* Top Banner Card: Live Status & Quick Action */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Google Sheets Live Cloud Sync
                </h3>
                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold rounded-md">
                  Google Apps Script
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Synchronize attendance punches, staff records, sites, and credentials directly to Google Sheets
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {webAppUrl ? (
              <span className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-full font-bold flex items-center gap-1.5 text-xs shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Active & Connected</span>
              </span>
            ) : (
              <span className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-full font-bold flex items-center gap-1.5 text-xs">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Link Required</span>
              </span>
            )}

            {lastSyncTime && (
              <span className="hidden md:inline-flex px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-[11px] font-medium items-center gap-1">
                <ClockIcon className="w-3 h-3" />
                <span>Last Synced: {lastSyncTime}</span>
              </span>
            )}
          </div>
        </div>

        {/* Global Live Sync Switch */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Real-Time Bi-Directional Auto Sync</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              Every attendance punch, staff change, password update, or site radius change automatically syncs to Google Sheets in real time.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input 
              type="checkbox" 
              className="sr-only peer"
              checked={syncEnabled}
              disabled={!isSuperAdmin}
              onChange={(e) => {
                setSyncEnabled(e.target.checked);
                handleSaveSettings(undefined, undefined);
              }}
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
            <span className="ml-2.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              {syncEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>

        {/* Success / Error Banners */}
        {syncSuccessMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-2 text-xs animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncSuccessMsg}</span>
          </div>
        )}

        {syncErrorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-2 text-xs animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{syncErrorMsg}</span>
          </div>
        )}
      </div>

      {/* CENTERPIECE: Deployment URL Bar with Persistent Double-Lock */}
      <div className="bg-white dark:bg-slate-900 border-2 border-emerald-500/30 dark:border-emerald-500/20 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Google Apps Script Web App Deployment URL
              </h4>
              {isLocked ? (
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold rounded-md flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-500" />
                  <span>Locked (Permanent)</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[10px] font-bold rounded-md flex items-center gap-1 animate-pulse">
                  <Unlock className="w-3 h-3 text-amber-600" />
                  <span>Unlocked for Edit</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              This deployment URL is saved securely in your browser and backend database — it will never disappear upon page refresh.
            </p>
          </div>

          {/* Admin Lock / Unlock Action Button */}
          {isSuperAdmin && (
            <button
              onClick={handleToggleLock}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                isLocked 
                  ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
              }`}
              title={isLocked ? "Click to unlock and edit the deployment link" : "Click to save and lock"}
            >
              {isLocked ? (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Unlock to Edit</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Save & Lock URL</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* The Deployment URL Input Bar */}
        <div className="space-y-2">
          <div className="flex flex-col md:flex-row items-stretch gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={webAppUrl}
                disabled={isLocked}
                onChange={(e) => setWebAppUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                className={`w-full py-2.5 px-3.5 rounded-xl font-mono text-xs border transition-all ${
                  isLocked 
                    ? 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 cursor-not-allowed select-all' 
                    : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                }`}
              />
              {isLocked && (
                <div className="absolute right-3 top-2.5 text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyUrl}
                disabled={!webAppUrl}
                className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                title="Copy deployment URL"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? 'Copied!' : 'Copy'}</span>
              </button>

              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !webAppUrl}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Testing...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>⚡ Test Link / Ping</span>
                  </>
                )}
              </button>

              {!isLocked && (
                <button
                  type="button"
                  onClick={() => handleSaveSettings(true)}
                  disabled={isSaving}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
              )}
            </div>
          </div>

          {/* Test Connection Diagnostics */}
          {testResult && (
            <div className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 animate-fadeIn ${
              testResult.success 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200' 
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="font-bold flex items-center gap-2">
                  <span>{testResult.message}</span>
                  {testResult.latencyMs !== undefined && (
                    <span className="px-2 py-0.5 bg-emerald-200/60 dark:bg-emerald-900/60 rounded-md text-[10px] font-mono">
                      Latency: {testResult.latencyMs}ms
                    </span>
                  )}
                </div>
                {testResult.sheetName && (
                  <p className="text-[11px] opacity-90">
                    Connected Spreadsheet: <strong className="underline">{testResult.sheetName}</strong> ({testResult.sheetsCount || 9} database sheets recognized)
                  </p>
                )}
                {!testResult.success && (
                  <p className="text-[11px] opacity-90">
                    Tip: Make sure in Google Apps Script you selected <strong>"Execute as: Me"</strong> and <strong>"Who has access: Anyone"</strong> when deploying.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('control')}
          className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'control' 
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Sync Operations</span>
        </button>

        <button
          onClick={() => setActiveSubTab('code')}
          className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'code' 
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Code2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>code.gs Script File</span>
        </button>

        <button
          onClick={() => setActiveSubTab('guide')}
          className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'guide' 
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-blue-600" />
          <span>5-Minute Setup Guide</span>
        </button>

        <button
          onClick={() => setActiveSubTab('schema')}
          className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'schema' 
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-purple-600" />
          <span>Database Schema (9 Sheets)</span>
        </button>
      </div>

      {/* TAB 1: SYNC OPERATIONS */}
      {activeSubTab === 'control' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center font-bold">
                <ArrowUpFromLine className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Push Full App Database to Sheet
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Exports all 9 tables (Staff, Attendance Logs, Sites, Designations, Departments, Requests, Advances, Holidays, Geofencing) into their respective spreadsheet tabs in one go.
              </p>
            </div>

            <button
              onClick={handlePushAllData}
              disabled={syncingAll || !webAppUrl}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
            >
              {syncingAll ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Streaming All Tables to Google Sheets...</span>
                </>
              ) : (
                <>
                  <ArrowUpFromLine className="w-4 h-4" />
                  <span>🚀 Push All App Data Now</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center font-bold">
                <ArrowDownToLine className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Pull & Restore from Google Sheet
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Reads all rows from your Google Spreadsheet and synchronizes them into the application database. Useful when you bulk-edit staff in Google Sheets.
              </p>
            </div>

            <button
              onClick={handlePullAllData}
              disabled={pullingAll || !webAppUrl}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
            >
              {pullingAll ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Pulling & Rebuilding Local Tables...</span>
                </>
              ) : (
                <>
                  <ArrowDownToLine className="w-4 h-4" />
                  <span>📥 Pull Data from Sheet to App</span>
                </>
              )}
            </button>
          </div>

          <div className="md:col-span-2 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h5 className="font-bold text-sm">Open Connected Google Spreadsheet</h5>
                <p className="text-xs text-slate-300">
                  View and manage your live database directly inside Google Sheets in a new browser tab.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => window.open(directSheetLink, '_blank')}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer shrink-0"
            >
              <span>Launch Google Sheet</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: CODE.GS SCRIPT */}
      {activeSubTab === 'code' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-emerald-600" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Google Apps Script (code.gs) Master Connector
                </h4>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Copy this complete script and paste it into Extensions &gt; Apps Script inside your Google Sheet.
              </p>
            </div>

            <button
              onClick={handleCopyCode}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer shrink-0"
            >
              {copiedScript ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedScript ? '✅ Copied to Clipboard!' : '📋 Copy code.gs Code'}</span>
            </button>
          </div>

          <div className="relative">
            <pre className="p-4 bg-slate-950 text-slate-200 rounded-2xl font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[500px] border border-slate-800 select-all">
              {CODE_GS_SCRIPT}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 3: 5-MINUTE SETUP GUIDE */}
      {activeSubTab === 'guide' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-5">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              <span>Step-by-Step Google Sheets Live Sync Setup (5 Minutes)</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Follow these simple steps to link your Google Spreadsheet as the live database for StaffSync.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">1</span>
                <h5 className="font-bold text-slate-900 dark:text-white">Create Sheet & Open Apps Script</h5>
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                Open <a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-emerald-600 font-bold underline">sheets.new</a> to create a new spreadsheet. In the top menu, click <strong>Extensions &gt; Apps Script</strong>.
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">2</span>
                <h5 className="font-bold text-slate-900 dark:text-white">Paste code.gs and Save</h5>
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                Delete any existing code in the Apps Script editor, paste the complete code from the <strong>code.gs tab</strong>, and press <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px]">Ctrl+S</kbd> to save.
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">3</span>
                <h5 className="font-bold text-slate-900 dark:text-white">1-Click Run `setupSheets`</h5>
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                In the top toolbar function dropdown, select <strong>setupSheets</strong> (NOT doGet), and click <strong>Run (▶)</strong>. Grant Google permissions on first run. All 9 tabs are created automatically!
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">4</span>
                <h5 className="font-bold text-slate-900 dark:text-white">Deploy as Web App (Anyone)</h5>
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                Click <strong>Deploy &gt; New deployment</strong>. Select type <strong>Web app</strong>. Set <em>Execute as: Me</em> and <strong>Who has access: Anyone</strong> (required for app sync). Click <strong>Deploy</strong>.
              </p>
            </div>

            <div className="md:col-span-2 p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">5</span>
                <h5 className="font-bold text-emerald-900 dark:text-emerald-200">Paste Web App URL & Lock</h5>
              </div>
              <p className="text-emerald-800 dark:text-emerald-300 text-xs leading-relaxed">
                Copy the Web App URL provided by Google, paste it into the <strong>Deployment URL bar above</strong>, click <strong>⚡ Test Link / Ping</strong> to verify, and click <strong>Lock</strong> to secure the connection.
              </p>
            </div>

          </div>
        </div>
      )}

      {/* TAB 4: DATABASE SCHEMA (9 SHEETS) */}
      {activeSubTab === 'schema' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>All 9 Database Tables &amp; Sheet Tabs</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Each entity in the app is neatly organized into a dedicated tab with colored headers in your Google Spreadsheet.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { name: 'Users', color: 'border-slate-700 bg-slate-900 text-white', desc: 'Employee codes, credentials, designations, wages, roles & shifts' },
              { name: 'Attendance', color: 'border-teal-700 bg-teal-800 text-white', desc: 'Real-time punch records, check-in/out, hours, lat/lng & device IDs' },
              { name: 'Sites', color: 'border-blue-700 bg-blue-900 text-white', desc: 'Site locations, coordinates, geofence radius & shift timing' },
              { name: 'Designations', color: 'border-indigo-700 bg-indigo-900 text-white', desc: 'Staff roles, engineer designations & corporate titles' },
              { name: 'Departments', color: 'border-purple-700 bg-purple-900 text-white', desc: 'Corporate departments & divisions' },
              { name: 'AttendanceRequests', color: 'border-fuchsia-700 bg-fuchsia-900 text-white', desc: 'Leave applications, punch corrections & admin approvals' },
              { name: 'SalaryAdvances', color: 'border-pink-700 bg-pink-900 text-white', desc: 'Advance salary requests, loans & disbursement records' },
              { name: 'Holidays', color: 'border-rose-700 bg-rose-900 text-white', desc: 'Official holiday calendars & gazetted days off' },
              { name: 'Geofencing', color: 'border-emerald-700 bg-emerald-900 text-white', desc: 'Global geofencing switch & default GPS parameters' },
            ].map((tab) => (
              <div key={tab.name} className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${tab.color}`}>
                    {tab.name}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Tab</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  {tab.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 1118 0z" />
    </svg>
  );
}
