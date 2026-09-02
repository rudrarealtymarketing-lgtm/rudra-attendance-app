import express from "express";
import { createServer as createViteServer } from "vite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

dotenv.config();

const resolvedFilename = typeof import.meta !== "undefined" && import.meta.url
  ? fileURLToPath(import.meta.url)
  : (typeof __filename !== "undefined" ? __filename : "");

const resolvedDirname = typeof __dirname !== "undefined"
  ? __dirname
  : (resolvedFilename ? path.dirname(resolvedFilename) : process.cwd());

const db = new Database("attendance.db");
try {
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
} catch (e: any) {
  console.warn("Could not set SQLite pragmas:", e.message);
}
console.log("Database initialized with WAL mode");

// Migration helper
const runMigration = (name: string, sql: string) => {
  try {
    db.exec(sql);
    console.log(`Migration successful: ${name}`);
  } catch (e: any) {
    if (e.message.includes("duplicate column name")) {
      console.log(`Migration skipped (column exists): ${name}`);
    } else {
      console.error(`Migration failed: ${name}`, e);
    }
  }
};

console.log("Running initial table creation...");
// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registration_id TEXT UNIQUE,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    country TEXT,
    phone TEXT,
    role TEXT DEFAULT 'user',
    department_id INTEGER,
    password TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    department_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id)
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_id INTEGER,
    date TEXT NOT NULL,
    check_in TEXT,
    check_out TEXT,
    status TEXT,
    location TEXT,
    method TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );

  CREATE TABLE IF NOT EXISTS qr_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    qr_code TEXT NOT NULL,
    created_by INTEGER,
    expires_at DATETIME NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sheet_settings (
    id INTEGER PRIMARY KEY,
    spreadsheet_id TEXT,
    users_sheet_name TEXT DEFAULT 'Users',
    attendance_sheet_name TEXT DEFAULT 'Attendance',
    service_account_json TEXT,
    web_app_url TEXT,
    sync_enabled INTEGER DEFAULT 1,
    is_locked INTEGER DEFAULT 1,
    last_sync_timestamp TEXT
  );

  CREATE TABLE IF NOT EXISTS geofence_settings (
    id INTEGER PRIMARY KEY,
    enabled INTEGER DEFAULT 0,
    latitude REAL,
    longitude REAL,
    radius REAL DEFAULT 150
  );

  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    address TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    radius REAL DEFAULT 150 NOT NULL,
    work_start_time TEXT DEFAULT '10:00',
    work_end_time TEXT DEFAULT '19:00',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS attendance_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    start_date TEXT,
    end_date TEXT,
    check_in TEXT,
    check_out TEXT,
    status TEXT DEFAULT 'PENDING',
    reason TEXT,
    site_name TEXT,
    type TEXT DEFAULT 'CORRECTION',
    half_day_slot TEXT,
    admin_comment TEXT,
    actioned_at DATETIME,
    actioned_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS salary_advances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS designations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migrations
const userTableInfo = db.prepare("PRAGMA table_info(users)").all() as any[];
if (!userTableInfo.some(col => col.name === 'username')) runMigration("add username", "ALTER TABLE users ADD COLUMN username TEXT");
if (!userTableInfo.some(col => col.name === 'work_start_time')) runMigration("add work_start_time", "ALTER TABLE users ADD COLUMN work_start_time TEXT DEFAULT '10:00'");
if (!userTableInfo.some(col => col.name === 'work_end_time')) runMigration("add work_end_time", "ALTER TABLE users ADD COLUMN work_end_time TEXT DEFAULT '19:00'");
if (!userTableInfo.some(col => col.name === 'registration_id')) runMigration("add registration_id", "ALTER TABLE users ADD COLUMN registration_id TEXT UNIQUE");
if (!userTableInfo.some(col => col.name === 'country')) runMigration("add country", "ALTER TABLE users ADD COLUMN country TEXT");
if (!userTableInfo.some(col => col.name === 'site_name')) runMigration("add site_name", "ALTER TABLE users ADD COLUMN site_name TEXT DEFAULT 'ARAMUS RUDRA'");
if (!userTableInfo.some(col => col.name === 'password')) runMigration("add password", "ALTER TABLE users ADD COLUMN password TEXT");
if (!userTableInfo.some(col => col.name === 'bound_device_id')) runMigration("add bound_device_id", "ALTER TABLE users ADD COLUMN bound_device_id TEXT");
if (!userTableInfo.some(col => col.name === 'last_device_info')) runMigration("add last_device_info", "ALTER TABLE users ADD COLUMN last_device_info TEXT");
if (!userTableInfo.some(col => col.name === 'monthly_salary')) runMigration("add monthly_salary", "ALTER TABLE users ADD COLUMN monthly_salary REAL DEFAULT 0");
if (!userTableInfo.some(col => col.name === 'designation')) runMigration("add designation", "ALTER TABLE users ADD COLUMN designation TEXT DEFAULT 'Staff'");
if (!userTableInfo.some(col => col.name === 'date_of_joining')) runMigration("add date_of_joining", "ALTER TABLE users ADD COLUMN date_of_joining TEXT");
if (!userTableInfo.some(col => col.name === 'date_of_birth')) runMigration("add date_of_birth", "ALTER TABLE users ADD COLUMN date_of_birth TEXT");
if (!userTableInfo.some(col => col.name === 'emergency_contact')) runMigration("add emergency_contact", "ALTER TABLE users ADD COLUMN emergency_contact TEXT");
if (!userTableInfo.some(col => col.name === 'bank_account')) runMigration("add bank_account", "ALTER TABLE users ADD COLUMN bank_account TEXT");
if (!userTableInfo.some(col => col.name === 'ifsc_code')) runMigration("add ifsc_code", "ALTER TABLE users ADD COLUMN ifsc_code TEXT");
if (!userTableInfo.some(col => col.name === 'upi_id')) runMigration("add upi_id", "ALTER TABLE users ADD COLUMN upi_id TEXT");
if (!userTableInfo.some(col => col.name === 'pan_aadhaar')) runMigration("add pan_aadhaar", "ALTER TABLE users ADD COLUMN pan_aadhaar TEXT");
if (!userTableInfo.some(col => col.name === 'allowed_devices')) runMigration("add allowed_devices", "ALTER TABLE users ADD COLUMN allowed_devices INTEGER DEFAULT 1");
if (!userTableInfo.some(col => col.name === 'avatar_url')) runMigration("add avatar_url", "ALTER TABLE users ADD COLUMN avatar_url TEXT");
if (!userTableInfo.some(col => col.name === 'current_address')) runMigration("add current_address", "ALTER TABLE users ADD COLUMN current_address TEXT");
if (!userTableInfo.some(col => col.name === 'marital_status')) runMigration("add marital_status", "ALTER TABLE users ADD COLUMN marital_status TEXT");
if (!userTableInfo.some(col => col.name === 'documents')) runMigration("add documents", "ALTER TABLE users ADD COLUMN documents TEXT");

const siteTableInfo = db.prepare("PRAGMA table_info(sites)").all() as any[];
if (!siteTableInfo.some(col => col.name === 'address')) runMigration("add address to sites", "ALTER TABLE sites ADD COLUMN address TEXT");
if (!siteTableInfo.some(col => col.name === 'work_start_time')) runMigration("add work_start_time to sites", "ALTER TABLE sites ADD COLUMN work_start_time TEXT DEFAULT '10:00'");
if (!siteTableInfo.some(col => col.name === 'work_end_time')) runMigration("add work_end_time to sites", "ALTER TABLE sites ADD COLUMN work_end_time TEXT DEFAULT '19:00'");

const reqTableInfo = db.prepare("PRAGMA table_info(attendance_requests)").all() as any[];
if (!reqTableInfo.some(col => col.name === 'type')) runMigration("add type to requests", "ALTER TABLE attendance_requests ADD COLUMN type TEXT DEFAULT 'CORRECTION'");
if (!reqTableInfo.some(col => col.name === 'start_date')) runMigration("add start_date to requests", "ALTER TABLE attendance_requests ADD COLUMN start_date TEXT");
if (!reqTableInfo.some(col => col.name === 'end_date')) runMigration("add end_date to requests", "ALTER TABLE attendance_requests ADD COLUMN end_date TEXT");
if (!reqTableInfo.some(col => col.name === 'half_day_slot')) runMigration("add half_day_slot to requests", "ALTER TABLE attendance_requests ADD COLUMN half_day_slot TEXT");
if (!reqTableInfo.some(col => col.name === 'admin_comment')) runMigration("add admin_comment to requests", "ALTER TABLE attendance_requests ADD COLUMN admin_comment TEXT");
if (!reqTableInfo.some(col => col.name === 'actioned_at')) runMigration("add actioned_at to requests", "ALTER TABLE attendance_requests ADD COLUMN actioned_at DATETIME");
if (!reqTableInfo.some(col => col.name === 'actioned_by')) runMigration("add actioned_by to requests", "ALTER TABLE attendance_requests ADD COLUMN actioned_by TEXT");

const attTableInfo = db.prepare("PRAGMA table_info(attendance)").all() as any[];
if (!attTableInfo.some(col => col.name === 'early_checkout_reason')) runMigration("add early_checkout_reason", "ALTER TABLE attendance ADD COLUMN early_checkout_reason TEXT");
if (!attTableInfo.some(col => col.name === 'late_reason')) runMigration("add late_reason", "ALTER TABLE attendance ADD COLUMN late_reason TEXT");
if (!attTableInfo.some(col => col.name === 'is_late')) runMigration("add is_late", "ALTER TABLE attendance ADD COLUMN is_late INTEGER DEFAULT 0");
if (!attTableInfo.some(col => col.name === 'late_minutes')) runMigration("add late_minutes", "ALTER TABLE attendance ADD COLUMN late_minutes INTEGER DEFAULT 0");
if (!attTableInfo.some(col => col.name === 'overtime_hours')) runMigration("add overtime_hours", "ALTER TABLE attendance ADD COLUMN overtime_hours REAL DEFAULT 0");
if (!attTableInfo.some(col => col.name === 'session_id')) runMigration("add session_id", "ALTER TABLE attendance ADD COLUMN session_id INTEGER REFERENCES sessions(id)");
if (!attTableInfo.some(col => col.name === 'ip_address')) runMigration("add ip_address", "ALTER TABLE attendance ADD COLUMN ip_address TEXT");
if (!attTableInfo.some(col => col.name === 'latitude')) runMigration("add latitude", "ALTER TABLE attendance ADD COLUMN latitude REAL");
if (!attTableInfo.some(col => col.name === 'longitude')) runMigration("add longitude", "ALTER TABLE attendance ADD COLUMN longitude REAL");
if (!attTableInfo.some(col => col.name === 'device_id')) runMigration("add device_id", "ALTER TABLE attendance ADD COLUMN device_id TEXT");
if (!attTableInfo.some(col => col.name === 'photo_url')) runMigration("add photo_url", "ALTER TABLE attendance ADD COLUMN photo_url TEXT");
if (!attTableInfo.some(col => col.name === 'is_proxy_flagged')) runMigration("add is_proxy_flagged", "ALTER TABLE attendance ADD COLUMN is_proxy_flagged INTEGER DEFAULT 0");

const settingsTableInfo = db.prepare("PRAGMA table_info(sheet_settings)").all() as any[];
if (!settingsTableInfo.some(col => col.name === 'web_app_url')) runMigration("add web_app_url", "ALTER TABLE sheet_settings ADD COLUMN web_app_url TEXT");
if (!settingsTableInfo.some(col => col.name === 'is_locked')) runMigration("add is_locked", "ALTER TABLE sheet_settings ADD COLUMN is_locked INTEGER DEFAULT 1");

// Helper to sanitize time representation for Google Sheets export
function cleanTimeString(t: any): string {
  if (!t) return "";
  const str = String(t).trim();
  if (str.includes("T")) {
    const timePart = str.split("T")[1]?.split(".")[0];
    return timePart ? timePart.slice(0, 5) : str;
  }
  return str.slice(0, 5);
}

// Seed Master Departments
const deptCount = (db.prepare("SELECT COUNT(*) as count FROM departments").get() as any).count;
if (deptCount === 0) {
  const depts = [
    ["Executive & Management", "Executive Leadership & Board"],
    ["Civil & Construction", "Site Engineers, Supervisors & Project Managers"],
    ["Sales & Marketing", "Real Estate Sales Executives & CRM"],
    ["Accounts & Finance", "Billing, Payroll & Accounts Team"],
    ["Administration & HR", "General Office Administration & Operations"]
  ];
  const stmt = db.prepare("INSERT INTO departments (name, description) VALUES (?, ?)");
  for (const d of depts) { stmt.run(d[0], d[1]); }
}

// Seed Master Designations
const desigCount = (db.prepare("SELECT COUNT(*) as count FROM designations").get() as any).count;
if (desigCount === 0) {
  const defaultDesignations = [
    "Managing Director (MD)", "Executive Director", "Chief Executive Officer (CEO)", "General Manager (GM)",
    "Project Head / CPM", "Senior Site Engineer", "Junior Site Engineer", "Site Supervisor",
    "Quality & Safety Engineer", "Purchase & Material Manager", "Sales Head / Manager",
    "Senior Sales Executive", "Sales Executive / Field Officer", "Telecaller / CRM Executive",
    "Digital Marketing Executive", "Head of Accounts & Finance", "Accountant", "HR & Admin Manager",
    "Legal & Liaison Officer", "Front Desk / Receptionist", "Site Storekeeper", "Security In-Charge",
    "Driver / Logistics", "Office Boy / Peon", "Housekeeping Staff"
  ];
  const stmt = db.prepare("INSERT OR IGNORE INTO designations (name) VALUES (?)");
  for (const name of defaultDesignations) { stmt.run(name); }
}

// Default Super Admin & Director
const existingAdmin = db.prepare("SELECT id FROM users WHERE role = 'super_admin' OR registration_id = 'ADMIN-01'").get();
if (!existingAdmin) {
  db.prepare("INSERT INTO users (registration_id, name, email, role, department_id, password, designation, site_name, allowed_devices) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run("ADMIN-01", "Abhishek Bhatt (Admin)", "admin@rudra.com", "super_admin", 1, "admin123", "Chief Executive Officer (CEO)", "ARAMUS RUDRA", 99);
}

const existingDirector = db.prepare("SELECT id FROM users WHERE role = 'director' OR registration_id = 'DIR-01'").get();
if (!existingDirector) {
  db.prepare("INSERT INTO users (registration_id, name, email, role, department_id, password, designation, site_name, allowed_devices) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run("DIR-01", "Director / Partner", "director@rudra.com", "director", 1, "director123", "Managing Director (MD)", "ARAMUS RUDRA", 99);
}

// Ensure default site exists
const siteCountCheck = db.prepare("SELECT COUNT(*) as count FROM sites").get() as any;
if (siteCountCheck.count === 0) {
  db.prepare(`
    INSERT INTO sites (name, address, latitude, longitude, radius, work_start_time, work_end_time)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    "ARAMUS RUDRA",
    "Plot 4 and 4a, Sector 18 Rd, Sector 18, Kharghar, Panvel, Maharashtra 410210",
    19.04574,
    73.08025,
    150,
    "10:00",
    "19:00"
  );
}

// Ensure default sheet_settings row exists with the permanent Web App URL
const DEFAULT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycby-QMBlqhuh40b0MsMWlwRHKhzpvLmc1He1jBsh6E4g1jxWHScmU45jmla1DmAQ2v_Nrg/exec";
const sheetSettingsRow = db.prepare("SELECT * FROM sheet_settings WHERE id = 1").get() as any;
if (!sheetSettingsRow) {
  db.prepare("INSERT OR IGNORE INTO sheet_settings (id, users_sheet_name, attendance_sheet_name, web_app_url, sync_enabled, is_locked) VALUES (1, 'Users', 'Attendance', ?, 1, 1)").run(DEFAULT_WEB_APP_URL);
} else if (!sheetSettingsRow.web_app_url) {
  db.prepare("UPDATE sheet_settings SET web_app_url = ? WHERE id = 1").run(DEFAULT_WEB_APP_URL);
}

// Persistent Storage Backup Engine
const BACKUP_FILE = path.join(process.cwd(), "app_data_backup.json");

function restoreDatabaseFromJson() {
  if (!fs.existsSync(BACKUP_FILE)) return;
  try {
    const raw = fs.readFileSync(BACKUP_FILE, "utf8");
    const data = JSON.parse(raw);

    if (data.sheet_settings && Array.isArray(data.sheet_settings) && data.sheet_settings.length > 0) {
      const s = data.sheet_settings[0];
      if (s.web_app_url) {
        db.prepare(`
          INSERT INTO sheet_settings (id, spreadsheet_id, users_sheet_name, attendance_sheet_name, web_app_url, sync_enabled, is_locked)
          VALUES (1, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            web_app_url = excluded.web_app_url,
            is_locked = excluded.is_locked
        `).run(s.spreadsheet_id || null, s.users_sheet_name || 'Users', s.attendance_sheet_name || 'Attendance', s.web_app_url, 1, 1);
      }
    }

    if (Array.isArray(data.sites) && data.sites.length > 0) {
      for (const st of data.sites) {
        db.prepare(`
          INSERT INTO sites (id, name, address, latitude, longitude, radius, work_start_time, work_end_time)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(name) DO UPDATE SET
            address = excluded.address,
            latitude = excluded.latitude,
            longitude = excluded.longitude,
            radius = excluded.radius,
            work_start_time = excluded.work_start_time,
            work_end_time = excluded.work_end_time
        `).run(st.id || null, st.name, st.address || null, Number(st.latitude), Number(st.longitude), Number(st.radius) || 150, cleanTimeString(st.work_start_time) || '10:00', cleanTimeString(st.work_end_time) || '19:00');
      }
    }

    if (Array.isArray(data.users) && data.users.length > 0) {
      for (const u of data.users) {
        db.prepare(`
          INSERT INTO users (id, registration_id, name, username, email, phone, role, department_id, site_name, password, designation, allowed_devices, bound_device_id, work_start_time, work_end_time, monthly_salary, date_of_joining)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(registration_id) DO UPDATE SET
            name = excluded.name,
            username = excluded.username,
            email = excluded.email,
            phone = excluded.phone,
            role = excluded.role,
            site_name = excluded.site_name,
            password = excluded.password,
            designation = excluded.designation,
            allowed_devices = excluded.allowed_devices,
            bound_device_id = COALESCE(users.bound_device_id, excluded.bound_device_id),
            monthly_salary = excluded.monthly_salary,
            date_of_joining = excluded.date_of_joining
        `).run(
          u.id || null, u.registration_id, u.name, u.username || null, u.email || null, u.phone || null,
          u.role || 'user', u.department_id || 1, u.site_name || 'ARAMUS RUDRA', u.password || 'password123',
          u.designation || 'Staff', Number(u.allowed_devices) || 1, u.bound_device_id || null,
          cleanTimeString(u.work_start_time) || '10:00', cleanTimeString(u.work_end_time) || '19:00',
          Number(u.monthly_salary) || 0, u.date_of_joining || ''
        );
      }
    }

    console.log("Persistent state synchronized successfully from app_data_backup.json");
  } catch (err: any) {
    console.warn("Could not load from app_data_backup.json:", err.message);
  }
}

function backupDatabaseToJson() {
  try {
    const backupData = {
      sheet_settings: db.prepare("SELECT * FROM sheet_settings").all(),
      users: db.prepare("SELECT * FROM users").all(),
      attendance: db.prepare("SELECT * FROM attendance").all(),
      sites: db.prepare("SELECT * FROM sites").all(),
      designations: db.prepare("SELECT * FROM designations").all(),
      departments: db.prepare("SELECT * FROM departments").all(),
      attendance_requests: db.prepare("SELECT * FROM attendance_requests").all(),
      salary_advances: db.prepare("SELECT * FROM salary_advances").all(),
      holidays: db.prepare("SELECT * FROM holidays").all(),
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(backupData, null, 2), "utf8");
  } catch (err: any) {
    console.error("Failed to backup database to JSON:", err.message);
  }
}

restoreDatabaseFromJson();

// Auto-Restore from Google Sheets on Server Boot
async function autoSyncFromGoogleSheetsOnBoot() {
  try {
    let settings = db.prepare("SELECT * FROM sheet_settings WHERE id = 1").get() as any;
    let targetUrl = settings?.web_app_url || DEFAULT_WEB_APP_URL;

    console.log(">>> Connecting to Google Sheets and restoring full database on boot...");
    const response = await fetch(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getAllData`, { redirect: "follow" });
    const resJson = await response.json();

    if (resJson.success && resJson.data) {
      const d = resJson.data;

      db.prepare(`
        INSERT INTO sheet_settings (id, web_app_url, sync_enabled, is_locked)
        VALUES (1, ?, 1, 1)
        ON CONFLICT(id) DO UPDATE SET web_app_url = excluded.web_app_url
      `).run(targetUrl);

      // 1. Restore Users
      if (Array.isArray(d.users) && d.users.length > 0) {
        for (const u of d.users) {
          const empName = u.name || u.full_name || u['Full Name'];
          const regCode = u.registration_id || u.employee_code || u['Employee Code'] || u.user_id || u['User ID'];
          if (empName && u.role !== 'super_admin') {
            db.prepare(`
              INSERT INTO users (registration_id, name, username, email, phone, role, site_name, designation, monthly_salary, password, work_start_time, work_end_time, allowed_devices, bound_device_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(registration_id) DO UPDATE SET
                name = excluded.name,
                username = excluded.username,
                email = excluded.email,
                phone = excluded.phone,
                role = excluded.role,
                site_name = excluded.site_name,
                designation = excluded.designation,
                monthly_salary = excluded.monthly_salary,
                password = COALESCE(excluded.password, users.password),
                work_start_time = excluded.work_start_time,
                work_end_time = excluded.work_end_time,
                allowed_devices = COALESCE(excluded.allowed_devices, users.allowed_devices)
            `).run(
              regCode || null, empName, u.username || null, u.email || null, u.phone || null,
              u.role || 'user', u.site_name || u.branch___site || 'ARAMUS RUDRA', u.designation || 'Staff',
              Number(u.monthly_salary || u.monthly_salary_____) || 0, u.password || 'password123',
              cleanTimeString(u.work_start_time || u.work_start || u['Shift Start']) || '10:00',
              cleanTimeString(u.work_end_time || u.work_end || u['Shift End']) || '19:00',
              Number(u.allowed_devices) || 1, u.bound_device_id || null
            );
          }
        }
      }

      // 2. Restore Sites
      if (Array.isArray(d.sites) && d.sites.length > 0) {
        for (const s of d.sites) {
          const sName = s.name || s.site_name || s['Site Name'];
          if (sName) {
            db.prepare(`
              INSERT INTO sites (name, address, latitude, longitude, radius, work_start_time, work_end_time)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(name) DO UPDATE SET
                address = excluded.address,
                latitude = excluded.latitude,
                longitude = excluded.longitude,
                radius = excluded.radius,
                work_start_time = excluded.work_start_time,
                work_end_time = excluded.work_end_time
            `).run(
              sName, s.address || s['Address'] || '', Number(s.latitude || s['Latitude']) || 19.04574,
              Number(s.longitude || s['Longitude']) || 73.08025,
              Number(s.radius || s.radius__meters_ || s['Radius (Meters)']) || 150,
              cleanTimeString(s.work_start_time || s.shift_start || s['Shift Start']) || '10:00',
              cleanTimeString(s.work_end_time || s.shift_end || s['Shift End']) || '19:00'
            );
          }
        }
      }

      // 3. Restore Attendance Logs
      if (Array.isArray(d.attendance) && d.attendance.length > 0) {
        for (const a of d.attendance) {
          const regId = a.registration_id || a.employee_code || a['Employee Code'];
          const aName = a.name || a['Name'];
          const user = db.prepare("SELECT id FROM users WHERE registration_id = ? OR name = ?").get(regId, aName) as any;
          if (user && (a.date || a['Date'])) {
            const rawDate = a.date || a['Date'];
            const attDate = String(rawDate).includes("T") ? rawDate.split("T")[0] : rawDate;
            const existing = db.prepare("SELECT id FROM attendance WHERE user_id = ? AND date = ?").get(user.id, attDate);
            if (!existing) {
              db.prepare(`
                INSERT INTO attendance (user_id, date, check_in, check_out, status, method, location, late_minutes, overtime_hours)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                user.id, attDate,
                cleanTimeString(a.check_in || a['Check In']),
                cleanTimeString(a.check_out || a['Check Out']),
                a.status === 'Present' ? 'P' : (a.status === 'Late' ? 'L' : (a.status || 'P')),
                a.method || 'app', a.site_name || a.branch___site || 'ARAMUS RUDRA',
                Number(a.late_minutes || a.late__min_) || 0, Number(a.overtime_hours || a.overtime__hrs_) || 0
              );
            }
          }
        }
      }

      console.log(">>> Auto-restore completed: All users, sites, and attendance records restored from Google Sheets!");
      backupDatabaseToJson();
    }
  } catch (err: any) {
    console.warn("Auto-restore on boot warning:", err.message);
  }
}

setTimeout(() => {
  autoSyncFromGoogleSheetsOnBoot();
}, 3000);

async function syncFullDatabaseToSheets(): Promise<{ success: boolean; message: string }> {
  try {
    const settings = db.prepare("SELECT * FROM sheet_settings WHERE id = 1").get() as any;
    const targetUrl = settings?.web_app_url || DEFAULT_WEB_APP_URL;

    const rawUsers = db.prepare("SELECT * FROM users").all() as any[];
    const users = rawUsers.map(u => ({
      ...u,
      work_start_time: cleanTimeString(u.work_start_time),
      work_end_time: cleanTimeString(u.work_end_time)
    }));

    const rawAttendance = db.prepare(`
      SELECT a.id, a.date, a.check_in, a.check_out, u.registration_id, u.name, u.designation, 
             COALESCE(u.site_name, a.location) as site_name, a.status, a.late_minutes, 
             a.overtime_hours, a.method, a.device_id, a.latitude, a.longitude, 
             a.ip_address, a.photo_url, a.early_checkout_reason, a.late_reason, a.created_at
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      ORDER BY a.date DESC, a.check_in DESC
    `).all() as any[];

    const attendance = rawAttendance.map(a => ({
      ...a,
      date: a.date ? String(a.date).split("T")[0] : "",
      check_in: cleanTimeString(a.check_in),
      check_out: cleanTimeString(a.check_out)
    }));

    const rawSites = db.prepare("SELECT * FROM sites").all() as any[];
    const sites = rawSites.map(s => ({
      ...s,
      work_start_time: cleanTimeString(s.work_start_time),
      work_end_time: cleanTimeString(s.work_end_time)
    }));

    const designations = db.prepare("SELECT * FROM designations").all() as any[];
    const departments = db.prepare("SELECT * FROM departments").all() as any[];
    const approvals = db.prepare(`
      SELECT r.id, u.registration_id, u.name as user_name, r.date, r.type, r.check_in, r.check_out, r.status, r.reason, r.site_name, r.admin_comment, r.actioned_at, r.created_at
      FROM attendance_requests r
      JOIN users u ON r.user_id = u.id
      ORDER BY r.created_at DESC
    `).all() as any[];

    const salary_advances = db.prepare(`
      SELECT sa.id, sa.date, u.registration_id, u.name as user_name, sa.type, sa.amount, sa.notes, sa.created_at
      FROM salary_advances sa
      JOIN users u ON sa.user_id = u.id
      ORDER BY sa.date DESC
    `).all() as any[];

    const holidays = db.prepare("SELECT * FROM holidays ORDER BY date ASC").all() as any[];
    const geofencingObj = db.prepare("SELECT * FROM geofence_settings WHERE id = 1").get() as any;
    const geofencing = geofencingObj ? [geofencingObj] : [];

    const payload = {
      action: "exportAllData",
      data: {
        users,
        attendance,
        sites,
        designations,
        departments,
        approvals,
        salary_advances,
        holidays,
        geofencing
      }
    };

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow"
    });

    const now = new Date().toISOString();
    db.prepare("UPDATE sheet_settings SET last_sync_timestamp = ? WHERE id = 1").run(now);
    return { success: true, message: `Synced at ${now}` };
  } catch (err: any) {
    console.error("Background Sheet Sync Warning:", err.message);
    return { success: false, message: err.message };
  }
}

function triggerLiveSync(context = "general") {
  syncFullDatabaseToSheets().then(res => {
    if (res.success) {
      console.log(`[GoogleSheet Live Sync] Triggered successfully for: ${context}`);
    }
  }).catch(e => {
    console.warn(`[GoogleSheet Live Sync] Background sync warning:`, e.message);
  });
}

async function appendAttendanceLogLive(userId: number, date: string, checkInTime: string, status: string, method: string, sessionId: number | null, checkoutTime?: string) {
  try {
    const settings = db.prepare("SELECT * FROM sheet_settings WHERE id = 1").get() as any;
    const targetUrl = settings?.web_app_url || DEFAULT_WEB_APP_URL;

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
    if (!user) return;

    await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "appendAttendance",
        record: {
          id: `ATT-${userId}-${date}`,
          date: date.split("T")[0],
          check_in: cleanTimeString(checkInTime),
          check_out: cleanTimeString(checkoutTime),
          registration_id: user.registration_id || "",
          name: user.name,
          designation: user.designation || "Staff",
          site_name: user.site_name || "ARAMUS RUDRA",
          status: status === 'P' ? 'Present' : (status === 'L' ? 'Late' : (status === 'Half Day' ? 'Half Day' : status)),
          method: method || "App",
          created_at: new Date().toISOString()
        }
      }),
      redirect: "follow"
    });
  } catch (err: any) {
    console.error("Punch streaming error:", err.message);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(cookieParser());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Login Handler with Strict Hardware Device Access Limit
  app.post("/api/login", (req, res) => {
    const { identifier, username, password, deviceId } = req.body;
    const searchVal = String(identifier || username || "").trim();
    const pwd = String(password || "").trim();

    if (!searchVal || !pwd) {
      return res.status(400).json({ success: false, message: "Please enter your credentials" });
    }

    const user = db.prepare(`
      SELECT * FROM users 
      WHERE LOWER(email) = LOWER(?) 
         OR LOWER(registration_id) = LOWER(?) 
         OR LOWER(username) = LOWER(?)
         OR phone = ?
    `).get(searchVal, searchVal, searchVal, searchVal) as any;

    if (!user) {
      return res.status(401).json({ success: false, message: "Staff member not found." });
    }

    const expectedPassword = user.password || user.registration_id || "password123";
    if (pwd !== expectedPassword) {
      return res.status(401).json({ success: false, message: "Incorrect password." });
    }

    // 🔒 Hardware Device Locking Enforcement
    const allowedDevices = Number(user.allowed_devices) || 1;
    if (user.role !== 'super_admin' && allowedDevices === 1 && deviceId) {
      if (user.bound_device_id && user.bound_device_id !== deviceId) {
        return res.status(403).json({
          success: false,
          message: "Security Violation: Account bound to another device. Contact Admin to reset your device."
        });
      }

      if (!user.bound_device_id) {
        db.prepare("UPDATE users SET bound_device_id = ? WHERE id = ?").run(deviceId, user.id);
        user.bound_device_id = deviceId;
        backupDatabaseToJson();
      }
    }

    res.json({ success: true, user });
  });

  // Device Reset API (Admin 1-Click Unlock)
  app.post(["/api/users/:id/reset-device", "/api/super_admin/users/:id/reset-device"], (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("UPDATE users SET bound_device_id = NULL WHERE id = ?").run(id);
      backupDatabaseToJson();
      triggerLiveSync('reset_device');
      res.json({ success: true, message: "Device lock cleared successfully. User can now register a new device." });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Universal Password Change Handler
  const handleUniversalPasswordChange = (req: express.Request, res: express.Response) => {
    const { 
      userId, id, user_id, registration_id, email,
      currentPassword, current_password, oldPassword, old_password,
      newPassword, new_password, password 
    } = req.body;

    const target = req.params.id || userId || id || user_id || registration_id || email;
    const cleanNewPass = (newPassword || new_password || password || "").trim();
    const cleanCurrPass = (currentPassword || current_password || oldPassword || old_password || "").trim();

    if (!target) {
      return res.status(400).json({ success: false, message: "User identifier is required." });
    }
    if (!cleanNewPass) {
      return res.status(400).json({ success: false, message: "New password cannot be empty." });
    }

    try {
      const user = db.prepare(`
        SELECT * FROM users 
        WHERE id = ? 
           OR registration_id = ? 
           OR LOWER(email) = LOWER(?) 
           OR LOWER(username) = LOWER(?)
      `).get(target, target, target, target) as any;

      if (!user) {
        return res.status(404).json({ success: false, message: "User account not found." });
      }

      if (cleanCurrPass && user.password && user.password !== cleanCurrPass) {
        return res.status(400).json({ success: false, message: "Current password does not match." });
      }

      db.prepare("UPDATE users SET password = ? WHERE id = ?").run(cleanNewPass, user.id);
      backupDatabaseToJson();
      triggerLiveSync('change_password');

      return res.json({ success: true, message: "Password updated successfully!", userId: user.id });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message });
    }
  };

  app.all([
    "/api/users/change-password",
    "/api/change-password",
    "/api/auth/change-password",
    "/api/users/:id/change-password",
    "/api/users/:id/password"
  ], handleUniversalPasswordChange);

  // Users & Staff Management
  app.get("/api/users", (req, res) => {
    const { siteName } = req.query;
    let users;
    if (siteName) {
      users = db.prepare(`
        SELECT u.*, d.name as department_name 
        FROM users u 
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE LOWER(u.site_name) = LOWER(?) OR LOWER(u.country) = LOWER(?)
      `).all(siteName, siteName);
    } else {
      users = db.prepare("SELECT u.*, d.name as department_name FROM users u LEFT JOIN departments d ON u.department_id = d.id").all();
    }
    res.json(users);
  });

  const handleCreateUser = (req: express.Request, res: express.Response) => {
    const { 
      registration_id, username, name, email, phone, country, role, 
      department_id, site_name, password, designation, allowed_devices, 
      work_start_time, work_end_time, monthly_salary, date_of_joining 
    } = req.body;

    try {
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: "Full Name is required" });
      }

      const cleanEmail = email && email.trim() ? email.trim() : null;
      const cleanPhone = phone && phone.trim() ? phone.trim() : null;
      
      let cleanRegId = registration_id && registration_id.trim() ? registration_id.trim() : null;
      if (!cleanRegId) {
        const count = (db.prepare("SELECT COUNT(*) as c FROM users").get() as any)?.c || 0;
        cleanRegId = `EMP-${1000 + count + 1}`;
      } else {
        const existing = db.prepare("SELECT id FROM users WHERE registration_id = ?").get(cleanRegId);
        if (existing) cleanRegId = `${cleanRegId}-${Date.now().toString().slice(-3)}`;
      }

      const derivedUsername = (username && username.trim()) 
        ? username.trim().toLowerCase() 
        : name.toLowerCase().replace(/[^a-z0-9]/g, '.');
      
      const defaultPwd = (password && password.trim()) ? password.trim() : cleanRegId;

      const result = db.prepare(`
        INSERT INTO users (
          registration_id, username, name, email, phone, country, role, 
          department_id, site_name, password, designation, allowed_devices, 
          work_start_time, work_end_time, monthly_salary, date_of_joining
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        cleanRegId, derivedUsername, name.trim(), cleanEmail, cleanPhone, country || null, 
        role || 'user', department_id || null, site_name || 'ARAMUS RUDRA', defaultPwd, 
        designation || 'Staff', Number(allowed_devices) || 1, cleanTimeString(work_start_time) || '10:00', 
        cleanTimeString(work_end_time) || '19:00', Number(monthly_salary) || 0, 
        date_of_joining || new Date().toISOString().split('T')[0]
      );

      backupDatabaseToJson();
      triggerLiveSync('create_user');

      const newUser = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
      res.json({ success: true, id: result.lastInsertRowid, user: newUser, message: "Staff member registered successfully" });
    } catch (e: any) {
      res.status(400).json({ success: false, message: e.message });
    }
  };

  app.post("/api/users", handleCreateUser);
  app.post("/api/super_admin/users", handleCreateUser);

  const handleUpdateUser = (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const { 
      registration_id, username, name, email, phone, country, role, 
      department_id, site_name, password, designation, allowed_devices, 
      work_start_time, work_end_time, monthly_salary, date_of_joining 
    } = req.body;

    try {
      const existingUser = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
      if (!existingUser) return res.status(404).json({ success: false, message: "User not found" });

      db.prepare(`
        UPDATE users 
        SET registration_id = COALESCE(?, registration_id),
            username = COALESCE(?, username),
            name = COALESCE(?, name),
            email = ?,
            phone = ?,
            country = COALESCE(?, country),
            role = COALESCE(?, role),
            department_id = COALESCE(?, department_id),
            site_name = COALESCE(?, site_name),
            password = COALESCE(?, password),
            designation = COALESCE(?, designation),
            allowed_devices = COALESCE(?, allowed_devices),
            work_start_time = COALESCE(?, work_start_time),
            work_end_time = COALESCE(?, work_end_time),
            monthly_salary = COALESCE(?, monthly_salary),
            date_of_joining = COALESCE(?, date_of_joining)
        WHERE id = ?
      `).run(
        registration_id || null, username || null, name ? name.trim() : null, 
        email !== undefined ? email : existingUser.email, 
        phone !== undefined ? phone : existingUser.phone, 
        country !== undefined ? country : null, role !== undefined ? role : null, 
        department_id !== undefined ? department_id : null, site_name !== undefined ? site_name : null, 
        password && password.trim() ? password.trim() : null, designation !== undefined ? designation : null, 
        allowed_devices !== undefined ? Number(allowed_devices) : null, 
        work_start_time !== undefined ? cleanTimeString(work_start_time) : null, 
        work_end_time !== undefined ? cleanTimeString(work_end_time) : null, 
        monthly_salary !== undefined ? Number(monthly_salary) : null, 
        date_of_joining !== undefined ? date_of_joining : null, id
      );

      backupDatabaseToJson();
      triggerLiveSync('update_user');

      const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
      res.json({ success: true, user: updatedUser, message: "Staff updated successfully" });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  };

  app.put("/api/users/:id", handleUpdateUser);
  app.put("/api/super_admin/users/:id", handleUpdateUser);

  app.delete(["/api/users/:id", "/api/super_admin/users/:id"], (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM attendance WHERE user_id = ?").run(id);
      db.prepare("DELETE FROM attendance_requests WHERE user_id = ?").run(id);
      db.prepare("DELETE FROM salary_advances WHERE user_id = ?").run(id);
      db.prepare("DELETE FROM notifications WHERE user_id = ?").run(id);
      db.prepare("DELETE FROM users WHERE id = ?").run(id);

      backupDatabaseToJson();
      triggerLiveSync('delete_user');
      
      res.json({ success: true, message: "User deleted successfully." });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Attendance Punch In / Out
  app.post("/api/attendance/check-in", (req, res) => {
    const { userId, date, time, location, method, sessionId, deviceId, photoUrl, lateReason } = req.body;
    
    if (!location || !location.latitude || !location.longitude) {
      return res.status(400).json({
        success: false,
        message: "GPS Location is compulsory. Please turn on device location to punch attendance."
      });
    }

    const userRow = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
    if (userRow && (Number(userRow.allowed_devices) || 1) === 1 && deviceId) {
      if (userRow.bound_device_id && userRow.bound_device_id !== deviceId) {
        return res.status(403).json({ success: false, message: "Security Violation: Account bound to another device." });
      } else if (!userRow.bound_device_id) {
        db.prepare("UPDATE users SET bound_device_id = ? WHERE id = ?").run(deviceId, userId);
      }
    }

    const existing = db.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?").get(userId, date);
    if (existing) {
      return res.status(400).json({ success: false, message: "Already checked in for today" });
    }

    const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || "").split(',')[0].trim();
    let lat: number | null = location?.latitude || null;
    let lng: number | null = location?.longitude || null;

    let status = "P";
    let isLate = 0;
    let lateMinutes = 0;

    const timeParts = (cleanTimeString(time) || "10:00").split(":");
    const totalMinutes = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1] || "0", 10);
    const standardStartMinutes = 10 * 60;

    if (totalMinutes > standardStartMinutes) {
      status = "L";
      isLate = 1;
      lateMinutes = totalMinutes - standardStartMinutes;
    }

    const cleanTime = cleanTimeString(time);
    const result = db.prepare(`
      INSERT INTO attendance (user_id, session_id, date, check_in, status, location, method, ip_address, latitude, longitude, device_id, photo_url, is_proxy_flagged, is_late, late_minutes, late_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, sessionId || null, date, cleanTime, status, location ? JSON.stringify(location) : null, method || 'app', ip || null, lat, lng, deviceId || null, photoUrl || null, 0, isLate, lateMinutes, lateReason || null);

    appendAttendanceLogLive(userId, date, cleanTime, status, method || 'app', sessionId || null);
    triggerLiveSync('attendance_punch_in');

    res.json({ success: true, id: result.lastInsertRowid, isLate: isLate === 1, lateMinutes, status });
  });

  app.post("/api/attendance/check-out", (req, res) => {
    const { userId, date, time, earlyCheckoutReason } = req.body;
    try {
      const lastRecord = db.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ? ORDER BY id DESC LIMIT 1").get(userId, date) as any;
      if (!lastRecord) return res.status(404).json({ success: false, message: "No check-in record found for today." });
      if (lastRecord.check_out) return res.status(400).json({ success: false, message: "Already checked out today" });

      const cleanOutTime = cleanTimeString(time);
      let overtimeHours = 0;
      if (cleanOutTime) {
        const timeParts = cleanOutTime.split(":");
        const totalOutMinutes = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1] || "0", 10);
        if (totalOutMinutes > (19 * 60)) {
          overtimeHours = Math.round(((totalOutMinutes - (19 * 60)) / 60) * 10) / 10;
        }
      }

      db.prepare(`
        UPDATE attendance 
        SET check_out = ?, early_checkout_reason = ?, overtime_hours = ?
        WHERE id = ?
      `).run(cleanOutTime, earlyCheckoutReason || null, overtimeHours, lastRecord.id);

      appendAttendanceLogLive(userId, date, lastRecord.check_in, lastRecord.status, lastRecord.method, lastRecord.session_id, cleanOutTime);
      triggerLiveSync('attendance_punch_out');

      res.json({ success: true, message: `Checked out at ${cleanOutTime}`, overtimeHours });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Manual Attendance Entry / Override by Admin
  const handleManualAttendance = (req: express.Request, res: express.Response) => {
    const { 
      userId, user_id, registration_id, name, user_name, employee_code,
      date, checkIn, check_in, checkOut, check_out, 
      status, remarks, reason, site_name, location 
    } = req.body;

    const rawTarget = String(userId || user_id || registration_id || employee_code || name || user_name || "").trim();
    const targetDate = date || new Date().toISOString().split('T')[0];

    if (!rawTarget) {
      return res.status(400).json({ success: false, message: "Please select a staff member." });
    }

    try {
      let user = db.prepare(`
        SELECT * FROM users 
        WHERE id = ? 
           OR registration_id = ? 
           OR LOWER(registration_id) = LOWER(?)
           OR LOWER(name) = LOWER(?)
           OR LOWER(username) = LOWER(?)
      `).get(rawTarget, rawTarget, rawTarget, rawTarget, rawTarget) as any;

      if (!user && rawTarget.includes("[")) {
        const extractedCode = rawTarget.split("[")[1]?.split("]")[0]?.trim();
        if (extractedCode) {
          user = db.prepare("SELECT * FROM users WHERE registration_id = ? OR LOWER(registration_id) = LOWER(?)").get(extractedCode, extractedCode) as any;
        }
      }

      if (!user) {
        return res.status(404).json({ success: false, message: "Staff member not found in database." });
      }

      const finalCheckIn = cleanTimeString(checkIn || check_in || "09:00");
      const finalCheckOut = cleanTimeString(checkOut || check_out || "19:00");
      const finalStatus = status || "P";
      const finalReason = remarks || reason || "Manual Punch by Admin";
      const finalSite = site_name || user.site_name || "ARAMUS RUDRA";

      const existing = db.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?").get(user.id, targetDate) as any;

      if (existing) {
        db.prepare(`
          UPDATE attendance 
          SET check_in = ?, check_out = ?, status = ?, late_reason = ?, method = 'manual', location = COALESCE(?, location)
          WHERE id = ?
        `).run(finalCheckIn, finalCheckOut, finalStatus, finalReason, location || finalSite, existing.id);
      } else {
        db.prepare(`
          INSERT INTO attendance (user_id, date, check_in, check_out, status, method, late_reason, location)
          VALUES (?, ?, ?, ?, ?, 'manual', ?, ?)
        `).run(user.id, targetDate, finalCheckIn, finalCheckOut, finalStatus, finalReason, location || finalSite);
      }

      backupDatabaseToJson();
      appendAttendanceLogLive(user.id, targetDate, finalCheckIn, finalStatus, 'manual', null, finalCheckOut || undefined);
      triggerLiveSync('manual_attendance');

      return res.json({ success: true, message: `Attendance saved successfully for ${user.name}!` });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message });
    }
  };

  app.all([
    "/api/attendance/manual",
    "/api/super_admin/attendance/manual",
    "/api/attendance/override",
    "/api/super_admin/attendance/override"
  ], handleManualAttendance);

  // Sheet Settings API
  app.get("/api/sheet-settings", (req, res) => {
    try {
      let settings = db.prepare("SELECT * FROM sheet_settings WHERE id = 1").get() as any;
      if (!settings) {
        db.prepare("INSERT OR IGNORE INTO sheet_settings (id, users_sheet_name, attendance_sheet_name, web_app_url, sync_enabled, is_locked) VALUES (1, 'Users', 'Attendance', ?, 1, 1)").run(DEFAULT_WEB_APP_URL);
        settings = db.prepare("SELECT * FROM sheet_settings WHERE id = 1").get();
      }
      res.json(settings || {});
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/sheet-settings", (req, res) => {
    const { spreadsheet_id, users_sheet_name, attendance_sheet_name, web_app_url, sync_enabled, is_locked } = req.body;
    try {
      const cleanUrl = web_app_url ? String(web_app_url).trim() : DEFAULT_WEB_APP_URL;
      db.prepare(`
        INSERT INTO sheet_settings (id, spreadsheet_id, users_sheet_name, attendance_sheet_name, web_app_url, sync_enabled, is_locked)
        VALUES (1, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          spreadsheet_id = excluded.spreadsheet_id,
          users_sheet_name = excluded.users_sheet_name,
          attendance_sheet_name = excluded.attendance_sheet_name,
          web_app_url = COALESCE(excluded.web_app_url, sheet_settings.web_app_url),
          sync_enabled = excluded.sync_enabled,
          is_locked = excluded.is_locked
      `).run(
        spreadsheet_id || null, 
        users_sheet_name || 'Users', 
        attendance_sheet_name || 'Attendance', 
        cleanUrl, 
        sync_enabled !== undefined ? (sync_enabled ? 1 : 0) : 1, 
        is_locked !== undefined ? (is_locked ? 1 : 0) : 1
      );

      backupDatabaseToJson();
      res.json({ success: true, message: "Sheet settings saved permanently!" });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/sheet-settings/test", async (req, res) => {
    const { web_app_url } = req.body;
    const settings = db.prepare("SELECT * FROM sheet_settings WHERE id = 1").get() as any;
    const targetUrl = web_app_url ? String(web_app_url).trim() : (settings?.web_app_url || DEFAULT_WEB_APP_URL);

    if (!targetUrl) return res.status(400).json({ success: false, message: "No Deployment URL provided." });

    try {
      const startTime = Date.now();
      const pingUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=ping&_t=${startTime}`;
      const response = await fetch(pingUrl, { redirect: "follow" });
      const latencyMs = Date.now() - startTime;
      const data = await response.json();

      res.json({ success: true, latencyMs, data, message: "Connection verified!" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Universal Push & Export All Data API
  const handleExportAllToSheets = async (req: express.Request, res: express.Response) => {
    try {
      const result = await syncFullDatabaseToSheets();
      if (result.success) {
        return res.json({ success: true, message: "Synchronized full database to Google Sheets!" });
      }
      return res.status(500).json({ success: false, message: result.message || "Sync failed" });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Export error" });
    }
  };

  app.all([
    "/api/sheet-settings/export-all",
    "/api/super_admin/sheet-settings/export-all",
    "/api/sheet-settings/export",
    "/api/super_admin/sheet-settings/export"
  ], handleExportAllToSheets);

  app.post("/api/sheet-settings/pull-all", async (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings WHERE id = 1").get() as any;
      const targetUrl = settings?.web_app_url || DEFAULT_WEB_APP_URL;

      const response = await fetch(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getAllData`, { redirect: "follow" });
      const resJson = await response.json();

      if (resJson.success && resJson.data) {
        const d = resJson.data;

        db.prepare(`
          INSERT INTO sheet_settings (id, web_app_url, sync_enabled, is_locked)
          VALUES (1, ?, 1, 1)
          ON CONFLICT(id) DO UPDATE SET web_app_url = excluded.web_app_url
        `).run(targetUrl);

        // 1. Restore Users
        if (Array.isArray(d.users) && d.users.length > 0) {
          for (const u of d.users) {
            const empName = u.name || u.full_name || u['Full Name'];
            const regCode = u.registration_id || u.employee_code || u['Employee Code'] || u.user_id || u['User ID'];
            if (empName && u.role !== 'super_admin') {
              try {
                db.prepare(`
                  INSERT INTO users (registration_id, name, username, email, phone, role, site_name, designation, monthly_salary, password, work_start_time, work_end_time, allowed_devices, bound_device_id)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(registration_id) DO UPDATE SET
                    name = excluded.name,
                    username = excluded.username,
                    email = excluded.email,
                    phone = excluded.phone,
                    role = excluded.role,
                    site_name = excluded.site_name,
                    designation = excluded.designation,
                    monthly_salary = excluded.monthly_salary,
                    password = COALESCE(excluded.password, users.password),
                    work_start_time = excluded.work_start_time,
                    work_end_time = excluded.work_end_time,
                    allowed_devices = COALESCE(excluded.allowed_devices, users.allowed_devices)
                `).run(
                  regCode || null, empName, u.username || null, u.email || null, u.phone || null,
                  u.role || 'user', u.site_name || u.branch___site || 'ARAMUS RUDRA', u.designation || 'Staff',
                  Number(u.monthly_salary || u.monthly_salary_____) || 0, u.password || 'password123',
                  cleanTimeString(u.work_start_time || u.work_start || u['Shift Start']) || '10:00',
                  cleanTimeString(u.work_end_time || u.work_end || u['Shift End']) || '19:00',
                  Number(u.allowed_devices) || 1, u.bound_device_id || null
                );
              } catch (_) {}
            }
          }
        }

        // 2. Restore Sites
        if (Array.isArray(d.sites) && d.sites.length > 0) {
          for (const s of d.sites) {
            const sName = s.name || s.site_name || s['Site Name'];
            if (sName) {
              try {
                db.prepare(`
                  INSERT INTO sites (name, address, latitude, longitude, radius, work_start_time, work_end_time)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(name) DO UPDATE SET
                    address = excluded.address,
                    latitude = excluded.latitude,
                    longitude = excluded.longitude,
                    radius = excluded.radius,
                    work_start_time = excluded.work_start_time,
                    work_end_time = excluded.work_end_time
                `).run(
                  sName, s.address || s['Address'] || '', Number(s.latitude || s['Latitude']) || 19.04574,
                  Number(s.longitude || s['Longitude']) || 73.08025,
                  Number(s.radius || s.radius__meters_ || s['Radius (Meters)']) || 150,
                  cleanTimeString(s.work_start_time || s.shift_start || s['Shift Start']) || '10:00',
                  cleanTimeString(s.work_end_time || s.shift_end || s['Shift End']) || '19:00'
                );
              } catch (_) {}
            }
          }
        }

        // 3. Restore Attendance
        if (Array.isArray(d.attendance) && d.attendance.length > 0) {
          for (const a of d.attendance) {
            const regId = a.registration_id || a.employee_code || a['Employee Code'];
            const aName = a.name || a['Name'];
            const user = db.prepare("SELECT id FROM users WHERE registration_id = ? OR name = ?").get(regId, aName) as any;
            if (user && (a.date || a['Date'])) {
              const rawDate = a.date || a['Date'];
              const attDate = String(rawDate).includes("T") ? rawDate.split("T")[0] : rawDate;
              const existing = db.prepare("SELECT id FROM attendance WHERE user_id = ? AND date = ?").get(user.id, attDate);
              if (!existing) {
                try {
                  db.prepare(`
                    INSERT INTO attendance (user_id, date, check_in, check_out, status, method, location, late_minutes, overtime_hours)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `).run(
                    user.id, attDate,
                    cleanTimeString(a.check_in || a['Check In']),
                    cleanTimeString(a.check_out || a['Check Out']),
                    a.status === 'Present' ? 'P' : (a.status === 'Late' ? 'L' : (a.status || 'P')),
                    a.method || 'app', a.site_name || a.branch___site || 'ARAMUS RUDRA',
                    Number(a.late_minutes || a.late__min_) || 0, Number(a.overtime_hours || a.overtime__hrs_) || 0
                  );
                } catch (_) {}
              }
            }
          }
        }

        backupDatabaseToJson();
        return res.json({ success: true, message: "Successfully pulled and restored all data from Google Sheets!" });
      }
      return res.status(500).json({ success: false, message: "Could not parse response from Google Sheet." });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // Universal Sites & Geofence APIs
  app.get("/api/sites", (req, res) => {
    res.json(db.prepare("SELECT * FROM sites ORDER BY id ASC").all());
  });

  const handleUniversalSiteSave = (req: express.Request, res: express.Response) => {
    const { id, name, site_name, address, latitude, longitude, radius, geofence_radius, work_start_time, work_end_time } = req.body;
    const targetId = req.params.id || id;
    const targetName = (name || site_name || "").trim();

    const incomingRadius = radius !== undefined && radius !== null && radius !== '' 
      ? Number(radius) 
      : (geofence_radius !== undefined && geofence_radius !== null && geofence_radius !== '' ? Number(geofence_radius) : null);

    try {
      let existingSite: any = null;
      if (targetId) {
        existingSite = db.prepare("SELECT * FROM sites WHERE id = ?").get(targetId);
      }
      if (!existingSite && targetName) {
        existingSite = db.prepare("SELECT * FROM sites WHERE LOWER(name) = LOWER(?)").get(targetName);
      }

      if (existingSite) {
        const cleanLat = (latitude !== undefined && latitude !== null && latitude !== '') ? Number(latitude) : existingSite.latitude;
        const cleanLng = (longitude !== undefined && longitude !== null && longitude !== '') ? Number(longitude) : existingSite.longitude;
        const cleanRadius = incomingRadius !== null && !isNaN(incomingRadius) ? incomingRadius : (existingSite.radius || 150);

        db.prepare(`
          UPDATE sites 
          SET name = COALESCE(?, name),
              address = COALESCE(?, address),
              latitude = ?,
              longitude = ?,
              radius = ?,
              work_start_time = COALESCE(?, work_start_time),
              work_end_time = COALESCE(?, work_end_time)
          WHERE id = ?
        `).run(
          targetName || null,
          address !== undefined ? address : null,
          cleanLat,
          cleanLng,
          cleanRadius,
          cleanTimeString(work_start_time) || null,
          cleanTimeString(work_end_time) || null,
          existingSite.id
        );

        backupDatabaseToJson();
        triggerLiveSync('update_site');

        const updated = db.prepare("SELECT * FROM sites WHERE id = ?").get(existingSite.id);
        return res.json({ success: true, site: updated, sites: db.prepare("SELECT * FROM sites").all(), message: "Site geofence updated successfully!" });
      } else {
        if (!targetName) {
          return res.status(400).json({ success: false, message: "Site Name is required" });
        }
        const cleanLat = latitude ? Number(latitude) : 19.04574;
        const cleanLng = longitude ? Number(longitude) : 73.08025;
        const cleanRadius = incomingRadius !== null && !isNaN(incomingRadius) ? incomingRadius : 150;

        const result = db.prepare(`
          INSERT INTO sites (name, address, latitude, longitude, radius, work_start_time, work_end_time)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          targetName,
          address || null,
          cleanLat,
          cleanLng,
          cleanRadius,
          cleanTimeString(work_start_time) || '10:00',
          cleanTimeString(work_end_time) || '19:00'
        );

        backupDatabaseToJson();
        triggerLiveSync('create_site');

        const newSite = db.prepare("SELECT * FROM sites WHERE id = ?").get(result.lastInsertRowid);
        return res.json({ success: true, id: result.lastInsertRowid, site: newSite, sites: db.prepare("SELECT * FROM sites").all(), message: "Site created successfully!" });
      }
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message });
    }
  };

  app.all([
    "/api/sites",
    "/api/super_admin/sites",
    "/api/sites/:id",
    "/api/super_admin/sites/:id",
    "/api/sites/:id/update"
  ], (req, res, next) => {
    if (req.method === 'GET') return next();
    if (req.method === 'DELETE') {
      try {
        db.prepare("DELETE FROM sites WHERE id = ?").run(req.params.id);
        backupDatabaseToJson();
        triggerLiveSync('delete_site');
        return res.json({ success: true, message: "Site deleted successfully" });
      } catch (e: any) {
        return res.status(500).json({ success: false, message: e.message });
      }
    }
    return handleUniversalSiteSave(req, res);
  });

  app.get("/api/geofence-settings", (req, res) => {
    res.json(db.prepare("SELECT * FROM geofence_settings WHERE id = 1").get() || {});
  });

  app.post("/api/geofence-settings", (req, res) => {
    const { enabled, latitude, longitude, radius } = req.body;
    db.prepare("UPDATE geofence_settings SET enabled = ?, latitude = ?, longitude = ?, radius = ? WHERE id = 1").run(enabled ? 1 : 0, Number(latitude), Number(longitude), Number(radius));
    triggerLiveSync('geofencing');
    res.json({ success: true, message: "Geofence settings updated." });
  });

  // Requests / Approvals Workflow
  app.get("/api/attendance/requests", (req, res) => {
    const requests = db.prepare(`
      SELECT r.*, u.name as user_name, u.registration_id, u.site_name as user_site_name, u.designation
      FROM attendance_requests r
      JOIN users u ON r.user_id = u.id
      ORDER BY r.created_at DESC
    `).all();
    res.json(requests);
  });

  app.post("/api/attendance/request", (req, res) => {
    const { userId, date, startDate, endDate, checkIn, checkOut, reason, siteName, type, halfDaySlot } = req.body;
    try {
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
      if (!user) return res.status(404).json({ success: false, message: "User not found" });

      const targetDate = date || startDate || new Date().toISOString().split('T')[0];
      const result = db.prepare(`
        INSERT INTO attendance_requests (user_id, date, start_date, end_date, check_in, check_out, reason, site_name, type, half_day_slot, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
      `).run(userId, targetDate, startDate || targetDate, endDate || targetDate, cleanTimeString(checkIn) || null, cleanTimeString(checkOut) || null, reason || null, siteName || user.site_name || null, type || 'CORRECTION', halfDaySlot || null);

      backupDatabaseToJson();
      triggerLiveSync('requests');
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/attendance/requests/:id/approve", (req, res) => {
    const { id } = req.params;
    const { adminComment, actionedBy } = req.body;
    try {
      const request = db.prepare("SELECT * FROM attendance_requests WHERE id = ?").get(id) as any;
      if (!request) return res.status(404).json({ success: false, message: "Request not found." });

      db.prepare(`
        UPDATE attendance_requests 
        SET status = 'APPROVED', admin_comment = ?, actioned_at = CURRENT_TIMESTAMP, actioned_by = ?
        WHERE id = ?
      `).run(adminComment || 'Approved', actionedBy || 'Admin', id);

      backupDatabaseToJson();
      triggerLiveSync('approve_request');
      res.json({ success: true, message: "Request approved." });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Master Designations CRUD API
  app.get("/api/designations", (req, res) => {
    try {
      res.json(db.prepare("SELECT * FROM designations ORDER BY id ASC").all());
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/designations", (req, res) => {
    const { name } = req.body;
    const cleanName = (name || "").trim();
    if (!cleanName) {
      return res.status(400).json({ success: false, message: "Designation name is required" });
    }
    try {
      const stmt = db.prepare("INSERT INTO designations (name) VALUES (?)");
      const result = stmt.run(cleanName);
      backupDatabaseToJson();
      triggerLiveSync('create_designation');
      const newItem = db.prepare("SELECT * FROM designations WHERE id = ?").get(result.lastInsertRowid);
      res.json({ success: true, id: result.lastInsertRowid, item: newItem, message: "Post added successfully!" });
    } catch (e: any) {
      const existing = db.prepare("SELECT * FROM designations WHERE LOWER(name) = LOWER(?)").get(cleanName);
      if (existing) {
        return res.json({ success: true, id: (existing as any).id, item: existing, message: "Post already exists" });
      }
      res.status(400).json({ success: false, message: e.message });
    }
  });

  app.put("/api/designations/:id", (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    const cleanName = (name || "").trim();
    if (!cleanName) {
      return res.status(400).json({ success: false, message: "Designation name is required" });
    }
    try {
      db.prepare("UPDATE designations SET name = ? WHERE id = ?").run(cleanName, id);
      backupDatabaseToJson();
      triggerLiveSync('update_designation');
      res.json({ success: true, message: "Designation updated successfully" });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.delete("/api/designations/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM designations WHERE id = ?").run(id);
      backupDatabaseToJson();
      triggerLiveSync('delete_designation');
      res.json({ success: true, message: "Designation deleted successfully" });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get("/api/holidays", (req, res) => {
    res.json(db.prepare("SELECT * FROM holidays ORDER BY date ASC").all());
  });

  app.get("/api/departments", (req, res) => {
    res.json(db.prepare("SELECT * FROM departments").all());
  });

  // History & Reports
  app.get("/api/attendance/history/:userId", (req, res) => {
    const history = db.prepare("SELECT * FROM attendance WHERE user_id = ? ORDER BY date DESC").all(req.params.userId);
    res.json(history);
  });

  app.get("/api/super_admin/attendance", (req, res) => {
    const records = db.prepare(`
      SELECT a.*, u.name as user_name, u.registration_id, u.site_name as user_site_name, u.designation
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      ORDER BY a.date DESC, a.check_in DESC
    `).all();
    res.json(records);
  });

  // Vite SPA Handler
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
