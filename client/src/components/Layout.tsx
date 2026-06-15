import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';

const pageTitleMap: Record<string, string> = {
  '/timesheet': '工时填报',
  '/timesheet/calendar': '日历总览',
  '/approvals': '审批管理',
  '/team/summary': '团队汇总',
  '/admin/dashboard': '仪表盘',
  '/admin/users': '用户管理',
  '/admin/projects': '项目管理',
  '/notifications': '通知中心',
};

export default function Layout() {
  const location = useLocation();

  const getTitle = () => {
    const exact = pageTitleMap[location.pathname];
    if (exact) return exact;
    const prefix = Object.keys(pageTitleMap)
      .filter((k) => location.pathname.startsWith(k) && k !== '/')
      .sort((a, b) => b.length - a.length)[0];
    return prefix ? pageTitleMap[prefix] : '工时管理系统';
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-60 min-h-screen bg-gray-50 flex flex-col">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-10">
          <h1 className="text-lg font-semibold text-gray-800">{getTitle()}</h1>
          <NotificationBell />
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
