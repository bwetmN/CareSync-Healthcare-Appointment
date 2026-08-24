import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Activity, User, Stethoscope, Shield, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { UserRole } from '../types';

export const LoginPage: React.FC = () => {
  const { login, register, demoLogin, loading } = useAuth();
  const [isRegister, setIsRegister] = useState<boolean>(false);

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [role, setRole] = useState<UserRole>('PATIENT');
  const [phone, setPhone] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (isRegister) {
        await register({ email, password, name, role, phone });
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    }
  };

  const handleDemo = async (demoRole: 'PATIENT' | 'DOCTOR' | 'ADMIN') => {
    setError(null);
    try {
      await demoLogin(demoRole);
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left: Platform Pitch & 1-Click Demo Logins */}
        <div className="space-y-6">
          <div className="inline-flex items-center space-x-2 bg-brand-50 border border-brand-100 px-3 py-1.5 rounded-full text-xs font-bold text-brand-700">
            <Sparkles className="w-4 h-4 text-brand-600" />
            <span>AI-Powered Healthcare Appointment & Follow-up Platform</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Intelligent Triage, Seamless Booking & Post-Care Management
          </h1>

          <p className="text-sm text-slate-600 leading-relaxed">
            Experience next-generation clinical workflows with pre-visit symptom analysis, concurrency-safe booking, doctor leave conflict protection, automated medication schedules, and Google Calendar sync.
          </p>

          {/* Instant 1-Click Demo Accounts for Evaluators */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              ⚡ Instant 1-Click Evaluation Personas
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleDemo('PATIENT')}
                disabled={loading}
                className="p-3 bg-sky-50 hover:bg-sky-100 border border-sky-100 rounded-2xl text-left transition group flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-brand-600 text-white flex items-center justify-center mb-2 shadow-sm">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="font-bold text-xs text-slate-900">Demo Patient</div>
                  <div className="text-[10px] text-slate-500">Sarah Jenkins</div>
                </div>
                <span className="text-[10px] font-semibold text-brand-700 mt-2 flex items-center">
                  Login & Book <ArrowRight className="w-2.5 h-2.5 ml-1" />
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleDemo('DOCTOR')}
                disabled={loading}
                className="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-2xl text-left transition group flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-2 shadow-sm">
                    <Stethoscope className="w-4 h-4" />
                  </div>
                  <div className="font-bold text-xs text-slate-900">Demo Doctor</div>
                  <div className="text-[10px] text-slate-500">Dr. Gregory House</div>
                </div>
                <span className="text-[10px] font-semibold text-emerald-700 mt-2 flex items-center">
                  Doctor Agenda <ArrowRight className="w-2.5 h-2.5 ml-1" />
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleDemo('ADMIN')}
                disabled={loading}
                className="p-3 bg-purple-50 hover:bg-purple-100 border border-purple-100 rounded-2xl text-left transition group flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center mb-2 shadow-sm">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="font-bold text-xs text-slate-900">Demo Admin</div>
                  <div className="text-[10px] text-slate-500">Clinic Manager</div>
                </div>
                <span className="text-[10px] font-semibold text-purple-700 mt-2 flex items-center">
                  Admin Portal <ArrowRight className="w-2.5 h-2.5 ml-1" />
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Traditional Auth Form */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">
              {isRegister ? 'Create CareSync Account' : 'Sign In to Portal'}
            </h2>
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
              }}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700"
            >
              {isRegister ? 'Already have an account?' : 'Register as new user'}
            </button>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium p-3.5 rounded-xl mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Account Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  >
                    <option value="PATIENT">Patient (Book Appointments & View Summaries)</option>
                    <option value="DOCTOR">Doctor (Manage Agenda & Clinical Consultations)</option>
                    <option value="ADMIN">Administrator (Manage Doctors & System)</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs py-3 px-4 rounded-xl shadow-md shadow-brand-500/20 transition disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
