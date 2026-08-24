import React, { useState, useEffect } from 'react';
import { Timer, AlertTriangle, X } from 'lucide-react';

interface SlotHoldTimerProps {
  expiresAt: string; // ISO date
  slotDetails: {
    doctorName: string;
    date: string;
    time: string;
  };
  onExpire: () => void;
  onCancel: () => void;
}

export const SlotHoldTimer: React.FC<SlotHoldTimerProps> = ({
  expiresAt,
  slotDetails,
  onExpire,
  onCancel,
}) => {
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(0);

  useEffect(() => {
    const calculateTime = () => {
      const exp = new Date(expiresAt).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((exp - now) / 1000));
      setTimeLeftSeconds(diff);

      if (diff <= 0) {
        onExpire();
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  if (timeLeftSeconds <= 0) return null;

  const minutes = Math.floor(timeLeftSeconds / 60);
  const seconds = timeLeftSeconds % 60;
  const isUrgent = timeLeftSeconds < 60;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 p-4 rounded-2xl shadow-2xl border transition-all duration-300 animate-in slide-in-from-bottom-5 max-w-sm ${
        isUrgent
          ? 'bg-rose-50 border-rose-200 text-rose-900 ring-2 ring-rose-400'
          : 'bg-white border-brand-200 text-slate-900 shadow-brand-500/10'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-2">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              isUrgent ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-brand-100 text-brand-600'
            }`}
          >
            <Timer className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Temporary Slot Hold
            </div>
            <div className="text-sm font-semibold text-slate-900">
              {slotDetails.doctorName}
            </div>
          </div>
        </div>
        <button
          onClick={onCancel}
          title="Release Hold"
          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-600 bg-slate-50/80 p-2 rounded-xl border border-slate-100">
        <span>📅 {slotDetails.date}</span>
        <span className="font-semibold text-brand-700">⏰ {slotDetails.time}</span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-slate-500">
          Reserved for you for:
        </div>
        <div
          className={`text-base font-mono font-bold px-2.5 py-0.5 rounded-lg ${
            isUrgent ? 'bg-rose-200 text-rose-800' : 'bg-brand-50 text-brand-700'
          }`}
        >
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
      </div>

      {isUrgent && (
        <div className="mt-2 text-[11px] text-rose-600 flex items-center space-x-1">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          <span>Hold expires soon! Confirm booking to lock in slot.</span>
        </div>
      )}
    </div>
  );
};
