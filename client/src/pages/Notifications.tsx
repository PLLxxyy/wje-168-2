import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Empty, Tag, List, message, Space, Popconfirm } from 'antd';
import { Bell, CheckCircle, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { useNotificationStore } from '../store/notificationStore';
import type { Notification } from '../types';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const typeColors: Record<string, string> = {
  approval: 'green',
  rejection: 'red',
  system: 'blue',
};

const typeLabels: Record<string, string> = {
  approval: '审批通过',
  rejection: '审批打回',
  system: '系统通知',
};

export default function Notifications() {
  const { notifications, fetchNotifications, markAsRead, markAllAsRead, deleteNotification } =
    useNotificationStore();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter === 'unread' ? { unread: 'true' } : {};
      await fetchNotifications(params);
    } catch {
      message.error('加载通知失败');
    } finally {
      setLoading(false);
    }
  }, [fetchNotifications, filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMarkAll = async () => {
    try {
      await markAllAsRead();
      message.success('已全部标记为已读');
    } catch {
      message.error('操作失败');
    }
  };

  const handleMarkOne = async (id: number) => {
    try {
      await markAsRead(id);
    } catch {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteNotification(id);
      message.success('删除成功');
    } catch {
      message.error('删除失败');
    }
  };

  const unreadCount = notifications.filter((n: Notification) => n.is_read === 0).length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">通知中心</h1>
        <Space>
          <Button.Group>
            <Button
              type={filter === 'all' ? 'primary' : 'default'}
              onClick={() => setFilter('all')}
            >
              全部
            </Button>
            <Button
              type={filter === 'unread' ? 'primary' : 'default'}
              onClick={() => setFilter('unread')}
            >
              未读 ({unreadCount})
            </Button>
          </Button.Group>
          {unreadCount > 0 && (
            <Button icon={<CheckCircle size={14} />} onClick={handleMarkAll}>
              全部已读
            </Button>
          )}
        </Space>
      </div>

      <Card>
        {notifications.length === 0 ? (
        <Empty description="暂无通知" />
      ) : (
        <List
          loading={loading}
          dataSource={notifications}
          renderItem={(item: Notification) => (
            <List.Item
              className={`hover:bg-gray-50 transition-colors ${item.is_read === 0 ? 'bg-blue-50' : ''}`}
              actions={[
                item.is_read === 0 && (
                  <Button
                    key="mark"
                    type="link"
                    size="small"
                    icon={<CheckCircle size={14} />}
                    onClick={() => handleMarkOne(item.id)}
                  >
                    标记已读
                  </Button>
                ),
                <Popconfirm
                  key="delete"
                  title="确认删除此通知？"
                  onConfirm={() => handleDelete(item.id)}
                  okText="确认"
                  cancelText="取消"
                >
                  <Button type="link" size="small" danger icon={<Trash2 size={14} />}>
                    删除
                  </Button>
                </Popconfirm>,
              ].filter(Boolean)}
            >
              <List.Item.Meta
                avatar={<Bell size={20} className="text-blue-500 mt-1" />}
                title={
                  <div className="flex items-center gap-2">
                  {item.is_read === 0 && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  )}
                  <span className="font-medium">{item.title}</span>
                  <Tag color={typeColors[item.type] || typeColors.system}>
                    {typeLabels[item.type] || '通知'}
                  </Tag>
                </div>
                }
                description={
                  <div>
                    <div className="text-gray-600 mb-1">{item.content}</div>
                    <div className="text-xs text-gray-400">
                      {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
      </Card>
    </div>
  );
}
