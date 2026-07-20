// Shared HRMS types — mirrors the backend hrms.entity.ts shapes.

export interface HrmsUser {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface Department {
  id: string;
  name: string;
}

export interface Shift {
  id: string;
  userId: string;
  user?: HrmsUser;
  shiftDate: string;
  startTime: string;
  endTime: string;
  departmentId?: string | null;
  department?: Department | null;
  notes?: string | null;
}

export interface Attendance {
  id: string;
  userId: string;
  user?: HrmsUser;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE' | 'HOLIDAY';
  checkInAt?: string | null;
  checkOutAt?: string | null;
  notes?: string | null;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  user?: HrmsUser;
  leaveType: 'CASUAL' | 'SICK' | 'EARNED' | 'UNPAID' | 'MATERNITY' | 'PATERNITY';
  startDate: string;
  endDate: string;
  days: number;
  reason?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
}

export interface LeaveBalance {
  id: string;
  userId: string;
  year: number;
  leaveType: string;
  allocated: number;
  used: number;
}

export interface SalaryStructure {
  id: string;
  userId: string;
  effectiveFrom: string;
  basic: string;
  hra: string;
  otherAllowances: string;
  panNumber?: string | null;
  bankAccountNo?: string | null;
  bankIfsc?: string | null;
  pfNumber?: string | null;
  esiNumber?: string | null;
  isActive: boolean;
}

export interface PayrollRecord {
  id: string;
  userId: string;
  user?: HrmsUser;
  month: number;
  year: number;
  grossPay: string;
  pfEmployee?: string | null;
  esiEmployee?: string | null;
  professionalTax?: string | null;
  tds?: string | null;
  otherDeductions?: string | null;
  netPay: string;
  status: 'DRAFT' | 'FINALIZED' | 'PAID';
  paidAt?: string | null;
  notes?: string | null;
}

export interface DirectoryEntry {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string | null;
  todaysShift: Shift | null;
}
