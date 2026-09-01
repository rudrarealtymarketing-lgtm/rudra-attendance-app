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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    spreadsheet_id TEXT,
    users_sheet_name TEXT DEFAULT 'Users',
    attendance_sheet_name TEXT DEFAULT 'Attendance',
    service_account_json TEXT,
    web_app_url TEXT,
    sync_enabled INTEGER DEFAULT 1,
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
if (!userTableInfo.some(col => col.name === 'username')) runMigration("add username", "ALTER TABLE users ADD COLUMN username TEXT");
if (!userTableInfo.some(col => col.name === 'work_start_time')) runMigration("add work_start_time", "ALTER TABLE users ADD COLUMN work_start_time TEXT DEFAULT '10:00'");
if (!userTableInfo.some(col => col.name === 'work_end_time')) runMigration("add work_end_time", "ALTER TABLE users ADD COLUMN work_end_time TEXT DEFAULT '19:00'");
if (!userTableInfo.some(col => col.name === 'registration_id')) runMigration("add registration_id", "ALTER TABLE users ADD COLUMN registration_id TEXT UNIQUE");
if (!userTableInfo.some(col => col.name === 'country')) runMigration("add country", "ALTER TABLE users ADD COLUMN country TEXT");
if (!userTableInfo.some(col => col.name === 'site_name')) runMigration("add site_name", "ALTER TABLE users ADD COLUMN site_name TEXT");
if (!userTableInfo.some(col => col.name === 'password')) runMigration("add password", "ALTER TABLE users ADD COLUMN password TEXT");
if (!userTableInfo.some(col => col.name === 'bound_device_id')) runMigration("add bound_device_id", "ALTER TABLE users ADD COLUMN bound_device_id TEXT");
if (!userTableInfo.some(col => col.name === 'last_device_info')) runMigration("add last_device_info", "ALTER TABLE users ADD COLUMN last_device_info TEXT");
if (!userTableInfo.some(col => col.name === 'monthly_salary')) runMigration("add monthly_salary", "ALTER TABLE users ADD COLUMN monthly_salary REAL DEFAULT 0");
if (!userTableInfo.some(col => col.name === 'designation')) runMigration("add designation", "ALTER TABLE users ADD COLUMN designation TEXT");
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

// Seed Departments, Master Designations, Super Admin & Director
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

const desigCount = (db.prepare("SELECT COUNT(*) as count FROM designations").get() as any).count;
if (desigCount === 0) {
  const defaultDesignations = [
    "Managing Director (MD)",
    "Executive Director / Partner",
    "Chief Executive Officer (CEO)",
    "Project Manager / Construction Head",
    "Senior Site Engineer",
    "Junior Site Engineer",
    "Site Supervisor",
    "Safety Officer",
    "Quality Control (QC) Engineer",
    "Sales Manager",
    "Sales Executive",
    "Accountant",
    "HR Executive",
    "Office Assistant"
  ];
  const stmt = db.prepare("INSERT OR IGNORE INTO designations (name) VALUES (?)");
  for (const name of defaultDesignations) { stmt.run(name); }
}

const existingAdmin = db.prepare("SELECT id FROM users WHERE role = 'super_admin' OR registration_id = 'ADMIN-01'").get();
if (!existingAdmin) {
  db.prepare("INSERT INTO users (registration_id, name, email, role, department_id, password, designation, allowed_devices) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run("ADMIN-01", "Abhishek Bhatt (Admin)", "admin@rudra.com", "super_admin", 1, "admin123", "Chief Executive Officer (CEO)", 99);
}

const existingDirector = db.prepare("SELECT id FROM users WHERE role = 'director' OR registration_id = 'DIR-01'").get();
if (!existingDirector) {
  db.prepare("INSERT INTO users (registration_id, name, email, role, department_id, password, designation, allowed_devices) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run("DIR-01", "Director / Partner", "director@rudra.com", "director", 1, "director123", "Managing Director (MD)", 99);
}

const settingsCount = db.prepare("SELECT COUNT(*) as count FROM sheet_settings").get() as { count: number };
if (settingsCount.count === 0) {
  db.prepare("INSERT INTO sheet_settings (users_sheet_name, attendance_sheet_name, sync_enabled) VALUES (?, ?, ?)").run("Users", "Attendance", 1);
}

const geofenceSettingsCount = db.prepare("SELECT COUNT(*) as count FROM geofence_settings").get() as { count: number };
if (geofenceSettingsCount.count === 0) {
  db.prepare("INSERT INTO geofence_settings (id, enabled, latitude, longitude, radius) VALUES (1, 0, 23.0225, 72.5714, 150.0)").run();
}

const sitesCount = db.prepare("SELECT COUNT(*) as count FROM sites").get() as { count: number };
if (sitesCount.count === 0) {
  const defaultSites = [
    { name: 'Headquarters', lat: 23.0225, lng: 72.5714, rad: 150 },
    { name: 'Site Velocity', lat: 23.0645, lng: 72.5085, rad: 200 }
  ];
  const stmt = db.prepare("INSERT INTO sites (name, latitude, longitude, radius) VALUES (?, ?, ?, ?)");
  for (const s of defaultSites) {
    try { stmt.run(s.name, s.lat, s.lng, s.rad); } catch (_) {}
  }
}

// Durable File Backup Mechanism (Strictly overwrites with current database state)
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
      if (!location) return response;
      currentUrl = new URL(location, currentUrl).toString();

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

// =========================================================================
// REAL-TIME CLOUD ENGINE (Push-Only Event Driven Sync - 100% Reliable)
// =========================================================================

async function syncFullDatabaseToSheets(): Promise<{ success: boolean; message: string }> {
  try {
    const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
    if (!settings || !settings.web_app_url || settings.sync_enabled === 0) {
      return { success: false, message: "Sync disabled or Web App URL missing." };
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

    if (response.ok) {
      const now = new Date().toISOString();
      db.prepare("UPDATE sheet_settings SET last_sync_timestamp = ? WHERE id = 1").run(now);
      return { success: true, message: `Synced at ${now}` };
    }
    return { success: false, message: `HTTP ${response.status}` };
  } catch (err: any) {
    console.error("Background Sheet Sync Warning:", err.message);
    return { success: false, message: err.message };
  }
}

// Background auto trigger for any database event (Fire & Forget)
function triggerLiveSync(context = "general") {
  syncFullDatabaseToSheets().then(res => {
    if (res.success) {
      console.log(`[GoogleSheet Live Sync] Triggered & Updated successfully for: ${context}`);
    }
  }).catch(e => {
    console.warn(`[GoogleSheet Live Sync] Background sync warning:`, e.message);
  });
}

// Fast realtime punch appender for single Check-In / Check-Out
async function appendAttendanceLogLive(userId: number, date: string, checkInTime: string, status: string, method: string, sessionId: number | null, checkoutTime?: string) {
  try {
    const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
    if (!settings || !settings.web_app_url || settings.sync_enabled === 0) return;

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
    if (!user) return;

    await fetchWithRedirect(settings.web_app_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "appendAttendance",
        record: {
          id: `ATT-${userId}-${date}`,
          date,
          check_in: checkInTime || "",
          check_out: checkoutTime || "",
          registration_id: user.registration_id || "",
          name: user.name,
          designation: user.designation || "Staff",
          site_name: user.site_name || "Headquarters",
          status: status === 'P' ? 'Present' : (status === 'L' ? 'Late' : (status === 'Half Day' ? 'Half Day' : status)),
          method: method || "App",
          created_at: new Date().toISOString()
        }
      })
    });
  } catch (err: any) {
    console.error("Punch streaming error:", err.message);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Login
  app.post("/api/login", (req, res) => {
    const { identifier, password } = req.body;
    const searchVal = (identifier || "").trim();
    const pwd = (password || "").trim();
    
    if (!searchVal || !pwd) {
      return res.status(400).json({ success: false, message: "Please enter your credentials" });
    }

    const user = db.prepare("SELECT * FROM users WHERE email = ? OR registration_id = ? OR username = ? OR LOWER(username) = LOWER(?)").get(searchVal, searchVal, searchVal, searchVal) as any;
    
    if (!user) {
      return res.status(401).json({ success: false, message: "Staff member not found." });
    }

    const expectedPassword = user.password || user.registration_id || "password123";
    if (pwd === expectedPassword) {
      res.json({ success: true, user });
    } else {
      res.status(401).json({ success: false, message: "Incorrect password." });
    }
  });

  // Users & Staff
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
        role || 'user', department_id || null, site_name || 'Headquarters', defaultPwd, 
        designation || 'Staff', Number(allowed_devices) || 1, work_start_time || '10:00', 
        work_end_time || '19:00', Number(monthly_salary) || 0, 
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
        work_start_time !== undefined ? work_start_time : null, 
        work_end_time !== undefined ? work_end_time : null, 
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

  // DELETE USER (Permanent & Synced)
  app.delete(["/api/users/:id", "/api/super_admin/users/:id"], (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM attendance WHERE user_id = ?").run(id);
      db.prepare("DELETE FROM attendance_requests WHERE user_id = ?").run(id);
      db.prepare("DELETE FROM salary_advances WHERE user_id = ?").run(id);
      db.prepare("DELETE FROM notifications WHERE user_id = ?").run(id);
      db.prepare("DELETE FROM users WHERE id = ?").run(id);

      // Overwrite JSON backup immediately
      backupDatabaseToJson();
      // Push fresh state to Google Sheets immediately
      triggerLiveSync('delete_user');
      
      res.json({ success: true, message: "User deleted successfully." });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Attendance Punch In / Out
  app.post("/api/attendance/check-in", (req, res) => {
    const { userId, date, time, location, method, sessionId, deviceId, photoUrl, lateReason } = req.body;
    const userRow = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
    
    let isProxyFlagged = 0;
    if (userRow && (Number(userRow.allowed_devices) || 1) === 1) {
      if (userRow.bound_device_id && deviceId && userRow.bound_device_id !== deviceId) {
        return res.status(403).json({ success: false, message: "Security Violation: Account bound to another device." });
      } else if (!userRow.bound_device_id && deviceId) {
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

    const timeParts = (time || "10:00").split(":");
    const totalMinutes = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1] || "0", 10);
    const standardStartMinutes = 10 * 60; // 10:00 AM

    if (totalMinutes > standardStartMinutes) {
      status = "L";
      isLate = 1;
      lateMinutes = totalMinutes - standardStartMinutes;
    }

    const result = db.prepare(`
      INSERT INTO attendance (user_id, session_id, date, check_in, status, location, method, ip_address, latitude, longitude, device_id, photo_url, is_proxy_flagged, is_late, late_minutes, late_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, sessionId || null, date, time, status, location ? JSON.stringify(location) : null, method || 'app', ip || null, lat, lng, deviceId || null, photoUrl || null, isProxyFlagged, isLate, lateMinutes, lateReason || null);

    appendAttendanceLogLive(userId, date, time, status, method || 'app', sessionId || null);
    triggerLiveSync('attendance_punch_in');

    res.json({ success: true, id: result.lastInsertRowid, isLate: isLate === 1, lateMinutes, status });
  });

  app.post("/api/attendance/check-out", (req, res) => {
    const { userId, date, time, earlyCheckoutReason } = req.body;
    try {
      const lastRecord = db.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ? ORDER BY id DESC LIMIT 1").get(userId, date) as any;
      if (!lastRecord) return res.status(404).json({ success: false, message: "No check-in record found for today." });
      if (lastRecord.check_out) return res.status(400).json({ success: false, message: "Already checked out today" });

      let overtimeHours = 0;
      if (time) {
        const timeParts = time.split(":");
        const totalOutMinutes = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1] || "0", 10);
        if (totalOutMinutes > (19 * 60)) {
          overtimeHours = Math.round(((totalOutMinutes - (19 * 60)) / 60) * 10) / 10;
        }
      }

      db.prepare(`
        UPDATE attendance 
        SET check_out = ?, early_checkout_reason = ?, overtime_hours = ?
        WHERE id = ?
      `).run(time, earlyCheckoutReason || null, overtimeHours, lastRecord.id);

      appendAttendanceLogLive(userId, date, lastRecord.check_in, lastRecord.status, lastRecord.method, lastRecord.session_id, time);
      triggerLiveSync('attendance_punch_out');

      res.json({ success: true, message: `Checked out at ${time}`, overtimeHours });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Sheet Settings API
  app.get("/api/sheet-settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get();
    res.json(settings || {});
  });

  app.post("/api/sheet-settings", (req, res) => {
    const { spreadsheet_id, users_sheet_name, attendance_sheet_name, web_app_url, sync_enabled, is_locked } = req.body;
    try {
      db.prepare(`
        UPDATE sheet_settings 
        SET spreadsheet_id = ?, users_sheet_name = ?, attendance_sheet_name = ?, web_app_url = ?, sync_enabled = ?, is_locked = ?
        WHERE id = 1
      `).run(spreadsheet_id || null, users_sheet_name || 'Users', attendance_sheet_name || 'Attendance', web_app_url ? String(web_app_url).trim() : null, sync_enabled !== undefined ? (sync_enabled ? 1 : 0) : 1, is_locked !== undefined ? (is_locked ? 1 : 0) : 1);

      res.json({ success: true, message: "Saved settings system-wide!" });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/sheet-settings/test", async (req, res) => {
    const { web_app_url } = req.body;
    const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
    const targetUrl = web_app_url ? String(web_app_url).trim() : (settings ? settings.web_app_url : "");

    if (!targetUrl) return res.status(400).json({ success: false, message: "No Deployment URL provided." });

    try {
      const startTime = Date.now();
      const pingUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=ping&_t=${startTime}`;
      const response = await fetchWithRedirect(pingUrl);
      const latencyMs = Date.now() - startTime;
      const data = await response.json();

      res.json({ success: true, latencyMs, data, message: "Connection verified!" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/sheet-settings/export-all", async (req, res) => {
    const result = await syncFullDatabaseToSheets();
    if (result.success) res.json({ success: true, message: "Synchronized full database to Google Sheets!" });
    else res.status(500).json({ success: false, message: result.message });
  });

  // Pull data manually if requested by Super Admin
  app.post("/api/sheet-settings/pull-all", async (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM sheet_settings LIMIT 1").get() as any;
      if (!settings || !settings.web_app_url) return res.status(400).json({ success: false, message: "Deployment URL missing." });

      const response = await fetchWithRedirect(`${settings.web_app_url}?action=getAllData`);
      const resJson = await response.json();
      if (resJson.success && resJson.data) {
        const d = resJson.data;
        if (Array.isArray(d.users) && d.users.length > 0) {
          for (const u of d.users) {
            if (u.name && u.role !== 'super_admin') {
              try {
                db.prepare(`
                  INSERT INTO users (registration_id, name, email, phone, role, site_name, designation, monthly_salary)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(registration_id) DO UPDATE SET
                    name = excluded.name,
                    email = excluded.email,
                    phone = excluded.phone,
                    site_name = excluded.site_name,
                    designation = excluded.designation,
                    monthly_salary = excluded.monthly_salary
                `).run(u.registration_id || null, u.name, u.email || null, u.phone || null, u.role || 'user', u.site_name || 'Headquarters', u.designation || 'Staff', Number(u.monthly_salary) || 0);
              } catch (_) {}
            }
          }
        }
        backupDatabaseToJson();
        return res.json({ success: true, message: "Successfully pulled data from Google Sheets." });
      }
      return res.status(500).json({ success: false, message: "Could not read data from Google Sheet." });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // Sites / Geofence APIs
  app.get("/api/sites", (req, res) => {
    res.json(db.prepare("SELECT * FROM sites ORDER BY name ASC").all());
  });

  app.post(["/api/sites", "/api/super_admin/sites"], (req, res) => {
    const { name, address, latitude, longitude, radius } = req.body;
    try {
      const result = db.prepare("INSERT INTO sites (name, address, latitude, longitude, radius) VALUES (?, ?, ?, ?, ?)").run(name, address || null, Number(latitude), Number(longitude), Number(radius) || 150);
      backupDatabaseToJson();
      triggerLiveSync('sites');
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ success: false, message: e.message });
    }
  });

  app.delete(["/api/sites/:id", "/api/super_admin/sites/:id"], (req, res) => {
    try {
      db.prepare("DELETE FROM sites WHERE id = ?").run(req.params.id);
      backupDatabaseToJson();
      triggerLiveSync('delete_site');
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
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

  // Requests / Approvals
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
      `).run(userId, targetDate, startDate || targetDate, endDate || targetDate, checkIn || null, checkOut || null, reason || null, siteName || user.site_name || null, type || 'CORRECTION', halfDaySlot || null);

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

// Master Tables
  app.get("/api/designations", (req, res) => {
    try {
      res.json(db.prepare("SELECT * FROM designations ORDER BY id ASC").all());
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/designations", (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Designation name is required" });
    }
    try {
      const result = db.prepare("INSERT INTO designations (name) VALUES (?)").run(name.trim());
      backupDatabaseToJson();
      triggerLiveSync('designations');
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ success: false, message: "Designation already exists or invalid" });
    }
  });

  app.put("/api/designations/:id", (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Designation name is required" });
    }
    try {
      db.prepare("UPDATE designations SET name = ? WHERE id = ?").run(name.trim(), id);
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

  // Vite middleware
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
