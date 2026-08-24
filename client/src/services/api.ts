import {
  User,
  DoctorProfile,
  Appointment,
  SlotAvailabilityResponse,
  ClinicAnalytics,
  EmailOutboxItem,
} from '../types';

const rawBase = (((import.meta as any).env?.VITE_API_URL as string) || '').trim();
const API_BASE = rawBase
  ? (rawBase.endsWith('/api') ? rawBase : `${rawBase.replace(/\/+$/, '')}/api`)
  : '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('caresync_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers,
  };

  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text().catch(() => '');
    throw new Error(`Network response error (${response.status}): ${text.slice(0, 100) || 'Unknown'}`);
  }

  const data = await response.json();

  if (!response.ok || data.success === false) {
    const errorMsg = data.error?.message || data.message || 'Request failed';
    throw new Error(errorMsg);
  }

  return data.data !== undefined ? data.data : data;
}

export const api = {
  // Authentication
  auth: {
    login: (credentials: { email: string; password: string }) =>
      request<{ user: User; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    register: (payload: { email: string; password: string; name: string; role?: string; phone?: string }) =>
      request<{ user: User; token: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    demoLogin: (role: 'PATIENT' | 'DOCTOR' | 'ADMIN') =>
      request<{ user: User; token: string }>('/auth/demo-login', {
        method: 'POST',
        body: JSON.stringify({ role }),
      }),
    getMe: () => request<User>('/auth/me'),
  },

  // Doctors & Slot Search
  doctors: {
    list: (params?: { specialization?: string; search?: string }) => {
      const query = new URLSearchParams();
      if (params?.specialization) query.append('specialization', params.specialization);
      if (params?.search) query.append('search', params.search);
      return request<DoctorProfile[]>(`/doctors?${query.toString()}`);
    },
    getById: (id: string) => request<DoctorProfile>(`/doctors/${id}`),
    getSlots: (doctorId: string, date: string) =>
      request<SlotAvailabilityResponse>(`/doctors/${doctorId}/slots?date=${date}`),
    holdSlot: (doctorId: string, payload: { slotDate: string; startTime: string; endTime: string }) =>
      request<{ holdToken: string; expiresAt: string }>(`/doctors/${doctorId}/hold`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  // Appointments
  appointments: {
    create: (payload: {
      doctorId: string;
      appointmentDate: string;
      startTime: string;
      endTime: string;
      symptoms: string;
      holdToken?: string;
    }) =>
      request<Appointment>('/appointments', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getMy: () => request<Appointment[]>('/appointments/my'),
    getById: (id: string) => request<Appointment>(`/appointments/${id}`),
    reschedule: (id: string, payload: { newDate: string; newStartTime: string; newEndTime: string }) =>
      request<Appointment>(`/appointments/${id}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    cancel: (id: string) =>
      request<Appointment>(`/appointments/${id}/cancel`, {
        method: 'PATCH',
      }),
  },

  // Doctor Portal
  doctorPortal: {
    getAgenda: (date?: string) => {
      const q = date ? `?date=${date}` : '';
      return request<{ doctor: DoctorProfile; appointments: Appointment[] }>(`/doctor-portal/agenda${q}`);
    },
    submitConsultation: (
      appointmentId: string,
      payload: {
        clinicalNotes: string;
        prescriptions: Array<{
          medicationName: string;
          dosage: string;
          frequency: string;
          durationDays: number;
          instructions?: string;
        }>;
      }
    ) =>
      request<Appointment>(`/doctor-portal/appointments/${appointmentId}/consultation`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getLeaves: () => request<Array<{ id: string; leaveDate: string; reason?: string }>>('/doctor-portal/leaves'),
    previewLeave: (leaveDate: string) =>
      request<{
        doctor: DoctorProfile;
        leaveDate: string;
        conflictCount: number;
        affectedAppointments: Appointment[];
      }>(`/doctor-portal/leaves/preview?leaveDate=${leaveDate}`),
    applyLeave: (payload: { leaveDate: string; reason?: string }) =>
      request<{ leave: any; affectedCount: number; affectedAppointments: Appointment[] }>(
        '/doctor-portal/leaves',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      ),
    deleteLeave: (leaveDate: string) =>
      request<{ success: boolean }>(`/doctor-portal/leaves/${leaveDate}`, {
        method: 'DELETE',
      }),
  },

  // Admin Portal
  admin: {
    createDoctor: (payload: any) =>
      request<any>('/admin/doctors', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    updateDoctor: (id: string, payload: any) =>
      request<any>(`/admin/doctors/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    getAnalytics: () => request<ClinicAnalytics>('/admin/analytics'),
    getOutbox: () => request<EmailOutboxItem[]>('/admin/outbox'),
    retryOutbox: () => request<{ message: string }>('/admin/outbox/retry', { method: 'POST' }),
  },

  // Calendar
  calendar: {
    getAuthUrl: () => request<{ authUrl: string | null; isConfigured: boolean }>('/calendar/auth-url'),
    getStatus: () => request<{ isConnected: boolean }>('/calendar/status'),
    disconnect: () => request<{ message: string }>('/calendar/disconnect', { method: 'POST' }),
  },
};
