import api from './index';

export const getNotifications = async (params?: Record<string, any>) => {
  const res = await api.get('/notifications', { params });
  return res.data;
};

export const markAsRead = async (id: number) => {
  const res = await api.put(`/notifications/${id}/read`);
  return res.data;
};

export const markAllAsRead = async () => {
  const res = await api.put('/notifications/read-all');
  return res.data;
};

export const deleteNotification = async (id: number) => {
  const res = await api.delete(`/notifications/${id}`);
  return res.data;
};
