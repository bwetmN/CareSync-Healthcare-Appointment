import React from 'react';
import { PostVisitParsedSummary, Appointment } from '../types';
import { X, Sparkles, Pill, CheckCircle2, AlertTriangle, FileText, Calendar } from 'lucide-react';

interface PostVisitSummaryModalProps {
  appointment: Appointment;
  onClose: () => void;
}

export const PostVisitSummaryModal: React.FC<PostVisitSummaryModalProps> = ({
  appointment,
  onClose,
}) => {
  let parsedSummary: PostVisitParsedSummary | null = null;
  try {
    if (appointment.postVisitSummary) {
      parsedSummary = JSON.parse(appointment.postVisitSummary);
    }
  } catch (e) {
    parsedSummary = null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-600 to-indigo-600 p-6 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Post-Visit Summary & Care Plan</h2>
              <p className="text-xs text-brand-100">
                Dr. {appointment.doctor.user.name} ({appointment.doctor.specialization}) • {appointment.appointmentDate}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Patient-Friendly Summary */}
          {parsedSummary?.patientSummary && (
            <div className="bg-brand-50/70 border border-brand-100 p-4 rounded-2xl">
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-brand-800 mb-2">
                <Sparkles className="w-4 h-4 text-brand-600" />
                <span>Patient-Friendly Diagnosis & Overview</span>
              </div>
              <p className="text-sm text-slate-800 leading-relaxed font-medium">
                {parsedSummary.patientSummary}
              </p>
            </div>
          )}

          {/* Medication Schedule */}
          {parsedSummary?.medicationSchedule && parsedSummary.medicationSchedule.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                <Pill className="w-4 h-4 text-emerald-600" />
                <span>Prescription & Medication Schedule</span>
              </div>
              <div className="grid gap-3">
                {parsedSummary.medicationSchedule.map((med, i) => (
                  <div
                    key={i}
                    className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-slate-900">{med.medication}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          {med.dosage}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{med.instructions}</p>
                    </div>
                    <div className="text-right sm:border-l sm:border-slate-200 sm:pl-4 flex-shrink-0">
                      <div className="text-xs font-semibold text-brand-700">{med.frequency}</div>
                      <div className="text-[11px] text-slate-500">{med.duration}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Follow-up Steps */}
          {parsedSummary?.followUpSteps && parsedSummary.followUpSteps.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                <CheckCircle2 className="w-4 h-4 text-brand-600" />
                <span>Recommended Follow-Up Steps</span>
              </div>
              <ul className="space-y-2">
                {parsedSummary.followUpSteps.map((step, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200 flex items-start space-x-2"
                  >
                    <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="mt-0.5">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Precautions */}
          {parsedSummary?.precautions && parsedSummary.precautions.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl">
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-amber-900 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Precautions & Safety Warnings</span>
              </div>
              <ul className="space-y-1.5 text-xs text-amber-800 list-disc list-inside">
                {parsedSummary.precautions.map((p, idx) => (
                  <li key={idx}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Doctor's Raw Clinical Notes */}
          {appointment.postVisitNotes && (
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                <FileText className="w-3.5 h-3.5" />
                <span>Doctor's Clinical Notes (Original)</span>
              </div>
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono">
                {appointment.postVisitNotes}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition"
          >
            Close Summary
          </button>
        </div>
      </div>
    </div>
  );
};
