import api from './index';

export const login = async (username: string, password: string) => {
  const res = await api.post('/auth/login', { username, password });
  return res.data;
};

export const register = async (data: {
  username: string;
  password: string;
  name: string;
  email?: string;
  role?: string;
  department?: string;
  supervisor_id?: number;
}) => {
  const res = await api.post('/auth/register', data);
  return res.data;
};

export const getMe = async () => {
  const res = await api.get('/auth/me');
  return res.data;
};
