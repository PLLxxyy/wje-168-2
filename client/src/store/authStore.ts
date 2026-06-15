import { create } from 'zustand';
import { login as loginApi, register as registerApi, getMe } from '../api/auth';
import type { User, UserRole } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  role: UserRole | null;
  login: (username: string, password: string) => Promise<User>;
  register: (data: { username: string; password: string; name: string; email?: string }) => Promise<User>;
  logout: () => void;
  initAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  role: null,

  login: async (username, password) => {
    const data: any = await loginApi(username, password);
    const { token, user } = data;
    localStorage.setItem('token', token);
    set({ token, user, isAuthenticated: true, role: user.role });
    return user;
  },

  register: async (data) => {
    const result: any = await registerApi(data);
    const { token, user } = result;
    localStorage.setItem('token', token);
    set({ token, user, isAuthenticated: true, role: user.role });
    return user;
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null, isAuthenticated: false, role: null });
  },

  initAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ token: null, user: null, isAuthenticated: false, role: null });
      return;
    }
    try {
      const user: any = await getMe();
      set({ user, token, isAuthenticated: true, role: user.role });
    } catch {
      localStorage.removeItem('token');
      set({ token: null, user: null, isAuthenticated: false, role: null });
    }
  },
}));
