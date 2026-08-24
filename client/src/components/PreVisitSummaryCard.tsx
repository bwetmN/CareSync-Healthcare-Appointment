import React from 'react';
import { UrgencyLevel } from '../types';
import { Sparkles, AlertCircle, HelpCircle, CheckCircle2 } from 'lucide-react';

interface PreVisitSummaryCardProps {
  urgency?: UrgencyLevel | string;
  chiefComplaint?: string;
  suggestedQuestionsJson?: string;
  symptoms: string;
}

export const PreVisitSummaryCard: React.FC<PreVisitSummaryCardProps> = ({
  urgency = 'Low',
  chiefComplaint,
  suggestedQuestionsJson,
  symptoms,
}) => {
  let questions: string[] = [];
  try {
    if (suggestedQuestionsJson) {
      questions = JSON.parse(suggestedQuestionsJson);
    }
  } catch (e) {
    questions = [];
  }

  const getUrgencyBadge = (lvl: string) => {
    switch (lvl) {
      case 'High':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-600"></span>
            <span>HIGH URGENCY</span>
          </span>
        );
      case 'Medium':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-600"></span>
            <span>MEDIUM URGENCY</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
            <span>ROUTINE / LOW URGENCY</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 to-sky-50/40 rounded-2xl border border-sky-100 p-4 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-sky-100/80">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            AI Clinical Pre-Visit Brief
          </span>
        </div>
        <div>{getUrgencyBadge(urgency)}</div>
      </div>

      {/* Chief Complaint */}
      <div className="mt-3">
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          Chief Complaint
        </div>
        <p className="text-sm font-semibold text-slate-900 mt-0.5">
          {chiefComplaint || symptoms}
        </p>
      </div>

      {/* Raw Symptoms Reported */}
      <div className="mt-2.5 bg-white/80 p-2.5 rounded-xl border border-slate-200/60 text-xs text-slate-600">
        <span className="font-semibold text-slate-700">Patient Symptoms: </span>
        {symptoms}
      </div>

      {/* Suggested Doctor Questions */}
      {questions.length > 0 && (
        <div className="mt-3.5">
          <div className="text-[11px] font-bold text-brand-700 uppercase tracking-wider flex items-center space-x-1">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>AI Suggested Diagnostic Questions for Doctor</span>
          </div>
          <ul className="mt-1.5 space-y-1.5">
            {questions.map((q, idx) => (
              <li
                key={idx}
                className="text-xs text-slate-700 bg-white/90 p-2 rounded-lg border border-slate-200/60 flex items-start space-x-2 shadow-2xs"
              >
                <span className="w-4 h-4 rounded-full bg-brand-50 text-brand-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
