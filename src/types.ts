export interface User {
  id: number;
  registration_id?: string;
  username?: string;
  name: string;
  email?: string;
  country?: string;
  phone?: string;
  role: 'user' | 'super_admin' | 'director' | 'site_manager';
  department_id?: number;
  department_name?: string;
  site_name?: string;
  password?: string;
  bound_device_id?: string;
  device_fingerprint?: string;
  last_device_info?: string;
  allowed_devices?: number;
  monthly_salary?: number;
  designation?: string;
  date_of_joining?: string;
  date_of_birth?: string;
  emergency_contact?: string;
  bank_account?: string;
  ifsc_code?: string;
  upi_id?: string;
  pan_aadhaar?: string;
  current_address?: string;
  marital_status?: string;
  avatar_url?: string;
  documents?: string;
  work_start_time?: string;
  work_end_time?: string;
  created_at: string;
}

export interface AppNotification {
  id: number;
  user_id?: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: number;
  created_at: string;
}

export interface SalaryAdvance {
  id: number;
  user_id: number;
  type: 'ADVANCE_GIVEN' | 'REPAYMENT_DEDUCTED';
  amount: number;
  date: string;
  notes?: string;
  created_at?: string;
}

export interface PayrollSummary {
  month: string;
  user: {
    id: number;
    name: string;
    registration_id?: string;
    monthly_salary: number;
    designation?: string;
    bound_device_id?: string;
    last_device_info?: string;
  };
  metrics: {
    daysInMonth: number;
    presentCount: number;
    absentCount: number;
    dailyWage: number;
    grossEarnedSalary: number;
    netAdvanceBalance: number;
    netPayableSalary: number;
  };
}

export interface Department {
  id: number;
  name: string;
  description?: string;
}

export interface Session {
  id: number;
  name: string;
  date: string;
  start_time: string;
  end_time: string;
  department_id?: number;
  department_name?: string;
  site_name?: string;
  created_at: string;
}

export interface AttendanceRecord {
  id: number;
  user_id: number;
  session_id?: number;
  user_name?: string;
  registration_id?: string;
  user_site_name?: string;
  designation?: string;
  department_name?: string;
  date: string;
  check_in: string;
  check_out?: string;
  status: 'P' | 'A' | 'L' | 'Leave' | 'Half Day' | 'Weekly Off';
  location?: string;
  method: 'one-tap' | 'app' | 'gps' | 'manual' | 'manual_approval' | 'request_approved';
  early_checkout_reason?: string;
  late_reason?: string;
  is_late?: number;
  late_minutes?: number;
  overtime_hours?: number;
  is_proxy_flagged?: number;
  created_at: string;
}

export type Screen = 'splash' | 'login' | 'home' | 'history' | 'profile' | 'admin' | 'director';

export interface Site {
  id: number;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  radius: number;
  geofence_radius?: number;
  work_start_time?: string;
  work_end_time?: string;
  created_at: string;
}

export interface Holiday {
  id: number;
  date: string;
  name: string;
  created_at: string;
}

export interface Designation {
  id: number;
  name: string;
  created_at?: string;
}

export interface AttendanceRequest {
  id: number;
  user_id: number;
  user_name?: string;
  registration_id?: string;
  user_site_name?: string;
  designation?: string;
  date: string;
  start_date?: string;
  end_date?: string;
  check_in?: string;
  check_out?: string;
  type?: 'ADVANCE_LEAVE' | 'EMERGENCY_LEAVE' | 'HALF_DAY' | 'WEEKLY_OFF' | 'TIME_CHANGE' | 'CORRECTION';
  half_day_slot?: 'FIRST_HALF' | 'SECOND_HALF';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string;
  admin_comment?: string;
  actioned_at?: string;
  actioned_by?: string;
  site_name?: string;
  created_at: string;
}

