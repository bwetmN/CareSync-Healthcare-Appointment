import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ClinicAnalytics, DoctorProfile, EmailOutboxItem } from '../types';
import {
  Shield,
  Users,
  Calendar,
  Activity,
  Mail,
  RefreshCw,
  Plus,
  Edit,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  Stethoscope,
  Send,
} from 'lucide-react';

export const AdminPortal: React.FC<{ activeTab?: string }> = ({ activeTab = 'analytics' }) => {
  // State
  const [analytics, setAnalytics] = useState<ClinicAnalytics | null>(null);
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [outbox, setOutbox] = useState<EmailOutboxItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [retryingOutbox, setRetryingOutbox] = useState<boolean>(false);

  // Modal State for Doctor Creation/Editing
  const [showDocModal, setShowDocModal] = useState<boolean>(false);
  const [editingDoc, setEditingDoc] = useState<DoctorProfile | null>(null);
  const [docForm, setDocForm] = useState({
    name: '',
    email: '',
    password: '',
    specialization: 'General Medicine',
    bio: '',
    consultationFee: '60',
    slotDurationMinutes: '30',
    workingStartTime: '09:00',
    workingEndTime: '17:00',
    phone: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [analyticsData, doctorsData, outboxData] = await Promise.all([
        api.admin.getAnalytics(),
        api.doctors.list(),
        api.admin.getOutbox(),
      ]);
      setAnalytics(analyticsData);
      setDoctors(doctorsData);
      setOutbox(outboxData);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreateDoctor = () => {
    setEditingDoc(null);
    setDocForm({
      name: '',
      email: '',
      password: 'Doctor123!',
      specialization: 'General Medicine',
      bio: '',
      consultationFee: '60',
      slotDurationMinutes: '30',
      workingStartTime: '09:00',
      workingEndTime: '17:00',
      phone: '',
    });
    setShowDocModal(true);
  };

  const handleOpenEditDoctor = (doc: DoctorProfile) => {
    setEditingDoc(doc);
    setDocForm({
      name: doc.user.name,
      email: doc.user.email,
      password: '',
      specialization: doc.specialization,
      bio: doc.bio || '',
      consultationFee: String(doc.consultationFee),
      slotDurationMinutes: String(doc.slotDurationMinutes),
      workingStartTime: doc.workingStartTime,
      workingEndTime: doc.workingEndTime,
      phone: doc.user.phone || '',
    });
    setShowDocModal(true);
  };

  const handleSaveDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDoc) {
        await api.admin.updateDoctor(editingDoc.id, {
          name: docForm.name,
          specialization: docForm.specialization,
          bio: docForm.bio,
          consultationFee: docForm.consultationFee,
          slotDurationMinutes: docForm.slotDurationMinutes,
          workingStartTime: docForm.workingStartTime,
          workingEndTime: docForm.workingEndTime,
          phone: docForm.phone,
        });
      } else {
        await api.admin.createDoctor(docForm);
      }
      setShowDocModal(false);
      fetchData();
      alert(`Doctor profile ${editingDoc ? 'updated' : 'created'} successfully!`);
    } catch (err: any) {
      alert(err.message || 'Failed to save doctor profile');
    }
  };

  const handleManualRetryOutbox = async () => {
    setRetryingOutbox(true);
    try {
      const res = await api.admin.retryOutbox();
      alert(res.message || 'Outbox processed!');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Retry failed');
    } finally {
      setRetryingOutbox(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold mb-3">
            <Shield className="w-3.5 h-3.5 text-purple-300" />
            <span>Clinic Administrator Master Panel</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Clinic Governance & Monitoring</h1>
          <p className="text-purple-200 text-xs sm:text-sm mt-1 max-w-xl">
            Configure physician schedules, track appointment metrics, monitor email outbox delivery, and supervise background queue workers.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition flex items-center space-x-2 text-xs font-semibold self-start md:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* Tab: ANALYTICS & OVERVIEW */}
      {(activeTab === 'analytics' || activeTab === 'portal') && analytics && (
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-slate-900">Clinic Analytics & Performance</h2>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-brand-600 flex items-center justify-center font-bold">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-slate-900">{analytics.appointments.total}</div>
                <div className="text-xs text-slate-500 font-medium">Total Bookings</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-slate-900">{analytics.appointments.completed}</div>
                <div className="text-xs text-slate-500 font-medium">Completed Visits</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-slate-900">{analytics.appointments.leaveConflicts}</div>
                <div className="text-xs text-slate-500 font-medium">Leave Conflicts Handled</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-slate-900">
                  {analytics.clinic.doctors} / {analytics.clinic.patients}
                </div>
                <div className="text-xs text-slate-500 font-medium">Doctors / Patients</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: DOCTOR PROFILES & SCHEDULE MANAGEMENT */}
      {activeTab === 'doctors' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Physician Roster & Working Hours</h2>
              <p className="text-xs text-slate-500">Configure specializations, slot durations, and working hours</p>
            </div>
            <button
              onClick={handleOpenCreateDoctor}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-md shadow-brand-500/20 transition flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Doctor</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {doctors.map((doc) => (
              <div
                key={doc.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-base">
                        {doc.user.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">Dr. {doc.user.name}</h3>
                        <span className="text-[11px] font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                          {doc.specialization}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenEditDoctor(doc)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition"
                      title="Edit Profile"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-slate-600 pt-3 border-t border-slate-100">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {doc.workingStartTime} - {doc.workingEndTime}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                      <span>${doc.consultationFee.toFixed(2)}/visit</span>
                    </div>
                    <div className="col-span-2 text-slate-500">
                      Slot Duration: <strong>{doc.slotDurationMinutes} mins</strong> (Mon-Fri)
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                  Email: {doc.user.email}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: EMAIL OUTBOX & BACKGROUND QUEUE MONITOR */}
      {activeTab === 'outbox' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Email Outbox & Retry Queue</h2>
              <p className="text-xs text-slate-500">
                Transactional outbox monitoring, delivery attempts, and exponential backoff retry status
              </p>
            </div>

            <button
              onClick={handleManualRetryOutbox}
              disabled={retryingOutbox}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition flex items-center space-x-2 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{retryingOutbox ? 'Processing Outbox...' : 'Trigger Retry Worker Now'}</span>
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Recipient</th>
                    <th className="px-5 py-3.5">Subject & Template</th>
                    <th className="px-5 py-3.5">Attempts</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {outbox.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                        No email outbox logs found.
                      </td>
                    </tr>
                  ) : (
                    outbox.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60">
                        <td className="px-5 py-3 font-semibold text-slate-900">
                          {item.recipientName && <div>{item.recipientName}</div>}
                          <div className="text-[11px] text-slate-400 font-normal">{item.recipientEmail}</div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="font-medium text-slate-800">{item.subject}</div>
                          <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                            {item.templateName}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="font-mono font-bold">
                            {item.attempts} / {item.maxAttempts}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.status === 'SENT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.status === 'PENDING'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-[11px] text-slate-400 font-mono">
                          {new Date(item.createdAt).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Doctor Modal */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">
              {editingDoc ? `Edit Dr. ${editingDoc.user.name}` : 'Create Doctor Profile'}
            </h3>

            <form onSubmit={handleSaveDoctor} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Doctor Name</label>
                <input
                  type="text"
                  required
                  value={docForm.name}
                  onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  placeholder="e.g. Gregory House"
                />
              </div>

              {!editingDoc && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={docForm.email}
                      onChange={(e) => setDocForm({ ...docForm, email: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                      placeholder="doctor@caresync.health"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Temporary Password</label>
                    <input
                      type="password"
                      required
                      value={docForm.password}
                      onChange={(e) => setDocForm({ ...docForm, password: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Specialization</label>
                <input
                  type="text"
                  required
                  value={docForm.specialization}
                  onChange={(e) => setDocForm({ ...docForm, specialization: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  placeholder="e.g. Cardiology, Dermatology, Neurology"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Working Start Time</label>
                  <input
                    type="time"
                    required
                    value={docForm.workingStartTime}
                    onChange={(e) => setDocForm({ ...docForm, workingStartTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Working End Time</label>
                  <input
                    type="time"
                    required
                    value={docForm.workingEndTime}
                    onChange={(e) => setDocForm({ ...docForm, workingEndTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Consultation Fee ($)</label>
                  <input
                    type="number"
                    step="5"
                    required
                    value={docForm.consultationFee}
                    onChange={(e) => setDocForm({ ...docForm, consultationFee: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Slot Duration (Minutes)</label>
                  <select
                    value={docForm.slotDurationMinutes}
                    onChange={(e) => setDocForm({ ...docForm, slotDurationMinutes: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  >
                    <option value="15">15 Minutes</option>
                    <option value="30">30 Minutes</option>
                    <option value="45">45 Minutes</option>
                    <option value="60">60 Minutes</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDocModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
