import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from './store/authStore';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import TimesheetEntry from './pages/TimesheetEntry';
import TimesheetCalendar from './pages/TimesheetCalendar';
import ApprovalList from './pages/ApprovalList';
import TeamSummary from './pages/TeamSummary';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminProjects from './pages/AdminProjects';
import Notifications from './pages/Notifications';

export default function App() {
  const { initAuth, isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      await initAuth();
      setLoading(false);
    };
    init();
  }, [initAuth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/" replace /> : <Register />} />

      <Route element={<ProtectedRoute requiredRole="employee" />}>
        <Route element={<Layout />}>
          <Route path="/timesheet" element={<TimesheetEntry />} />
          <Route path="/timesheet/calendar" element={<TimesheetCalendar />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute requiredRole="supervisor" />}>
        <Route element={<Layout />}>
          <Route path="/approvals" element={<ApprovalList />} />
          <Route path="/team/summary" element={<TeamSummary />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute requiredRole="admin" />}>
        <Route element={<Layout />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/projects" element={<AdminProjects />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/notifications" element={<Notifications />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to={isAuthenticated ? '/timesheet' : '/login'} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
