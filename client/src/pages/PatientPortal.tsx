import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  DoctorProfile,
  AvailableSlot,
  Appointment,
  SlotAvailabilityResponse,
} from '../types';
import { DoctorCard } from '../components/DoctorCard';
import { PreVisitSummaryCard } from '../components/PreVisitSummaryCard';
import { PostVisitSummaryModal } from '../components/PostVisitSummaryModal';
import { SlotHoldTimer } from '../components/SlotHoldTimer';
import { MedicationTracker } from '../components/MedicationTracker';
import confetti from 'canvas-confetti';
import {
  Search,
  Calendar,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileText,
  RefreshCw,
  X,
  Stethoscope,
  ChevronRight,
  Filter,
} from 'lucide-react';

export const PatientPortal: React.FC<{ activeTab?: string }> = ({ activeTab = 'book' }) => {
  const { user } = useAuth();

  // State: Doctors & Search
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loadingDoctors, setLoadingDoctors] = useState<boolean>(true);

  // State: Booking Flow
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorProfile | null>(null);
  const [bookingDate, setBookingDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [slotsData, setSlotsData] = useState<SlotAvailabilityResponse | null>(null);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);

  // State: Slot Hold & Symptoms Form
  const [activeHold, setActiveHold] = useState<{
    holdToken: string;
    expiresAt: string;
    doctorId: string;
    doctorName: string;
    date: string;
    slot: AvailableSlot;
  } | null>(() => {
    const saved = localStorage.getItem('caresync_active_hold');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (new Date(parsed.expiresAt).getTime() > Date.now()) {
          return parsed;
        }
      } catch (e) {}
    }
    return null;
  });

  const [symptoms, setSymptoms] = useState<string>('');
  const [bookingSubmitting, setBookingSubmitting] = useState<boolean>(false);
  const [bookingSuccess, setBookingSuccess] = useState<Appointment | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // State: Appointments
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState<boolean>(false);
  const [viewSummaryAppt, setViewSummaryAppt] = useState<Appointment | null>(null);

  // State: Rescheduling Modal
  const [rescheduleAppt, setRescheduleAppt] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleSlots, setRescheduleSlots] = useState<AvailableSlot[]>([]);
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState<AvailableSlot | null>(null);
  const [rescheduleLoading, setRescheduleLoading] = useState<boolean>(false);

  // Load initial doctors
  const fetchDoctors = async () => {
    setLoadingDoctors(true);
    try {
      const data = await api.doctors.list();
      setDoctors(data);

      const specs = Array.from(new Set(data.map((d) => d.specialization)));
      setSpecializations(specs);
    } catch (err) {
      console.error('Failed to load doctors:', err);
    } finally {
      setLoadingDoctors(false);
    }
  };

  // Load patient appointments
  const fetchAppointments = async () => {
    setLoadingAppointments(true);
    try {
      const data = await api.appointments.getMy();
      setAppointments(data);
    } catch (err) {
      console.error('Failed to load appointments:', err);
    } finally {
      setLoadingAppointments(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
    fetchAppointments();
  }, []);

  // Fetch slots whenever selected doctor or date changes
  const fetchSlots = async (docId: string, date: string) => {
    setLoadingSlots(true);
    try {
      const data = await api.doctors.getSlots(docId, date);
      setSlotsData(data);
    } catch (err) {
      console.error('Failed to load slots:', err);
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    if (selectedDoctor && bookingDate) {
      fetchSlots(selectedDoctor.id, bookingDate);
      setSelectedSlot(null);
    }
  }, [selectedDoctor, bookingDate]);

  // Handle Slot Selection and 5-min Hold Acquisition
  const handleSlotSelect = async (slot: AvailableSlot) => {
    if (!slot.isAvailable || !selectedDoctor) return;

    setSelectedSlot(slot);
    setBookingError(null);

    try {
      const holdRes = await api.doctors.holdSlot(selectedDoctor.id, {
        slotDate: bookingDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
      });

      const holdObj = {
        holdToken: holdRes.holdToken,
        expiresAt: holdRes.expiresAt,
        doctorId: selectedDoctor.id,
        doctorName: `Dr. ${selectedDoctor.user.name}`,
        date: bookingDate,
        slot,
      };

      setActiveHold(holdObj);
      localStorage.setItem('caresync_active_hold', JSON.stringify(holdObj));
    } catch (err: any) {
      setBookingError(err.message || 'Could not acquire slot hold. Please pick another slot.');
      fetchSlots(selectedDoctor.id, bookingDate);
    }
  };

  const handleHoldExpire = () => {
    setActiveHold(null);
    localStorage.removeItem('caresync_active_hold');
    if (selectedDoctor) {
      fetchSlots(selectedDoctor.id, bookingDate);
    }
  };

  const handleHoldCancel = () => {
    setActiveHold(null);
    localStorage.removeItem('caresync_active_hold');
    setSelectedSlot(null);
    if (selectedDoctor) {
      fetchSlots(selectedDoctor.id, bookingDate);
    }
  };

  // Submit Final Booking
  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctor || !selectedSlot || !symptoms.trim()) {
      setBookingError('Please enter your symptoms to complete the clinical triage.');
      return;
    }

    setBookingSubmitting(true);
    setBookingError(null);

    try {
      const newAppt = await api.appointments.create({
        doctorId: selectedDoctor.id,
        appointmentDate: bookingDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        symptoms: symptoms.trim(),
        holdToken: activeHold?.holdToken,
      });

      // Confetti celebration!
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
      });

      setBookingSuccess(newAppt);
      setActiveHold(null);
      localStorage.removeItem('caresync_active_hold');
      setSelectedSlot(null);
      setSymptoms('');
      fetchAppointments();
    } catch (err: any) {
      setBookingError(err.message || 'Failed to confirm booking.');
    } finally {
      setBookingSubmitting(false);
    }
  };

  // Cancel Appointment
  const handleCancelAppointment = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      await api.appointments.cancel(id);
      fetchAppointments();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel appointment');
    }
  };

  // Open Reschedule Flow
  const handleOpenReschedule = async (appt: Appointment) => {
    setRescheduleAppt(appt);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextDate = tomorrow.toISOString().split('T')[0];
    setRescheduleDate(nextDate);
    setSelectedRescheduleSlot(null);

    try {
      const res = await api.doctors.getSlots(appt.doctorId, nextDate);
      setRescheduleSlots(res.slots.filter((s) => s.isAvailable));
    } catch (e) {}
  };

  const handleRescheduleDateChange = async (date: string) => {
    setRescheduleDate(date);
    setSelectedRescheduleSlot(null);
    if (rescheduleAppt) {
      try {
        const res = await api.doctors.getSlots(rescheduleAppt.doctorId, date);
        setRescheduleSlots(res.slots.filter((s) => s.isAvailable));
      } catch (e) {}
    }
  };

  const handleConfirmReschedule = async () => {
    if (!rescheduleAppt || !selectedRescheduleSlot) return;
    setRescheduleLoading(true);
    try {
      await api.appointments.reschedule(rescheduleAppt.id, {
        newDate: rescheduleDate,
        newStartTime: selectedRescheduleSlot.startTime,
        newEndTime: selectedRescheduleSlot.endTime,
      });

      setRescheduleAppt(null);
      fetchAppointments();
      alert('Appointment rescheduled successfully! Calendar and notifications updated.');
    } catch (err: any) {
      alert(err.message || 'Failed to reschedule');
    } finally {
      setRescheduleLoading(false);
    }
  };

  // Filtered doctors list
  const filteredDoctors = doctors.filter((doc) => {
    const matchesSpec = selectedSpecialization === 'ALL' || doc.specialization === selectedSpecialization;
    const matchesQuery =
      searchQuery === '' ||
      doc.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.specialization.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.bio && doc.bio.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSpec && matchesQuery;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Active Hold Floating Widget */}
      {activeHold && (
        <SlotHoldTimer
          expiresAt={activeHold.expiresAt}
          slotDetails={{
            doctorName: activeHold.doctorName,
            date: activeHold.date,
            time: `${activeHold.slot.startTime} - ${activeHold.slot.endTime}`,
          }}
          onExpire={handleHoldExpire}
          onCancel={handleHoldCancel}
        />
      )}

      {/* Tab View: BOOK APPOINTMENT */}
      {(activeTab === 'book' || activeTab === 'portal') && (
        <div className="space-y-8">
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-brand-700 via-brand-600 to-indigo-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-brand-500/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5 text-sky-200" />
                <span>AI Clinical Triage Assistant Active</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Welcome back, {user?.name}
              </h1>
              <p className="text-brand-100 text-xs sm:text-sm mt-1 max-w-xl">
                Find top medical specialists, reserve a slot with zero double-booking risk, share symptoms for AI pre-triage, and access your post-visit medication schedule anytime.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 flex items-center space-x-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{appointments.filter((a) => a.status === 'BOOKED').length}</div>
                <div className="text-[10px] text-brand-100 uppercase tracking-wider font-semibold">Upcoming</div>
              </div>
              <div className="h-8 w-px bg-white/20"></div>
              <div className="text-center">
                <div className="text-2xl font-bold">{appointments.filter((a) => a.status === 'COMPLETED').length}</div>
                <div className="text-[10px] text-brand-100 uppercase tracking-wider font-semibold">Completed</div>
              </div>
            </div>
          </div>

          {/* Booking Success Banner */}
          {bookingSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 shadow-sm animate-in fade-in">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-600/20">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      Appointment Confirmed & Synced!
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Your consultation with <strong>Dr. {bookingSuccess.doctor.user.name}</strong> is booked for{' '}
                      <strong>{bookingSuccess.appointmentDate}</strong> at{' '}
                      <strong>
                        {bookingSuccess.startTime} - {bookingSuccess.endTime}
                      </strong>
                      . Confirmation email and calendar invite sent!
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setBookingSuccess(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* AI Pre-Visit Briefing Preview */}
              <div className="mt-4 pt-4 border-t border-emerald-200/60">
                <PreVisitSummaryCard
                  urgency={bookingSuccess.preVisitUrgency}
                  chiefComplaint={bookingSuccess.preVisitSummary}
                  suggestedQuestionsJson={bookingSuccess.preVisitQuestions}
                  symptoms={bookingSuccess.symptoms}
                />
              </div>
            </div>
          )}

          {/* Step 1: Doctor Selection & Search */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Find a Specialist</h2>
                <p className="text-xs text-slate-500">Select a doctor to view their live available slots</p>
              </div>

              {/* Search input */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search doctor, condition, specialty..."
                  className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-white"
                />
              </div>
            </div>

            {/* Specialization Filter Pills */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-2">
              <button
                onClick={() => setSelectedSpecialization('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  selectedSpecialization === 'ALL'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                All Specialties
              </button>
              {specializations.map((spec) => (
                <button
                  key={spec}
                  onClick={() => setSelectedSpecialization(spec)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    selectedSpecialization === spec
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {spec}
                </button>
              ))}
            </div>

            {/* Doctor Cards Grid */}
            {loadingDoctors ? (
              <div className="text-center py-12 text-xs text-slate-400">Loading doctors...</div>
            ) : filteredDoctors.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
                No doctors match your filter. Try clearing the search or specialty filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredDoctors.map((doc) => (
                  <DoctorCard
                    key={doc.id}
                    doctor={doc}
                    onSelect={(d) => {
                      setSelectedDoctor(d);
                      // Scroll to slot picker
                      window.scrollTo({ top: 400, behavior: 'smooth' });
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Step 2: Slot Selection & Hold Modal/Section */}
          {selectedDoctor && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
                    Step 2: Choose Date & Slot
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                    Booking Consultation with Dr. {selectedDoctor.user.name}
                  </h3>
                  <p className="text-xs text-slate-500">{selectedDoctor.specialization}</p>
                </div>

                {/* Date Picker */}
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </div>

              {/* Slot Availability Grid */}
              {loadingSlots ? (
                <div className="text-center py-8 text-xs text-slate-400">Checking slot availability...</div>
              ) : slotsData?.isLeave ? (
                <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl text-amber-800 text-xs flex items-center space-x-3">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600" />
                  <div>
                    <span className="font-bold">Doctor on Leave: </span>
                    Dr. {selectedDoctor.user.name} is not available on {bookingDate}. Please pick another date.
                  </div>
                </div>
              ) : slotsData?.slots && slotsData.slots.length > 0 ? (
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    Available Time Slots (Click to reserve 5-min hold)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                    {slotsData.slots.map((slot, i) => {
                      const isSelected = selectedSlot?.startTime === slot.startTime;
                      return (
                        <button
                          key={i}
                          disabled={!slot.isAvailable}
                          onClick={() => handleSlotSelect(slot)}
                          className={`p-2.5 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center border ${
                            isSelected
                              ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-500/20 ring-2 ring-brand-400'
                              : slot.isAvailable
                              ? 'bg-slate-50 hover:bg-brand-50 hover:border-brand-300 text-slate-800 border-slate-200'
                              : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through'
                          }`}
                        >
                          <span>{slot.startTime}</span>
                          <span className="text-[10px] font-normal opacity-80 mt-0.5">
                            {slot.isAvailable ? (isSelected ? 'Held for you' : 'Available') : 'Booked'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 text-center py-6">No slots scheduled for this day.</div>
              )}

              {/* Step 3: Symptom Intake Form */}
              {selectedSlot && (
                <form
                  onSubmit={handleConfirmBooking}
                  className="mt-6 pt-6 border-t border-slate-100 space-y-4 bg-slate-50/70 p-6 rounded-2xl border border-slate-200"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
                        Step 3: Symptom Intake for AI Clinical Triage
                      </span>
                      <h4 className="font-bold text-sm text-slate-900 mt-0.5">
                        Selected Slot: {bookingDate} at {selectedSlot.startTime} - {selectedSlot.endTime}
                      </h4>
                    </div>

                    <div className="flex items-center space-x-1.5 text-xs text-brand-700 bg-brand-100/70 px-3 py-1 rounded-full font-semibold">
                      <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                      <span>Gemini AI Triage Enabled</span>
                    </div>
                  </div>

                  {bookingError && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium p-3 rounded-xl">
                      {bookingError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Describe your symptoms in detail (duration, severity, triggers):
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={symptoms}
                      onChange={(e) => setSymptoms(e.target.value)}
                      placeholder="e.g. Sharp pain in chest when inhaling deeply for past 2 days, accompanied by dry cough and slight dizziness..."
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-white"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Our clinical AI will analyze your symptoms to generate a pre-visit urgency assessment and diagnostic questions for your doctor.
                    </p>
                  </div>

                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedSlot(null)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl"
                    >
                      Change Slot
                    </button>
                    <button
                      type="submit"
                      disabled={bookingSubmitting}
                      className="px-6 py-2.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md shadow-brand-500/20 transition disabled:opacity-50 flex items-center space-x-2"
                    >
                      {bookingSubmitting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Analyzing & Confirming...</span>
                        </>
                      ) : (
                        <span>Confirm Appointment</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab View: MY APPOINTMENTS */}
      {activeTab === 'appointments' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">My Appointments</h2>
              <p className="text-xs text-slate-500">Track upcoming consultations, clinical summaries, and reschedule requests</p>
            </div>
            <button
              onClick={fetchAppointments}
              className="p-2 text-slate-500 hover:text-slate-800 rounded-xl border border-slate-200 hover:bg-white transition"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {loadingAppointments ? (
            <div className="text-center py-12 text-xs text-slate-400">Loading appointments...</div>
          ) : appointments.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center max-w-md mx-auto">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-800 text-sm">No Appointments Yet</h3>
              <p className="text-xs text-slate-500 mt-1">Book your first doctor consultation to get started.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {appointments.map((appt) => {
                const isLeaveConflict = appt.status === 'LEAVE_CONFLICT';
                const isCompleted = appt.status === 'COMPLETED';
                const isBooked = appt.status === 'BOOKED';
                const isCancelled = appt.status === 'CANCELLED';

                return (
                  <div
                    key={appt.id}
                    className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${
                      isLeaveConflict
                        ? 'border-rose-300 bg-rose-50/40'
                        : isCompleted
                        ? 'border-slate-200'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left: Doctor & Schedule */}
                      <div className="flex items-start space-x-3.5">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-white shadow-sm flex-shrink-0 ${
                            isLeaveConflict
                              ? 'bg-rose-600'
                              : isCompleted
                              ? 'bg-slate-700'
                              : 'bg-brand-600'
                          }`}
                        >
                          {appt.doctor.user.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-bold text-sm text-slate-900">
                              Dr. {appt.doctor.user.name}
                            </h4>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-brand-50 text-brand-700">
                              {appt.doctor.specialization}
                            </span>
                          </div>

                          <div className="flex items-center space-x-3 mt-1.5 text-xs text-slate-600">
                            <span className="flex items-center space-x-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>{appt.appointmentDate}</span>
                            </span>
                            <span className="flex items-center space-x-1 font-semibold text-slate-800">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>
                                {appt.startTime} - {appt.endTime}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Middle: Status Badge */}
                      <div className="flex items-center space-x-2">
                        {isLeaveConflict && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>DOCTOR ON LEAVE - RESCHEDULE NEEDED</span>
                          </span>
                        )}
                        {isBooked && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                            <span>CONFIRMED</span>
                          </span>
                        )}
                        {isCompleted && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>COMPLETED</span>
                          </span>
                        )}
                        {isCancelled && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
                            <span>CANCELLED</span>
                          </span>
                        )}
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center space-x-2 flex-wrap">
                        {isCompleted && appt.postVisitSummary && (
                          <button
                            onClick={() => setViewSummaryAppt(appt)}
                            className="px-3.5 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold rounded-xl border border-brand-200 flex items-center space-x-1.5 transition shadow-2xs"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>View Care Summary</span>
                          </button>
                        )}

                        {(isBooked || isLeaveConflict) && (
                          <>
                            <button
                              onClick={() => handleOpenReschedule(appt)}
                              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition"
                            >
                              Reschedule
                            </button>
                            <button
                              onClick={() => handleCancelAppointment(appt.id)}
                              className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 text-xs font-semibold rounded-xl border border-rose-200 transition"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Pre-Visit Triage Briefing Details Accordion */}
                    <div className="mt-4 pt-3 border-t border-slate-100">
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

      {/* Tab View: MEDICATIONS & DOSES */}
      {activeTab === 'medications' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Medication & Prescription Schedule</h2>
            <p className="text-xs text-slate-500">
              Active prescriptions prescribed by your physicians with automated reminder tracking
            </p>
          </div>
          <MedicationTracker appointments={appointments} />
        </div>
      )}

      {/* Post-Visit Summary Modal */}
      {viewSummaryAppt && (
        <PostVisitSummaryModal
          appointment={viewSummaryAppt}
          onClose={() => setViewSummaryAppt(null)}
        />
      )}

      {/* Reschedule Modal */}
      {rescheduleAppt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Reschedule Appointment</h3>
                <p className="text-xs text-slate-500">
                  Dr. {rescheduleAppt.doctor.user.name} ({rescheduleAppt.doctor.specialization})
                </p>
              </div>
              <button
                onClick={() => setRescheduleAppt(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select New Date</label>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={rescheduleDate}
                onChange={(e) => handleRescheduleDateChange(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Available Slots</label>
              {rescheduleSlots.length === 0 ? (
                <div className="text-xs text-slate-400 bg-slate-50 p-4 rounded-xl text-center">
                  No available slots on this date. Please pick another date.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                  {rescheduleSlots.map((slot, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedRescheduleSlot(slot)}
                      className={`p-2 rounded-xl text-xs font-semibold border transition ${
                        selectedRescheduleSlot?.startTime === slot.startTime
                          ? 'bg-brand-600 text-white border-brand-600 shadow'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                      }`}
                    >
                      {slot.startTime}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setRescheduleAppt(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                disabled={!selectedRescheduleSlot || rescheduleLoading}
                onClick={handleConfirmReschedule}
                className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow transition disabled:opacity-50"
              >
                {rescheduleLoading ? 'Updating...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
