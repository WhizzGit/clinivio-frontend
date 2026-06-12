export type Gender = "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";

export type AppointmentStatus =
  | "REGISTERED" | "PENDING_PAYMENT" | "CONFIRMED" | "CHECKED_IN"
  | "IN_PROGRESS" | "COMPLETED" | "SENT_TO_PHARMACY" | "CANCELLED" | "NO_SHOW";

export type AppointmentType = "IN_PERSON" | "VIDEO" | "FOLLOW_UP";
export type PaymentStatus = "PENDING" | "PAID" | "REFUNDED" | "FAILED";
export type LabOrderStatus = "PENDING" | "SAMPLE_COLLECTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type LabResultFlag = "NORMAL" | "ABNORMAL" | "CRITICAL";

export interface Patient {
  id: string;
  uhid: string;
  tenantId: string;
  firstName: string;
  lastName: string | null;
  phone: string;
  email: string | null;
  dob: string | null;
  gender: Gender | null;
  bloodGroup: string | null;
  address: string | null;
  abhaId: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface DoctorProfile {
  id: string;
  specialty: string;
  qualification: string;
  consultationFee: number;
  user: { id: string; firstName: string; lastName: string };
  department?: Department;
}

export interface Department {
  id: string;
  name: string;
  isActive: boolean;
}

export interface DoctorSlot {
  id: string;
  doctorId: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  isBlocked: boolean;
  maxPatients: number;
  bookedCount: number;
  durationMinutes: number;
}

export interface Appointment {
  id: string;
  tokenNumber: number | null;
  status: AppointmentStatus;
  appointmentType: AppointmentType;
  paymentStatus: PaymentStatus;
  chiefComplaint: string | null;
  scheduledAt: string | null;
  createdAt: string;
  doctor?: { id: string; firstName: string; lastName: string; doctorProfile?: DoctorProfile };
  department?: Department;
  slot?: DoctorSlot;
}

export interface PrescriptionItem {
  id: string;
  medicineName: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
}

export interface Prescription {
  id: string;
  items: PrescriptionItem[];
}

export interface FollowUp {
  id: string;
  followUpDate: string;
  isCompleted: boolean;
  notes: string | null;
}

export interface Consultation {
  id: string;
  appointmentId: string;
  createdAt: string;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  pulseRate: number | null;
  temperature: string | null;
  diagnosis: string | null;
  observations: string | null;
  doctor?: { id: string; firstName: string; lastName: string };
  prescriptions: Prescription[];
  followUps: FollowUp[];
}

export interface LabOrderItem {
  id: string;
  result: string | null;
  unit: string | null;
  normalRange: string | null;
  flag: LabResultFlag | null;
  labTest: { id: string; name: string; code: string; category: string };
}

export interface LabOrder {
  id: string;
  orderNumber: string;
  status: LabOrderStatus;
  priority: string;
  clinicalNotes: string | null;
  collectedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  items: LabOrderItem[];
  orderedBy?: { id: string; firstName: string; lastName: string };
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceType: string;
  paymentStatus: PaymentStatus;
  subtotal: string;
  discountAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  totalAmount: string;
  lineItems: any;
  createdAt: string;
  paymentMethod: string | null;
  paidAt: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
