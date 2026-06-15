import api from './index';

export const getPersonalSummary = async (year: number, month: number) => {
  const res = await api.get('/stats/personal/summary', { params: { year, month } });
  return res.data;
};

export const getPersonalProjects = async (year: number, month: number) => {
  const res = await api.get('/stats/personal/projects', { params: { year, month } });
  return res.data;
};

export const getTeamSummary = async (year: number, month: number, department?: string) => {
  const res = await api.get('/stats/team/summary', { params: { year, month, department } });
  return res.data;
};

export const getTeamProjects = async (year: number, month: number, department?: string) => {
  const res = await api.get('/stats/team/projects', { params: { year, month, department } });
  return res.data;
};

export const getCompanySummary = async (year: number, month: number) => {
  const res = await api.get('/stats/company/summary', { params: { year, month } });
  return res.data;
};

export const getOvertimeRanking = async (year: number, month: number, limit?: number) => {
  const res = await api.get('/stats/company/overtime-ranking', { params: { year, month, limit } });
  return res.data;
};

export const getAttendance = async (year: number, month: number) => {
  const res = await api.get('/stats/company/attendance', { params: { year, month } });
  return res.data;
};

export const exportMonthly = async (year: number, month: number) => {
  const res = await api.get('/stats/export/monthly', { params: { year, month } });
  return res.data;
};
