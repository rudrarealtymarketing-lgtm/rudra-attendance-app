export type Language = 'en' | 'hi';

export interface Translations {
  appName: string;
  tagline: string;
  byLine: string;
  login: string;
  employeeIdOrEmail: string;
  password: string;
  rememberMe: string;
  autoSaved: string;
  signInBtn: string;
  gpsActive: string;
  gpsVerify: string;
  quickTestAccounts: string;
  adminRole: string;
  directorRole: string;
  staffRole: string;
  testRole: string;

  // Nav
  home: string;
  timesheet: string;
  leave: string;
  profile: string;
  admin: string;
  director: string;
  requests: string;
  dashboard: string;
  attendance: string;
  adminConsole: string;

  // Home Screen
  goodMorning: string;
  goodAfternoon: string;
  goodEvening: string;
  goodNight: string;
  dailyStatus: string;
  officeHours: string;
  todayInOut: string;
  tapToCheckIn: string;
  tapToCheckOut: string;
  dayCompleted: string;
  attendanceRecorded: string;
  seeYouTomorrow: string;
  officeStart: string;
  shiftEnd: string;
  applyLeave: string;
  viewTimesheet: string;
  notCheckedIn: string;
  checkedInOnTime: string;
  checkedInLate: string;
  checkedOutComplete: string;
  notifications: string;
  noNotifications: string;
  clearAll: string;
  markAsRead: string;
  earlyDepartureTitle: string;
  earlyDeparturePrompt: string;
  earlyDeparturePlaceholder: string;
  confirmCheckOut: string;
  cancel: string;
  lateArrivalTitle: string;
  lateArrivalPrompt: string;
  lateArrivalPlaceholder: string;
  confirmLateCheckIn: string;
  lateNoticeTitle: string;
  lateNoticeDesc: string;
  recordedDelay: string;
  acknowledged: string;

  // Timesheet
  timesheetTitle: string;
  timesheetSubtitle: string;
  downloadPdf: string;
  month: string;
  year: string;
  allLogs: string;
  present: string;
  late: string;
  leaveQuota: string;
  weeklyOff: string;
  halfDay: string;
  overtime: string;
  daysWorked: string;
  totalLate: string;
  leaveBalance: string;
  onTimeDays: string;
  filterByStatus: string;
  calendarView: string;
  listView: string;

  // Requests Modal
  requestModalTitle: string;
  requestModalSubtitle: string;
  applyNewRequest: string;
  myRequests: string;
  selectCategory: string;
  advanceLeave: string;
  emergencyLeave: string;
  halfDayLeave: string;
  weeklyOffLeave: string;
  timeCorrection: string;
  timeDuration: string;
  firstHalf: string;
  secondHalf: string;
  targetDate: string;
  startDate: string;
  endDate: string;
  checkInTime: string;
  checkOutTime: string;
  selectSite: string;
  reasonPrompt: string;
  submitApplication: string;
  submitting: string;
  weeklyOffLimitNotice: string;
  correctionLimitNotice: string;

  // Profile Screen
  profileTitle: string;
  profileSubtitle: string;
  digitalId: string;
  personalInfo: string;
  saveChanges: string;
  saving: string;
  officialEmail: string;
  residentialAddress: string;
  maritalStatus: string;
  single: string;
  married: string;
  emergencyContact: string;
  appearanceAndLanguage: string;
  themeMode: string;
  lightMode: string;
  darkMode: string;
  language: string;
  deviceProtected: string;
  signOut: string;
  digitalBadgeTitle: string;
  printOrSaveCard: string;
  close: string;

  // Director & Admin
  executiveOverview: string;
  pendingRequests: string;
  siteOverview: string;
  liveAttendanceStream: string;
  approve: string;
  decline: string;
  searchPlaceholder: string;
  addStaff: string;
  addSite: string;
  googleSheetsSync: string;
  satelliteView: string;
  geofenceRadius: string;
  workTimings: string;
  officeStartTime: string;
  officeEndTime: string;
  allowedDevices: string;
  actions: string;
  deleteUser: string;
  deleteSite: string;
  resetDevice: string;
  confirmDelete: string;
}

export function useTranslation(lang: Language | string = 'en') {
  const currentLang = (translations as any)[lang] || translations.en;
  return (key: keyof Translations | string): string => {
    return (currentLang as any)[key] || (translations.en as any)[key] || String(key);
  };
}

export const translations: Record<Language, Translations> = {
  en: {
    appName: "Rudra Infra World",
    tagline: "Corporate Workforce & Attendance Management",
    byLine: "Designed & Developed by Abhishek Bhatt",
    login: "Account Login",
    employeeIdOrEmail: "Employee ID or Email",
    password: "Password",
    rememberMe: "Remember My Login",
    autoSaved: "Auto Saved",
    signInBtn: "Sign In to StaffSync",
    gpsActive: "GPS Geofencing Active",
    gpsVerify: "Location Verified on Check-in",
    quickTestAccounts: "Quick Test Accounts:",
    adminRole: "Admin",
    directorRole: "Director",
    staffRole: "Staff",
    testRole: "Testing",

    home: "Home",
    timesheet: "Timesheet",
    leave: "Leave",
    profile: "Profile",
    admin: "Admin",
    director: "Director",
    requests: "Requests",
    dashboard: "Dashboard",
    attendance: "Attendance",
    adminConsole: "Admin Console",

    goodMorning: "Good Morning",
    goodAfternoon: "Good Afternoon",
    goodEvening: "Good Evening",
    goodNight: "Good Night",
    dailyStatus: "Daily Attendance Status",
    officeHours: "Official Office Hours",
    todayInOut: "Today's Check In / Out",
    tapToCheckIn: "TAP TO CHECK IN",
    tapToCheckOut: "TAP TO CHECK OUT",
    dayCompleted: "DAY COMPLETED",
    attendanceRecorded: "Attendance Recorded",
    seeYouTomorrow: "Have a great evening! See you tomorrow!",
    officeStart: "Office Start",
    shiftEnd: "Shift End",
    applyLeave: "Apply Leave",
    viewTimesheet: "Timesheet",
    notCheckedIn: "Absent (Not Checked In)",
    checkedInOnTime: "Checked In (On-Time)",
    checkedInLate: "Checked In (Late Entry)",
    checkedOutComplete: "Checked Out (Shift Complete)",
    notifications: "Notifications",
    noNotifications: "No new notifications",
    clearAll: "Clear All",
    markAsRead: "Mark Read",
    earlyDepartureTitle: "Early Departure Reason",
    earlyDeparturePrompt: "Standard shift ends at 07:00 PM. Please state your reason for early departure:",
    earlyDeparturePlaceholder: "e.g. Client site meeting completed / Medical appointment",
    confirmCheckOut: "Confirm Check-Out",
    cancel: "Cancel",
    lateArrivalTitle: "Late Arrival Reason",
    lateArrivalPrompt: "Official shift starts at 10:00 AM. Please state your reason for late arrival:",
    lateArrivalPlaceholder: "e.g. Heavy traffic, Vehicle breakdown, Site visit, Family emergency...",
    confirmLateCheckIn: "Confirm & Check In",
    lateNoticeTitle: "Late Check-In Notice",
    lateNoticeDesc: "You checked in after the official office start time.",
    recordedDelay: "Recorded Delay",
    acknowledged: "Acknowledged & Proceed",

    timesheetTitle: "Attendance Timesheet",
    timesheetSubtitle: "Monthly Logs, Performance & Quotas",
    downloadPdf: "PDF Report",
    month: "Month",
    year: "Year",
    allLogs: "All Logs",
    present: "Present",
    late: "Late",
    leaveQuota: "Leaves",
    weeklyOff: "Weekly Off",
    halfDay: "Half Day",
    overtime: "Overtime",
    daysWorked: "Days Worked",
    totalLate: "Total Late Delay",
    leaveBalance: "Leave & Offs Balance",
    onTimeDays: "On-Time Days",
    filterByStatus: "Filter Status",
    calendarView: "Calendar View",
    listView: "List View",

    requestModalTitle: "Leave & Attendance Requests",
    requestModalSubtitle: "Approval Workflow & Monthly Quota Management",
    applyNewRequest: "Apply New Request",
    myRequests: "My Request History",
    selectCategory: "Select Request Category",
    advanceLeave: "Advance Planned Leave",
    emergencyLeave: "Emergency Unplanned Leave",
    halfDayLeave: "Half-Day Leave",
    weeklyOffLeave: "Weekly Off (Sunday / Roster)",
    timeCorrection: "Time Correction / Manual Entry",
    timeDuration: "Time Duration & Shift Slot",
    firstHalf: "First Half (Morning Slot)",
    secondHalf: "Second Half (Afternoon Slot)",
    targetDate: "Target Date",
    startDate: "Start Date",
    endDate: "End Date",
    checkInTime: "Correct Check-In Time",
    checkOutTime: "Correct Check-Out Time",
    selectSite: "Project Site / Branch",
    reasonPrompt: "Reason / Justification",
    submitApplication: "Submit Application for Approval",
    submitting: "Submitting Request...",
    weeklyOffLimitNotice: "Weekly-Off Limit: Maximum 4 days allowed per calendar month.",
    correctionLimitNotice: "Time Correction Limit: Maximum 3 requests allowed per month.",

    profileTitle: "Staff Profile & ID",
    profileSubtitle: "Digital Real Estate Identity & Preferences",
    digitalId: "Digital ID Badge",
    personalInfo: "Personal & Contact Details",
    saveChanges: "Save Profile Changes",
    saving: "Saving...",
    officialEmail: "Official Email Address",
    residentialAddress: "Residential Address",
    maritalStatus: "Marital Status",
    single: "Single",
    married: "Married",
    emergencyContact: "Emergency Contact Number",
    appearanceAndLanguage: "Appearance & Language Settings",
    themeMode: "App Theme",
    lightMode: "Light (White Corporate)",
    darkMode: "Dark Luxury Mode",
    language: "App Language",
    deviceProtected: "Single-Device Security Protected",
    signOut: "Sign Out from Account",
    digitalBadgeTitle: "Corporate Staff Identity Card",
    printOrSaveCard: "Print / Save ID Card",
    close: "Close",

    executiveOverview: "Executive Overview",
    pendingRequests: "Pending Requests",
    siteOverview: "Project Sites",
    liveAttendanceStream: "Live Attendance Stream",
    approve: "Approve",
    decline: "Decline",
    searchPlaceholder: "Search staff name, ID, or site...",
    addStaff: "Add Staff Member",
    addSite: "Add Project Site",
    googleSheetsSync: "Google Sheets Live Sync",
    satelliteView: "Satellite Geofence Map",
    geofenceRadius: "Geofence Radius (Meters)",
    workTimings: "Site & Staff Work Timings",
    officeStartTime: "Shift Start Time",
    officeEndTime: "Shift End Time",
    allowedDevices: "Allowed Devices Lock",
    actions: "Actions",
    deleteUser: "Delete Staff",
    deleteSite: "Delete Site",
    resetDevice: "Reset Device Lock",
    confirmDelete: "Are you sure you want to delete this record? This action cannot be undone."
  },
  hi: {
    appName: "रुद्र इन्फ्रा वर्ल्ड",
    tagline: "कॉर्पोरेट स्टाफ उपस्थिति एवं कार्यबल प्रबंधन",
    byLine: "Designed & Developed by Abhishek Bhatt",
    login: "खाता लॉगिन",
    employeeIdOrEmail: "कर्मचारी आईडी या ईमेल",
    password: "पासवर्ड",
    rememberMe: "मेरा लॉगिन याद रखें",
    autoSaved: "स्वतः सहेजा गया",
    signInBtn: "स्टाफसिंक में साइन इन करें",
    gpsActive: "जीपीएस जियोफेंस सक्रिय",
    gpsVerify: "चेक-इन पर स्थान सत्यापित",
    quickTestAccounts: "त्वरित परीक्षण खाते:",
    adminRole: "एडमिन",
    directorRole: "डायरेक्टर",
    staffRole: "स्टाफ",
    testRole: "परीक्षण",

    home: "होम",
    timesheet: "टाइमशीट",
    leave: "अवकाश",
    profile: "प्रोफाइल",
    admin: "एडमिन",
    director: "डायरेक्टर",
    requests: "अनुरोध",
    dashboard: "डैशबोर्ड",
    attendance: "उपस्थिति",
    adminConsole: "एडमिन कंसोल",

    goodMorning: "शुभ प्रभात",
    goodAfternoon: "शुभ दोपहर",
    goodEvening: "शुभ संध्या",
    goodNight: "शुभ रात्रि",
    dailyStatus: "दैनिक उपस्थिति स्थिति",
    officeHours: "कार्यालय का आधिकारिक समय",
    todayInOut: "आज का चेक इन / आउट",
    tapToCheckIn: "चेक-इन करने के लिए स्पर्श करें",
    tapToCheckOut: "चेक-आउट करने के लिए स्पर्श करें",
    dayCompleted: "दिन पूरा हुआ",
    attendanceRecorded: "उपस्थिति दर्ज की गई",
    seeYouTomorrow: "आपका दिन शुभ रहे! कल फिर मिलेंगे!",
    officeStart: "ऑफिस प्रारंभ",
    shiftEnd: "शिफ्ट समाप्त",
    applyLeave: "छुट्टी का आवेदन करें",
    viewTimesheet: "टाइमशीट देखें",
    notCheckedIn: "अनुपस्थित (चेक-इन नहीं किया)",
    checkedInOnTime: "चेक-इन (समय पर)",
    checkedInLate: "चेक-इन (देरी से)",
    checkedOutComplete: "चेक-आउट (शिफ्ट पूर्ण)",
    notifications: "सूचनाएं (Notifications)",
    noNotifications: "कोई नई सूचना नहीं है",
    clearAll: "सभी हटाएं",
    markAsRead: "पढ़ा हुआ मार्क करें",
    earlyDepartureTitle: "जल्दी जाने का कारण",
    earlyDeparturePrompt: "मानक शिफ्ट शाम 07:00 बजे समाप्त होती है। कृपया जल्दी जाने का कारण बताएं:",
    earlyDeparturePlaceholder: "उदा. क्लाइंट साइट मीटिंग पूर्ण / डॉक्टर अपॉइंटमेंट",
    confirmCheckOut: "चेक-आउट की पुष्टि करें",
    cancel: "रद्द करें",
    lateArrivalTitle: "देर से आने का कारण",
    lateArrivalPrompt: "कार्यालय का आधिकारिक समय सुबह 10:00 बजे है। कृपया देर से आने का कारण बताएं:",
    lateArrivalPlaceholder: "उदा. भारी ट्रैफिक, वाहन खराबी, साइट विजिट, पारिवारिक कार्य...",
    confirmLateCheckIn: "पुष्टि करें और चेक-इन करें",
    lateNoticeTitle: "विलंब चेक-इन सूचना",
    lateNoticeDesc: "आपने कार्यालय के निर्धारित समय के बाद चेक-इन किया है।",
    recordedDelay: "दर्ज विलंब",
    acknowledged: "स्वीकार किया और आगे बढ़ें",

    timesheetTitle: "उपस्थिति टाइमशीट",
    timesheetSubtitle: "मासिक लॉग, प्रदर्शन एवं अवकाश कोटा",
    downloadPdf: "पीडीएफ रिपोर्ट",
    month: "माह",
    year: "वर्ष",
    allLogs: "सभी लॉग",
    present: "उपस्थित",
    late: "विलंब",
    leaveQuota: "अवकाश",
    weeklyOff: "साप्ताहिक अवकाश",
    halfDay: "आधा दिन",
    overtime: "ओवरटाइम",
    daysWorked: "कार्य दिवस",
    totalLate: "कुल विलंब",
    leaveBalance: "अवकाश शेष",
    onTimeDays: "समय पर उपस्थित दिन",
    filterByStatus: "स्थिति अनुसार फ़िल्टर",
    calendarView: "कैलेंडर दृश्य",
    listView: "सूची दृश्य",

    requestModalTitle: "अवकाश एवं उपस्थिति अनुरोध",
    requestModalSubtitle: "स्वीकृति कार्यप्रवाह एवं मासिक कोटा प्रबंधन",
    applyNewRequest: "नया अनुरोध भेजें",
    myRequests: "मेरे पिछले अनुरोध",
    selectCategory: "अनुरोध श्रेणी चुनें",
    advanceLeave: "अग्रिम नियोजित अवकाश (Advance Leave)",
    emergencyLeave: "आपातकालीन अवकाश (Emergency Leave)",
    halfDayLeave: "आधे दिन का अवकाश (Half Day)",
    weeklyOffLeave: "साप्ताहिक अवकाश (Weekly Off)",
    timeCorrection: "समय संशोधन (Time Correction)",
    timeDuration: "समय अवधि एवं शिफ्ट स्लॉट",
    firstHalf: "पहला भाग (सुबह का स्लॉट)",
    secondHalf: "दूसरा भाग (दोपहर का स्लॉट)",
    targetDate: "लक्षित तारीख",
    startDate: "प्रारंभ तारीख",
    endDate: "समाप्ति तारीख",
    checkInTime: "सही चेक-इन समय",
    checkOutTime: "सही चेक-आउट समय",
    selectSite: "प्रोजेक्ट साइट / शाखा",
    reasonPrompt: "कारण / विवरण",
    submitApplication: "अनुमोदन हेतु आवेदन जमा करें",
    submitting: "आवेदन जमा हो रहा है...",
    weeklyOffLimitNotice: "साप्ताहिक अवकाश सीमा: प्रति कैलेंडर माह अधिकतम 4 दिन।",
    correctionLimitNotice: "समय संशोधन सीमा: प्रति कैलेंडर माह अधिकतम 3 बार।",

    profileTitle: "स्टाफ प्रोफाइल एवं पहचान पत्र",
    profileSubtitle: "डिजिटल रियल एस्टेट आईडी एवं प्राथमिकताएं",
    digitalId: "डिजिटल आईडी कार्ड",
    personalInfo: "व्यक्तिगत एवं संपर्क विवरण",
    saveChanges: "प्रोफाइल परिवर्तन सहेजें",
    saving: "सहेजा जा रहा है...",
    officialEmail: "आधिकारिक ईमेल पता",
    residentialAddress: "निवास का पता",
    maritalStatus: "वैवाहिक स्थिति",
    single: "अविवाहित",
    married: "विवाहित",
    emergencyContact: "आपातकालीन संपर्क नंबर",
    appearanceAndLanguage: "थीम एवं भाषा सेटिंग्स",
    themeMode: "ऐप थीम",
    lightMode: "लाइट (सफेद कॉर्पोरेट)",
    darkMode: "डार्क लक्ज़री मोड",
    language: "ऐप की भाषा",
    deviceProtected: "एकल-उपकरण सुरक्षा सक्रिय",
    signOut: "खाते से लॉग आउट करें",
    digitalBadgeTitle: "कॉर्पोरेट स्टाफ पहचान पत्र",
    printOrSaveCard: "आईडी कार्ड प्रिंट / सेव करें",
    close: "बंद करें",

    executiveOverview: "कार्यकारी अवलोकन",
    pendingRequests: "लंबित अनुरोध",
    siteOverview: "प्रोजेक्ट साइट्स",
    liveAttendanceStream: "लाइव उपस्थिति स्ट्रीम",
    approve: "स्वीकार करें",
    decline: "अस्वीकार करें",
    searchPlaceholder: "स्टाफ नाम, आईडी या साइट खोजें...",
    addStaff: "नया स्टाफ जोड़ें",
    addSite: "नई साइट जोड़ें",
    googleSheetsSync: "गूगल शीट्स लाइव सिंक",
    satelliteView: "सैटेलाइट जियोफेंस मैप",
    geofenceRadius: "जियोफेंस दायरा (मीटर)",
    workTimings: "साइट एवं स्टाफ कार्य समय",
    officeStartTime: "शिफ्ट प्रारंभ समय",
    officeEndTime: "शिफ्ट समाप्ति समय",
    allowedDevices: "अनुमत उपकरण लॉक",
    actions: "कार्रवाई",
    deleteUser: "स्टाफ हटाएं",
    deleteSite: "साइट हटाएं",
    resetDevice: "डिवाइस लॉक रीसेट करें",
    confirmDelete: "क्या आप वाकई इस रिकॉर्ड को हटाना चाहते हैं? यह क्रिया वापस नहीं ली जा सकती।"
  }
};
