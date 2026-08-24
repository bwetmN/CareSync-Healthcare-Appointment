import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  activeRole: UserRole | null;
  setActiveRole: (role: UserRole | null) => void;
  login: (email: string, pass: string) => Promise<void>;
  register: (data: { email: string; password: string; name: string; role?: string; phone?: string }) => Promise<void>;
  demoLogin: (role: 'PATIENT' | 'DOCTOR' | 'ADMIN') => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('caresync_token'));
  const [loading, setLoading] = useState<boolean>(true);
  const [activeRole, setActiveRole] = useState<UserRole | null>(null);

  const refreshUser = async () => {
    try {
      const u = await api.auth.getMe();
      setUser(u);
      setActiveRole(u.role);
    } catch (err) {
      console.warn('Session expired or invalid:', err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      refreshUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const res = await api.auth.login({ email, password: pass });
      localStorage.setItem('caresync_token', res.token);
      setToken(res.token);
      setUser(res.user);
      setActiveRole(res.user.role);
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: { email: string; password: string; name: string; role?: string; phone?: string }) => {
    setLoading(true);
    try {
      const res = await api.auth.register(data);
      localStorage.setItem('caresync_token', res.token);
      setToken(res.token);
      setUser(res.user);
      setActiveRole(res.user.role);
    } finally {
      setLoading(false);
    }
  };

  const demoLogin = async (role: 'PATIENT' | 'DOCTOR' | 'ADMIN') => {
    setLoading(true);
    try {
      const res = await api.auth.demoLogin(role);
      localStorage.setItem('caresync_token', res.token);
      setToken(res.token);
      setUser(res.user);
      setActiveRole(res.user.role);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('caresync_token');
    localStorage.removeItem('caresync_active_hold');
    setToken(null);
    setUser(null);
    setActiveRole(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        activeRole,
        setActiveRole,
        login,
        register,
        demoLogin,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
