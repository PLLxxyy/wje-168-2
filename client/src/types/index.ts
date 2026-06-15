export type UserRole = 'admin' | 'supervisor' | 'employee';

export interface User {
  id: number;
  username: string;
  name: string;
  email?: string;
  role: UserRole;
  department?: string;
  supervisor_id?: number;
  supervisor_name?: string;
  created_at: string;
}

export interface Project {
  id: number;
  name: string;
  code: string;
  description?: string;
  department?: string;
  status: string;
  created_at: string;
}

export interface TimeEntry {
  id: number;
  user_id: number;
  entry_date: string;
  task_name: string;
  hours: number;
  project_id?: number;
  project_name?: string;
  description?: string;
  is_overtime: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface TimeEntryWithUser extends TimeEntry {
  user_name: string;
  department: string;
}

export interface PendingGroup {
  user_id: number;
  user_name: string;
  department: string;
  entry_date: string;
  entries: TimeEntry[];
  total_hours: number;
  is_overtime: number;
}

export interface Approval {
  id: number;
  time_entry_id: number;
  approver_id: number;
  status: string;
  comment?: string;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  content?: string;
  is_read: number;
  related_id?: number;
  created_at: string;
}

export interface CalendarData {
  entry_date: string;
  total_hours: number;
  overtime_hours: number;
  entry_count: number;
  status: string;
}

export interface PersonalSummary {
  work_days: number;
  approved_hours: number;
  pending_hours: number;
  rejected_hours: number;
  overtime_hours: number;
  total_entries: number;
}

export interface ProjectStats {
  id: number;
  name: string;
  code: string;
  total_hours: number;
  entry_count: number;
}

export interface TeamMemberSummary {
  id: number;
  name: string;
  department: string;
  work_days: number;
  approved_hours: number;
  pending_hours: number;
  overtime_hours: number;
}

export interface DepartmentSummary {
  department: string;
  employee_count: number;
  total_attendance_days: number;
  total_hours: number;
  total_overtime_hours: number;
}

export interface OvertimeRank {
  id: number;
  name: string;
  department: string;
  overtime_hours: number;
}

export interface AttendanceData {
  id: number;
  name: string;
  department: string;
  filled_days: number;
}
