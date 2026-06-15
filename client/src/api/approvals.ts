import api from './index';

export const getPendingApprovals = async () => {
  const res = await api.get('/approvals/pending');
  return res.data;
};

export const approveEntry = async (id: number, comment?: string) => {
  const res = await api.post(`/approvals/${id}/approve`, { comment });
  return res.data;
};

export const rejectEntry = async (id: number, comment: string) => {
  const res = await api.post(`/approvals/${id}/reject`, { comment });
  return res.data;
};

export const batchApprove = async (userId: number, entryDate: string, comment?: string) => {
  const res = await api.post('/approvals/batch/approve', { user_id: userId, entry_date: entryDate, comment });
  return res.data;
};

export const batchReject = async (userId: number, entryDate: string, comment: string) => {
  const res = await api.post('/approvals/batch/reject', { user_id: userId, entry_date: entryDate, comment });
  return res.data;
};
