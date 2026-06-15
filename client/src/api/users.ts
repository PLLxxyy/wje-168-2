import api from './index';

export const getUsers = async (params?: Record<string, any>) => {
  const res = await api.get('/users', { params });
  return res.data;
};

export const getSubordinates = async () => {
  const res = await api.get('/users/subordinates');
  return res.data;
};

export const getDepartments = async () => {
  const res = await api.get('/users/departments');
  return res.data;
};

export const createUser = async (data: any) => {
  const res = await api.post('/users', data);
  return res.data;
};

export const updateUser = async (id: number, data: any) => {
  const res = await api.put(`/users/${id}`, data);
  return res.data;
};

export const deleteUser = async (id: number) => {
  const res = await api.delete(`/users/${id}`);
  return res.data;
};
