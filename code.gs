/**
 * ==============================================================================
 * STAFFSYNC / RUDRA REALTY - GOOGLE APPS SCRIPT LIVE CLOUD DATABASE CONNECTOR
 * ==============================================================================
 * 
 * This Apps Script transforms your Google Spreadsheet into a high-speed,
 * real-time cloud database and reporting warehouse for the entire StaffSync app.
 *
 * QUICK 5-STEP SETUP GUIDE:
 * ------------------------------------------------------------------------------
 * 1. Open your Google Spreadsheet (create a new blank spreadsheet if needed).
 * 2. In Google Sheets menu, click "Extensions" > "Apps Script".
 * 3. Delete any code in the editor, paste this entire file, and click "Save" (Ctrl+S / Cmd+S).
 * 4. INITIALIZE ALL SHEETS (One-Click):
 *    - In the toolbar dropdown at top, select "setupSheets" (NOT doGet or doPost).
 *    - Click "Run" (▶). Google will ask for permission on first run:
 *      * Click "Review permissions" -> Choose your Google Account.
 *      * Click "Advanced" -> "Go to Untitled project (unsafe)" -> Click "Allow".
 *    - Check your spreadsheet: All 9 sheets/tabs with professional styling are now created!
 * 5. DEPLOY AS WEB APP:
 *    - Click "Deploy" button (top right) > "New deployment".
 *    - Click the Gear icon (⚙) next to "Select type" and choose "Web app".
 *    - Set Deployment settings:
 *        • Description: "StaffSync Production Database Sync"
 *        • Execute as: "Me (your email address)"
 *        • Who has access: "Anyone"  <-- CRITICAL (Allows your app to sync data)
 *    - Click "Deploy".
 *    - COPY the "Web app URL" (looks like: https://script.google.com/macros/s/AKfycb.../exec).
 *    - In your StaffSync Admin Console > Google Sheets Tab:
 *      Paste the URL into the "Google Apps Script Deployment URL" bar, click "Save & Test", and Lock it!
 * ==============================================================================
 */

// ==========================================
// 1. ONE-CLICK SHEET SETUP & FORMATTER
// ==========================================
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
    // Update headers if already exists
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  
  // Apply beautiful styling
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground(headerColor || "#1E293B");
  headerRange.setFontColor("#FFFFFF");
  headerRange.setFontWeight("bold");
  headerRange.setFontSize(10);
  headerRange.setVerticalAlignment("middle");
  sheet.setRowHeight(1, 32);
  sheet.setFrozenRows(1);
  
  // Format column widths
  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
    const w = sheet.getColumnWidth(i);
    if (w < 110) sheet.setColumnWidth(i, 120);
    if (w > 260) sheet.setColumnWidth(i, 260);
  }
  return sheet;
}

function getOrCreateSheet(sheetName, headers, headerColor) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return setupTab(ss, sheetName, headers, headerColor);
}

// ==========================================
// 2. GET REQUEST HANDLER (doGet)
// ==========================================
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "ping";

    // PING / HEALTH CHECK
    if (action === "ping") {
      const sheetsList = ss.getSheets().map(s => ({
        name: s.getName(),
        rows: s.getLastRow() > 1 ? s.getLastRow() - 1 : 0
      }));
      return createJsonResponse({
        success: true,
        status: "active",
        spreadsheet_name: ss.getName(),
        spreadsheet_id: ss.getId(),
        sheets_count: sheetsList.length,
        sheets: sheetsList,
        server_timestamp: new Date().toISOString(),
        message: "Google Apps Script Live Sync Web App is fully operational."
      });
    }

    // GET ALL DATA (Database Snapshot)
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
      return createJsonResponse({ success: true, data: data });
    }

    // Individual Table Queries
    if (action === "getUsers") {
      return createJsonResponse({ success: true, data: { users: getSheetData("Users") } });
    }
    if (action === "getAttendance") {
      return createJsonResponse({ success: true, data: { attendance: getSheetData("Attendance") } });
    }
    if (action === "getSites") {
      return createJsonResponse({ success: true, data: { sites: getSheetData("Sites") } });
    }
    if (action === "getDesignations") {
      return createJsonResponse({ success: true, data: { designations: getSheetData("Designations") } });
    }
    if (action === "getDepartments") {
      return createJsonResponse({ success: true, data: { departments: getSheetData("Departments") } });
    }
    if (action === "getApprovals" || action === "getRequests") {
      return createJsonResponse({ success: true, data: { approvals: getSheetData("AttendanceRequests") } });
    }
    if (action === "getSalaryAdvances") {
      return createJsonResponse({ success: true, data: { salary_advances: getSheetData("SalaryAdvances") } });
    }
    if (action === "getHolidays") {
      return createJsonResponse({ success: true, data: { holidays: getSheetData("Holidays") } });
    }

    return createJsonResponse({ success: true, message: "Apps Script connector active." });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

// ==========================================
// 3. POST REQUEST HANDLER (doPost)
// ==========================================
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No JSON payload received in POST request.");
    }

    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. FULL DATABASE EXPORT / PUSH
    if (action === "exportAllData") {
      const data = payload.data || {};
      
      // Users
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

      // Attendance
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

      // Sites
      if (Array.isArray(data.sites)) {
        replaceSheetData("Sites", [
          "Site ID", "Site Name", "Address", "Latitude", "Longitude", 
          "Radius (Meters)", "Shift Start", "Shift End", "Created At"
        ], data.sites.map(s => [
          s.id || "", s.name || "", s.address || "", s.latitude || "", s.longitude || "",
          s.radius || 150, s.work_start_time || "10:00", s.work_end_time || "19:00", s.created_at || ""
        ]), "#1E3A8A");
      }

      // Designations
      if (Array.isArray(data.designations)) {
        replaceSheetData("Designations", [
          "Designation ID", "Designation Name", "Created At"
        ], data.designations.map(d => [
          d.id || "", d.name || "", d.created_at || ""
        ]), "#312E81");
      }

      // Departments
      if (Array.isArray(data.departments)) {
        replaceSheetData("Departments", [
          "Department ID", "Department Name", "Description"
        ], data.departments.map(d => [
          d.id || "", d.name || "", d.description || ""
        ]), "#4C1D95");
      }

      // Attendance Requests
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

      // Salary Advances
      if (Array.isArray(data.salary_advances)) {
        replaceSheetData("SalaryAdvances", [
          "Advance ID", "Date", "Employee Code", "Employee Name", "Type", 
          "Amount (₹)", "Notes / Reason", "Created At"
        ], data.salary_advances.map(sa => [
          sa.id || "", sa.date || "", sa.registration_id || "", sa.user_name || sa.name || "", sa.type || "Advance",
          sa.amount || 0, sa.notes || "", sa.created_at || ""
        ]), "#831843");
      }

      // Holidays
      if (Array.isArray(data.holidays)) {
        replaceSheetData("Holidays", [
          "Holiday ID", "Holiday Date", "Holiday Name", "Created At"
        ], data.holidays.map(h => [
          h.id || "", h.date || "", h.name || "", h.created_at || ""
        ]), "#881337");
      }

      // Geofencing
      if (Array.isArray(data.geofencing)) {
        replaceSheetData("Geofencing", [
          "ID", "Geofence Enabled (1/0)", "Default Latitude", "Default Longitude", "Default Radius (Meters)"
        ], data.geofencing.map(g => [
          g.id || 1, g.enabled || 0, g.latitude || "", g.longitude || "", g.radius || 150
        ]), "#134E4A");
      }

      return createJsonResponse({
        success: true,
        message: "Successfully synchronized all tables to Google Spreadsheet."
      });
    }

    // 2. EXPORT ATTENDANCE LOGS ONLY
    if (action === "exportAttendance") {
      const records = payload.records || [];
      replaceSheetData("Attendance", [
        "Record ID", "Date", "Employee Code", "Name", "Designation", 
        "Branch / Site", "Check In", "Check Out", "Status", "Late (Min)", 
        "Overtime (Hrs)", "Method", "Device ID", "Latitude", "Longitude", 
        "IP Address", "Photo URL", "Early Checkout Reason", "Late Reason", "Created At"
      ], records.map(a => [
        a.id || "", a.date || "", a.registration_id || "", a.name || "", a.designation || "",
        a.site_name || "", a.check_in || "", a.check_out || "", a.status || "", a.late_minutes || 0,
        a.overtime_hours || 0, a.method || "App", a.device_id || "", a.latitude || "", a.longitude || "",
        a.ip_address || "", a.photo_url || "", a.early_checkout_reason || "", a.late_reason || "", a.created_at || ""
      ]), "#0F766E");

      return createJsonResponse({
        success: true,
        message: `Successfully synchronized ${records.length} attendance records.`
      });
    }

    // 3. REAL-TIME LIVE ATTENDANCE PUNCH (Append / Update Row)
    if (action === "appendAttendance") {
      const r = payload.record || {};
      const sheet = getOrCreateSheet("Attendance", [
        "Record ID", "Date", "Employee Code", "Name", "Designation", 
        "Branch / Site", "Check In", "Check Out", "Status", "Late (Min)", 
        "Overtime (Hrs)", "Method", "Device ID", "Latitude", "Longitude", 
        "IP Address", "Photo URL", "Early Checkout Reason", "Late Reason", "Created At"
      ], "#0F766E");

      const regId = String(r.registration_id || "");
      const punchDate = String(r.date || "");

      // Check if an entry for this employee & date already exists (to update Check Out)
      let rowToUpdate = -1;
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const dataRange = sheet.getRange(2, 2, lastRow - 1, 2).getValues(); // Cols B (Date) & C (Emp Code)
        for (let i = dataRange.length - 1; i >= 0; i--) {
          const rowDate = String(dataRange[i][0]);
          const rowEmp = String(dataRange[i][1]);
          if (rowDate === punchDate && rowEmp === regId) {
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

      return createJsonResponse({
        success: true,
        message: "Logged attendance punch in Google Sheet."
      });
    }

    throw new Error("Unsupported action: " + action);
  } catch (err) {
    return createJsonResponse({
      success: false,
      error: err.toString()
    });
  }
}

// ==========================================
// 4. HELPER FUNCTIONS
// ==========================================
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
    // Only include non-empty rows
    if (Object.values(item).some(v => v !== "" && v !== null && v !== undefined)) {
      rows.push(item);
    }
  }
  return rows;
}

function replaceSheetData(sheetName, headers, rows, headerColor) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  sheet.clear();
  sheet.appendRow(headers);

  // Style header
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

  // Column auto-fit with constraints
  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
    const w = sheet.getColumnWidth(i);
    if (w < 110) sheet.setColumnWidth(i, 120);
    if (w > 260) sheet.setColumnWidth(i, 260);
  }
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
