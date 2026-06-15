import { create } from 'zustand';
import {
  getNotifications,
  markAsRead as markAsReadApi,
  markAllAsRead as markAllAsReadApi,
  deleteNotification as deleteNotificationApi,
} from '../api/notifications';
import type { Notification } from '../types';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  fetchNotifications: (params?: Record<string, any>) => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  fetchNotifications: async (params) => {
    const data = await getNotifications(params);
    const notifications = data.notifications || [];
    const unreadCount = data.unreadCount ?? notifications.filter((n: Notification) => n.is_read === 0).length;
    set({ notifications, unreadCount });
  },

  markAsRead: async (id) => {
    await markAsReadApi(id);
    const notifications = get().notifications.map((n) =>
      n.id === id ? { ...n, is_read: 1 } : n,
    );
    set({ notifications, unreadCount: notifications.filter((n) => n.is_read === 0).length });
  },

  markAllAsRead: async () => {
    await markAllAsReadApi();
    const notifications = get().notifications.map((n) => ({ ...n, is_read: 1 }));
    set({ notifications, unreadCount: 0 });
  },

  deleteNotification: async (id) => {
    await deleteNotificationApi(id);
    const notifications = get().notifications.filter((n) => n.id !== id);
    set({ notifications, unreadCount: notifications.filter((n) => n.is_read === 0).length });
  },
}));
