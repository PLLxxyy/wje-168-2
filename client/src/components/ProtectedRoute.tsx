import { Navigate } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import type { UserRole } from '../types';

const roleHomeMap: Record<UserRole, string> = {
  employee: '/timesheet',
  supervisor: '/approvals',
  admin: '/admin/dashboard',
};

interface ProtectedRouteProps {
  requiredRole?: UserRole;
}

export default function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, role } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && role !== requiredRole) {
    return <Navigate to={roleHomeMap[role!]} replace />;
  }

  return <Outlet />;
}
