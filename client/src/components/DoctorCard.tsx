import React from 'react';
import { DoctorProfile } from '../types';
import { Calendar, Clock, DollarSign, Award, ChevronRight, Stethoscope } from 'lucide-react';

interface DoctorCardProps {
  doctor: DoctorProfile;
  onSelect: (doctor: DoctorProfile) => void;
}

export const DoctorCard: React.FC<DoctorCardProps> = ({ doctor, onSelect }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
      <div>
        {/* Top Info */}
        <div className="flex items-start space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white font-bold flex items-center justify-center text-lg shadow-md shadow-brand-500/20 flex-shrink-0">
            {doctor.user.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 text-base truncate group-hover:text-brand-600 transition">
              Dr. {doctor.user.name}
            </h3>
            <div className="inline-flex items-center space-x-1 text-xs font-semibold px-2 py-0.5 mt-0.5 rounded-md bg-brand-50 text-brand-700 border border-brand-100">
              <Stethoscope className="w-3 h-3" />
              <span className="truncate">{doctor.specialization}</span>
            </div>
          </div>
        </div>

        {/* Bio */}
        {doctor.bio && (
          <p className="text-xs text-slate-600 mt-3 line-clamp-2 leading-relaxed">
            {doctor.bio}
          </p>
        )}

        {/* Schedule & Fees Details */}
        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{doctor.workingStartTime} - {doctor.workingEndTime}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <DollarSign className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-800">${doctor.consultationFee.toFixed(2)}</span>
            <span className="text-[10px] text-slate-400">/ visit</span>
          </div>
          <div className="flex items-center space-x-1.5 col-span-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{doctor.slotDurationMinutes} min slots (Mon-Fri)</span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={() => onSelect(doctor)}
        className="mt-5 w-full bg-slate-900 hover:bg-brand-600 text-white font-medium text-xs py-2.5 px-4 rounded-xl flex items-center justify-center space-x-1.5 transition shadow-sm group-hover:shadow"
      >
        <span>View Available Slots</span>
        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </button>
    </div>
  );
};
