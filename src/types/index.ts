// ─── User & Auth ─────────────────────────────────────────────────────────────

export type UserRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "DOCTOR"
  | "NURSE"
  | "RECEPTIONIST"
  | "PHARMACIST"
  | "LAB_TECHNICIAN";

export interface User {
  id: string;
  staffId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string;
  profileImage?: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ─── Tenant ───────────────────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  address?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
}

// ─── Patient ──────────────────────────────────────────────────────────────────

export type Gender = "MALE" | "FEMALE" | "OTHER";
export type BloodGroup =
  | "A_POSITIVE"
  | "A_NEGATIVE"
  | "B_POSITIVE"
  | "B_NEGATIVE"
  | "AB_POSITIVE"
  | "AB_NEGATIVE"
  | "O_POSITIVE"
  | "O_NEGATIVE";
export type Language = "EN" | "HI" | "TA" | "TE" | "KN" | "BN";

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship?: string;
}

export interface Patient {
  id: string;
  uhid: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender;
  bloodGroup?: BloodGroup;
  preferredLanguage: Language;
  abhaId?: string;
  address?: string;
  emergencyContact?: EmergencyContact;
  isActive: boolean;
  consentGiven: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Doctor ───────────────────────────────────────────────────────────────────

export interface DoctorProfile {
  id: string;
  userId: string;
  tenantId: string;
  specialty: string;
  qualification: string;
  registrationNumber: string;
  consultationFee: number;
  user: User;
  isActive: boolean;
  createdAt: string;
}

// ─── Appointment ──────────────────────────────────────────────────────────────

export type AppointmentStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type AppointmentType = "IN_PERSON" | "VIDEO" | "FOLLOW_UP";

export type PaymentMode = "PAY_NOW" | "PAY_AT_COUNTER";

export interface Appointment {
  id: string;
  tenantId: string;
  patientId: string;
  doctorId: string;
  slotId: string;
  tokenNumber: number;
  scheduledAt: string;
  type: AppointmentType;
  status: AppointmentStatus;
  chiefComplaint?: string;
  notes?: string;
  paymentMode: PaymentMode;
  consultationFee: number;
  patient?: Patient;
  doctor?: DoctorProfile;
  createdAt: string;
  updatedAt: string;
}

// ─── Slots ────────────────────────────────────────────────────────────────────

export interface DoctorSlot {
  id: string;
  doctorId: string;
  tenantId: string;
  date: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  maxAppointments: number;
  bookedCount: number;
  doctor?: DoctorProfile;
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export type InvoiceStatus = "DRAFT" | "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
export type PaymentMethod = "CASH" | "CARD" | "UPI" | "NETBANKING" | "INSURANCE";

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  patientId: string;
  appointmentId?: string;
  status: InvoiceStatus;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod?: PaymentMethod;
  dueDate: string;
  paidAt?: string;
  patient?: Patient;
  createdAt: string;
  updatedAt: string;
}

// ─── Pharmacy: Vendor / Stock Ledger / Purchase Returns ────────────────────────

export interface Vendor {
  id: string;
  tenantId: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StockMovementType = "PURCHASE" | "DISPENSE" | "ADJUSTMENT" | "RETURN_TO_VENDOR";
export type StockLedgerRefType =
  | "PHARMACY_PURCHASE"
  | "PHARMACY_ORDER"
  | "PHARMACY_PURCHASE_RETURN"
  | "MANUAL_ADJUSTMENT";

export interface PharmacyStockLedgerEntry {
  id: string;
  tenantId: string;
  inventoryId: string;
  movementType: StockMovementType;
  quantityChange: number;
  balanceAfter: number;
  batchNo?: string | null;
  expiryDate?: string | null;
  refType?: StockLedgerRefType | null;
  refId?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export type PurchaseReturnReason =
  | "DAMAGED"
  | "EXPIRED"
  | "WRONG_ITEM"
  | "QUALITY_ISSUE"
  | "OVERSTOCK"
  | "OTHER";

export interface PharmacyPurchaseReturnItem {
  id: string;
  returnId: string;
  inventoryId?: string | null;
  originalPurchaseItemId?: string | null;
  medicineName: string;
  batchNo?: string | null;
  expiryDate?: string | null;
  quantity: number;
  purchasePrice: number;
  gstRate?: number | null;
  reason: PurchaseReturnReason;
  lineTotal: number;
}

export interface PharmacyPurchaseReturn {
  id: string;
  tenantId: string;
  vendorId: string;
  vendor?: Vendor;
  originalPurchaseId?: string | null;
  debitNoteNo?: string | null;
  returnDate: string;
  totalAmount: number;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  items: PharmacyPurchaseReturnItem[];
}

// Matches the backend's { data, pagination: {...} } shape used by pharmacy
// list endpoints — distinct from PaginatedResponse<T> below, which has a
// flatter shape used by other modules.
export interface PharmacyPagedResult<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ─── Generic ──────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
}

export interface DashboardStats {
  todayAppointments: number;
  totalPatients: number;
  revenueToday: number;
  pendingPayments: number;
  appointmentsTrend: number;
  patientsTrend: number;
  revenueTrend: number;
}
