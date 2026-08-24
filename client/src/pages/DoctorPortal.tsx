import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Appointment, DoctorProfile, UrgencyLevel } from '../types';
import { PreVisitSummaryCard } from '../components/PreVisitSummaryCard';
import { PostVisitSummaryModal } from '../components/PostVisitSummaryModal';
import {
  Calendar,
  Clock,
  User,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Pill,
  Plus,
  Trash2,
  RefreshCw,
  Send,
  X,
  Plane,
} from 'lucide-react';

export const DoctorPortal: React.FC<{ activeTab?: string }> = ({ activeTab = 'agenda' }) => {
  const { user } = useAuth();

  // State: Agenda
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [loadingAgenda, setLoadingAgenda] = useState<boolean>(true);

  // State: Consultation Form Modal
  const [consultAppt, setConsultAppt] = useState<Appointment | null>(null);
  const [clinicalNotes, setClinicalNotes] = useState<string>('');
  const [prescriptions, setPrescriptions] = useState<
    Array<{
      medicationName: string;
      dosage: string;
      frequency: string;
      durationDays: number;
      instructions: string;
    }>
  >([]);
  const [consultSubmitting, setConsultSubmitting] = useState<boolean>(false);
  const [viewCareSummaryAppt, setViewCareSummaryAppt] = useState<Appointment | null>(null);

  // State: Leaves
  const [leaves, setLeaves] = useState<Array<{ id: string; leaveDate: string; reason?: string }>>([]);
  const [leaveDate, setLeaveDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [leaveReason, setLeaveReason] = useState<string>('');
  const [leavePreview, setLeavePreview] = useState<{
    conflictCount: number;
    affectedAppointments: Appointment[];
  } | null>(null);
  const [loadingLeavePreview, setLoadingLeavePreview] = useState<boolean>(false);
  const [leaveSubmitting, setLeaveSubmitting] = useState<boolean>(false);

  const fetchAgenda = async () => {
    setLoadingAgenda(true);
    try {
      const data = await api.doctorPortal.getAgenda(selectedDate);
      setAppointments(data.appointments);
      setDoctorProfile(data.doctor);
    } catch (err) {
      console.error('Failed to load agenda:', err);
    } finally {
      setLoadingAgenda(false);
    }
  };

  const fetchLeaves = async () => {
    try {
      const data = await api.doctorPortal.getLeaves();
      setLeaves(data);
    } catch (err) {
      console.error('Failed to load leaves:', err);
    }
  };

  useEffect(() => {
    fetchAgenda();
    fetchLeaves();
  }, [selectedDate]);

  // Handle Consultation Modal Opening
  const handleOpenConsultation = (appt: Appointment) => {
    setConsultAppt(appt);
    setClinicalNotes(appt.postVisitNotes || '');
    if (appt.prescriptions && appt.prescriptions.length > 0) {
      setPrescriptions(
        appt.prescriptions.map((p) => ({
          medicationName: p.medicationName,
          dosage: p.dosage,
          frequency: p.frequency,
          durationDays: p.durationDays,
          instructions: p.instructions || '',
        }))
      );
    } else {
      setPrescriptions([
        {
          medicationName: 'Amoxicillin',
          dosage: '500mg',
          frequency: 'THRICE_DAILY',
          durationDays: 7,
          instructions: 'Take with full glass of water after food.',
        },
      ]);
    }
  };

  const handleAddPrescriptionRow = () => {
    setPrescriptions([
      ...prescriptions,
      {
        medicationName: '',
        dosage: '',
        frequency: 'ONCE_DAILY',
        durationDays: 7,
        instructions: 'Take as directed.',
      },
    ]);
  };

  const handleRemovePrescriptionRow = (index: number) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== index));
  };

  const handlePrescriptionChange = (index: number, field: string, value: any) => {
    const updated = [...prescriptions];
    (updated[index] as any)[field] = value;
    setPrescriptions(updated);
  };

  const handleSubmitConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultAppt || !clinicalNotes.trim()) return;

    setConsultSubmitting(true);
    try {
      const updated = await api.doctorPortal.submitConsultation(consultAppt.id, {
        clinicalNotes: clinicalNotes.trim(),
        prescriptions: prescriptions.filter((p) => p.medicationName.trim().length > 0),
      });

      setConsultAppt(null);
      fetchAgenda();
      alert('Consultation completed! AI converted patient-friendly summary and medication schedule have been saved.');
    } catch (err: any) {
      alert(err.message || 'Failed to submit consultation');
    } finally {
      setConsultSubmitting(false);
    }
  };

  // Leave Management Handlers
  const handlePreviewLeave = async () => {
    if (!leaveDate) return;
    setLoadingLeavePreview(true);
    try {
      const preview = await api.doctorPortal.previewLeave(leaveDate);
      setLeavePreview(preview);
    } catch (err: any) {
      alert(err.message || 'Failed to preview leave conflicts');
    } finally {
      setLoadingLeavePreview(false);
    }
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveDate) return;

    if (
      leavePreview &&
      leavePreview.conflictCount > 0 &&
      !confirm(
        `Applying leave for ${leaveDate} will automatically cancel ${leavePreview.conflictCount} confirmed patient booking(s) and dispatch priority reschedule alerts. Proceed?`
      )
    ) {
      return;
    }

    setLeaveSubmitting(true);
    try {
      const res = await api.doctorPortal.applyLeave({
        leaveDate,
        reason: leaveReason || 'Scheduled Physician Leave',
      });

      alert(`Leave applied for ${leaveDate}. ${res.affectedCount} affected patient(s) notified.`);
      setLeavePreview(null);
      setLeaveReason('');
      fetchLeaves();
      fetchAgenda();
    } catch (err: any) {
      alert(err.message || 'Failed to apply leave');
    } finally {
      setLeaveSubmitting(false);
    }
  };

  const handleDeleteLeave = async (date: string) => {
    if (!confirm(`Cancel leave for ${date}?`)) return;
    try {
      await api.doctorPortal.deleteLeave(date);
      fetchLeaves();
      fetchAgenda();
    } catch (err: any) {
      alert(err.message || 'Failed to delete leave');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-brand-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-brand-300" />
            <span>Doctor Clinical Portal • AI Assistant Active</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Dr. {user?.name}
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-xl">
            {doctorProfile?.specialization || 'Clinical Specialist'} • Review pre-visit AI symptom briefings, conduct consultations, and auto-generate patient care summaries.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex items-center space-x-5">
          <div className="text-center">
            <div className="text-2xl font-bold">{appointments.length}</div>
            <div className="text-[10px] text-slate-300 uppercase tracking-wider font-semibold">Today's Patients</div>
          </div>
          <div className="h-8 w-px bg-white/20"></div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {appointments.filter((a) => a.preVisitUrgency === 'High').length}
            </div>
            <div className="text-[10px] text-rose-300 uppercase tracking-wider font-semibold">High Urgency</div>
          </div>
        </div>
      </div>

      {/* Tab: PATIENT QUEUE & AGENDA */}
      {(activeTab === 'agenda' || activeTab === 'portal') && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Patient Queue & Schedule</h2>
              <p className="text-xs text-slate-500">Filter agenda by date to review upcoming patient symptom briefings</p>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                <Calendar className="w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="text-xs font-semibold text-slate-800 focus:outline-none bg-transparent"
                />
              </div>

              <button
                onClick={fetchAgenda}
                className="p-2 text-slate-500 hover:text-slate-800 rounded-xl border border-slate-200 hover:bg-white transition"
                title="Refresh Agenda"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Appointments List */}
          {loadingAgenda ? (
            <div className="text-center py-12 text-xs text-slate-400">Loading daily schedule...</div>
          ) : appointments.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center max-w-md mx-auto">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-800 text-sm">No Appointments for {selectedDate}</h3>
              <p className="text-xs text-slate-500 mt-1">Enjoy your schedule or switch dates to inspect other days.</p>
            </div>
          ) : (
            <div className="grid gap-5">
              {appointments.map((appt) => {
                const isHighUrgency = appt.preVisitUrgency === 'High';
                const isCompleted = appt.status === 'COMPLETED';

                return (
                  <div
                    key={appt.id}
                    className={`bg-white rounded-2xl border p-6 shadow-sm transition-all ${
                      isHighUrgency && !isCompleted
                        ? 'border-rose-300 ring-1 ring-rose-300/40 bg-rose-50/20'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                      <div className="flex items-center space-x-3.5">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white shadow-sm flex-shrink-0 ${
                            isCompleted ? 'bg-slate-700' : isHighUrgency ? 'bg-rose-600' : 'bg-brand-600'
                          }`}
                        >
                          {appt.patient.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-bold text-base text-slate-900">{appt.patient.name}</h3>
                            <span className="text-xs text-slate-500">{appt.patient.email}</span>
                          </div>
                          <div className="flex items-center space-x-3 text-xs text-slate-600 mt-1">
                            <span className="flex items-center space-x-1 font-semibold text-slate-900">
                              <Clock className="w-3.5 h-3.5 text-brand-600" />
                              <span>
                                {appt.startTime} - {appt.endTime}
                              </span>
                            </span>
                            <span>• {appt.patient.phone || 'No phone'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="flex items-center space-x-3">
                        {isCompleted ? (
                          <div className="flex items-center space-x-2">
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                              Completed
                            </span>
                            <button
                              onClick={() => setViewCareSummaryAppt(appt)}
                              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition"
                            >
                              View Notes & AI Summary
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenConsultation(appt)}
                            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-md shadow-brand-500/20 transition flex items-center space-x-2"
                          >
                            <FileText className="w-4 h-4" />
                            <span>Start Consultation & Notes</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Pre-Visit AI Clinical Briefing */}
                    <div className="mt-4">
                      <PreVisitSummaryCard
                        urgency={appt.preVisitUrgency}
                        chiefComplaint={appt.preVisitSummary}
                        suggestedQuestionsJson={appt.preVisitQuestions}
                        symptoms={appt.symptoms}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: LEAVE MANAGEMENT & CONFLICT RESOLUTION */}
      {activeTab === 'leaves' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Doctor Leave Management</h2>
            <p className="text-xs text-slate-500">
              Schedule planned leaves with automatic patient conflict detection and automated rescheduling alerts
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Apply Leave Form */}
            <div className="lg:col-span-1 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-brand-700">
                <Plane className="w-4 h-4 text-brand-600" />
                <span>Mark Planned Leave</span>
              </div>

              <form onSubmit={handleApplyLeave} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Leave Date</label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={leaveDate}
                    onChange={(e) => {
                      setLeaveDate(e.target.value);
                      setLeavePreview(null);
                    }}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Reason (Optional)</label>
                  <input
                    type="text"
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    placeholder="e.g. Attending Medical Conference / Personal Leave"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handlePreviewLeave}
                    disabled={loadingLeavePreview}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
                  >
                    {loadingLeavePreview ? 'Checking Conflicts...' : 'Check Affected Patients'}
                  </button>

                  <button
                    type="submit"
                    disabled={leaveSubmitting}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-600/20 transition disabled:opacity-50"
                  >
                    {leaveSubmitting ? 'Applying & Notifying...' : 'Confirm Leave & Notify Patients'}
                  </button>
                </div>
              </form>

              {/* Conflict Preview Card */}
              {leavePreview && (
                <div
                  className={`p-4 rounded-2xl text-xs border animate-in fade-in ${
                    leavePreview.conflictCount > 0
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <div className="font-bold flex items-center space-x-1.5">
                    {leavePreview.conflictCount > 0 ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                    <span>
                      {leavePreview.conflictCount > 0
                        ? `${leavePreview.conflictCount} Existing Bookings Affected!`
                        : 'No Existing Bookings Conflict!'}
                    </span>
                  </div>
                  {leavePreview.conflictCount > 0 && (
                    <p className="mt-1 text-[11px] text-amber-800">
                      When confirmed, all {leavePreview.conflictCount} patients will receive urgent schedule change emails with 1-click priority reschedule links.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Right: Active Leaves List */}
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm">Scheduled Leaves & Unavailable Dates</h3>

              {leaves.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400">
                  No upcoming leaves scheduled. You are currently available on all regular working days.
                </div>
              ) : (
                <div className="grid gap-3">
                  {leaves.map((l) => (
                    <div
                      key={l.id}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-xs">
                          <Plane className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-900">📅 {l.leaveDate}</div>
                          <div className="text-xs text-slate-500">{l.reason || 'Physician Leave'}</div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteLeave(l.leaveDate)}
                        className="text-rose-600 hover:text-rose-800 p-2 hover:bg-rose-50 rounded-xl transition text-xs font-semibold flex items-center space-x-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Remove</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Consultation Modal */}
      {consultAppt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-6 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
                  Clinical Consultation Notes & Prescription
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  Patient: {consultAppt.patient.name} ({consultAppt.appointmentDate} at {consultAppt.startTime})
                </h3>
              </div>
              <button
                onClick={() => setConsultAppt(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* AI Pre-Visit Brief Reminder */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
              <span className="font-bold text-slate-700">Patient Symptoms Reported: </span>
              <span className="text-slate-600">{consultAppt.symptoms}</span>
            </div>

            <form onSubmit={handleSubmitConsultation} className="space-y-5">
              {/* Doctor Clinical Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Clinical Notes / Diagnosis / Care Plan:
                </label>
                <textarea
                  rows={4}
                  required
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="e.g. Patient presents with acute bronchitis. Bilateral wheezing on auscultation. Prescribe Amoxicillin 500mg TID and Salbutamol inhaler PRN. Patient advised to rest and stay hydrated..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 font-mono"
                />
                <p className="text-[11px] text-brand-600 mt-1 flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Gemini LLM will automatically convert these notes into plain-English patient instructions!</span>
                </p>
              </div>

              {/* Structured Prescriptions Builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                    <Pill className="w-4 h-4 text-emerald-600" />
                    <span>Prescriptions (Triggers Automated Medication Reminders)</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddPrescriptionRow}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Drug</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {prescriptions.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center"
                    >
                      <div className="sm:col-span-4">
                        <input
                          type="text"
                          placeholder="Medication Name"
                          value={p.medicationName}
                          onChange={(e) => handlePrescriptionChange(idx, 'medicationName', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          placeholder="Dosage (e.g. 500mg)"
                          value={p.dosage}
                          onChange={(e) => handlePrescriptionChange(idx, 'dosage', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <select
                          value={p.frequency}
                          onChange={(e) => handlePrescriptionChange(idx, 'frequency', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                        >
                          <option value="ONCE_DAILY">Once Daily</option>
                          <option value="TWICE_DAILY">Twice Daily</option>
                          <option value="THRICE_DAILY">Thrice Daily</option>
                          <option value="AS_NEEDED">As Needed (PRN)</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          placeholder="Days"
                          value={p.durationDays}
                          onChange={(e) => handlePrescriptionChange(idx, 'durationDays', parseInt(e.target.value || '1', 10))}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                        />
                      </div>
                      <div className="sm:col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemovePrescriptionRow(idx)}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConsultAppt(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={consultSubmitting}
                  className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-md shadow-brand-500/20 transition disabled:opacity-50 flex items-center space-x-2"
                >
                  {consultSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating AI Patient Care Summary...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Save & Generate AI Patient Summary</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Post-Visit View Care Summary Modal */}
      {viewCareSummaryAppt && (
        <PostVisitSummaryModal
          appointment={viewCareSummaryAppt}
          onClose={() => setViewCareSummaryAppt(null)}
        />
      )}
    </div>
  );
};
