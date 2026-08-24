export type UserRole = 'PATIENT' | 'DOCTOR' | 'ADMIN';

export type UrgencyLevel = 'Low' | 'Medium' | 'High';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  googleConnected?: boolean;
  doctorProfile?: DoctorProfile;
}

export interface DoctorProfile {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  specialization: string;
  bio?: string;
  consultationFee: number;
  slotDurationMinutes: number;
  workingStartTime: string;
  workingEndTime: string;
  workingDays: string;
  leaves?: { leaveDate: string; reason?: string }[];
}

export interface AvailableSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  isHeld: boolean;
  heldUntil?: string;
}

export interface SlotAvailabilityResponse {
  doctor: DoctorProfile;
  isLeave: boolean;
  slots: AvailableSlot[];
}

export interface Prescription {
  id: string;
  appointmentId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions?: string;
  startDate: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patient: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  doctorId: string;
  doctor: DoctorProfile;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: 'BOOKED' | 'COMPLETED' | 'CANCELLED' | 'LEAVE_CONFLICT' | 'RESCHEDULED';
  symptoms: string;
  preVisitUrgency?: UrgencyLevel;
  preVisitSummary?: string;
  preVisitQuestions?: string; // JSON string
  postVisitNotes?: string;
  postVisitSummary?: string; // JSON string
  googleCalendarEventId?: string;
  prescriptions?: Prescription[];
  createdAt: string;
}

export interface MedicationScheduleItem {
  medication: string;
  dosage: string;
  frequency: string;
  instructions: string;
  duration: string;
}

export interface PostVisitParsedSummary {
  patientSummary: string;
  medicationSchedule: MedicationScheduleItem[];
  followUpSteps: string[];
  precautions: string[];
}

export interface ClinicAnalytics {
  appointments: {
    total: number;
    completed: number;
    booked: number;
    cancelled: number;
    leaveConflicts: number;
  };
  clinic: {
    doctors: number;
    patients: number;
  };
  emailOutbox: {
    sent: number;
    pending: number;
    failed: number;
  };
}

export interface EmailOutboxItem {
  id: string;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  templateName: string;
  attempts: number;
  maxAttempts: number;
  status: 'PENDING' | 'SENT' | 'FAILED';
  nextRetryAt: string;
  errorLog?: string;
  createdAt: string;
  sentAt?: string;
}
