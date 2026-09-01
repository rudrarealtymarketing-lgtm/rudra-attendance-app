import express from "express";
import { createServer as createViteServer } from "vite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { google } from "googleapis";

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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    spreadsheet_id TEXT,
    users_sheet_name TEXT DEFAULT 'Users',
    attendance_sheet_name TEXT DEFAULT 'Attendance',
    service_account_json TEXT,
    web_app_url TEXT,
    sync_enabled INTEGER DEFAULT 0,
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
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    radius REAL DEFAULT 150 NOT NULL,
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
    check_in TEXT,
    check_out TEXT,
    status TEXT DEFAULT 'PENDING',
    reason TEXT,
    site_name TEXT,
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

if (!userTableInfo.some(col => col.name === 'username')) {
  runMigration("add username to users", "ALTER TABLE users ADD COLUMN username TEXT");
}

if (!userTableInfo.some(col => col.name === 'work_start_time')) {
  runMigration("add work_start_time to users", "ALTER TABLE users ADD COLUMN work_start_time TEXT DEFAULT '10:00'");
}

if (!userTableInfo.some(col => col.name === 'work_end_time')) {
  runMigration("add work_end_time to users", "ALTER TABLE users ADD COLUMN work_end_time TEXT DEFAULT '19:00'");
}

if (!userTableInfo.some(col => col.name === 'registration_id')) {
  runMigration("add registration_id", "ALTER TABLE users ADD COLUMN registration_id TEXT UNIQUE");
}

if (!userTableInfo.some(col => col.name === 'country')) {
  runMigration("add country", "ALTER TABLE users ADD COLUMN country TEXT");
}

if (!userTableInfo.some(col => col.name === 'site_name')) {
  runMigration("add site_name to users", "ALTER TABLE users ADD COLUMN site_name TEXT");
}

if (!userTableInfo.some(col => col.name === 'password')) {
  runMigration("add password to users", "ALTER TABLE users ADD COLUMN password TEXT");
}

if (!userTableInfo.some(col => col.name === 'bound_device_id')) {
  runMigration("add bound_device_id", "ALTER TABLE users ADD COLUMN bound_device_id TEXT");
}

if (!userTableInfo.some(col => col.name === 'last_device_info')) {
  runMigration("add last_device_info", "ALTER TABLE users ADD COLUMN last_device_info TEXT");
}

if (!userTableInfo.some(col => col.name === 'monthly_salary')) {
  runMigration("add monthly_salary", "ALTER TABLE users ADD COLUMN monthly_salary REAL DEFAULT 0");
}

if (!userTableInfo.some(col => col.name === 'designation')) {
  runMigration("add designation", "ALTER TABLE users ADD COLUMN designation TEXT");
}

if (!userTableInfo.some(col => col.name === 'date_of_joining')) {
  runMigration("add date_of_joining", "ALTER TABLE users ADD COLUMN date_of_joining TEXT");
}

if (!userTableInfo.some(col => col.name === 'date_of_birth')) {
  runMigration("add date_of_birth", "ALTER TABLE users ADD COLUMN date_of_birth TEXT");
}

if (!userTableInfo.some(col => col.name === 'emergency_contact')) {
  runMigration("add emergency_contact", "ALTER TABLE users ADD COLUMN emergency_contact TEXT");
}

if (!userTableInfo.some(col => col.name === 'bank_account')) {
  runMigration("add bank_account", "ALTER TABLE users ADD COLUMN bank_account TEXT");
}

if (!userTableInfo.some(col => col.name === 'ifsc_code')) {
  runMigration("add ifsc_code", "ALTER TABLE users ADD COLUMN ifsc_code TEXT");
}

if (!userTableInfo.some(col => col.name === 'upi_id')) {
  runMigration("add upi_id", "ALTER TABLE users ADD COLUMN upi_id TEXT");
}

if (!userTableInfo.some(col => col.name === 'pan_aadhaar')) {
  runMigration("add pan_aadhaar", "ALTER TABLE users ADD COLUMN pan_aadhaar TEXT");
}

if (!userTableInfo.some(col => col.name === 'allowed_devices')) {
  runMigration("add allowed_devices", "ALTER TABLE users ADD COLUMN allowed_devices INTEGER DEFAULT 1");
}

if (!userTableInfo.some(col => col.name === 'avatar_url')) {
  runMigration("add avatar_url", "ALTER TABLE users ADD COLUMN avatar_url TEXT");
}

if (!userTableInfo.some(col => col.name === 'current_address')) {
  runMigration("add current_address", "ALTER TABLE users ADD COLUMN current_address TEXT");
}

if (!userTableInfo.some(col => col.name === 'marital_status')) {
  runMigration("add marital_status", "ALTER TABLE users ADD COLUMN marital_status TEXT");
}

if (!userTableInfo.some(col => col.name === 'documents')) {
  runMigration("add documents", "ALTER TABLE users ADD COLUMN documents TEXT");
}

const siteTableInfo = db.prepare("PRAGMA table_info(sites)").all() as any[];
if (!siteTableInfo.some(col => col.name === 'address')) {
  runMigration("add address to sites", "ALTER TABLE sites ADD COLUMN address TEXT");
}
if (!siteTableInfo.some(col => col.name === 'work_start_time')) {
  runMigration("add work_start_time to sites", "ALTER TABLE sites ADD COLUMN work_start_time TEXT DEFAULT '10:00'");
}
if (!siteTableInfo.some(col => col.name === 'work_end_time')) {
  runMigration("add work_end_time to sites", "ALTER TABLE sites ADD COLUMN work_end_time TEXT DEFAULT '19:00'");
}

const reqTableInfo = db.prepare("PRAGMA table_info(attendance_requests)").all() as any[];
if (!reqTableInfo.some(col => col.name === 'type')) {
  runMigration("add type to attendance_requests", "ALTER TABLE attendance_requests ADD COLUMN type TEXT DEFAULT 'CORRECTION'");
}
if (!reqTableInfo.some(col => col.name === 'start_date')) {
  runMigration("add start_date to attendance_requests", "ALTER TABLE attendance_requests ADD COLUMN start_date TEXT");
}
if (!reqTableInfo.some(col => col.name === 'end_date')) {
  runMigration("add end_date to attendance_requests", "ALTER TABLE attendance_requests ADD COLUMN end_date TEXT");
}
if (!reqTableInfo.some(col => col.name === 'half_day_slot')) {
  runMigration("add half_day_slot to attendance_requests", "ALTER TABLE attendance_requests ADD COLUMN half_day_slot TEXT");
}
if (!reqTableInfo.some(col => col.name === 'admin_comment')) {
  runMigration("add admin_comment to attendance_requests", "ALTER TABLE attendance_requests ADD COLUMN admin_comment TEXT");
}
if (!reqTableInfo.some(col => col.name === 'actioned_at')) {
  runMigration("add actioned_at to attendance_requests", "ALTER TABLE attendance_requests ADD COLUMN actioned_at DATETIME");
}
if (!reqTableInfo.some(col => col.name === 'actioned_by')) {
  runMigration("add actioned_by to attendance_requests", "ALTER TABLE attendance_requests ADD COLUMN actioned_by TEXT");
}

const attTableInfo = db.prepare("PRAGMA table_info(attendance)").all() as any[];
if (!attTableInfo.some(col => col.name === 'early_checkout_reason')) {
  runMigration("add early_checkout_reason to attendance", "ALTER TABLE attendance ADD COLUMN early_checkout_reason TEXT");
}
if (!attTableInfo.some(col => col.name === 'late_reason')) {
  runMigration("add late_reason to attendance", "ALTER TABLE attendance ADD COLUMN late_reason TEXT");
}
if (!attTableInfo.some(col => col.name === 'is_late')) {
  runMigration("add is_late to attendance", "ALTER TABLE attendance ADD COLUMN is_late INTEGER DEFAULT 0");
}
if (!attTableInfo.some(col => col.name === 'late_minutes')) {
  runMigration("add late_minutes to attendance", "ALTER TABLE attendance ADD COLUMN late_minutes INTEGER DEFAULT 0");
}
if (!attTableInfo.some(col => col.name === 'overtime_hours')) {
  runMigration("add overtime_hours to attendance", "ALTER TABLE attendance ADD COLUMN overtime_hours REAL DEFAULT 0");
}

// Backfill empty passwords with registration_id or 'password123'
try {
  db.prepare(`
    UPDATE users 
    SET password = COALESCE(registration_id, 'password123') 
    WHERE password IS NULL OR password = ''
  `).run();
} catch (backfillErr: any) {
  console.error("Failed to backfill passwords:", backfillErr.message);
}

const sessionTableInfo = db.prepare("PRAGMA table_info(sessions)").all() as any[];
if (!sessionTableInfo.some(col => col.name === 'site_name')) {
  runMigration("add site_name to sessions", "ALTER TABLE sessions ADD COLUMN site_name TEXT");
}

const attendanceTableInfo = db.prepare("PRAGMA table_info(attendance)").all() as any[];
if (!attendanceTableInfo.some(col => col.name === 'session_id')) {
  runMigration("add session_id", "ALTER TABLE attendance ADD COLUMN session_id INTEGER REFERENCES sessions(id)");
}

if (!attendanceTableInfo.some(col => col.name === 'ip_address')) {
  runMigration("add ip_address", "ALTER TABLE attendance ADD COLUMN ip_address TEXT");
}

if (!attendanceTableInfo.some(col => col.name === 'latitude')) {
  runMigration("add latitude", "ALTER TABLE attendance ADD COLUMN latitude REAL");
}

if (!attendanceTableInfo.some(col => col.name === 'longitude')) {
  runMigration("add longitude", "ALTER TABLE attendance ADD COLUMN longitude REAL");
}

if (!attendanceTableInfo.some(col => col.name === 'device_id')) {
  runMigration("add device_id", "ALTER TABLE attendance ADD COLUMN device_id TEXT");
}

if (!attendanceTableInfo.some(col => col.name === 'photo_url')) {
  runMigration("add photo_url", "ALTER TABLE attendance ADD COLUMN photo_url TEXT");
}

if (!attendanceTableInfo.some(col => col.name === 'is_proxy_flagged')) {
  runMigration("add is_proxy_flagged", "ALTER TABLE attendance ADD COLUMN is_proxy_flagged INTEGER DEFAULT 0");
}

const settingsTableInfo = db.prepare("PRAGMA table_info(sheet_settings)").all() as any[];
if (!settingsTableInfo.some(col => col.name === 'web_app_url')) {
  runMigration("add web_app_url", "ALTER TABLE sheet_settings ADD COLUMN web_app_url TEXT");
}
if (!settingsTableInfo.some(col => col.name === 'is_locked')) {
  runMigration("add is_locked", "ALTER TABLE sheet_settings ADD COLUMN is_locked INTEGER DEFAULT 1");
}

// Seed initial data if empty
// Seed initial data if empty or missing default accounts
const existingAdmin = db.prepare("SELECT id FROM users WHERE role = 'super_admin' OR registration_id = 'EMP-001' OR registration_id = 'ADMIN-01'").get();
if (!existingAdmin) {
  db.prepare("INSERT INTO departments (name, description) VALUES (?, ?)").run("Executive & Management", "Executive Leadership & Board");
  db.prepare("INSERT INTO users (registration_id, name, email, role, department_id, password, designation, allowed_devices) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run("ADMIN-01", "Abhishek Bhatt (Admin)", "admin@rudra.com", "super_admin", 1, "admin123", "Chief Executive Officer (CEO) / Managing Director (MD)", 99);
}

const existingDirector = db.prepare("SELECT id FROM users WHERE registration_id = 'DIR-001' OR name LIKE '%Director%'").get();
if (!existingDirector) {
  db.prepare("INSERT INTO users (registration_id, name, email, role, password, designation, allowed_devices) VALUES (?, ?, ?, ?, ?, ?, ?)").run("DIR-001", "StaffSync Director", "director@rudra.com", "director", "director123", "Executive Director / Partner", 8);
}

const existingTest = db.prepare("SELECT id FROM users WHERE registration_id = 'TEST-001'").get();
if (!existingTest) {
  db.prepare("INSERT INTO users (registration_id, name, email, role, password, designation, allowed_devices) VALUES (?, ?, ?, ?, ?, ?, ?)").run("TEST-001", "Testing Employee", "test@rudra.com", "user", "test1234", "Site Engineer / Civil Engineer", 99);
}

const existingStaff = db.prepare("SELECT id FROM users WHERE registration_id = 'EMP-1001'").get();
if (!existingStaff) {
  db.prepare("INSERT INTO users (registration_id, name, email, role, password, designation, allowed_devices, site_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run("EMP-1001", "John Doe", "john@example.com", "user", "user123", "Sales Executive / Associate", 1, "Headquarters");
}

const settingsCount = db.prepare("SELECT COUNT(*) as count FROM sheet_settings").get() as { count: number };
if (settingsCount.count === 0) {
  db.prepare("INSERT INTO sheet_settings (users_sheet_name, attendance_sheet_name, sync_enabled) VALUES (?, ?, ?)").run("Users", "Attendance", 0);
}

const geofenceSettingsCount = db.prepare("SELECT COUNT(*) as count FROM geofence_settings").get() as { count: number };
if (geofenceSettingsCount.count === 0) {
  // Default to San Francisco (or any coordinate) but disabled
  db.prepare("INSERT INTO geofence_settings (id, enabled, latitude, longitude, radius) VALUES (1, 0, 37.7749, -122.4194, 150.0)").run();
}

const sitesCount = db.prepare("SELECT COUNT(*) as count FROM sites").get() as { count: number };
if (sitesCount.count === 0) {
  const defaultSites = [
    { name: 'Headquarters', lat: 37.7749, lng: -122.4194, rad: 150 },
    { name: 'Branch Office Alpha', lat: 37.7849, lng: -122.4094, rad: 100 },
    { name: 'Branch Office Beta', lat: 37.7649, lng: -122.4294, rad: 200 },
    { name: 'Downtown Hub', lat: 37.7949, lng: -122.3994, rad: 150 },
    { name: 'Warehouse East', lat: 37.7549, lng: -122.3894, rad: 300 }
  ];
  const stmt = db.prepare("INSERT INTO sites (name, latitude, longitude, radius) VALUES (?, ?, ?, ?)");
  for (const s of defaultSites) {
    try {
      stmt.run(s.name, s.lat, s.lng, s.rad);
    } catch (e) {
      console.error("Failed to seed site:", s.name, e);
    }
  }
}

// Seed initial designations if empty
const desigCount = db.prepare("SELECT COUNT(*) as count FROM designations").get() as { count: number };
if (desigCount.count === 0) {
  const defaultDesignations = [
    "Chief Executive Officer (CEO) / Managing Director (MD)",
    "Chief Operating Officer (COO)",
    "Chief Technology Officer (CTO)",
    "Chief Financial Officer (CFO)",
    "Vice President (VP) - Operations",
    "Director - Projects & Infrastructure",
    "Executive Director / Partner",
    "Head of Sales & Business Development",
    "Senior Sales Manager",
    "Sales Executive / Associate",
    "Business Development Executive (BDE)",
    "Field Sales Officer",
    "Head of Finance & Accounts",
    "Senior Accountant",
    "Junior Accountant",
    "Billing & Audit Executive",
    "Cashier / Treasury Officer",
    "CRM Manager",
    "Customer Success Executive",
    "Client Relations Officer",
    "Telecaller / Support Representative",
    "Head of Legal & Regulatory Affairs",
    "Senior Legal Associate",
    "Compliance & Liaison Officer",
    "Land Acquisition & Liaison Executive",
    "Marketing Manager",
    "Digital Marketing Specialist",
    "Graphic Designer & Content Creator",
    "Brand & Public Relations (PR) Executive",
    "Chief Project Manager (CPM)",
    "Senior Project Engineer",
    "Site Engineer / Civil Engineer",
    "Quality Control (QC) & Safety Engineer",
    "MEP (Mechanical, Electrical, Plumbing) Engineer",
    "Senior Architect / Landscape Designer",
    "Interior Designer / 3D Visualizer",
    "Quantity Surveyor & Estimation Engineer",
    "Store & Material Procurement Manager",
    "HR Manager",
    "HR Generalist / Executive",
    "Admin & Facilities Manager",
    "Front Desk & Office Coordinator",
    "Security & Transport In-Charge"
  ];
  const desigStmt = db.prepare("INSERT OR IGNORE INTO designations (name) VALUES (?)");
  for (const d of defaultDesignations) {
    try {
      desigStmt.run(d);
    } catch (e) {
      console.error("Failed to seed designation:", d, e);
    }
  }
}

// Durable File Backup & Auto-Recovery Mechanism
const BACKUP_FILE = path.join(process.cwd(), "app_data_backup.json");

function backupDatabaseToJson() {
  try {
    const backupData = {
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

function restoreDatabaseFromJson() {
  try {
    if (!fs.existsSync(BACKUP_FILE)) {
      // First time: initialize backup file
      backupDatabaseToJson();
      return;
    }
    const raw = fs.readFileSync(BACKUP_FILE, "utf8");
    if (!raw || raw.trim().length === 0) return;
    const backupData = JSON.parse(raw);

    // Restore users if any missing
    if (Array.isArray(backupData.users) && backupData.users.length > 0) {
      const existingUsers = db.prepare("SELECT id, registration_id, email, username FROM users").all() as any[];
      const existingRegIds = new Set(existingUsers.map(u => u.registration_id).filter(Boolean));
      const existingEmails = new Set(existingUsers.map(u => u.email).filter(Boolean));
      const existingIds = new Set(existingUsers.map(u => u.id));

      const insertUserStmt = db.prepare(`
        INSERT OR IGNORE INTO users (
          id, registration_id, username, name, email, phone, country, role, 
          department_id, password, work_start_time, work_end_time, site_name, 
          bound_device_id, last_device_info, monthly_salary, designation, 
          date_of_joining, emergency_contact, bank_account, ifsc_code, upi_id, 
          pan_aadhaar, allowed_devices, avatar_url, current_address, marital_status, 
          documents, date_of_birth, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, 
          ?, ?, ?, ?, ?, 
          ?, ?, ?, ?, 
          ?, ?, ?, ?, ?, 
          ?, ?, ?, ?, ?, 
          ?, ?, ?
        )
      `);

      for (const u of backupData.users) {
        if (!existingIds.has(u.id) && (!u.registration_id || !existingRegIds.has(u.registration_id))) {
          try {
            insertUserStmt.run(
              u.id || null, 
              u.registration_id || null, 
              u.username || null, 
              u.name, 
              u.email || null, 
              u.phone || null, 
              u.country || null, 
              u.role || 'user',
              u.department_id || null, 
              u.password || 'pass123', 
              u.work_start_time || '10:00', 
              u.work_end_time || '19:00', 
              u.site_name || 'Headquarters',
              u.bound_device_id || null, 
              u.last_device_info || null, 
              u.monthly_salary || 0, 
              u.designation || 'Staff',
              u.date_of_joining || null, 
              u.emergency_contact || null, 
              u.bank_account || null, 
              u.ifsc_code || null, 
              u.upi_id || null,
              u.pan_aadhaar || null, 
              u.allowed_devices || 1, 
              u.avatar_url || null, 
              u.current_address || null, 
              u.marital_status || null,
              u.documents || null, 
              u.date_of_birth || null, 
              u.created_at || new Date().toISOString()
            );
            console.log(`Restored user from persistent backup: ${u.name} (${u.registration_id})`);
          } catch (e: any) {
            console.error(`Failed to restore user ${u.name}:`, e.message);
          }
        }
      }
    }

    // Restore designations
    if (Array.isArray(backupData.designations)) {
      const desigStmt = db.prepare("INSERT OR IGNORE INTO designations (name) VALUES (?)");
      for (const d of backupData.designations) {
        if (d && d.name) {
          try { desigStmt.run(d.name); } catch (_) {}
        }
      }
    }

    // Restore sites
    if (Array.isArray(backupData.sites)) {
      const siteStmt = db.prepare("INSERT OR IGNORE INTO sites (name, address, latitude, longitude, radius) VALUES (?, ?, ?, ?, ?)");
      for (const s of backupData.sites) {
        if (s && s.name && s.latitude && s.longitude) {
          try { siteStmt.run(s.name, s.address || null, s.latitude, s.longitude, s.radius || 150); } catch (_) {}
        }
      }
    }
    
    // Always refresh backup after startup sync
    backupDatabaseToJson();
    console.log("Persistent data snapshot verified & synced");
  } catch (err: any) {
    console.error("Failed to restore from JSON backup:", err.message);
  }
}

// Run recovery / sync on boot
restoreDatabaseFromJson();

function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

async function fetchWithRedirect(url: string, options: any = {}): Promise<Response> {
  const maxRedirects = 5;
  let currentUrl = url;
  let currentOptions = { ...options };

  for (let i = 0; i < maxRedirects; i++) {
    const response = await fetch(currentUrl, {
      ...currentOptions,
      redirect: 'manual'
    });

    const isRedirect = [301, 302, 303, 307, 308].includes(response.status);
    if (isRedirect) {
      const location = response.headers.get('location');
      if (!location) {
        return response;
      }
      currentUrl = new URL(location, currentUrl).toString();

      // Change method to GET and delete body for standard 301/302/303 redirect follow
      if (response.status === 301 || response.status === 302 || response.status === 303) {
        currentOptions.method = 'GET';
        delete currentOptions.body;
        if (currentOptions.headers) {
          const headers = { ...currentOptions.headers };
          delete headers['Content-Type'];
          delete headers['content-type'];
          currentOptions.headers = headers;
        }
      }
      continue;
    }

    return response;
  }
  
  throw new Error('Too many redirects');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API Routes
  app.post("/api/login", (req, res) => {
    const { identifier, password } = req.body;
    const searchVal = (identifier || "").trim();
    const pwd = (password || "").trim();
    
    if (!searchVal) {
      return res.status(400).json({ success: false, message: "Please enter your Email, Username, or Employee ID" });
    }
    if (!pwd) {
      return res.status(400).json({ success: false, message: "Please enter your password" });
    }

    // Lookup user by email OR registration_id OR username
    const user = db.prepare("SELECT * FROM users WHERE email = ? OR registration_id = ? OR username = ? OR LOWER(username) = LOWER(?)").get(searchVal, searchVal, searchVal, searchVal) as any;
    
    if (!user) {
      return res.status(401).json({ success: false, message: "Staff member not found. Please verify your Username or Employee ID." });
    }

    const expectedPassword = user.password || user.registration_id || "password123";
    if (pwd === expectedPassword) {
      res.json({ success: true, user });
    } else {
      res.status(401).json({ success: false, message: "Incorrect password. Please try again." });
    }
  });

  // --- Designations / Positions Master APIs ---
  app.get("/api/designations", (req, res) => {
    try {
      const designations = db.prepare("SELECT * FROM designations ORDER BY name ASC").all();
      res.json(designations);
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/designations", (req, res) => {
    const { name } = req.body;
    const trimmed = (name || "").trim();
    if (!trimmed) {
      return res.status(400).json({ success: false, message: "Position / Designation name is required" });
    }
    try {
      const result = db.prepare("INSERT INTO designations (name) VALUES (?)").run(trimmed);
      res.json({ success: true, id: result.lastInsertRowid, name: trimmed });
    } catch (e: any) {
      res.status(400).json({ success: false, message: "This position / designation already exists" });
    }
  });

  app.put("/api/designations/:id", (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    const trimmed = (name || "").trim();
    if (!trimmed) {
      return res.status(400).json({ success: false, message: "Position name is required" });
    }
    try {
      const existing = db.prepare("SELECT name FROM designations WHERE id = ?").get(id) as any;
      if (existing && existing.name) {
        // Also update any employees who have this designation
        db.prepare("UPDATE users SET designation = ? WHERE designation = ?").run(trimmed, existing.name);
      }
      db.prepare("UPDATE designations SET name = ? WHERE id = ?").run(trimmed, id);
      triggerLiveSync('users');
      res.json({ success: true, message: "Position updated successfully" });
    } catch (e: any) {
      res.status(400).json({ success: false, message: e.message });
    }
  });

  app.delete("/api/designations/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM designations WHERE id = ?").run(id);
      res.json({ success: true, message: "Position deleted successfully" });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Map & Place Search API with multi-tier fallback & local database site matching
  app.get("/api/maps/search", async (req, res) => {
    const rawQuery = (req.query.q as string || "").trim();
    if (!rawQuery || rawQuery.length < 2) {
      return res.json([]);
    }

    const results: Array<{ lat: string; lon: string; display_name: string }> = [];
    const queryLower = rawQuery.toLowerCase();

    // 1. Search local sites in Database
    try {
      const dbSites = db.prepare("SELECT name, address, latitude, longitude FROM sites WHERE LOWER(name) LIKE ? OR LOWER(address) LIKE ?").all(`%${queryLower}%`, `%${queryLower}%`) as any[];
      if (Array.isArray(dbSites)) {
        for (const s of dbSites) {
          if (s.latitude && s.longitude) {
            results.push({
              lat: String(s.latitude),
              lon: String(s.longitude),
              display_name: `${s.name} (${s.address || 'Company Construction Site'})`
            });
          }
        }
      }
    } catch (e) {
      // ignore db search error
    }

    // 2. Built-in curated popular Indian and regional landmarks / business hubs
    const POPULAR_LOCATIONS = [
      { name: "Ahmedabad, Gujarat", lat: "23.0225", lon: "72.5714" },
      { name: "SG Highway, Ahmedabad", lat: "23.0645", lon: "72.5085" },
      { name: "Prahlad Nagar, Ahmedabad", lat: "23.0076", lon: "72.5081" },
      { name: "Bopal, Ahmedabad", lat: "23.0336", lon: "72.4632" },
      { name: "GIFT City, Gandhinagar", lat: "23.1594", lon: "72.6841" },
      { name: "Gandhinagar, Gujarat", lat: "23.2156", lon: "72.6369" },
      { name: "Surat, Gujarat", lat: "21.1702", lon: "72.8311" },
      { name: "Vadodara, Gujarat", lat: "22.3072", lon: "73.1812" },
      { name: "Rajkot, Gujarat", lat: "22.3039", lon: "70.8022" },
      { name: "Mumbai, Maharashtra", lat: "19.0760", lon: "72.8777" },
      { name: "Bandra Kurla Complex (BKC), Mumbai", lat: "19.0664", lon: "72.8687" },
      { name: "Andheri, Mumbai", lat: "19.1136", lon: "72.8697" },
      { name: "Pune, Maharashtra", lat: "18.5204", lon: "73.8567" },
      { name: "Hinjawadi IT Park, Pune", lat: "18.5913", lon: "73.7389" },
      { name: "New Delhi, Delhi", lat: "28.6139", lon: "77.2090" },
      { name: "Connaught Place, New Delhi", lat: "28.6315", lon: "77.2167" },
      { name: "Cyber Hub, Gurugram", lat: "28.4950", lon: "77.0895" },
      { name: "Noida, Uttar Pradesh", lat: "28.5355", lon: "77.3910" },
      { name: "Bengaluru, Karnataka", lat: "12.9716", lon: "77.5946" },
      { name: "Whitefield, Bengaluru", lat: "12.9698", lon: "77.7499" },
      { name: "Electronic City, Bengaluru", lat: "12.8452", lon: "77.6602" },
      { name: "Hitec City, Hyderabad", lat: "17.4474", lon: "78.3762" },
      { name: "Hyderabad, Telangana", lat: "17.3850", lon: "78.4867" },
      { name: "Chennai, Tamil Nadu", lat: "13.0827", lon: "80.2707" },
      { name: "OMR IT Corridor, Chennai", lat: "12.9010", lon: "80.2279" },
      { name: "Kolkata, West Bengal", lat: "22.5726", lon: "88.3639" },
      { name: "Jaipur, Rajasthan", lat: "26.9124", lon: "75.7873" },
      { name: "Indore, Madhya Pradesh", lat: "22.7196", lon: "75.8577" }
    ];

    for (const loc of POPULAR_LOCATIONS) {
      if (loc.name.toLowerCase().includes(queryLower) || queryLower.split(' ').some(w => w.length > 2 && loc.name.toLowerCase().includes(w))) {
        if (!results.some(r => r.lat === loc.lat && r.lon === loc.lon)) {
          results.push({
            lat: loc.lat,
            lon: loc.lon,
            display_name: loc.name
          });
        }
      }
    }

    // 3. Try external Geocoding service with short timeout & fallback
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(rawQuery)}&limit=5&addressdetails=1`;
      const response = await fetch(nominatimUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'StaffSyncEnterprise/2.0 (staff_attendance_app)',
          'Accept': 'application/json'
        }
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const externalData = await response.json();
        if (Array.isArray(externalData)) {
          for (const item of externalData) {
            if (item.lat && item.lon && !results.some(r => Math.abs(parseFloat(r.lat) - parseFloat(item.lat)) < 0.001 && Math.abs(parseFloat(r.lon) - parseFloat(item.lon)) < 0.001)) {
              results.push({
                lat: String(item.lat),
                lon: String(item.lon),
                display_name: item.display_name
              });
            }
          }
        }
      }
    } catch (e: any) {
      // If external call fails/times out, we already have DB + curated list matches
    }

    res.json(results.slice(0, 8));
  });

  app.post("/api/forgot-password", (req, res) => {
    const { identifier, email, newPassword } = req.body;
    const searchId = (identifier || "").trim();
    const searchEmail = (email || "").trim();
    const newPwd = (newPassword || "").trim();

    if (!searchId || !searchEmail) {
      return res.status(400).json({ success: false, message: "Please provide both your Employee ID and Email." });
    }

    const user = db.prepare("SELECT * FROM users WHERE registration_id = ? AND email = ?").get(searchId, searchEmail) as any;
    if (!user) {
      return res.status(404).json({ success: false, message: "No matching employee record found for that ID and Email." });
    }

    if (newPwd) {
      db.prepare("UPDATE users SET password = ? WHERE id = ?").run(newPwd, user.id);
      triggerLiveSync('users'); // Sync with sheets if enabled
      return res.json({ success: true, message: "Your password has been reset successfully. Please sign in." });
    } else {
      // Verification check
      return res.json({ success: true, verified: true, message: "Identity verified. Please enter your new password." });
    }
  });

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

  app.get("/api/departments", (req, res) => {
    const departments = db.prepare("SELECT * FROM departments").all();
    res.json(departments);
  });

  // --- Google Sheets Sync Helpers & Endpoints ---

  function extractSpreadsheetId(urlOrId: string): string {
    if (!urlOrId) return "";
    const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : urlOrId;
  }

  // Get sheet settings
  app.get("/api/sheet-settings", (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get();
      res.json(settings || {});
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Save sheet settings
  app.post("/api/sheet-settings", (req, res) => {
    const { spreadsheet_id, users_sheet_name, attendance_sheet_name, web_app_url, sync_enabled, is_locked } = req.body;
    try {
      const cleanId = extractSpreadsheetId(spreadsheet_id || "");
      const cleanUrl = web_app_url ? String(web_app_url).trim() : null;
      
      db.prepare(`
        UPDATE sheet_settings 
        SET spreadsheet_id = ?, 
            users_sheet_name = ?, 
            attendance_sheet_name = ?, 
            web_app_url = ?, 
            sync_enabled = ?,
            is_locked = ?
        WHERE id = 1
      `).run(
        cleanId || null, 
        users_sheet_name || 'Users', 
        attendance_sheet_name || 'Attendance', 
        cleanUrl, 
        sync_enabled ? 1 : 0,
        is_locked !== undefined ? (is_locked ? 1 : 0) : 1
      );

      backupDatabaseToJson();
      res.json({ success: true, message: "Google Sheets settings saved successfully" });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Test Web App URL Connection (Ping Apps Script)
  app.post("/api/sheet-settings/test", async (req, res) => {
    const { web_app_url } = req.body;
    const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
    const targetUrl = web_app_url ? String(web_app_url).trim() : (settings ? settings.web_app_url : "");

    if (!targetUrl) {
      return res.status(400).json({ 
        success: false, 
        message: "No Google Apps Script Deployment URL provided." 
      });
    }

    try {
      const startTime = Date.now();
      const pingUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=ping&_t=${startTime}`;
      const response = await fetchWithRedirect(pingUrl);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`Google Apps Script returned HTTP ${response.status}. Please ensure "Who has access" is set to "Anyone".`);
      }

      let data: any;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error("Received non-JSON response from Google. Make sure you deployed as 'Web app' (URL ending in /exec) and authorized permissions.");
      }

      res.json({
        success: true,
        latencyMs,
        data,
        message: "Google Apps Script connection verified successfully!"
      });
    } catch (err: any) {
      console.error("Test Google Sheets connection error:", err.message);
      res.status(500).json({
        success: false,
        message: err.message || "Failed to reach Google Apps Script Web App."
      });
    }
  });

  // Sync users from Google Sheet (Live pull via Apps Script Web App)
  app.post("/api/sheet-settings/sync-users", async (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
      if (!settings || !settings.web_app_url) {
        return res.status(400).json({ success: false, message: "Google Sheets Web App URL is not configured." });
      }

      const usersSheet = settings.users_sheet_name || "Users";
      const targetUrl = `${settings.web_app_url}${settings.web_app_url.includes('?') ? '&' : '?'}action=getUsers&usersTab=${encodeURIComponent(usersSheet)}`;

      const response = await fetchWithRedirect(targetUrl);
      if (!response.ok) {
         throw new Error(`Google Sheets Web App returned HTTP ${response.status}`);
      }

      let data;
      try {
        data = await response.json() as any;
      } catch (jsonErr: any) {
        throw new Error("The Google Web App URL did not return valid JSON. Please double-check that you copied the 'Web App URL' from your Deployment (ending in '/exec') and NOT the browser address bar of the Apps Script editor or Google Sheet.");
      }

      if (!data.success) {
         throw new Error(data.message || "Apps Script failed to fetch users");
      }

      const syncedUsers = data.data ? data.data.users : data.users;
      if (!syncedUsers || !Array.isArray(syncedUsers) || syncedUsers.length === 0) {
        return res.json({ success: true, message: "No valid users found to import", added: 0, updated: 0 });
      }

      // Upsert into local database
      const insertOrUpdateUser = db.transaction((usersList) => {
        let added = 0;
        let updated = 0;
        let skipped = 0;

        const cleanRegId = (regId: any): string | null => {
          if (!regId) return null;
          const str = String(regId).trim();
          if (str === "" || str === "—" || str === "-" || str === "N/A" || str.toLowerCase() === "null" || str.toLowerCase() === "undefined") {
            return null;
          }
          return str;
        };

        const cleanEmailVal = (email: any): string | null => {
          if (!email) return null;
          const str = String(email).trim();
          if (str === "" || str === "—" || str === "-" || str === "N/A" || str.toLowerCase() === "null" || str.toLowerCase() === "undefined") {
            return null;
          }
          if (!str.includes("@")) {
            return null;
          }
          return str;
        };

        const cleanCountryVal = (country: any): string | null => {
          if (!country) return null;
          const str = String(country).trim();
          if (str === "" || str === "—" || str === "-" || str === "N/A" || str.toLowerCase() === "null" || str.toLowerCase() === "undefined") {
            return null;
          }
          return str;
        };

        for (const u of usersList) {
          try {
            const registration_id = cleanRegId(u.registration_id);
            const email = cleanEmailVal(u.email);
            const country = cleanCountryVal(u.country);

            // Check if user exists by registration_id (if present)
            let existing = null;
            if (registration_id) {
              existing = db.prepare("SELECT * FROM users WHERE registration_id = ?").get(registration_id);
            }
            // If not found by registration_id, check by email if present
            if (!existing && email) {
              existing = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
            }

            if (existing) {
              db.prepare(`
                UPDATE users 
                SET registration_id = COALESCE(?, registration_id),
                    name = ?, 
                    email = COALESCE(?, email), 
                    country = COALESCE(?, country), 
                    role = ?,
                    password = COALESCE(?, password)
                WHERE id = ?
              `).run(registration_id, u.name, email, country, u.role, u.password || null, existing.id);
              updated++;
            } else {
              const defaultPwd = u.password || registration_id || 'password123';
              db.prepare(`
                INSERT INTO users (registration_id, name, email, country, role, password) 
                VALUES (?, ?, ?, ?, ?, ?)
              `).run(registration_id, u.name, email, country, u.role, defaultPwd);
              added++;
            }
          } catch (itemErr: any) {
            console.error(`Skipping sync error for user: ${u.name || 'unnamed'} (${u.email || u.registration_id || 'no identifiers'}):`, itemErr.message);
            skipped++;
          }
        }
        return { added, updated, skipped };
      });

      const stats = insertOrUpdateUser(syncedUsers);
      
      const now = new Date().toISOString();
      db.prepare("UPDATE sheet_settings SET last_sync_timestamp = ? WHERE id = 1").run(now);

      res.json({
        success: true,
        message: `Successfully synchronized with Google Sheet!`,
        added: stats.added,
        updated: stats.updated,
        skipped: stats.skipped,
        timestamp: now
      });
    } catch (e: any) {
      console.error("User sync error:", e);
      res.status(500).json({ success: false, message: e.message || "Failed to synchronize user data" });
    }
  });

  // Symmetrical Push/Pull API endpoints for each database table
  
  // PUSH Users
  app.post("/api/sheet-settings/push/users", async (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
      if (!settings || !settings.web_app_url) {
        return res.status(400).json({ success: false, message: "Google Sheets Web App URL is not configured." });
      }

      const users = db.prepare("SELECT * FROM users").all() as any[];
      const response = await fetchWithRedirect(settings.web_app_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "exportAllData",
          data: { users }
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as any;
      if (!data.success) throw new Error(data.message || "Failed to push users");

      const now = new Date().toISOString();
      db.prepare("UPDATE sheet_settings SET last_sync_timestamp = ? WHERE id = 1").run(now);
      res.json({ success: true, message: `Successfully pushed ${users.length} users to Google Sheets!` });
    } catch (e: any) {
      console.error("Push users error:", e);
      res.status(500).json({ success: false, message: e.message || "Failed to push users" });
    }
  });

  // Alias for backward compatibility
  app.post("/api/sheet-settings/export-users", async (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
      if (!settings || !settings.web_app_url) {
        return res.status(400).json({ success: false, message: "Google Sheets Web App URL is not configured." });
      }

      const users = db.prepare("SELECT * FROM users").all() as any[];
      const response = await fetchWithRedirect(settings.web_app_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "exportAllData",
          data: { users }
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as any;
      if (!data.success) throw new Error(data.message || "Failed to push users");

      const now = new Date().toISOString();
      db.prepare("UPDATE sheet_settings SET last_sync_timestamp = ? WHERE id = 1").run(now);
      res.json({ success: true, message: `Successfully exported ${users.length} users to Google Sheet!` });
    } catch (e: any) {
      console.error("Export users error:", e);
      res.status(500).json({ success: false, message: e.message || "Failed to export users to Google Sheet" });
    }
  });

  // PULL Users
  app.post("/api/sheet-settings/pull/users", async (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
      if (!settings || !settings.web_app_url) {
        return res.status(400).json({ success: false, message: "Google Sheets Web App URL is not configured." });
      }

      const usersSheet = settings.users_sheet_name || "Users";
      const targetUrl = `${settings.web_app_url}${settings.web_app_url.includes('?') ? '&' : '?'}action=getUsers&usersTab=${encodeURIComponent(usersSheet)}`;

      const response = await fetchWithRedirect(targetUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json() as any;
      if (!data.success) throw new Error(data.message || "Failed to pull users");

      const syncedUsers = data.data ? data.data.users : data.users;
      if (!syncedUsers || !Array.isArray(syncedUsers) || syncedUsers.length === 0) {
        return res.json({ success: true, message: "No valid users found to pull", added: 0, updated: 0 });
      }

      const syncUsersTx = db.transaction((usersList) => {
        let added = 0;
        let updated = 0;
        for (const u of usersList) {
          if (!u.name) continue;
          let existing = null;
          if (u.registration_id) {
            existing = db.prepare("SELECT id FROM users WHERE registration_id = ?").get(u.registration_id);
          }
          if (!existing && u.email) {
            existing = db.prepare("SELECT id FROM users WHERE email = ?").get(u.email);
          }

          if (existing) {
            db.prepare(`
              UPDATE users 
              SET name = ?, email = COALESCE(?, email), country = COALESCE(?, country), role = ?, site_name = COALESCE(?, site_name), password = COALESCE(?, password)
              WHERE id = ?
            `).run(u.name, u.email || null, u.country || null, u.role || 'user', u.site_name || null, u.password || null, existing.id);
            updated++;
          } else {
            const defaultPwd = u.password || u.registration_id || 'password123';
            db.prepare(`
              INSERT INTO users (registration_id, name, email, country, role, site_name, password)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(u.registration_id || null, u.name, u.email || null, u.country || null, u.role || 'user', u.site_name || null, defaultPwd);
            added++;
          }
        }
        return { added, updated };
      });

      const stats = syncUsersTx(syncedUsers);
      const now = new Date().toISOString();
      db.prepare("UPDATE sheet_settings SET last_sync_timestamp = ? WHERE id = 1").run(now);

      res.json({ success: true, message: `Successfully pulled users! Added: ${stats.added}, Updated: ${stats.updated}`, ...stats });
    } catch (e: any) {
      console.error("Pull users error:", e);
      res.status(500).json({ success: false, message: e.message || "Failed to pull users" });
    }
  });

  // PUSH Attendance
  app.post("/api/sheet-settings/push/attendance", async (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
      if (!settings || !settings.web_app_url) {
        return res.status(400).json({ success: false, message: "Google Sheets Web App URL is not configured." });
      }

      const records = db.prepare(`
        SELECT a.date, a.check_in, a.check_out, u.registration_id, u.name, u.email, u.country, a.status, s.name as session_name, a.method, a.ip_address, a.latitude, a.longitude
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        LEFT JOIN sessions s ON a.session_id = s.id
        ORDER BY a.date DESC, a.check_in DESC
      `).all() as any[];

      const response = await fetchWithRedirect(settings.web_app_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "exportAttendance",
          attendanceTab: settings.attendance_sheet_name || "Attendance",
          records: records
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as any;
      if (!data.success) throw new Error(data.message || "Failed to push attendance");

      const now = new Date().toISOString();
      db.prepare("UPDATE sheet_settings SET last_sync_timestamp = ? WHERE id = 1").run(now);
      res.json({ success: true, message: `Successfully pushed ${records.length} attendance logs to Google Sheets!` });
    } catch (e: any) {
      console.error("Push attendance error:", e);
      res.status(500).json({ success: false, message: e.message || "Failed to push attendance" });
    }
  });

  // PULL Attendance
  app.post("/api/sheet-settings/pull/attendance", async (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
      if (!settings || !settings.web_app_url) {
        return res.status(400).json({ success: false, message: "Google Sheets Web App URL is not configured." });
      }

      const attendanceSheet = settings.attendance_sheet_name || "Attendance";
      const targetUrl = `${settings.web_app_url}${settings.web_app_url.includes('?') ? '&' : '?'}action=getAttendance&attendanceTab=${encodeURIComponent(attendanceSheet)}`;

      const response = await fetchWithRedirect(targetUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json() as any;
      if (!data.success) throw new Error(data.message || "Failed to pull attendance");

      const syncedAttendance = data.data ? data.data.attendance : data.attendance;
      if (!syncedAttendance || !Array.isArray(syncedAttendance) || syncedAttendance.length === 0) {
        return res.json({ success: true, message: "No attendance data found on Google Sheets", added: 0 });
      }

      const syncAttendanceTx = db.transaction((list) => {
        let added = 0;
        for (const item of list) {
          if (!item.date || (!item.registration_id && !item.name)) continue;
          let user = null;
          if (item.registration_id) {
            user = db.prepare("SELECT id FROM users WHERE registration_id = ?").get(item.registration_id);
          }
          if (!user && item.name) {
            user = db.prepare("SELECT id FROM users WHERE name = ?").get(item.name);
          }
          if (!user) continue;

          let sessId = null;
          if (item.session_name) {
            const session = db.prepare("SELECT id FROM sessions WHERE name = ?").get(item.session_name);
            if (session) sessId = session.id;
          }

          // Check duplicate
          const existing = db.prepare("SELECT id FROM attendance WHERE user_id = ? AND date = ? AND check_in = ?").get(user.id, item.date, item.check_in);
          if (!existing) {
            db.prepare(`
              INSERT INTO attendance (user_id, session_id, date, check_in, check_out, status, method, ip_address, latitude, longitude)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              user.id,
              sessId,
              item.date,
              item.check_in,
              item.check_out || null,
              item.status === 'Present' || item.status === 'P' ? 'P' : (item.status === 'Late' || item.status === 'L' ? 'L' : 'A'),
              item.method || 'manual',
              item.ip_address || null,
              item.latitude ? Number(item.latitude) : null,
              item.longitude ? Number(item.longitude) : null
            );
            added++;
          }
        }
        return { added };
      });

      const stats = syncAttendanceTx(syncedAttendance);
      const now = new Date().toISOString();
      db.prepare("UPDATE sheet_settings SET last_sync_timestamp = ? WHERE id = 1").run(now);

      res.json({ success: true, message: `Successfully pulled ${stats.added} new attendance logs from Google Sheets!`, ...stats });
    } catch (e: any) {
      console.error("Pull attendance error:", e);
      res.status(500).json({ success: false, message: e.message || "Failed to pull attendance" });
    }
  });

  // PUSH Sessions
  app.post("/api/sheet-settings/push/sessions", async (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
      if (!settings || !settings.web_app_url) {
        return res.status(400).json({ success: false, message: "Google Sheets Web App URL is not configured." });
      }

      const sessions = db.prepare("SELECT * FROM sessions").all() as any[];
      const response = await fetchWithRedirect(settings.web_app_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "exportAllData",
          data: { sessions }
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as any;
      if (!data.success) throw new Error(data.message || "Failed to push sessions");

      const now = new Date().toISOString();
      db.prepare("UPDATE sheet_settings SET last_sync_timestamp = ? WHERE id = 1").run(now);
      res.json({ success: true, message: `Successfully pushed ${sessions.length} sessions to Google Sheets!` });
    } catch (e: any) {
      console.error("Push sessions error:", e);
      res.status(500).json({ success: false, message: e.message || "Failed to push sessions" });
    }
  });

  // PULL Sessions
  app.post("/api/sheet-settings/pull/sessions", async (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
      if (!settings || !settings.web_app_url) {
        return res.status(400).json({ success: false, message: "Google Sheets Web App URL is not configured." });
      }

      const targetUrl = `${settings.web_app_url}${settings.web_app_url.includes('?') ? '&' : '?'}action=getSessions`;
      const response = await fetchWithRedirect(targetUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json() as any;
      if (!data.success) throw new Error(data.message || "Failed to pull sessions");

      const syncedSessions = data.data ? data.data.sessions : data.sessions;
      if (!syncedSessions || !Array.isArray(syncedSessions) || syncedSessions.length === 0) {
        return res.json({ success: true, message: "No sessions found on Google Sheets", added: 0 });
      }

      const syncSessionsTx = db.transaction((list) => {
        let added = 0;
        let updated = 0;
        for (const s of list) {
          if (!s.name || !s.date) continue;
          let existing = null;
          if (s.id) {
            existing = db.prepare("SELECT id FROM sessions WHERE id = ?").get(s.id);
          } else {
            existing = db.prepare("SELECT id FROM sessions WHERE name = ? AND date = ? AND start_time = ?").get(s.name, s.date, s.start_time);
          }

          if (existing) {
            db.prepare(`
              UPDATE sessions 
              SET name = ?, date = ?, start_time = ?, end_time = ?, site_name = ?
              WHERE id = ?
            `).run(s.name, s.date, s.start_time, s.end_time, s.site_name || null, existing.id);
            updated++;
          } else {
            db.prepare(`
              INSERT INTO sessions (name, date, start_time, end_time, site_name)
              VALUES (?, ?, ?, ?, ?)
            `).run(s.name, s.date, s.start_time, s.end_time, s.site_name || null);
            added++;
          }
        }
        return { added, updated };
      });

      const stats = syncSessionsTx(syncedSessions);
      const now = new Date().toISOString();
      db.prepare("UPDATE sheet_settings SET last_sync_timestamp = ? WHERE id = 1").run(now);

      res.json({ success: true, message: `Successfully pulled sessions! Added: ${stats.added}, Updated: ${stats.updated}`, ...stats });
    } catch (e: any) {
      console.error("Pull sessions error:", e);
      res.status(500).json({ success: false, message: e.message || "Failed to pull sessions" });
    }
  });

  // PUSH Sites
  app.post("/api/sheet-settings/push/sites", async (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
      if (!settings || !settings.web_app_url) {
        return res.status(400).json({ success: false, message: "Google Sheets Web App URL is not configured." });
      }

      const sites = db.prepare("SELECT * FROM sites").all() as any[];
      const response = await fetchWithRedirect(settings.web_app_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "exportAllData",
          data: { sites }
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as any;
      if (!data.success) throw new Error(data.message || "Failed to push sites");

      const now = new Date().toISOString();
      db.prepare("UPDATE sheet_settings SET last_sync_timestamp = ? WHERE id = 1").run(now);
      res.json({ success: true, message: `Successfully pushed ${sites.length} sites to Google Sheets!` });
    } catch (e: any) {
      console.error("Push sites error:", e);
      res.status(500).json({ success: false, message: e.message || "Failed to push sites" });
    }
  });

  // PULL Sites
  app.post("/api/sheet-settings/pull/sites", async (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
      if (!settings || !settings.web_app_url) {
        return res.status(400).json({ success: false, message: "Google Sheets Web App URL is not configured." });
      }

      const targetUrl = `${settings.web_app_url}${settings.web_app_url.includes('?') ? '&' : '?'}action=getSites`;
      const response = await fetchWithRedirect(targetUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json() as any;
      if (!data.success) throw new Error(data.message || "Failed to pull sites");

      const syncedSites = data.data ? data.data.sites : data.sites;
      if (!syncedSites || !Array.isArray(syncedSites) || syncedSites.length === 0) {
        return res.json({ success: true, message: "No sites found on Google Sheets", added: 0 });
      }

      const syncSitesTx = db.transaction((list) => {
        let added = 0;
        let updated = 0;
        for (const st of list) {
          if (!st.name) continue;
          let existing = db.prepare("SELECT id FROM sites WHERE name = ?").get(st.name);
          const latVal = Number(st.latitude);
          const lngVal = Number(st.longitude);
          const radVal = Number(st.radius) || 150;

          if (isNaN(latVal) || isNaN(lngVal)) continue;

          if (existing) {
            db.prepare(`
              UPDATE sites 
              SET latitude = ?, longitude = ?, radius = ?
              WHERE id = ?
            `).run(latVal, lngVal, radVal, existing.id);
            updated++;
          } else {
            db.prepare(`
              INSERT INTO sites (name, latitude, longitude, radius)
              VALUES (?, ?, ?, ?)
            `).run(st.name, latVal, lngVal, radVal);
            added++;
          }
        }
        return { added, updated };
      });

      const stats = syncSitesTx(syncedSites);
      const now = new Date().toISOString();
      db.prepare("UPDATE sheet_settings SET last_sync_timestamp = ? WHERE id = 1").run(now);

      res.json({ success: true, message: `Successfully pulled sites! Added: ${stats.added}, Updated: ${stats.updated}`, ...stats });
    } catch (e: any) {
      console.error("Pull sites error:", e);
      res.status(500).json({ success: false, message: e.message || "Failed to pull sites" });
    }
  });

  // PUSH Holidays
  app.post("/api/sheet-settings/push/holidays", async (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
      if (!settings || !settings.web_app_url) {
        return res.status(400).json({ success: false, message: "Google Sheets Web App URL is not configured." });
      }

      const holidays = db.prepare("SELECT * FROM holidays").all() as any[];
      const response = await fetchWithRedirect(settings.web_app_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "exportAllData",
          data: { holidays }
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as any;
      if (!data.success) throw new Error(data.message || "Failed to push holidays");

      const now = new Date().toISOString();
      db.prepare("UPDATE sheet_settings SET last_sync_timestamp = ? WHERE id = 1").run(now);
      res.json({ success: true, message: `Successfully pushed ${holidays.length} holidays to Google Sheets!` });
    } catch (e: any) {
      console.error("Push holidays error:", e);
      res.status(500).json({ success: false, message: e.message || "Failed to push holidays" });
    }
  });

  // PULL Holidays
  app.post("/api/sheet-settings/pull/holidays", async (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
      if (!settings || !settings.web_app_url) {
        return res.status(400).json({ success: false, message: "Google Sheets Web App URL is not configured." });
      }

      const targetUrl = `${settings.web_app_url}${settings.web_app_url.includes('?') ? '&' : '?'}action=getHolidays`;
      const response = await fetchWithRedirect(targetUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json() as any;
      if (!data.success) throw new Error(data.message || "Failed to pull holidays");

      const syncedHolidays = data.data ? data.data.holidays : data.holidays;
      if (!syncedHolidays || !Array.isArray(syncedHolidays) || syncedHolidays.length === 0) {
        return res.json({ success: true, message: "No holidays found on Google Sheets", added: 0 });
      }

      const syncHolidaysTx = db.transaction((list) => {
        let added = 0;
        let updated = 0;
        for (const h of list) {
          if (!h.date || !h.name) continue;
          let existing = db.prepare("SELECT id FROM holidays WHERE date = ?").get(h.date);
          if (existing) {
            db.prepare(`
              UPDATE holidays 
              SET name = ?
              WHERE id = ?
            `).run(h.name, existing.id);
            updated++;
          } else {
            db.prepare(`
              INSERT INTO holidays (date, name)
              VALUES (?, ?)
            `).run(h.date, h.name);
            added++;
          }
        }
        return { added, updated };
      });

      const stats = syncHolidaysTx(syncedHolidays);
      const now = new Date().toISOString();
      db.prepare("UPDATE sheet_settings SET last_sync_timestamp = ? WHERE id = 1").run(now);

      res.json({ success: true, message: `Successfully pulled holidays! Added: ${stats.added}, Updated: ${stats.updated}`, ...stats });
    } catch (e: any) {
      console.error("Pull holidays error:", e);
      res.status(500).json({ success: false, message: e.message || "Failed to pull holidays" });
    }
  });

  // PUSH Approvals
  app.post("/api/sheet-settings/push/approvals", async (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
      if (!settings || !settings.web_app_url) {
        return res.status(400).json({ success: false, message: "Google Sheets Web App URL is not configured." });
      }

      const approvals = db.prepare(`
        SELECT r.id, u.registration_id, u.name as user_name, r.date, r.check_in, r.check_out, r.status, r.reason, r.site_name
        FROM attendance_requests r
        JOIN users u ON r.user_id = u.id
        ORDER BY r.created_at DESC
      `).all() as any[];

      const response = await fetchWithRedirect(settings.web_app_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "exportAllData",
          data: { approvals }
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as any;
      if (!data.success) throw new Error(data.message || "Failed to push approvals");

      const now = new Date().toISOString();
      db.prepare("UPDATE sheet_settings SET last_sync_timestamp = ? WHERE id = 1").run(now);
      res.json({ success: true, message: `Successfully pushed ${approvals.length} correction requests to Google Sheets!` });
    } catch (e: any) {
      console.error("Push approvals error:", e);
      res.status(500).json({ success: false, message: e.message || "Failed to push approvals" });
    }
  });

  // PULL Approvals
  app.post("/api/sheet-settings/pull/approvals", async (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
      if (!settings || !settings.web_app_url) {
        return res.status(400).json({ success: false, message: "Google Sheets Web App URL is not configured." });
      }

      const targetUrl = `${settings.web_app_url}${settings.web_app_url.includes('?') ? '&' : '?'}action=getApprovals`;
      const response = await fetchWithRedirect(targetUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json() as any;
      if (!data.success) throw new Error(data.message || "Failed to pull approvals");

      const syncedApprovals = data.data ? data.data.approvals : data.approvals;
      if (!syncedApprovals || !Array.isArray(syncedApprovals) || syncedApprovals.length === 0) {
        return res.json({ success: true, message: "No correction requests found on Google Sheets", added: 0 });
      }

      const syncApprovalsTx = db.transaction((list) => {
        let added = 0;
        let updated = 0;
        for (const ap of list) {
          if (!ap.date || (!ap.registration_id && !ap.user_name)) continue;
          let userRow = null;
          if (ap.registration_id) {
            userRow = db.prepare("SELECT id FROM users WHERE registration_id = ?").get(ap.registration_id);
          }
          if (!userRow && ap.user_name) {
            userRow = db.prepare("SELECT id FROM users WHERE name = ?").get(ap.user_name);
          }
          if (!userRow) continue;

          let existing = null;
          if (ap.id) {
            existing = db.prepare("SELECT id FROM attendance_requests WHERE id = ?").get(ap.id);
          }

          if (existing) {
            db.prepare(`
              UPDATE attendance_requests 
              SET date = ?, check_in = ?, check_out = ?, status = ?, reason = ?, site_name = ?
              WHERE id = ?
            `).run(ap.date, ap.check_in || null, ap.check_out || null, ap.status || 'PENDING', ap.reason || null, ap.site_name || null, existing.id);
            updated++;
          } else {
            db.prepare(`
              INSERT INTO attendance_requests (user_id, date, check_in, check_out, status, reason, site_name)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(userRow.id, ap.date, ap.check_in || null, ap.check_out || null, ap.status || 'PENDING', ap.reason || null, ap.site_name || null);
            added++;
          }
        }
        return { added, updated };
      });

      const stats = syncApprovalsTx(syncedApprovals);
      const now = new Date().toISOString();
      db.prepare("UPDATE sheet_settings SET last_sync_timestamp = ? WHERE id = 1").run(now);

      res.json({ success: true, message: `Successfully pulled correction requests! Added: ${stats.added}, Updated: ${stats.updated}`, ...stats });
    } catch (e: any) {
      console.error("Pull approvals error:", e);
      res.status(500).json({ success: false, message: e.message || "Failed to pull approvals" });
    }
  });

  // PUSH Geofencing
  app.post("/api/sheet-settings/push/geofencing", async (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
      if (!settings || !settings.web_app_url) {
        return res.status(400).json({ success: false, message: "Google Sheets Web App URL is not configured." });
      }

      const geofencingObj = db.prepare("SELECT * FROM geofence_settings WHERE id = 1").get() as any;
      const geofencing = geofencingObj ? [geofencingObj] : [];

      const response = await fetchWithRedirect(settings.web_app_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "exportAllData",
          data: { geofencing }
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as any;
      if (!data.success) throw new Error(data.message || "Failed to push geofencing");

      const now = new Date().toISOString();
      db.prepare("UPDATE sheet_settings SET last_sync_timestamp = ? WHERE id = 1").run(now);
      res.json({ success: true, message: `Successfully pushed Geofencing settings to Google Sheets!` });
    } catch (e: any) {
      console.error("Push geofencing error:", e);
      res.status(500).json({ success: false, message: e.message || "Failed to push geofencing" });
    }
  });

  // PULL Geofencing
  app.post("/api/sheet-settings/pull/geofencing", async (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
      if (!settings || !settings.web_app_url) {
        return res.status(400).json({ success: false, message: "Google Sheets Web App URL is not configured." });
      }

      const targetUrl = `${settings.web_app_url}${settings.web_app_url.includes('?') ? '&' : '?'}action=getGeofencing`;
      const response = await fetchWithRedirect(targetUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json() as any;
      if (!data.success) throw new Error(data.message || "Failed to pull geofencing");

      const syncedGeofencing = data.data ? data.data.geofencing : data.geofencing;
      if (!syncedGeofencing || !Array.isArray(syncedGeofencing) || syncedGeofencing.length === 0) {
        return res.json({ success: true, message: "No geofencing settings found on Google Sheets" });
      }

      const g = syncedGeofencing[0];
      const latVal = Number(g.latitude);
      const lngVal = Number(g.longitude);
      const radVal = Number(g.radius) || 150;

      if (!isNaN(latVal) && !isNaN(lngVal)) {
        db.prepare(`
          UPDATE geofence_settings 
          SET enabled = ?, latitude = ?, longitude = ?, radius = ?
          WHERE id = 1
        `).run(g.enabled ? 1 : 0, latVal, lngVal, radVal);
      }

      const now = new Date().toISOString();
      db.prepare("UPDATE sheet_settings SET last_sync_timestamp = ? WHERE id = 1").run(now);

      res.json({ success: true, message: `Successfully pulled Geofencing settings!` });
    } catch (e: any) {
      console.error("Pull geofencing error:", e);
      res.status(500).json({ success: false, message: e.message || "Failed to pull geofencing" });
    }
  });

  // Export everything to Google Sheets
  app.post("/api/sheet-settings/export-all", async (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
      if (!settings || !settings.web_app_url) {
        return res.status(400).json({ success: false, message: "Google Sheets Web App URL is not configured. Please paste your deployment URL in settings." });
      }

      // 1. Users
      const users = db.prepare("SELECT * FROM users").all() as any[];

      // 2. Attendance
      const attendance = db.prepare(`
        SELECT a.id, a.date, a.check_in, a.check_out, u.registration_id, u.name, u.designation, 
               COALESCE(u.site_name, a.location) as site_name, a.status, a.late_minutes, 
               a.overtime_hours, a.method, a.device_id, a.latitude, a.longitude, 
               a.ip_address, a.photo_url, a.early_checkout_reason, a.late_reason, a.created_at
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        ORDER BY a.date DESC, a.check_in DESC
      `).all() as any[];

      // 3. Sites
      const sites = db.prepare("SELECT * FROM sites").all() as any[];

      // 4. Designations
      const designations = db.prepare("SELECT * FROM designations").all() as any[];

      // 5. Departments
      const departments = db.prepare("SELECT * FROM departments").all() as any[];

      // 6. Approvals / Attendance Requests
      const approvals = db.prepare(`
        SELECT r.id, u.registration_id, u.name as user_name, r.date, r.type, r.check_in, r.check_out, r.status, r.reason, r.site_name, r.admin_comment, r.actioned_at, r.created_at
        FROM attendance_requests r
        JOIN users u ON r.user_id = u.id
        ORDER BY r.created_at DESC
      `).all() as any[];

      // 7. Salary Advances
      const salary_advances = db.prepare(`
        SELECT sa.id, sa.date, u.registration_id, u.name as user_name, sa.type, sa.amount, sa.notes, sa.created_at
        FROM salary_advances sa
        JOIN users u ON sa.user_id = u.id
        ORDER BY sa.date DESC
      `).all() as any[];

      // 8. Holidays
      const holidays = db.prepare("SELECT * FROM holidays ORDER BY date ASC").all() as any[];

      // 9. Geofencing
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

      const response = await fetchWithRedirect(settings.web_app_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
         throw new Error(`Google Sheets Web App returned HTTP ${response.status}`);
      }

      const data = await response.json() as any;
      if (!data.success) {
         throw new Error(data.message || data.error || "Apps Script failed to export all data");
      }

      const now = new Date().toISOString();
      db.prepare("UPDATE sheet_settings SET last_sync_timestamp = ? WHERE id = 1").run(now);

      res.json({ success: true, message: "Successfully synchronized all local data tables to Google Sheets!" });
    } catch (e: any) {
      console.error("Export all data error:", e);
      res.status(500).json({ success: false, message: e.message || "Failed to sync all data to Google Sheets." });
    }
  });

  // Super Admin Sync Alias
  app.post("/api/super_admin/sheets/sync", async (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
      if (!settings || !settings.web_app_url) {
        return res.status(400).json({ success: false, message: "Google Sheets Web App URL is not configured. Please paste your deployment URL first." });
      }

      const users = db.prepare("SELECT * FROM users").all() as any[];
      const attendance = db.prepare(`
        SELECT a.id, a.date, a.check_in, a.check_out, u.registration_id, u.name, u.designation, 
               COALESCE(u.site_name, a.location) as site_name, a.status, a.late_minutes, 
               a.overtime_hours, a.method, a.device_id, a.latitude, a.longitude, 
               a.ip_address, a.photo_url, a.early_checkout_reason, a.late_reason, a.created_at
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        ORDER BY a.date DESC, a.check_in DESC
      `).all() as any[];
      const sites = db.prepare("SELECT * FROM sites").all() as any[];
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

      const response = await fetchWithRedirect(settings.web_app_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Google Sheets Web App returned HTTP ${response.status}`);
      }

      const data = await response.json() as any;
      if (!data.success) {
        throw new Error(data.message || data.error || "Apps Script failed to export all data");
      }

      const now = new Date().toISOString();
      db.prepare("UPDATE sheet_settings SET last_sync_timestamp = ? WHERE id = 1").run(now);

      res.json({ success: true, message: "Successfully synchronized all local data tables to Google Sheets!" });
    } catch (e: any) {
      console.error("Super Admin Sheets Sync error:", e);
      res.status(500).json({ success: false, message: e.message || "Failed to sync to Google Sheets." });
    }
  });

  // Pull everything from Google Sheets
  app.post("/api/sheet-settings/pull-all", async (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
      if (!settings || !settings.web_app_url) {
        return res.status(400).json({ success: false, message: "Google Sheets Web App URL is not configured." });
      }

      let users: any[] = [];
      let sessions: any[] = [];
      let sites: any[] = [];
      let holidays: any[] = [];
      let approvals: any[] = [];
      let geofencing: any[] = [];

      let fetchedViaAll = false;
      try {
        const targetUrl = `${settings.web_app_url}${settings.web_app_url.includes('?') ? '&' : '?'}action=getAllData`;
        const response = await fetchWithRedirect(targetUrl);
        if (response.ok) {
          const resBody = await response.json() as any;
          if (resBody && (resBody.success || resBody.data)) {
            const dataObj = resBody.data || resBody;
            users = dataObj.users || [];
            sessions = dataObj.sessions || [];
            sites = dataObj.sites || [];
            holidays = dataObj.holidays || [];
            approvals = dataObj.approvals || [];
            geofencing = dataObj.geofencing || [];
            fetchedViaAll = true;
          }
        }
      } catch (err: any) {
        console.warn("getAllData failed, falling back to individual endpoints:", err.message);
      }

      // If we couldn't fetch via getAllData (e.g. older Apps Script version), fetch one by one!
      if (!fetchedViaAll) {
        console.log("getAllData failed or empty. Falling back to individual tables...");
        const fetchTableSafe = async (action: string, key: string) => {
          try {
            const url = `${settings.web_app_url}${settings.web_app_url.includes('?') ? '&' : '?'}action=${action}`;
            const resp = await fetchWithRedirect(url);
            if (resp.ok) {
              const body = await resp.json() as any;
              const dataObj = body.data || body;
              return dataObj[key] || [];
            }
          } catch (e: any) {
            console.warn(`Fallback fetch for action=${action} failed:`, e.message);
          }
          return [];
        };

        const results = await Promise.all([
          fetchTableSafe("getUsers", "users"),
          fetchTableSafe("getSessions", "sessions"),
          fetchTableSafe("getSites", "sites"),
          fetchTableSafe("getHolidays", "holidays"),
          fetchTableSafe("getApprovals", "approvals"),
          fetchTableSafe("getGeofencing", "geofencing")
        ]);

        users = results[0];
        sessions = results[1];
        sites = results[2];
        holidays = results[3];
        approvals = results[4];
        geofencing = results[5];
      }

      // Wrap in transaction for database safety
      const syncAllTransaction = db.transaction(() => {
        let stats = {
          users: 0,
          sessions: 0,
          sites: 0,
          holidays: 0,
          approvals: 0,
          geofencing: 0
        };

        // 1. Sync Users
        if (users && Array.isArray(users)) {
          for (const u of users) {
            try {
              if (!u.name) continue;
              // Find by registration_id or email
              let existing = null;
              if (u.registration_id) {
                existing = db.prepare("SELECT id FROM users WHERE registration_id = ?").get(u.registration_id);
              }
              if (!existing && u.email) {
                existing = db.prepare("SELECT id FROM users WHERE email = ?").get(u.email);
              }

              if (existing) {
                db.prepare(`
                  UPDATE users 
                  SET name = ?, email = COALESCE(?, email), country = COALESCE(?, country), role = ?, site_name = COALESCE(?, site_name), password = COALESCE(?, password)
                  WHERE id = ?
                `).run(u.name, u.email || null, u.country || null, u.role || 'user', u.site_name || null, u.password || null, existing.id);
              } else {
                const defaultPwd = u.password || u.registration_id || 'password123';
                db.prepare(`
                  INSERT INTO users (registration_id, name, email, country, role, site_name, password)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(u.registration_id || null, u.name, u.email || null, u.country || null, u.role || 'user', u.site_name || null, defaultPwd);
              }
              stats.users++;
            } catch (err: any) {
              console.warn("Skipping user sync row:", u, err.message);
            }
          }
        }

        // 2. Sync Sessions
        if (sessions && Array.isArray(sessions)) {
          for (const s of sessions) {
            try {
              if (!s.name || !s.date) continue;
              let existing = null;
              if (s.id) {
                existing = db.prepare("SELECT id FROM sessions WHERE id = ?").get(s.id);
              } else {
                existing = db.prepare("SELECT id FROM sessions WHERE name = ? AND date = ? AND start_time = ?").get(s.name, s.date, s.start_time);
              }

              if (existing) {
                db.prepare(`
                  UPDATE sessions 
                  SET name = ?, date = ?, start_time = ?, end_time = ?, site_name = ?
                  WHERE id = ?
                `).run(s.name, s.date, s.start_time, s.end_time, s.site_name || null, existing.id);
              } else {
                db.prepare(`
                  INSERT INTO sessions (name, date, start_time, end_time, site_name)
                  VALUES (?, ?, ?, ?, ?)
                `).run(s.name, s.date, s.start_time, s.end_time, s.site_name || null);
              }
              stats.sessions++;
            } catch (err: any) {
              console.warn("Skipping session sync row:", s, err.message);
            }
          }
        }

        // 3. Sync Sites
        if (sites && Array.isArray(sites)) {
          for (const st of sites) {
            try {
              if (!st.name) continue;
              let existing = db.prepare("SELECT id FROM sites WHERE name = ?").get(st.name);
              const latVal = Number(st.latitude);
              const lngVal = Number(st.longitude);
              const radVal = Number(st.radius) || 150;

              if (isNaN(latVal) || isNaN(lngVal)) {
                console.warn("Skipping site due to invalid coordinates:", st);
                continue;
              }

              if (existing) {
                db.prepare(`
                  UPDATE sites 
                  SET latitude = ?, longitude = ?, radius = ?
                  WHERE id = ?
                `).run(latVal, lngVal, radVal, existing.id);
              } else {
                db.prepare(`
                  INSERT INTO sites (name, latitude, longitude, radius)
                  VALUES (?, ?, ?, ?)
                `).run(st.name, latVal, lngVal, radVal);
              }
              stats.sites++;
            } catch (err: any) {
              console.warn("Skipping site sync row:", st, err.message);
            }
          }
        }

        // 4. Sync Holidays
        if (holidays && Array.isArray(holidays)) {
          for (const h of holidays) {
            try {
              if (!h.date || !h.name) continue;
              let existing = db.prepare("SELECT id FROM holidays WHERE date = ?").get(h.date);
              if (existing) {
                db.prepare(`
                  UPDATE holidays 
                  SET name = ?
                  WHERE id = ?
                `).run(h.name, existing.id);
              } else {
                db.prepare(`
                  INSERT INTO holidays (date, name)
                  VALUES (?, ?)
                `).run(h.date, h.name);
              }
              stats.holidays++;
            } catch (err: any) {
              console.warn("Skipping holiday sync row:", h, err.message);
            }
          }
        }

        // 5. Sync Approvals / Correction Requests
        if (approvals && Array.isArray(approvals)) {
          for (const ap of approvals) {
            try {
              if (!ap.date || (!ap.registration_id && !ap.user_name)) continue;
              // Find user_id from database using registration_id or user_name
              let userRow = null;
              if (ap.registration_id) {
                userRow = db.prepare("SELECT id FROM users WHERE registration_id = ?").get(ap.registration_id);
              }
              if (!userRow && ap.user_name) {
                userRow = db.prepare("SELECT id FROM users WHERE name = ?").get(ap.user_name);
              }
              if (!userRow) continue; // Skip if user not found locally

              let existing = null;
              if (ap.id) {
                existing = db.prepare("SELECT id FROM attendance_requests WHERE id = ?").get(ap.id);
              }

              if (existing) {
                db.prepare(`
                  UPDATE attendance_requests 
                  SET date = ?, check_in = ?, check_out = ?, status = ?, reason = ?, site_name = ?
                  WHERE id = ?
                `).run(ap.date, ap.check_in || null, ap.check_out || null, ap.status || 'PENDING', ap.reason || null, ap.site_name || null, existing.id);
              } else {
                db.prepare(`
                  INSERT INTO attendance_requests (user_id, date, check_in, check_out, status, reason, site_name)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(userRow.id, ap.date, ap.check_in || null, ap.check_out || null, ap.status || 'PENDING', ap.reason || null, ap.site_name || null);
              }
              stats.approvals++;
            } catch (err: any) {
              console.warn("Skipping approval request sync row:", ap, err.message);
            }
          }
        }

        // 6. Sync Geofencing Settings
        if (geofencing && Array.isArray(geofencing) && geofencing.length > 0) {
          try {
            const g = geofencing[0];
            const latVal = Number(g.latitude);
            const lngVal = Number(g.longitude);
            const radVal = Number(g.radius) || 150;

            if (!isNaN(latVal) && !isNaN(lngVal)) {
              db.prepare(`
                UPDATE geofence_settings 
                SET enabled = ?, latitude = ?, longitude = ?, radius = ?
                WHERE id = 1
              `).run(g.enabled ? 1 : 0, latVal, lngVal, radVal);
              stats.geofencing = 1;
            }
          } catch (err: any) {
            console.warn("Skipping geofencing settings sync:", err.message);
          }
        }

        return stats;
      });

      const stats = syncAllTransaction();
      const now = new Date().toISOString();
      db.prepare("UPDATE sheet_settings SET last_sync_timestamp = ? WHERE id = 1").run(now);

      res.json({
        success: true,
        message: "Successfully synchronized all data from Google Sheets!",
        stats,
        timestamp: now
      });
    } catch (e: any) {
      console.error("Pull all data error:", e);
      res.status(500).json({ success: false, message: e.message || "Failed to pull and synchronize data from Google Sheets." });
    }
  });

  // Export all local attendance logs to Google Sheet (Sync back via Apps Script Web App)
  app.post("/api/sheet-settings/export-attendance", async (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
      if (!settings || !settings.web_app_url) {
        return res.status(400).json({ success: false, message: "Google Sheets Web App URL is not configured." });
      }

      // Fetch all attendance logs
      const records = db.prepare(`
        SELECT a.date, a.check_in, a.check_out, u.registration_id, u.name, u.email, u.country, a.status, s.name as session_name, a.method
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        LEFT JOIN sessions s ON a.session_id = s.id
        ORDER BY a.date DESC, a.check_in DESC
      `).all() as any[];

      if (records.length === 0) {
        return res.json({ success: true, message: "No attendance records found to export" });
      }

      const response = await fetchWithRedirect(settings.web_app_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "exportAttendance",
          attendanceTab: settings.attendance_sheet_name || "Attendance",
          records: records
        })
      });

      if (!response.ok) {
         throw new Error(`Google Sheets Web App returned HTTP ${response.status}`);
      }

      const data = await response.json() as any;
      if (!data.success) {
         throw new Error(data.message || "Apps Script failed to export attendance");
      }

      res.json({ success: true, message: `Exported ${records.length} records to Google Sheet successfully!` });
    } catch (e: any) {
      console.error("Export attendance error:", e);
      res.status(500).json({ success: false, message: e.message || "Failed to export attendance data" });
    }
  });

  // Helper to append a single attendance log in real-time
  async function appendAttendanceLogLive(userId: number, date: string, checkInTime: string, status: string, method: string, sessionId: number | null, checkoutTime?: string) {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
      if (!settings || !settings.web_app_url || settings.sync_enabled === 0) {
        return; // Live sync not enabled or not configured
      }

      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
      if (!user) return;

      const response = await fetchWithRedirect(settings.web_app_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "appendAttendance",
          record: {
            date,
            check_in: checkInTime,
            check_out: checkoutTime || "",
            registration_id: user.registration_id || "",
            name: user.name,
            designation: user.designation || "",
            site_name: user.site_name || "Headquarters",
            status: status === 'P' ? 'Present' : (status === 'L' ? 'Late' : 'Half Day'),
            method: method || "App",
            created_at: new Date().toISOString()
          }
        })
      });

      if (response.ok) {
        console.log(`Live sync: logged punch for ${user.name}`);
      }
    } catch (err: any) {
      console.error("Failed to sync attendance live to Google Sheet:", err.message);
    }
  }

  // Centralized Full Database Synchronizer to Google Sheets
  async function syncFullDatabaseToSheets(logErrors = true): Promise<{ success: boolean; message: string }> {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
      if (!settings || !settings.web_app_url || settings.sync_enabled === 0) {
        return { success: false, message: "Sync is disabled or Web App URL is missing." };
      }

      const users = db.prepare("SELECT * FROM users").all() as any[];
      const attendance = db.prepare(`
        SELECT a.id, a.date, a.check_in, a.check_out, u.registration_id, u.name, u.designation, 
               COALESCE(u.site_name, a.location) as site_name, a.status, a.late_minutes, 
               a.overtime_hours, a.method, a.device_id, a.latitude, a.longitude, 
               a.ip_address, a.photo_url, a.early_checkout_reason, a.late_reason, a.created_at
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        ORDER BY a.date DESC, a.check_in DESC
      `).all() as any[];
      const sites = db.prepare("SELECT * FROM sites").all() as any[];
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

      const response = await fetchWithRedirect(settings.web_app_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Google Sheets Web App returned HTTP ${response.status}`);
      }

      const data = await response.json() as any;
      if (!data.success) {
        throw new Error(data.message || data.error || "Apps Script failed to export all data");
      }

      const now = new Date().toISOString();
      db.prepare("UPDATE sheet_settings SET last_sync_timestamp = ? WHERE id = 1").run(now);
      return { success: true, message: `Successfully synchronized at ${now}` };
    } catch (err: any) {
      if (logErrors) {
        console.error("Google Sheets synchronization error:", err.message);
      }
      return { success: false, message: err.message };
    }
  }

  // Helper to trigger automated/real-time sync to Google Sheets for any table
  async function triggerLiveSync(table: 'users' | 'sessions' | 'sites' | 'holidays' | 'approvals' | 'geofencing' | 'attendance' | 'designations' | 'salary_advances') {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
      if (!settings || !settings.web_app_url || settings.sync_enabled === 0) {
        return; // Live sync not enabled or not configured
      }

      // Fast synchronous sync for all tables or targeted table
      await syncFullDatabaseToSheets(false);
      console.log(`Live sync: triggered immediate Google Sheet update for ${table}`);
    } catch (err: any) {
      console.error(`Failed to sync ${table} live to Google Sheet:`, err.message);
    }
  }

  // Background Automatic Interval Sync (Runs every 60 seconds as a safety net)
  setInterval(async () => {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
      if (settings && settings.web_app_url && (settings.sync_enabled === 1 || settings.sync_enabled === true)) {
        await syncFullDatabaseToSheets(false);
      }
    } catch (err: any) {
      console.warn("Background auto-sync tick skipped:", err.message);
    }
  }, 60000);

  // Session Endpoints
  app.post("/api/sessions", (req, res) => {
    const { name, date, startTime, endTime, departmentId, site_name } = req.body;
    const deptId = departmentId && departmentId !== "" ? departmentId : null;
    try {
      const result = db.prepare(`
        INSERT INTO sessions (name, date, start_time, end_time, department_id, site_name)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(name, date, startTime, endTime, deptId, site_name || null);
      triggerLiveSync('sessions'); // Live sync
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get("/api/sessions", (req, res) => {
    const { siteName } = req.query;
    let sessions;
    if (siteName) {
      sessions = db.prepare(`
        SELECT s.*, d.name as department_name 
        FROM sessions s 
        LEFT JOIN departments d ON s.department_id = d.id
        WHERE LOWER(s.site_name) = LOWER(?)
        ORDER BY date DESC, start_time DESC
      `).all(siteName);
    } else {
      sessions = db.prepare(`
        SELECT s.*, d.name as department_name 
        FROM sessions s 
        LEFT JOIN departments d ON s.department_id = d.id
        ORDER BY date DESC, start_time DESC
      `).all();
    }
    res.json(sessions);
  });

  app.post("/api/attendance/manual", (req, res) => {
    const { userId, sessionId, date, time, status } = req.body;
    const sessId = sessionId && sessionId !== "" ? sessionId : null;
    
    // Check if already marked
    const existing = db.prepare("SELECT * FROM attendance WHERE user_id = ? AND session_id = ?").get(userId, sessId);
    
    if (existing) {
      return res.status(400).json({ success: false, message: "Attendance already marked for this shift" });
    }

    const result = db.prepare(`
      INSERT INTO attendance (user_id, session_id, date, check_in, status, method)
      VALUES (?, ?, ?, ?, ?, 'manual')
    `).run(userId, sessId, date, time, status);

    // Live sync to Google Sheets (runs in background)
    appendAttendanceLogLive(userId, date, time, status, 'manual', sessId);

    res.json({ success: true, id: result.lastInsertRowid });
  });

  app.post("/api/attendance/check-in", (req, res) => {
    const { userId, date, time, location, method, sessionId, deviceId, deviceInfo, photoUrl, lateReason } = req.body;
    
    // Security & Anti-Proxy Device Verification
    const userRow = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
    let isProxyFlagged = 0;

    if (userRow) {
      const allowedDevices = Number(userRow.allowed_devices) || 1;
      if (allowedDevices === 1) {
        // Enforce strict device lock for 1-device users
        if (userRow.bound_device_id && deviceId && userRow.bound_device_id !== deviceId) {
          return res.status(403).json({
            success: false,
            device_mismatch: true,
            message: `Security Violation: Account bound to another device (${userRow.last_device_info || 'Primary Device'}). Contact Admin to reset your device lock.`
          });
        } else if (!userRow.bound_device_id && deviceId) {
          db.prepare("UPDATE users SET bound_device_id = ?, last_device_info = ? WHERE id = ?").run(deviceId, deviceInfo || 'Primary Registered Device', userId);
        }
      }
    }

    // Check if already checked in for this session or date
    const existing = db.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ? AND (session_id = ? OR session_id IS NULL)").get(userId, date, sessionId || null);
    
    if (existing) {
      return res.status(400).json({ success: false, message: "Already checked in for today" });
    }

    // Extract IP address
    const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || "").split(',')[0].trim();

    // Extract coordinates if provided
    let lat: number | null = null;
    let lng: number | null = null;
    if (location && typeof location === 'object') {
      lat = typeof location.latitude === 'number' ? location.latitude : null;
      lng = typeof location.longitude === 'number' ? location.longitude : null;
    }

    // Enforce Geofencing (for assigned sites or when enabled globally)
    const geofence = db.prepare("SELECT * FROM geofence_settings WHERE id = 1").get() as any;
    
    // Find user's assigned site
    let siteName: string | null = null;
    if (sessionId) {
      const sess = db.prepare("SELECT site_name FROM sessions WHERE id = ?").get(sessionId) as any;
      if (sess && sess.site_name) {
        siteName = sess.site_name;
      }
    }
    if (!siteName && userId) {
      const u = db.prepare("SELECT site_name, country FROM users WHERE id = ?").get(userId) as any;
      if (u) {
        siteName = u.site_name || u.country || null;
      }
    }

    const assignedSite = siteName ? db.prepare("SELECT * FROM sites WHERE LOWER(name) = LOWER(?)").get(siteName) as any : null;
    const shouldEnforceGeofence = (geofence && geofence.enabled === 1) || !!assignedSite;

    if (shouldEnforceGeofence) {
      if (lat === null || lng === null) {
        return res.status(400).json({ 
          success: false, 
          message: `GPS Location Required: Attendance for site '${siteName || 'Designated Site'}' requires active GPS location.` 
        });
      }

      let targetLat = assignedSite?.latitude || geofence?.latitude || 23.0225;
      let targetLng = assignedSite?.longitude || geofence?.longitude || 72.5714;
      let targetRadius = assignedSite?.radius || geofence?.radius || 150;
      let siteLabel = assignedSite?.name || siteName || "Designated Site";

      const distance = getHaversineDistance(lat, lng, targetLat, targetLng);
      if (distance > targetRadius) {
        return res.status(400).json({ 
          success: false, 
          message: `Attendance Denied (Outside Site Boundary): You are assigned to '${siteLabel}'. You are ${Math.round(distance)}m away (Allowed radius: ${targetRadius}m). Attendance cannot be marked from other sites or outside designated coordinates.` 
        });
      }
    }

    // Calculate Late status (Office official time is 10:00 AM or user work_start_time)
    let status = "P";
    let isLate = 0;
    let lateMinutes = 0;

    const timeParts = time.split(":");
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1] || "0", 10);
    const totalMinutes = hours * 60 + minutes;
    
    let standardStartMinutes = 10 * 60; // 10:00 AM
    if (userRow && userRow.work_start_time) {
      const parts = userRow.work_start_time.split(":");
      if (parts.length >= 2) {
        standardStartMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      }
    }

    if (totalMinutes > standardStartMinutes) {
      status = "L";
      isLate = 1;
      lateMinutes = totalMinutes - standardStartMinutes;
    }

    const result = db.prepare(`
      INSERT INTO attendance (user_id, session_id, date, check_in, status, location, method, ip_address, latitude, longitude, device_id, photo_url, is_proxy_flagged, is_late, late_minutes, late_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId, 
      sessionId || null, 
      date, 
      time, 
      status, 
      location ? JSON.stringify(location) : null, 
      method || 'app',
      ip || null,
      lat,
      lng,
      deviceId || null,
      photoUrl || null,
      isProxyFlagged,
      isLate,
      lateMinutes,
      lateReason || null
    );

    appendAttendanceLogLive(userId, date, time, status, method || 'app', sessionId || null);

    res.json({ 
      success: true, 
      id: result.lastInsertRowid,
      isLate: isLate === 1,
      lateMinutes,
      status
    });
  });

  app.post("/api/attendance/check-out", (req, res) => {
    const { userId, date, time, earlyCheckoutReason } = req.body;
    try {
      const lastRecord = db.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ? ORDER BY id DESC LIMIT 1").get(userId, date) as any;
      
      if (!lastRecord) {
        return res.status(404).json({ success: false, message: "No check-in record found for today. Please check in first." });
      }

      if (lastRecord.check_out) {
        return res.status(400).json({ success: false, message: "Already checked out today" });
      }

      // Calculate Overtime (after 07:00 PM / 19:00)
      let overtimeHours = 0;
      if (time) {
        const timeParts = time.split(":");
        const outHours = parseInt(timeParts[0], 10);
        const outMinutes = parseInt(timeParts[1] || "0", 10);
        const totalOutMinutes = outHours * 60 + outMinutes;
        const standardEndMinutes = 19 * 60; // 07:00 PM
        if (totalOutMinutes > standardEndMinutes) {
          overtimeHours = Math.round(((totalOutMinutes - standardEndMinutes) / 60) * 10) / 10;
        }
      }

      db.prepare(`
        UPDATE attendance 
        SET check_out = ?, early_checkout_reason = ?, overtime_hours = ?
        WHERE id = ?
      `).run(time, earlyCheckoutReason || null, overtimeHours, lastRecord.id);

      const updatedRecord = db.prepare("SELECT * FROM attendance WHERE id = ?").get(lastRecord.id) as any;

      appendAttendanceLogLive(userId, date, updatedRecord.check_in, updatedRecord.status, updatedRecord.method, updatedRecord.session_id, time);

      res.json({ 
        success: true, 
        message: `Successfully checked out at ${time}`,
        overtimeHours
      });
    } catch (e: any) {
      console.error("Check-out API error:", e);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get("/api/attendance/history/:userId", (req, res) => {
    const history = db.prepare(`
      SELECT a.*, s.name as session_name 
      FROM attendance a 
      LEFT JOIN sessions s ON a.session_id = s.id 
      WHERE a.user_id = ? 
      ORDER BY a.date DESC
    `).all(req.params.userId);
    res.json(history);
  });

  app.get("/api/super_admin/attendance", (req, res) => {
    const { siteName, date, userId } = req.query;
    try {
      let query = `
        SELECT a.*, u.name as user_name, u.registration_id, u.site_name as user_site_name, u.designation, d.name as department_name, s.name as session_name
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN sessions s ON a.session_id = s.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (siteName && siteName !== 'All') {
        query += ` AND (LOWER(u.site_name) = LOWER(?) OR LOWER(s.site_name) = LOWER(?))`;
        params.push(siteName, siteName);
      }
      if (date) {
        query += ` AND a.date = ?`;
        params.push(date);
      }
      if (userId) {
        query += ` AND a.user_id = ?`;
        params.push(userId);
      }

      query += ` ORDER BY a.date DESC, a.check_in DESC`;
      const records = db.prepare(query).all(...params);
      res.json(records);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Admin Create / Update / Delete Attendance manually
  app.post("/api/super_admin/attendance/create", (req, res) => {
    const { userId, date, checkIn, checkOut, status, siteName, reason, lateMinutes, overtimeHours } = req.body;
    try {
      const result = db.prepare(`
        INSERT INTO attendance (user_id, date, check_in, check_out, status, method, early_checkout_reason, is_late, late_minutes, overtime_hours)
        VALUES (?, ?, ?, ?, ?, 'admin_manual', ?, ?, ?, ?)
      `).run(userId, date, checkIn || null, checkOut || null, status || 'P', reason || null, (lateMinutes && Number(lateMinutes) > 0) ? 1 : 0, Number(lateMinutes) || 0, Number(overtimeHours) || 0);
      triggerLiveSync('attendance');
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.put("/api/super_admin/attendance/:id", (req, res) => {
    const { id } = req.params;
    const { date, checkIn, checkOut, status, reason, lateMinutes, overtimeHours } = req.body;
    try {
      db.prepare(`
        UPDATE attendance 
        SET date = ?, check_in = ?, check_out = ?, status = ?, early_checkout_reason = ?, is_late = ?, late_minutes = ?, overtime_hours = ?
        WHERE id = ?
      `).run(date, checkIn || null, checkOut || null, status || 'P', reason || null, (lateMinutes && Number(lateMinutes) > 0) ? 1 : 0, Number(lateMinutes) || 0, Number(overtimeHours) || 0, id);
      triggerLiveSync('attendance');
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.delete("/api/super_admin/attendance/record/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM attendance WHERE id = ?").run(id);
      triggerLiveSync('attendance');
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Clear all attendance logs (filtered by site if requested)
  app.delete("/api/super_admin/attendance/clear", (req, res) => {
    const { siteName } = req.query;
    try {
      if (siteName) {
        db.prepare(`
          DELETE FROM attendance 
          WHERE user_id IN (SELECT id FROM users WHERE LOWER(site_name) = LOWER(?) OR LOWER(country) = LOWER(?))
        `).run(siteName, siteName);
        res.json({ success: true, message: `All attendance logs for site '${siteName}' have been cleared successfully.` });
      } else {
        db.prepare("DELETE FROM attendance").run();
        res.json({ success: true, message: "All attendance logs have been cleared successfully." });
      }
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Execute custom raw SQL from Admin Console
  app.post("/api/admin/execute-sql", (req, res) => {
    const { sql } = req.body;
    if (!sql) {
      return res.status(400).json({ success: false, message: "SQL statement is required" });
    }
    try {
      const trimmed = sql.trim().toUpperCase();
      let result;
      if (trimmed.startsWith("SELECT") || trimmed.startsWith("PRAGMA") || trimmed.startsWith("EXPLAIN") || trimmed.startsWith("SHOW") || trimmed.startsWith("WITH")) {
        result = db.prepare(sql).all();
        res.json({ success: true, type: "select", data: result });
      } else {
        const info = db.prepare(sql).run();
        res.json({ success: true, type: "run", data: info });
      }
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Get table schemas for console autocomplete and visualization
  app.get("/api/admin/database-schema", (req, res) => {
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
      const schema: Record<string, any[]> = {};
      for (const table of tables) {
        schema[table.name] = db.prepare(`PRAGMA table_info(${table.name})`).all();
      }
      res.json({ success: true, schema });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // --- Holidays Master APIs ---
  app.get("/api/holidays", (req, res) => {
    try {
      const holidays = db.prepare("SELECT * FROM holidays ORDER BY date ASC").all();
      res.json(holidays);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/holidays", (req, res) => {
    const { date, name } = req.body;
    try {
      const result = db.prepare("INSERT INTO holidays (date, name) VALUES (?, ?)").run(date, name);
      triggerLiveSync('holidays'); // Live sync holidays
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (err: any) {
      res.status(400).json({ success: false, message: "Holiday for this date already exists or invalid data." });
    }
  });

  app.delete("/api/holidays/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM holidays WHERE id = ?").run(req.params.id);
      triggerLiveSync('holidays'); // Live sync holidays
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // --- Leave, Half Day, Weekly Off & Attendance Requests APIs ---
  app.get("/api/attendance/requests", (req, res) => {
    const { siteName } = req.query;
    try {
      let requests;
      if (siteName) {
        requests = db.prepare(`
          SELECT r.*, u.name as user_name, u.registration_id, u.site_name as user_site_name, u.designation
          FROM attendance_requests r
          JOIN users u ON r.user_id = u.id
          WHERE LOWER(u.site_name) = LOWER(?) OR LOWER(r.site_name) = LOWER(?)
          ORDER BY r.created_at DESC
        `).all(siteName, siteName);
      } else {
        requests = db.prepare(`
          SELECT r.*, u.name as user_name, u.registration_id, u.site_name as user_site_name, u.designation
          FROM attendance_requests r
          JOIN users u ON r.user_id = u.id
          ORDER BY r.created_at DESC
        `).all();
      }
      res.json(requests);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/attendance/requests/user/:userId", (req, res) => {
    try {
      const requests = db.prepare("SELECT * FROM attendance_requests WHERE user_id = ? ORDER BY created_at DESC").all(req.params.userId);
      res.json(requests);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  const handleAttendanceRequest = (req: any, res: any) => {
    const { userId, date, startDate, endDate, checkIn, checkOut, requested_check_in, requested_check_out, reason, siteName, type, halfDaySlot } = req.body;
    try {
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const reqType = type || 'CORRECTION';
      const targetDate = date || startDate || new Date().toISOString().split('T')[0];
      const finalCheckIn = checkIn || requested_check_in || null;
      const finalCheckOut = checkOut || requested_check_out || null;

      // Time Correction restriction: Max 3 per calendar month for normal staff
      if ((reqType === 'TIME_CHANGE' || reqType === 'CORRECTION') && user.role === 'user') {
        const monthPrefix = targetDate.slice(0, 7); // YYYY-MM
        const usedCorrectionCount = db.prepare(`
          SELECT COUNT(*) as count 
          FROM attendance_requests 
          WHERE user_id = ? AND (type = 'TIME_CHANGE' OR type = 'CORRECTION') AND date LIKE ? AND status != 'REJECTED'
        `).get(userId, `${monthPrefix}%`) as { count: number };

        if (usedCorrectionCount.count >= 3) {
          return res.status(400).json({ 
            success: false, 
            message: `Monthly Limit Reached: Maximum 3 Time Correction requests are allowed per calendar month (${monthPrefix}). Please contact Admin for manual overrides.` 
          });
        }
      }

      // Weekly off restriction: Max 4 weekly offs per calendar month for normal staff
      if (reqType === 'WEEKLY_OFF' && user.role === 'user') {
        const monthPrefix = targetDate.slice(0, 7); // YYYY-MM
        const usedWeeklyOffCount = db.prepare(`
          SELECT COUNT(*) as count 
          FROM attendance_requests 
          WHERE user_id = ? AND type = 'WEEKLY_OFF' AND date LIKE ? AND status != 'REJECTED'
        `).get(userId, `${monthPrefix}%`) as { count: number };

        if (usedWeeklyOffCount.count >= 4) {
          return res.status(400).json({ 
            success: false, 
            message: `Monthly Quota Exceeded: You have already used all 4 Weekly Offs allowed for ${monthPrefix}. For additional time off, please apply under Advance Leave or Emergency Leave.` 
          });
        }
      }

      const result = db.prepare(`
        INSERT INTO attendance_requests (user_id, date, start_date, end_date, check_in, check_out, reason, site_name, type, half_day_slot, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
      `).run(
        userId, 
        targetDate, 
        startDate || targetDate, 
        endDate || targetDate, 
        finalCheckIn, 
        finalCheckOut, 
        reason || null, 
        siteName || user.site_name || null,
        reqType,
        halfDaySlot || null
      );

      // Create notification for management
      try {
        db.prepare(`
          INSERT INTO notifications (user_id, title, message, type)
          VALUES (NULL, ?, ?, 'info')
        `).run(
          `New ${reqType.replace(/_/g, ' ')} Request`,
          `${user.name} (${user.registration_id || 'Staff'}) submitted a request for ${startDate && endDate && startDate !== endDate ? `${startDate} to ${endDate}` : targetDate}.`
        );
      } catch (notifErr) {
        console.error("Failed to write notification:", notifErr);
      }

      triggerLiveSync('approvals');
      res.json({ success: true, id: result.lastInsertRowid, message: "Request submitted successfully for approval." });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  };

  app.post("/api/attendance/request", handleAttendanceRequest);
  app.post("/api/attendance/requests", handleAttendanceRequest);

  app.post("/api/attendance/requests/:id/approve", (req, res) => {
    const { id } = req.params;
    const { adminComment, actionedBy } = req.body;
    try {
      const request = db.prepare("SELECT * FROM attendance_requests WHERE id = ?").get(id) as any;
      if (!request) {
        return res.status(404).json({ success: false, message: "Request not found." });
      }

      const approverName = actionedBy || 'Admin / Management';
      const commentText = adminComment || `Approved by ${approverName}`;

      // Update request status with admin comment, actioned timestamp and approver name
      db.prepare(`
        UPDATE attendance_requests 
        SET status = 'APPROVED', 
            admin_comment = ?,
            actioned_at = CURRENT_TIMESTAMP,
            actioned_by = ?
        WHERE id = ?
      `).run(commentText, approverName, id);

      let attStatus = 'P';
      if (request.type === 'WEEKLY_OFF') attStatus = 'Weekly Off';
      else if (request.type === 'HALF_DAY') attStatus = 'Half Day';
      else if (request.type === 'ADVANCE_LEAVE' || request.type === 'EMERGENCY_LEAVE' || request.type === 'LEAVE') attStatus = 'Leave';

      // Check if attendance record already exists for this user on this date
      const existing = db.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?").get(request.user_id, request.date) as any;

      if (existing) {
        db.prepare(`
          UPDATE attendance 
          SET check_in = COALESCE(?, check_in), check_out = COALESCE(?, check_out), status = ?, early_checkout_reason = COALESCE(?, early_checkout_reason)
          WHERE id = ?
        `).run(request.check_in, request.check_out, attStatus, request.reason, existing.id);
      } else {
        db.prepare(`
          INSERT INTO attendance (user_id, date, check_in, check_out, status, method, early_checkout_reason)
          VALUES (?, ?, ?, ?, ?, 'request_approved', ?)
        `).run(request.user_id, request.date, request.check_in || '10:00:00', request.check_out || '19:00:00', attStatus, request.reason);
      }

      // Notify the employee with exact decision time & approver
      try {
        const actionTimeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        const actionDateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        db.prepare(`
          INSERT INTO notifications (user_id, title, message, type)
          VALUES (?, ?, ?, 'success')
        `).run(
          request.user_id,
          `Request Approved: ${request.type ? request.type.replace(/_/g, ' ') : 'Attendance'}`,
          `Your request for ${request.date} was approved on ${actionDateStr} at ${actionTimeStr} by ${approverName}. Note: ${commentText}`
        );
      } catch (notifErr) {
        console.error("Failed to write approval notification:", notifErr);
      }

      triggerLiveSync('approvals');
      triggerLiveSync('attendance');
      res.json({ success: true, message: "Request approved and attendance recorded." });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/attendance/requests/:id/reject", (req, res) => {
    const { id } = req.params;
    const { adminComment, actionedBy } = req.body;
    try {
      const request = db.prepare("SELECT * FROM attendance_requests WHERE id = ?").get(id) as any;
      if (!request) {
        return res.status(404).json({ success: false, message: "Request not found." });
      }

      const rejectorName = actionedBy || 'Admin / Management';
      const commentText = adminComment || `Declined by ${rejectorName}`;

      db.prepare(`
        UPDATE attendance_requests 
        SET status = 'REJECTED', 
            admin_comment = ?,
            actioned_at = CURRENT_TIMESTAMP,
            actioned_by = ?
        WHERE id = ?
      `).run(commentText, rejectorName, id);

      // Notify the employee with exact decision time & rejector
      try {
        const actionTimeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        const actionDateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        db.prepare(`
          INSERT INTO notifications (user_id, title, message, type)
          VALUES (?, ?, ?, 'error')
        `).run(
          request.user_id,
          `Request Declined: ${request.type ? request.type.replace(/_/g, ' ') : 'Attendance'}`,
          `Your request for ${request.date} was declined on ${actionDateStr} at ${actionTimeStr} by ${rejectorName}. Reason: ${commentText}`
        );
      } catch (notifErr) {
        console.error("Failed to write decline notification:", notifErr);
      }

      triggerLiveSync('approvals');
      res.json({ success: true, message: "Request rejected." });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // User Profile Self-Update Endpoint
  app.put("/api/users/:id/profile", (req, res) => {
    const { id } = req.params;
    const { email, current_address, marital_status, documents, avatar_url, emergency_contact, site_name, date_of_joining, date_of_birth } = req.body;
    try {
      db.prepare(`
        UPDATE users 
        SET email = COALESCE(?, email),
            current_address = ?,
            marital_status = ?,
            documents = ?,
            avatar_url = COALESCE(?, avatar_url),
            emergency_contact = COALESCE(?, emergency_contact),
            site_name = COALESCE(?, site_name),
            date_of_joining = COALESCE(?, date_of_joining),
            date_of_birth = COALESCE(?, date_of_birth)
        WHERE id = ?
      `).run(
        email || null,
        current_address || null,
        marital_status || null,
        documents ? JSON.stringify(documents) : null,
        avatar_url || null,
        emergency_contact || null,
        site_name || null,
        date_of_joining || null,
        date_of_birth || null,
        id
      );

      const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
      triggerLiveSync('users');
      res.json({ success: true, user: updatedUser, message: "Profile updated successfully." });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Dedicated Password Change Endpoint for Users, Admin & Director
  app.put("/api/users/:id/change-password", (req, res) => {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    
    if (!newPassword || !newPassword.trim()) {
      return res.status(400).json({ success: false, message: "Please provide a new password." });
    }

    try {
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
      if (!user) {
        return res.status(404).json({ success: false, message: "User account not found." });
      }

      // If currentPassword is provided, verify it (unless user had no password yet)
      if (currentPassword !== undefined && currentPassword !== null && currentPassword !== '') {
        const expectedPwd = user.password || user.registration_id || 'password123';
        if (user.password && currentPassword.trim() !== expectedPwd) {
          return res.status(400).json({ success: false, message: "Current password does not match. Please try again." });
        }
      }

      const trimmedNewPwd = newPassword.trim();
      if (trimmedNewPwd.length < 3) {
        return res.status(400).json({ success: false, message: "New password must be at least 3 characters long." });
      }

      db.prepare("UPDATE users SET password = ? WHERE id = ?").run(trimmedNewPwd, id);
      triggerLiveSync('users');

      const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
      res.json({ 
        success: true, 
        user: updatedUser,
        message: "Password changed successfully! You can now sign in with your new password." 
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Edit / Reschedule Pending Attendance Request Endpoint
  app.put("/api/attendance/requests/:id", (req, res) => {
    const { id } = req.params;
    const { userId, date, startDate, endDate, reason, check_in, check_out, type, half_day_slot } = req.body;
    try {
      const existing = db.prepare("SELECT * FROM attendance_requests WHERE id = ?").get(id) as any;
      if (!existing) {
        return res.status(404).json({ success: false, message: "Request not found." });
      }

      if (userId && Number(existing.user_id) !== Number(userId)) {
        return res.status(403).json({ success: false, message: "Unauthorized to edit this request." });
      }

      if (existing.status !== 'PENDING') {
        return res.status(400).json({ success: false, message: "Only pending requests can be rescheduled or modified." });
      }

      const targetDate = date || startDate || existing.date;
      const targetStartDate = startDate || date || existing.start_date || targetDate;
      const targetEndDate = endDate || date || existing.end_date || targetDate;

      db.prepare(`
        UPDATE attendance_requests
        SET date = ?,
            start_date = ?,
            end_date = ?,
            reason = ?,
            check_in = COALESCE(?, check_in),
            check_out = COALESCE(?, check_out),
            type = COALESCE(?, type),
            half_day_slot = COALESCE(?, half_day_slot)
        WHERE id = ?
      `).run(
        targetDate,
        targetStartDate,
        targetEndDate,
        reason || existing.reason,
        check_in || null,
        check_out || null,
        type || null,
        half_day_slot || null,
        id
      );

      triggerLiveSync('approvals');
      res.json({ success: true, message: "Request rescheduled & updated successfully." });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Admin Credentials & Device Policy Management Endpoint
  app.put("/api/users/:id/credentials", (req, res) => {
    const { id } = req.params;
    const { name, registration_id, password, allowed_devices, role, designation, site_name } = req.body;
    try {
      db.prepare(`
        UPDATE users
        SET name = COALESCE(?, name),
            registration_id = COALESCE(?, registration_id),
            password = COALESCE(?, password),
            allowed_devices = COALESCE(?, allowed_devices),
            role = COALESCE(?, role),
            designation = COALESCE(?, designation),
            site_name = COALESCE(?, site_name)
        WHERE id = ?
      `).run(
        name || null,
        registration_id || null,
        password || null,
        allowed_devices ? Number(allowed_devices) : 1,
        role || null,
        designation || null,
        site_name || null,
        id
      );

      triggerLiveSync('users');
      res.json({ success: true, message: "User credentials and device permissions updated." });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Monthly Automated Summary API for single user or all users
  app.get("/api/reports/monthly-summary", (req, res) => {
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7); // YYYY-MM
    const { siteName, userId } = req.query;
    try {
      let usersQuery = "SELECT * FROM users WHERE 1=1";
      const uParams: any[] = [];
      if (userId) {
        usersQuery += " AND id = ?";
        uParams.push(userId);
      } else if (siteName && siteName !== 'All') {
        usersQuery += " AND (LOWER(site_name) = LOWER(?) OR LOWER(country) = LOWER(?))";
        uParams.push(siteName, siteName);
      }
      usersQuery += " ORDER BY name ASC";

      const userList = db.prepare(usersQuery).all(...uParams) as any[];

      const [yearStr, mStr] = month.split('-');
      const year = Number(yearStr);
      const m = Number(mStr);
      const daysInMonth = new Date(year, m, 0).getDate();

      const attendanceRows = db.prepare(`
        SELECT a.*, u.name as user_name, u.registration_id
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        WHERE a.date LIKE ?
      `).all(`${month}%`) as any[];

      const summaryList = userList.map(u => {
        const userAtt = attendanceRows.filter(a => a.user_id === u.id);
        const presentCount = userAtt.filter(a => a.status === 'P').length;
        const lateCount = userAtt.filter(a => a.status === 'L').length;
        const leaveCount = userAtt.filter(a => a.status === 'Leave' || a.status === 'Half Day').length;
        const weeklyOffCount = userAtt.filter(a => a.status === 'Weekly Off').length;
        const totalWorkedDays = presentCount + lateCount;
        const absentCount = Math.max(0, daysInMonth - (totalWorkedDays + leaveCount + weeklyOffCount));

        let totalOvertimeHours = 0;
        let totalLateMinutes = 0;
        userAtt.forEach(a => {
          if (a.overtime_hours) totalOvertimeHours += Number(a.overtime_hours);
          if (a.late_minutes) totalLateMinutes += Number(a.late_minutes);
        });

        return {
          user_id: u.id,
          name: u.name,
          registration_id: u.registration_id,
          site_name: u.site_name || 'Headquarters',
          designation: u.designation || 'Staff Member',
          role: u.role,
          month,
          daysInMonth,
          presentCount,
          lateCount,
          leaveCount,
          weeklyOffCount,
          absentCount,
          totalWorkedDays,
          totalLateMinutes,
          totalOvertimeHours,
          attendanceLogs: userAtt
        };
      });

      res.json({
        success: true,
        month,
        daysInMonth,
        totalEmployees: userList.length,
        summary: summaryList
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Dynamic Site Master APIs
  app.get("/api/sites", (req, res) => {
    try {
      const sites = db.prepare("SELECT * FROM sites ORDER BY name ASC").all();
      res.json(sites);
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/sites", (req, res) => {
    const { name, latitude, longitude, radius } = req.body;
    try {
      if (!name || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ success: false, message: "Missing required fields: name, latitude, longitude" });
      }
      const result = db.prepare(`
        INSERT INTO sites (name, latitude, longitude, radius)
        VALUES (?, ?, ?, ?)
      `).run(name, Number(latitude), Number(longitude), Number(radius) || 150);
      triggerLiveSync('sites'); // Live sync sites
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ success: false, message: e.message || "Failed to create site" });
    }
  });

  app.put("/api/sites/:id", (req, res) => {
    const { name, latitude, longitude, radius } = req.body;
    const { id } = req.params;
    try {
      if (!name || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ success: false, message: "Missing required fields: name, latitude, longitude" });
      }
      db.prepare(`
        UPDATE sites 
        SET name = ?, latitude = ?, longitude = ?, radius = ?
        WHERE id = ?
      `).run(name, Number(latitude), Number(longitude), Number(radius) || 150, id);
      triggerLiveSync('sites'); // Live sync sites
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.delete("/api/sites/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM sites WHERE id = ?").run(id);
      triggerLiveSync('sites'); // Live sync sites
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get("/api/geofence-settings", (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM geofence_settings WHERE id = 1").get();
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/geofence-settings", (req, res) => {
    try {
      const { enabled, latitude, longitude, radius } = req.body;
      db.prepare(`
        UPDATE geofence_settings 
        SET enabled = ?, latitude = ?, longitude = ?, radius = ?
        WHERE id = 1
      `).run(enabled ? 1 : 0, Number(latitude), Number(longitude), Number(radius));
      triggerLiveSync('geofencing'); // Live sync geofencing
      res.json({ success: true, message: "Geofence settings updated successfully." });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/users/bulk", (req, res) => {
    const { users } = req.body;
    if (!Array.isArray(users)) {
      return res.status(400).json({ success: false, message: "Invalid data format" });
    }

    const insert = db.prepare("INSERT INTO users (registration_id, username, name, email, phone, country, role, department_id, site_name, password, designation, allowed_devices, work_start_time, work_end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const insertMany = db.transaction((usersList) => {
      for (const u of usersList) {
        try {
          const defaultPwd = u.password || u.registration_id || 'password123';
          const cleanEmail = u.email && u.email.trim() ? u.email.trim() : null;
          const cleanPhone = u.phone && u.phone.trim() ? u.phone.trim() : null;
          const cleanRegId = u.registration_id && u.registration_id.trim() ? u.registration_id.trim() : null;
          const derivedUsername = u.username || (u.name ? u.name.toLowerCase().replace(/[^a-z0-9]/g, '.') : null);

          insert.run(
            cleanRegId,
            derivedUsername,
            u.name.trim(),
            cleanEmail,
            cleanPhone,
            u.country || null,
            u.role || 'user',
            u.department_id || null,
            u.site_name || 'Headquarters',
            defaultPwd,
            u.designation || 'Staff',
            Number(u.allowed_devices) || 1,
            u.work_start_time || '10:00',
            u.work_end_time || '19:00'
          );
        } catch (e: any) {
          console.error(`Failed to insert bulk user ${u.name}:`, e.message);
        }
      }
    });

    try {
      insertMany(users);
      triggerLiveSync('users');
      backupDatabaseToJson();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Universal User / Staff Creation Handler
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
        // If registration_id is already taken, safely append or handle
        const existing = db.prepare("SELECT id FROM users WHERE registration_id = ?").get(cleanRegId);
        if (existing) {
          cleanRegId = `${cleanRegId}-${Date.now().toString().slice(-3)}`;
        }
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
        cleanRegId,
        derivedUsername,
        name.trim(),
        cleanEmail,
        cleanPhone,
        country || null,
        role || 'user',
        department_id || null,
        site_name || 'Headquarters',
        defaultPwd,
        designation || 'Staff',
        Number(allowed_devices) || 1,
        work_start_time || '10:00',
        work_end_time || '19:00',
        Number(monthly_salary) || 0,
        date_of_joining || new Date().toISOString().split('T')[0]
      );

      triggerLiveSync('users');
      backupDatabaseToJson(); // Instant durable persistence
      
      const newUser = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
      res.json({ success: true, id: result.lastInsertRowid, user: newUser, message: "Staff member registered successfully" });
    } catch (e: any) {
      console.error("Create user error:", e);
      res.status(400).json({ success: false, message: e.message || "Failed to create staff member" });
    }
  };

  app.post("/api/users", handleCreateUser);
  app.post("/api/super_admin/users", handleCreateUser);

  // Universal User / Staff Update Handler
  const handleUpdateUser = (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const { 
      registration_id, username, name, email, phone, country, role, 
      department_id, site_name, password, designation, allowed_devices, 
      work_start_time, work_end_time, monthly_salary, date_of_joining 
    } = req.body;

    try {
      const existingUser = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
      if (!existingUser) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const cleanEmail = email !== undefined ? (email && email.trim() ? email.trim() : null) : existingUser.email;
      const cleanPhone = phone !== undefined ? (phone && phone.trim() ? phone.trim() : null) : existingUser.phone;
      const cleanRegId = registration_id !== undefined ? (registration_id && registration_id.trim() ? registration_id.trim() : existingUser.registration_id) : existingUser.registration_id;
      const cleanUsername = username !== undefined ? (username && username.trim() ? username.trim().toLowerCase() : existingUser.username) : existingUser.username;

      db.prepare(`
        UPDATE users 
        SET registration_id = ?,
            username = ?,
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
        cleanRegId,
        cleanUsername,
        name ? name.trim() : null,
        cleanEmail,
        cleanPhone,
        country !== undefined ? country : null,
        role !== undefined ? role : null,
        department_id !== undefined ? department_id : null,
        site_name !== undefined ? site_name : null,
        password && password.trim() ? password.trim() : null,
        designation !== undefined ? designation : null,
        allowed_devices !== undefined ? Number(allowed_devices) : null,
        work_start_time !== undefined ? work_start_time : null,
        work_end_time !== undefined ? work_end_time : null,
        monthly_salary !== undefined ? Number(monthly_salary) : null,
        date_of_joining !== undefined ? date_of_joining : null,
        id
      );

      triggerLiveSync('users');
      backupDatabaseToJson(); // Instant durable persistence
      
      const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
      res.json({ success: true, user: updatedUser, message: "Staff updated successfully" });
    } catch (e: any) {
      console.error("Update user error:", e);
      res.status(500).json({ success: false, message: e.message });
    }
  };

  app.put("/api/users/:id", handleUpdateUser);
  app.put("/api/super_admin/users/:id", handleUpdateUser);

  app.put("/api/users/:id/role", (req, res) => {
    const { role } = req.body;
    const { id } = req.params;
    const lowerRole = role ? String(role).toLowerCase() : "";
    if (lowerRole !== "user" && lowerRole !== "super_admin" && lowerRole !== "site_manager" && lowerRole !== "admin" && lowerRole !== "director") {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }
    try {
      db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
      triggerLiveSync('users');
      backupDatabaseToJson();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // DELETE User endpoint (Admin Console)
  app.delete(["/api/users/:id", "/api/super_admin/users/:id"], (req, res) => {
    const { id } = req.params;
    try {
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // Delete child records first to maintain integrity
      db.prepare("DELETE FROM attendance WHERE user_id = ?").run(id);
      db.prepare("DELETE FROM attendance_requests WHERE user_id = ?").run(id);
      db.prepare("DELETE FROM salary_advances WHERE user_id = ?").run(id);
      db.prepare("DELETE FROM notifications WHERE user_id = ?").run(id);
      db.prepare("DELETE FROM users WHERE id = ?").run(id);

      triggerLiveSync('users');
      backupDatabaseToJson();
      res.json({ success: true, message: `User '${user.name}' deleted successfully.` });
    } catch (e: any) {
      console.error("Delete user error:", e);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Super Admin Device Reset Alias
  app.post("/api/super_admin/users/:id/reset_device", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("UPDATE users SET bound_device_id = NULL, last_device_info = NULL WHERE id = ?").run(id);
      triggerLiveSync('users');
      res.json({ success: true, message: "Device lock reset successfully" });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Super Admin Site Creation Alias
  app.post(["/api/super_admin/sites", "/api/sites"], (req, res) => {
    const { name, address, latitude, longitude, geofence_radius, radius, work_start_time, work_end_time } = req.body;
    try {
      if (!name || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ success: false, message: "Missing required fields: name, latitude, longitude" });
      }
      const rad = Number(geofence_radius) || Number(radius) || 150;
      const result = db.prepare(`
        INSERT INTO sites (name, address, latitude, longitude, radius, work_start_time, work_end_time)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(name, address || null, Number(latitude), Number(longitude), rad, work_start_time || '10:00', work_end_time || '19:00');
      triggerLiveSync('sites');
      res.json({ success: true, id: result.lastInsertRowid, message: "Site created successfully" });
    } catch (e: any) {
      res.status(400).json({ success: false, message: e.message || "Failed to create site" });
    }
  });

  // Super Admin Site Update Endpoint
  app.put(["/api/super_admin/sites/:id", "/api/sites/:id"], (req, res) => {
    const { name, address, latitude, longitude, geofence_radius, radius, work_start_time, work_end_time } = req.body;
    const { id } = req.params;
    try {
      if (!name || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ success: false, message: "Missing required fields: name, latitude, longitude" });
      }
      const rad = Number(geofence_radius) || Number(radius) || 150;
      db.prepare(`
        UPDATE sites 
        SET name = ?, address = ?, latitude = ?, longitude = ?, radius = ?, work_start_time = ?, work_end_time = ?
        WHERE id = ?
      `).run(name, address || null, Number(latitude), Number(longitude), rad, work_start_time || '10:00', work_end_time || '19:00', id);
      triggerLiveSync('sites');
      res.json({ success: true, message: "Site updated successfully" });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Super Admin Site Delete Alias
  app.delete(["/api/super_admin/sites/:id", "/api/sites/:id"], (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM sites WHERE id = ?").run(id);
      triggerLiveSync('sites');
      res.json({ success: true, message: "Site deleted successfully" });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Super Admin Manual Attendance with Full Calculations
  app.post(["/api/super_admin/attendance/manual", "/api/attendance/manual"], (req, res) => {
    const { userId, date, checkIn, checkOut, status, reason, lateMinutes, overtimeHours } = req.body;
    try {
      const userRow = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
      let computedStatus = status || 'P';
      let isLate = 0;
      let lateMins = Number(lateMinutes) || 0;
      let otHoursVal = Number(overtimeHours) || 0;

      const startTime = userRow?.work_start_time || '10:00';
      const endTime = userRow?.work_end_time || '19:00';

      if (checkIn) {
        const parts = checkIn.split(':');
        const startParts = startTime.split(':');
        const checkInMins = parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
        const startMins = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1] || '0', 10);
        if (checkInMins > startMins) {
          isLate = 1;
          lateMins = checkInMins - startMins;
          if (computedStatus === 'P') computedStatus = 'L';
        }
      }

      if (checkOut) {
        const parts = checkOut.split(':');
        const endParts = endTime.split(':');
        const checkOutMins = parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
        const endMins = parseInt(endParts[0], 10) * 60 + parseInt(endParts[1] || '0', 10);
        if (checkOutMins > endMins) {
          otHoursVal = Math.round(((checkOutMins - endMins) / 60) * 10) / 10;
        }
      }

      // Check if attendance row already exists for this user on date
      const existing = db.prepare("SELECT id FROM attendance WHERE user_id = ? AND date = ?").get(userId, date) as any;
      let resultId = null;

      if (existing) {
        db.prepare(`
          UPDATE attendance 
          SET check_in = COALESCE(?, check_in), 
              check_out = COALESCE(?, check_out), 
              status = ?, 
              early_checkout_reason = ?, 
              is_late = ?, 
              late_minutes = ?, 
              overtime_hours = ?, 
              method = 'admin_manual'
          WHERE id = ?
        `).run(checkIn || null, checkOut || null, computedStatus, reason || 'Admin Manual Override', isLate, lateMins, otHoursVal, existing.id);
        resultId = existing.id;
      } else {
        const resInsert = db.prepare(`
          INSERT INTO attendance (user_id, date, check_in, check_out, status, method, early_checkout_reason, is_late, late_minutes, overtime_hours)
          VALUES (?, ?, ?, ?, ?, 'admin_manual', ?, ?, ?, ?)
        `).run(userId, date, checkIn || null, checkOut || null, computedStatus, reason || 'Admin Manual Override', isLate, lateMins, otHoursVal);
        resultId = resInsert.lastInsertRowid;
      }

      triggerLiveSync('attendance');
      res.json({ success: true, id: resultId, message: "Manual attendance punch saved successfully." });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // --- NOTIFICATIONS APIS ---
  app.get("/api/notifications", (req, res) => {
    const { userId, role } = req.query;
    try {
      let notifs: any[] = [];
      if (role === 'super_admin' || role === 'director' || role === 'admin') {
        notifs = db.prepare("SELECT * FROM notifications WHERE user_id IS NULL OR user_id = ? ORDER BY created_at DESC LIMIT 50").all(userId || 0);
      } else if (userId) {
        notifs = db.prepare("SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC LIMIT 50").all(userId);
      } else {
        notifs = db.prepare("SELECT * FROM notifications WHERE user_id IS NULL ORDER BY created_at DESC LIMIT 50").all();
      }
      res.json(notifs);
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/notifications/:id/read", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/notifications/clear", (req, res) => {
    const { userId, role } = req.body;
    try {
      if (role === 'super_admin' || role === 'director') {
        db.prepare("DELETE FROM notifications WHERE user_id IS NULL OR user_id = ?").run(userId || 0);
      } else if (userId) {
        db.prepare("DELETE FROM notifications WHERE user_id = ?").run(userId);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // --- ANTI-PROXY & DEVICE LOCK ENDPOINT ---
  app.post("/api/users/:id/reset-device", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("UPDATE users SET bound_device_id = NULL, last_device_info = NULL WHERE id = ?").run(id);
      triggerLiveSync('users');
      res.json({ success: true, message: "Device lock reset successfully! The user can now log in or mark attendance on a new device." });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // --- HR & FINANCIAL PROFILE ENDPOINTS ---
  app.put("/api/users/:id/hr", (req, res) => {
    const { id } = req.params;
    const { 
      monthly_salary, 
      designation, 
      date_of_joining, 
      emergency_contact, 
      bank_account, 
      ifsc_code, 
      upi_id, 
      pan_aadhaar 
    } = req.body;
    try {
      db.prepare(`
        UPDATE users
        SET monthly_salary = ?, designation = ?, date_of_joining = ?, emergency_contact = ?, bank_account = ?, ifsc_code = ?, upi_id = ?, pan_aadhaar = ?
        WHERE id = ?
      `).run(
        monthly_salary ? Number(monthly_salary) : 0,
        designation || null,
        date_of_joining || null,
        emergency_contact || null,
        bank_account || null,
        ifsc_code || null,
        upi_id || null,
        pan_aadhaar || null,
        id
      );
      triggerLiveSync('users');
      res.json({ success: true, message: "HR & Financial profile updated successfully." });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Udhar / Advances Ledger GET
  app.get("/api/users/:id/advances", (req, res) => {
    const { id } = req.params;
    try {
      const records = db.prepare("SELECT * FROM salary_advances WHERE user_id = ? ORDER BY date DESC, id DESC").all(id) as any[];
      
      let totalAdvanceGiven = 0;
      let totalRepaidDeducted = 0;

      records.forEach(r => {
        if (r.type === 'ADVANCE_GIVEN') totalAdvanceGiven += r.amount;
        else if (r.type === 'REPAYMENT_DEDUCTED') totalRepaidDeducted += r.amount;
      });

      const netAdvanceBalance = Math.max(0, totalAdvanceGiven - totalRepaidDeducted);

      res.json({
        success: true,
        records,
        summary: {
          totalAdvanceGiven,
          totalRepaidDeducted,
          netAdvanceBalance
        }
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Udhar / Advances Ledger POST (Give advance or record repayment)
  app.post("/api/users/:id/advances", (req, res) => {
    const { id } = req.params;
    const { type, amount, date, notes } = req.body;
    if (!type || !amount || Number(amount) <= 0 || !date) {
      return res.status(400).json({ success: false, message: "Type, valid positive amount, and date are required." });
    }
    try {
      const result = db.prepare(`
        INSERT INTO salary_advances (user_id, type, amount, date, notes)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, type, Number(amount), date, notes || null);
      res.json({ success: true, id: result.lastInsertRowid, message: "Udhar / Advance transaction recorded successfully." });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Udhar / Advances DELETE
  app.delete("/api/advances/:advanceId", (req, res) => {
    const { advanceId } = req.params;
    try {
      db.prepare("DELETE FROM salary_advances WHERE id = ?").run(advanceId);
      res.json({ success: true, message: "Transaction record deleted." });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Monthly Payroll Summary & Salary Calculation
  app.get("/api/users/:id/payroll-summary", (req, res) => {
    const { id } = req.params;
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7); // YYYY-MM
    try {
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
      if (!user) return res.status(404).json({ success: false, message: "User not found" });

      const attendance = db.prepare(`
        SELECT * FROM attendance WHERE user_id = ? AND date LIKE ?
      `).all(id, `${month}%`) as any[];

      const presentCount = attendance.filter(a => a.status === 'P' || a.status === 'L').length;
      
      const [yearStr, mStr] = month.split('-');
      const year = Number(yearStr);
      const m = Number(mStr);
      const daysInMonth = new Date(year, m, 0).getDate();

      const baseSalary = user.monthly_salary || 0;
      const dailyWage = baseSalary > 0 ? (baseSalary / daysInMonth) : 0;
      const grossEarnedSalary = Math.round(dailyWage * presentCount);

      const advances = db.prepare("SELECT * FROM salary_advances WHERE user_id = ?").all(id) as any[];
      let totalAdvanceGiven = 0;
      let totalRepaidDeducted = 0;
      advances.forEach(r => {
        if (r.type === 'ADVANCE_GIVEN') totalAdvanceGiven += r.amount;
        else if (r.type === 'REPAYMENT_DEDUCTED') totalRepaidDeducted += r.amount;
      });
      const netAdvanceBalance = Math.max(0, totalAdvanceGiven - totalRepaidDeducted);

      const netPayableSalary = Math.max(0, grossEarnedSalary - netAdvanceBalance);

      res.json({
        success: true,
        month,
        user: {
          id: user.id,
          name: user.name,
          registration_id: user.registration_id,
          monthly_salary: baseSalary,
          designation: user.designation,
          bound_device_id: user.bound_device_id,
          last_device_info: user.last_device_info
        },
        metrics: {
          daysInMonth,
          presentCount,
          absentCount: Math.max(0, daysInMonth - presentCount),
          dailyWage: Math.round(dailyWage),
          grossEarnedSalary,
          netAdvanceBalance,
          netPayableSalary
        }
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get("/api/reports/summary", (req, res) => {
    const { siteName } = req.query;
    try {
      // 1. All sessions
      let sessions: any[];
      let users: any[];
      let attendance: any[];

      if (siteName) {
        sessions = db.prepare("SELECT * FROM sessions WHERE LOWER(site_name) = LOWER(?) ORDER BY date DESC, start_time DESC").all(siteName) as any[];
        users = db.prepare("SELECT * FROM users WHERE role = 'user' AND (LOWER(site_name) = LOWER(?) OR LOWER(country) = LOWER(?))").all(siteName, siteName) as any[];
        attendance = db.prepare(`
          SELECT a.* FROM attendance a
          JOIN users u ON a.user_id = u.id
          WHERE LOWER(u.site_name) = LOWER(?) OR LOWER(u.country) = LOWER(?)
        `).all(siteName, siteName) as any[];
      } else {
        sessions = db.prepare("SELECT * FROM sessions ORDER BY date DESC, start_time DESC").all() as any[];
        users = db.prepare("SELECT * FROM users WHERE role = 'user'").all() as any[];
        attendance = db.prepare("SELECT * FROM attendance").all() as any[];
      }
      
      const totalEligibleUsers = users.length;

      // Group attendance by session
      const attendanceBySession: Record<number, any[]> = {};
      attendance.forEach(rec => {
        if (rec.session_id) {
          if (!attendanceBySession[rec.session_id]) {
            attendanceBySession[rec.session_id] = [];
          }
          attendanceBySession[rec.session_id].push(rec);
        }
      });

      // 4. Build session reports
      const sessionReports = sessions.map(sess => {
        const recs = attendanceBySession[sess.id] || [];
        const presentCount = recs.filter(r => r.status === 'P').length;
        const lateCount = recs.filter(r => r.status === 'L').length;
        const attendedCount = presentCount + lateCount;
        const absentCount = Math.max(0, totalEligibleUsers - attendedCount);
        const attendanceRate = totalEligibleUsers > 0 ? Math.round((attendedCount / totalEligibleUsers) * 100) : 0;

        // Drill down list
        const attendanceMap = new Map(recs.map(r => [r.user_id, r]));
        const participantDetails = users.map(u => {
          const record = attendanceMap.get(u.id);
          return {
            id: u.id,
            name: u.name,
            registration_id: u.registration_id,
            country: u.country || 'NRI User',
            status: record ? record.status : 'A',
            check_in: record ? record.check_in : null,
            method: record ? record.method : null
          };
        });

        return {
          id: sess.id,
          name: sess.name,
          date: sess.date,
          start_time: sess.start_time,
          end_time: sess.end_time,
          total_users: totalEligibleUsers,
          present_count: presentCount,
          late_count: lateCount,
          absent_count: absentCount,
          attendance_rate: attendanceRate,
          participants: participantDetails
        };
      });

      // 5. Country-wise report
      // Group users by country
      const usersByCountry: Record<string, any[]> = {};
      users.forEach(u => {
        const country = (u.country || 'NRI User').trim();
        if (!usersByCountry[country]) {
          usersByCountry[country] = [];
        }
        usersByCountry[country].push(u);
      });

      const countryReport: any[] = [];
      Object.keys(usersByCountry).forEach(country => {
        const countryUsers = usersByCountry[country];
        const countryUserIds = new Set(countryUsers.map(u => u.id));
        const totalCountryUsers = countryUsers.length;

        // Calculate stats for each session for this country
        const sessionStats = sessions.map(sess => {
          const recs = attendanceBySession[sess.id] || [];
          // Filter records belonging to users of this country
          const countryRecs = recs.filter(r => countryUserIds.has(r.user_id));
          const present = countryRecs.filter(r => r.status === 'P').length;
          const late = countryRecs.filter(r => r.status === 'L').length;
          const attended = present + late;
          const absent = Math.max(0, totalCountryUsers - attended);
          const rate = totalCountryUsers > 0 ? Math.round((attended / totalCountryUsers) * 100) : 0;

          return {
            session_id: sess.id,
            session_name: sess.name,
            session_date: sess.date,
            present,
            late,
            absent,
            total: totalCountryUsers,
            attendance_rate: rate
          };
        });

        // Overall country stats
        const totalPossibleAttendance = totalCountryUsers * sessions.length;
        let totalActualAttendance = 0;
        sessions.forEach(sess => {
          const recs = attendanceBySession[sess.id] || [];
          const countryRecs = recs.filter(r => countryUserIds.has(r.user_id) && (r.status === 'P' || r.status === 'L'));
          totalActualAttendance += countryRecs.length;
        });

        const overallRate = totalPossibleAttendance > 0 ? Math.round((totalActualAttendance / totalPossibleAttendance) * 100) : 0;

        countryReport.push({
          country,
          total_users: totalCountryUsers,
          overall_attendance_rate: overallRate,
          sessions: sessionStats
        });
      });

      // 6. Overall stats
      const totalPossible = totalEligibleUsers * sessions.length;
      const totalAttended = attendance.filter(r => r.status === 'P' || r.status === 'L').length;
      const overallAttendanceRate = totalPossible > 0 ? Math.round((totalAttended / totalPossible) * 100) : 0;

      // Late rate
      const totalLate = attendance.filter(r => r.status === 'L').length;
      const lateRate = totalAttended > 0 ? Math.round((totalLate / totalAttended) * 100) : 0;

      res.json({
        success: true,
        summary: {
          total_users: totalEligibleUsers,
          total_sessions: sessions.length,
          overall_attendance_rate: overallAttendanceRate,
          late_rate: lateRate
        },
        sessions: sessionReports,
        countries: countryReport
      });
    } catch (e: any) {
      console.error("Reports API error:", e);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Vite middleware for development
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
    console.log(`>>> Server is listening on http://0.0.0.0:${PORT}`);
    console.log(`>>> NODE_ENV: ${process.env.NODE_ENV}`);
  });
}

startServer();
