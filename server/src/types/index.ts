export type UserRole = 'PATIENT' | 'DOCTOR' | 'ADMIN';

export type AppointmentStatus =
  | 'BOOKED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'LEAVE_CONFLICT'
  | 'RESCHEDULED';

export type UrgencyLevel = 'Low' | 'Medium' | 'High';

export type PrescriptionFrequency =
  | 'ONCE_DAILY'
  | 'TWICE_DAILY'
  | 'THRICE_DAILY'
  | 'AS_NEEDED';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface PreVisitAIAnalysis {
  urgency: UrgencyLevel;
  chiefComplaint: string;
  suggestedQuestions: string[];
  triageAdvice: string;
}

export interface MedicationScheduleItem {
  medication: string;
  dosage: string;
  frequency: string;
  instructions: string;
  duration: string;
}

export interface PostVisitAIAnalysis {
  patientSummary: string;
  medicationSchedule: MedicationScheduleItem[];
  followUpSteps: string[];
  precautions: string[];
}

export interface AvailableSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  isHeld: boolean;
  heldUntil?: Date;
}
