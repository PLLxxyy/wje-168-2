import { useNavigate, useLocation } from 'react-router-dom';
import {
  Clock,
  Calendar,
  CheckSquare,
  Users,
  LayoutDashboard,
  UserCog,
  FolderKanban,
  Bell,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import type { UserRole } from '../types';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const navByRole: Record<UserRole, NavItem[]> = {
  employee: [
    { label: '工时填报', path: '/timesheet', icon: <Clock size={18} /> },
    { label: '日历总览', path: '/timesheet/calendar', icon: <Calendar size={18} /> },
  ],
  supervisor: [
    { label: '审批管理', path: '/approvals', icon: <CheckSquare size={18} /> },
    { label: '团队汇总', path: '/team/summary', icon: <Users size={18} /> },
  ],
  admin: [
    { label: '仪表盘', path: '/admin/dashboard', icon: <LayoutDashboard size={18} /> },
    { label: '用户管理', path: '/admin/users', icon: <UserCog size={18} /> },
    { label: '项目管理', path: '/admin/projects', icon: <FolderKanban size={18} /> },
  ],
};

export default function Sidebar() {
  const { user, role, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const items = role ? [...navByRole[role], { label: '通知中心', path: '/notifications', icon: <Bell size={18} /> }] : [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-blue-900 text-white flex flex-col">
      <div className="px-5 py-6 text-xl font-bold tracking-wide border-b border-blue-800">
        工时管理系统
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {items.map((item) => {
          const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${
                active
                  ? 'bg-blue-700 border-l-4 border-white pl-4'
                  : 'border-l-4 border-transparent hover:bg-blue-800'
              }`}
            >
              {item.icon}
              <span className="text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-blue-800 px-5 py-4">
        <div className="text-sm truncate mb-2">{user?.name || user?.username}</div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-blue-300 hover:text-white transition-colors"
        >
          <LogOut size={16} />
          <span>退出登录</span>
        </button>
      </div>
    </aside>
  );
}
