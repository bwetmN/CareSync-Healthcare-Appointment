import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  Activity,
  Calendar,
  ShieldAlert,
  User as UserIcon,
  LogOut,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { UserRole } from '../types';

export const Navbar: React.FC<{
  currentTab: string;
  onSelectTab: (tab: string) => void;
}> = ({ currentTab, onSelectTab }) => {
  const { user, logout, demoLogin, activeRole, setActiveRole } = useAuth();
  const [googleStatus, setGoogleStatus] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [showRoleMenu, setShowRoleMenu] = useState<boolean>(false);

  const checkCalendarStatus = async () => {
    try {
      const res = await api.calendar.getStatus();
      setGoogleStatus(res.isConnected);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (user) {
      checkCalendarStatus();
    }
  }, [user]);

  const handleConnectCalendar = async () => {
    setGoogleLoading(true);
    try {
      const res = await api.calendar.getAuthUrl();
      if (res.authUrl) {
        window.location.href = res.authUrl;
      } else {
        alert(
          'Google Calendar OAuth credentials are not configured in backend .env. Operating in automatic mock calendar mode!'
        );
      }
    } catch (e: any) {
      alert(e.message || 'Failed to connect Google Calendar');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleQuickSwitch = async (role: UserRole) => {
    setShowRoleMenu(false);
    await demoLogin(role);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onSelectTab('portal')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-lg text-slate-900 tracking-tight">CareSync</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-brand-100 text-brand-700">
                Health AI
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">Healthcare Appointment & Follow-up Platform</p>
          </div>
        </div>

        {/* Portal Navigation Tabs */}
        {user && (
          <nav className="hidden md:flex items-center space-x-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            {user.role === 'PATIENT' && (
              <>
                <button
                  onClick={() => onSelectTab('book')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    currentTab === 'book'
                      ? 'bg-white text-brand-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Book Appointment
                </button>
                <button
                  onClick={() => onSelectTab('appointments')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    currentTab === 'appointments'
                      ? 'bg-white text-brand-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  My Appointments
                </button>
                <button
                  onClick={() => onSelectTab('medications')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    currentTab === 'medications'
                      ? 'bg-white text-brand-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Medications & Doses
                </button>
              </>
            )}

            {user.role === 'DOCTOR' && (
              <>
                <button
                  onClick={() => onSelectTab('agenda')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    currentTab === 'agenda'
                      ? 'bg-white text-brand-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Patient Queue & Agenda
                </button>
                <button
                  onClick={() => onSelectTab('leaves')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    currentTab === 'leaves'
                      ? 'bg-white text-brand-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Leave Management
                </button>
              </>
            )}

            {user.role === 'ADMIN' && (
              <>
                <button
                  onClick={() => onSelectTab('analytics')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    currentTab === 'analytics'
                      ? 'bg-white text-brand-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Analytics & Overview
                </button>
                <button
                  onClick={() => onSelectTab('doctors')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    currentTab === 'doctors'
                      ? 'bg-white text-brand-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Doctor Profiles
                </button>
                <button
                  onClick={() => onSelectTab('outbox')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    currentTab === 'outbox'
                      ? 'bg-white text-brand-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Email Queue & Worker
                </button>
              </>
            )}
          </nav>
        )}

        {/* Right Section: Role Switcher & User Profile */}
        <div className="flex items-center space-x-3">
          {user ? (
            <>
              {/* Google Calendar Sync Indicator */}
              <button
                onClick={handleConnectCalendar}
                disabled={googleLoading}
                title={googleStatus ? 'Google Calendar Connected' : 'Click to connect Google Calendar'}
                className={`hidden lg:flex items-center space-x-1.5 px-2.5 py-1 text-xs rounded-full border transition-all ${
                  googleStatus
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{googleStatus ? 'Calendar Synced' : 'Sync Google Cal'}</span>
                {googleStatus ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                ) : (
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                )}
              </button>

              {/* Quick Role Switcher Dropdown for Evaluator */}
              <div className="relative">
                <button
                  onClick={() => setShowRoleMenu(!showRoleMenu)}
                  className="flex items-center space-x-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 px-2.5 py-1.5 rounded-lg border border-brand-200 text-xs font-semibold transition"
                >
                  <span className="w-2 h-2 rounded-full bg-brand-500"></span>
                  <span>Role: {user.role}</span>
                  <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                </button>

                {showRoleMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1">
                    <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Switch Demo Persona
                    </div>
                    <button
                      onClick={() => handleQuickSwitch('PATIENT')}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 ${
                        user.role === 'PATIENT' ? 'font-bold text-brand-600' : 'text-slate-700'
                      }`}
                    >
                      <span>👤 Demo Patient</span>
                      {user.role === 'PATIENT' && <CheckCircle2 className="w-3.5 h-3.5 text-brand-600" />}
                    </button>
                    <button
                      onClick={() => handleQuickSwitch('DOCTOR')}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 ${
                        user.role === 'DOCTOR' ? 'font-bold text-brand-600' : 'text-slate-700'
                      }`}
                    >
                      <span>🩺 Demo Doctor</span>
                      {user.role === 'DOCTOR' && <CheckCircle2 className="w-3.5 h-3.5 text-brand-600" />}
                    </button>
                    <button
                      onClick={() => handleQuickSwitch('ADMIN')}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 ${
                        user.role === 'ADMIN' ? 'font-bold text-brand-600' : 'text-slate-700'
                      }`}
                    >
                      <span>🛡️ Demo Admin</span>
                      {user.role === 'ADMIN' && <CheckCircle2 className="w-3.5 h-3.5 text-brand-600" />}
                    </button>
                  </div>
                )}
              </div>

              {/* User Info & Logout */}
              <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs uppercase">
                  {user.name.charAt(0)}
                </div>
                <div className="hidden xl:block text-left">
                  <div className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">{user.name}</div>
                  <div className="text-[10px] text-slate-500">{user.email}</div>
                </div>
                <button
                  onClick={logout}
                  title="Log out"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => onSelectTab('login')}
              className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm transition"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
