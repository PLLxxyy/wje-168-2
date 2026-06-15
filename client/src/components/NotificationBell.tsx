import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Dropdown, Badge, Button, Empty, Spin } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { useNotificationStore } from '../store/notificationStore';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

export default function NotificationBell() {
  const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead } =
    useNotificationStore();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleOpenChange = async (visible: boolean) => {
    setOpen(visible);
    if (visible) {
      setLoading(true);
      await fetchNotifications();
      setLoading(false);
    }
  };

  const handleMarkAll = async () => {
    await markAllAsRead();
  };

  const handleMarkOne = async (id: number) => {
    await markAsRead(id);
  };

  const dropdownContent = (
    <div className="w-80 bg-white rounded-lg shadow-lg border border-gray-100 max-h-96 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="font-semibold text-gray-800">通知</span>
        {unreadCount > 0 && (
          <Button type="link" size="small" onClick={handleMarkAll}>
            全部已读
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <Spin />
          </div>
        ) : notifications.length === 0 ? (
          <Empty description="暂无通知" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${
                !n.is_read ? 'bg-blue-50' : ''
              }`}
              onClick={() => !n.is_read && handleMarkOne(n.id)}
            >
              <div className="flex items-start gap-2">
                {!n.is_read && <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{n.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.content}</div>
                  <div className="text-xs text-gray-400 mt-1">{dayjs(n.created_at).fromNow()}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <Dropdown
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      open={open}
      onOpenChange={handleOpenChange}
      placement="bottomRight"
    >
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <Bell size={20} className="text-gray-600 cursor-pointer hover:text-gray-800 transition-colors" />
      </Badge>
    </Dropdown>
  );
}
