import api from './index';

export const getTimeEntries = async (params?: Record<string, any>) => {
  const res = await api.get('/time-entries', { params });
  return res.data;
};

export const getCalendarData = async (year: number, month: number, userId?: number) => {
  const res = await api.get('/time-entries/calendar', { params: { year, month, user_id: userId } });
  return res.data;
};

export const saveTimeEntries = async (entries: any[]) => {
  const res = await api.post('/time-entries', { entries });
  return res.data;
};

export const updateTimeEntry = async (id: number, data: any) => {
  const res = await api.put(`/time-entries/${id}`, data);
  return res.data;
};

export const deleteTimeEntry = async (id: number) => {
  const res = await api.delete(`/time-entries/${id}`);
  return res.data;
};
