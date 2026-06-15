export type UserRole = 'admin' | 'supervisor' | 'employee';

export interface User {
  id: number;
  username: string;
  name: string;
  email?: string;
  role: UserRole;
  department?: string;
  supervisor_id?: number;
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

export interface JwtPayload {
  userId: number;
  username: string;
  role: UserRole;
}
