import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateAdminUserManualPDF = () => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = '#0F172A'; // Slate 900
  const accentColor = '#2563EB';  // Royal Blue
  const goldColor = '#D97706';    // Amber 600
  const lightBg = '#F8FAFC';

  // Helper for Header/Footer
  const addPageHeaderFooter = (pageNum: number, totalPages: number) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 16, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text("RUDRA INFRA WORLD — STAFF ATTENDANCE SYSTEM", 14, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text("SUPER ADMIN OFFICIAL MANUAL & SOP", 145, 11);

    // Footer
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 282, 210, 15, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(0, 282, 210, 282);

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text("Confidential — For Internal Admin Use Only | Managed by Rudra Infra World HR Dept.", 14, 290);
    doc.text(`Page ${pageNum} of ${totalPages}`, 185, 290);
  };

  // --- PAGE 1: TITLE & EXECUTIVE SUMMARY ---
  addPageHeaderFooter(1, 4);

  // Title Box
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, 24, 182, 38, 4, 4, 'F');
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.8);
  doc.line(14, 24, 14, 62);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text("ADMINISTRATOR USER MANUAL", 20, 36);

  doc.setTextColor(37, 99, 235);
  doc.setFontSize(11);
  doc.text("Complete System Architecture, HR Ledger & Security Operations Guide", 20, 44);

  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text("Version: 3.5 | Effective Date: 2026 | Organization: Rudra Infra World", 20, 52);

  // Section 1: Core Navigation & Admin Modules
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text("1. Admin Navigation & Main Menu Overview", 14, 72);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(
    "The Staff Attendance & HR Portal provides Super Administrators and Site Managers with complete authority over employee logs, financial advances, site geofencing, and security controls.",
    14, 79, { maxWidth: 182 }
  );

  autoTable(doc, {
    startY: 88,
    head: [['Menu Item / Tool', 'Access Role', 'Core Function & Purpose']],
    body: [
      ['Super Admin Dashboard', 'Super Admin', 'Central overview of present/absent counts, total salary payouts, site filter, and system configuration.'],
      ['Staff & HR Management', 'Super Admin / HR', 'Manage staff profiles, monthly base salary, advance loans (udhar), bank details, and personal info.'],
      ['One-Tap Daily Attendance', 'All Staff', 'Direct check-in/out verification with GPS location & device lock for non-admin users.'],
      ['Shifts & Schedules', 'Admin Only', 'Create, assign, and manage site-specific shifts and time windows for workforce duties.'],
      ['Attendance Requests & Overrides', 'Super Admin', 'Review and approve/reject attendance edit requests, manual entry, or holiday overrides.'],
      ['Geofence & Site Boundaries', 'Super Admin', 'Configure latitude, longitude, and radius (meters) for automated location checks.'],
      ['Data Reports & Sync', 'Super Admin', 'Export monthly attendance CSVs and trigger live two-way sync with Google Sheets.'],
    ],
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    styles: { fontSize: 8.5, cellPadding: 3 },
    margin: { left: 14, right: 14 }
  });

  // Section 2: Security & Anti-Proxy Attendance
  const yAfterSec1 = (doc as any).lastAutoTable.finalY + 10;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text("2. Anti-Proxy Attendance & Device Security Protocols", 14, yAfterSec1);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(
    "To prevent employees from sharing user IDs/passwords to mark fake attendance on behalf of colleagues, the system enforces multi-layered device security:",
    14, yAfterSec1 + 7, { maxWidth: 182 }
  );

  doc.setFillColor(254, 243, 199);
  doc.roundedRect(14, yAfterSec1 + 13, 182, 38, 3, 3, 'F');
  doc.setDrawColor(217, 119, 6);
  doc.line(14, yAfterSec1 + 13, 14, yAfterSec1 + 51);

  doc.setTextColor(180, 83, 9);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text("KEY SECURITY ENFORCEMENT RULES:", 18, yAfterSec1 + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text("• Device Binding / Fingerprinting: On first login/check-in, the user's mobile device ID is bound to their account.", 18, yAfterSec1 + 27);
  doc.text("• Mismatch Blocking: If a user tries logging in on another colleague's phone, attendance is BLOCKED instantly.", 18, yAfterSec1 + 33);
  doc.text("• Admin Device Reset: When an employee changes phones, Admin can click 'Reset Device Lock' under Staff Management.", 18, yAfterSec1 + 39);
  doc.text("• GPS Geofence & Selfie Verification: Location distance is checked in real-time against site coordinates.", 18, yAfterSec1 + 45);

  // --- PAGE 2: HR & FINANCIAL MANAGEMENT ---
  doc.addPage();
  addPageHeaderFooter(2, 4);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text("3. HR Department & Financial Ledger (Salary & Udhar / Advances)", 14, 26);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(
    "The HR module enables administrators to maintain personal records, base salaries, loan/advance (udhar) disbursements, and net payroll calculations for each staff member.",
    14, 33, { maxWidth: 182 }
  );

  autoTable(doc, {
    startY: 40,
    head: [['HR Feature / Field', 'Description & Operating Instructions']],
    body: [
      ['Monthly Base Salary', 'Set contract base monthly salary (e.g., ₹25,000) for automatic daily wage & monthly payroll estimation.'],
      ['Salary Advances (Udhar Ledger)', 'Record cash advances, loan disbursements, or emergency payouts given to staff with date and notes.'],
      ['Advance Repayments / Deductions', 'Log salary deductions or partial repayments to automatically calculate remaining Udhar balance.'],
      ['Net Payable Salary Calculation', 'Formula: (Monthly Salary × Present Days / Total Month Days) - Total Pending Advance Balance.'],
      ['Personal HR Profile Info', 'Store Designation, Date of Joining, Phone Number, Emergency Contact Person & Phone.'],
      ['Bank & Tax Identification', 'Keep Bank Account Number, IFSC Code, UPI ID for direct salary transfer, plus PAN / Aadhaar numbers.'],
    ],
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    styles: { fontSize: 8.5, cellPadding: 3.5 },
    margin: { left: 14, right: 14 }
  });

  const yAfterHR = (doc as any).lastAutoTable.finalY + 10;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text("4. Step-by-Step HR Workflow Guide", 14, yAfterHR);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  const steps = [
    "Step 1: Navigate to 'Super Admin' -> 'Staff Directory' or 'HR & Payroll' tab.",
    "Step 2: Click 'HR & Financials' button on any user card to view salary history and advances ledger.",
    "Step 3: To disburse cash advance (Udhar), click 'Give Advance', enter amount, date, and reason.",
    "Step 4: At month-end, view the automated Payroll Summary showing Present Days, Calculated Gross Salary, Deductions, and Net Payable Amount.",
    "Step 5: Export complete payroll and attendance reports as CSV or sync live to connected Google Sheets."
  ];

  let currentY = yAfterHR + 8;
  steps.forEach(step => {
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, currentY, 182, 10, 2, 2, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(step, 18, currentY + 6.5);
    currentY += 13;
  });

  // --- PAGE 3: ONE-TAP ATTENDANCE & SHIFT MANAGEMENT ---
  doc.addPage();
  addPageHeaderFooter(3, 4);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text("5. One-Tap Attendance & Shift Architecture", 14, 26);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(
    "To simplify daily operations for field staff while keeping strict administrative control over shift creation:",
    14, 33, { maxWidth: 182 }
  );

  autoTable(doc, {
    startY: 40,
    head: [['Role / View', 'Attendance Interface & Permitted Actions']],
    body: [
      [
        'Regular Staff User View', 
        'Direct One-Tap Check-In / Check-Out screen. No shift selection required. Automatically registers daily duty with GPS location & device lock.'
      ],
      [
        'Admin / Manager View', 
        'Full Shift & Session Management tab. Admin can create custom shifts (e.g. Morning Site Duty 09:00 - 18:00), assign site locations, and view live check-ins.'
      ],
      [
        'QR Code Scanner & Kiosk Mode', 
        'Staff can scan static or dynamic site QR codes for rapid group attendance verification.'
      ],
      [
        'Manual Attendance Entry', 
        'Admins can manually add or adjust past attendance logs for staff with reason notes (e.g., forgotten phone, site emergency).'
      ]
    ],
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    styles: { fontSize: 8.5, cellPadding: 4 },
    margin: { left: 14, right: 14 }
  });

  const yAfterShift = (doc as any).lastAutoTable.finalY + 10;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text("6. Geofencing & Multi-Site Setup Instructions", 14, yAfterShift);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(
    "Geofencing restricts attendance to physical project sites (e.g., Head Office, Site A, Plant 2):",
    14, yAfterShift + 7, { maxWidth: 182 }
  );

  doc.setFillColor(248, 250, 252);
  doc.rect(14, yAfterShift + 13, 182, 35, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, yAfterShift + 13, 182, 35, 'S');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text("Setting Up Site Geofences:", 18, yAfterShift + 20);
  doc.setFont('helvetica', 'normal');
  doc.text("1. Go to Super Admin -> 'Site Geofence Settings'.", 18, yAfterShift + 26);
  doc.text("2. Add Site Name, Latitude, Longitude, and allowed Radius in meters (Default: 150m).", 18, yAfterShift + 32);
  doc.text("3. Assign staff members to specific sites under 'Staff Management' so attendance validates against their site.", 18, yAfterShift + 38);

  // --- PAGE 4: TROUBLESHOOTING & CONTACT ---
  doc.addPage();
  addPageHeaderFooter(4, 4);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text("7. Troubleshooting & Frequently Asked Questions (FAQ)", 14, 26);

  autoTable(doc, {
    startY: 33,
    head: [['Common Error / Query', 'Root Cause', 'Admin Solution']],
    body: [
      [
        'Device Mismatch Error on Check-In',
        'Staff tried using another phone or replaced their device.',
        'Go to Super Admin -> Staff Directory -> Click "Reset Device Lock" for that user.'
      ],
      [
        'Outside Geofence Error',
        'GPS distance exceeds site radius (e.g. 250m > 150m).',
        'Ask staff to enable high accuracy GPS, or adjust site radius/coordinates in Geofence Settings.'
      ],
      [
        'Employee Forgot Password',
        'Lost account credentials.',
        'User can use "Forgot Password" on login screen OR Admin can set new password in Staff Directory.'
      ],
      [
        'Negative Udhar Balance in HR',
        'Repayments exceeded total advances given.',
        'Review transaction records under User HR Advances Ledger and adjust incorrect entry.'
      ]
    ],
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    styles: { fontSize: 8.5, cellPadding: 3.5 },
    margin: { left: 14, right: 14 }
  });

  const yEnd = (doc as any).lastAutoTable.finalY + 15;

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(14, yEnd, 182, 30, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text("SYSTEM ADMINISTRATOR SUPPORT", 22, yEnd + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text("For technical support, database maintenance, or custom HR configurations, contact:", 22, yEnd + 17);
  doc.text("Rudra Infra World Tech Operations | Email: rudrarealtymarketing@gmail.com", 22, yEnd + 23);

  // Save the PDF
  doc.save("Admin_User_Manual_Rudra_Infra.pdf");
};
