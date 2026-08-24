import React, { useState, useEffect } from 'react';
import { Appointment, Prescription } from '../types';
import { Pill, Clock, Calendar, CheckCircle, Bell, AlertCircle } from 'lucide-react';

interface MedicationTrackerProps {
  appointments: Appointment[];
}

export const MedicationTracker: React.FC<MedicationTrackerProps> = ({ appointments }) => {
  const allPrescriptions: Array<Prescription & { doctorName: string; appointmentDate: string }> = [];

  appointments.forEach((appt) => {
    if (appt.prescriptions && appt.prescriptions.length > 0) {
      appt.prescriptions.forEach((p) => {
        allPrescriptions.push({
          ...p,
          doctorName: appt.doctor.user.name,
          appointmentDate: appt.appointmentDate,
        });
      });
    }
  });

  const [notificationStatus, setNotificationStatus] = useState<string | null>(null);

  const simulateDoseTaken = (medName: string) => {
    setNotificationStatus(`Marked dose of ${medName} as taken! Next dose scheduled per frequency.`);
    setTimeout(() => setNotificationStatus(null), 4000);
  };

  if (allPrescriptions.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center max-w-lg mx-auto">
        <div className="w-14 h-14 bg-sky-50 text-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Pill className="w-7 h-7" />
        </div>
        <h3 className="font-bold text-slate-900 text-base">No Active Prescriptions</h3>
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
          When your doctor completes a consultation and prescribes medications, your daily dose schedules and automatic reminders will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notificationStatus && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold p-3.5 rounded-2xl flex items-center space-x-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{notificationStatus}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {allPrescriptions.map((pres) => (
          <div
            key={pres.id}
            className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Pill className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{pres.medicationName}</h4>
                    <span className="inline-block text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md mt-0.5">
                      {pres.dosage}
                    </span>
                  </div>
                </div>

                <span className="text-[11px] font-semibold text-brand-700 bg-brand-50 border border-brand-100 px-2.5 py-1 rounded-lg">
                  {pres.frequency.replace('_', ' ')}
                </span>
              </div>

              {pres.instructions && (
                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-3.5">
                  <span className="font-semibold text-slate-700">Instructions: </span>
                  {pres.instructions}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-slate-500 pt-3 border-t border-slate-100">
                <div className="flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Start: {pres.startDate}</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Duration: {pres.durationDays} Days</span>
                </div>
                <div className="col-span-2 text-[11px] text-slate-400">
                  Prescribed by Dr. {pres.doctorName}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-emerald-600 font-semibold flex items-center space-x-1">
                <Bell className="w-3.5 h-3.5" />
                <span>Automated Email Reminders Active</span>
              </span>
              <button
                onClick={() => simulateDoseTaken(pres.medicationName)}
                className="bg-brand-50 hover:bg-brand-100 text-brand-700 font-semibold text-xs px-3 py-1.5 rounded-xl border border-brand-200 transition"
              >
                Log Dose Taken
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
