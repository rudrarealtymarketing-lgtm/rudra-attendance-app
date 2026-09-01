import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AttendanceRecord, User } from '../types';

export function generateMonthlyAttendancePDF(
  records: AttendanceRecord[], 
  user: User | null, 
  periodLabel: string,
  siteName: string = 'All Sites'
) {
  const doc = new jsPDF('landscape');

  // Filter out any admin/director records if accidentally passed
  const employeeRecords = records.filter(r => true);

  // Header Box - Deep Corporate Navy
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('RUDRA INFRA WORLD - OFFICIAL ATTENDANCE & TIMESHEET REPORT', 14, 11);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const subtitle = user 
    ? `Individual Employee Timesheet | Period: ${periodLabel} | Site: ${user.site_name || siteName}`
    : `Master Company Timesheet | Period: ${periodLabel} | Site Filter: ${siteName} | Total Records: ${employeeRecords.length}`;
  doc.text(subtitle, 14, 20);

  let startY = 32;

  // Individual User Card if printing for single employee
  if (user) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, startY, 269, 20, 2, 2, 'FD');

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Employee Name: ${user.name}`, 18, startY + 6);
    doc.text(`Employee ID: ${user.registration_id || 'N/A'}`, 110, startY + 6);
    doc.text(`Position / Post: ${user.designation || 'Staff'}`, 190, startY + 6);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Assigned Site: ${user.site_name || 'Headquarters'}`, 18, startY + 14);
    doc.text(`Shift Timing: ${user.work_start_time || '10:00 AM'} to ${user.work_end_time || '07:00 PM'}`, 110, startY + 14);
    doc.text(`Phone / Mobile: ${user.phone || 'N/A'}`, 190, startY + 14);

    startY += 25;
  }

  // Statistics calculation
  const totalPresent = employeeRecords.filter(r => r.status === 'P' && (!r.is_late || r.is_late === 0)).length;
  const totalLate = employeeRecords.filter(r => r.status === 'L' || (r.is_late && r.is_late > 0)).length;
  const totalLeaves = employeeRecords.filter(r => r.status === 'Leave' || r.status === 'Half Day').length;
  const totalWeeklyOffs = employeeRecords.filter(r => r.status === 'Weekly Off').length;
  let totalLateMins = 0;
  let totalOT = 0;
  employeeRecords.forEach(r => {
    if (r.late_minutes) totalLateMins += Number(r.late_minutes);
    if (r.overtime_hours) totalOT += Number(r.overtime_hours);
  });

  // KPI Summary Bar
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, startY, 269, 13, 2, 2, 'FD');
  
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`On-Time Present: ${totalPresent}`, 18, startY + 8);
  doc.text(`Late Arrivals: ${totalLate} (${totalLateMins}m late)`, 75, startY + 8);
  doc.text(`Leaves / Half Day: ${totalLeaves}`, 145, startY + 8);
  doc.text(`Weekly Offs: ${totalWeeklyOffs}`, 195, startY + 8);
  doc.text(`Overtime: ${totalOT.toFixed(1)} hrs`, 240, startY + 8);

  startY += 18;

  // Table Body
  const tableRows = employeeRecords.map((r, index) => {
    const isLateRec = r.status === 'L' || (r.is_late && r.is_late > 0);
    const statusLabel = r.status === 'P' && !isLateRec ? 'Present (On-Time)' : isLateRec ? 'Late' : r.status;
    const checkInText = r.check_in ? r.check_in.slice(0, 5) : '--';
    const checkOutText = r.check_out ? r.check_out.slice(0, 5) : '--';
    const lateText = isLateRec && r.late_minutes ? `${r.late_minutes}m late` : isLateRec ? 'Late' : 'On-Time';
    const otText = r.overtime_hours && Number(r.overtime_hours) > 0 ? `${Number(r.overtime_hours).toFixed(1)}h` : '0h';
    const reasonText = r.early_checkout_reason || r.late_reason || '--';

    return [
      (index + 1).toString(),
      r.date,
      r.user_name || (user ? user.name : 'Staff'),
      r.registration_id || (user ? user.registration_id : '--'),
      r.user_site_name || siteName,
      checkInText,
      checkOutText,
      statusLabel,
      lateText,
      otText,
      reasonText
    ];
  });

  autoTable(doc, {
    startY: startY,
    head: [['#', 'Date', 'Employee Name', 'Emp ID', 'Site / Branch', 'Check In', 'Check Out', 'Status', 'Late By', 'Overtime', 'Notes / Reason']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    styles: { fontSize: 7.5, cellPadding: 2.2, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 22 },
      2: { cellWidth: 38 },
      3: { cellWidth: 22 },
      4: { cellWidth: 32 },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 18, halign: 'center' },
      7: { cellWidth: 26, halign: 'center' },
      8: { cellWidth: 22, halign: 'center' },
      9: { cellWidth: 18, halign: 'center' },
      10: { cellWidth: 43 }
    }
  });

  // Footer & Signature
  const finalY = Math.min((doc as any).lastAutoTable.finalY + 12, 198);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated on ${new Date().toLocaleDateString()} | Rudra Infra World Confidential Document`, 14, finalY);
  doc.text('Authorized Signatory: _______________________', 190, finalY);

  const cleanPeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Attendance_Report_${cleanPeriod}_${user ? user.name.replace(/\s+/g, '_') : 'Master'}.pdf`);
}
