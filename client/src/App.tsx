import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { PatientPortal } from './pages/PatientPortal';
import { DoctorPortal } from './pages/DoctorPortal';
import { AdminPortal } from './pages/AdminPortal';
import { Activity, CheckCircle, AlertCircle } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('portal');
  const [urlMessage, setUrlMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check URL search parameters for Google Calendar redirects or messages
    const params = new URLSearchParams(window.location.search);
    if (params.get('calendar_connected') === 'true') {
      setUrlMessage('✅ Google Calendar connected and synced successfully!');
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => setUrlMessage(null), 5000);
    }
  }, []);

  // Update default tab when role changes
  useEffect(() => {
    if (user) {
      if (user.role === 'PATIENT') setCurrentTab('book');
      else if (user.role === 'DOCTOR') setCurrentTab('agenda');
      else if (user.role === 'ADMIN') setCurrentTab('analytics');
    }
  }, [user?.role]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/20 animate-bounce">
            <Activity className="w-7 h-7" />
          </div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 animate-pulse">
            Loading CareSync Platform...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar currentTab="login" onSelectTab={() => {}} />
        <LoginPage />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <div>
        <Navbar currentTab={currentTab} onSelectTab={setCurrentTab} />

        {urlMessage && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold p-3.5 rounded-2xl flex items-center space-x-2 animate-in fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{urlMessage}</span>
            </div>
          </div>
        )}

        <main>
          {user.role === 'PATIENT' && <PatientPortal activeTab={currentTab} />}
          {user.role === 'DOCTOR' && <DoctorPortal activeTab={currentTab} />}
          {user.role === 'ADMIN' && <AdminPortal activeTab={currentTab} />}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-6 mt-16 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-brand-600" />
            <span className="font-semibold text-slate-700">CareSync Healthcare Manager</span>
            <span>• Concurrency Safe & AI-Powered</span>
          </div>
          <div>Built with React, Node.js/Express, PostgreSQL, Prisma, BullMQ & Google Gemini</div>
        </div>
      </footer>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
