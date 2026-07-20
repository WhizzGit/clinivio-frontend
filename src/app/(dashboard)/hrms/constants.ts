export const ROLE_META: Record<string, { label: string; bg: string; text: string }> = {
  DOCTOR: { label: 'Doctor', bg: 'bg-blue-100', text: 'text-blue-700' },
  NURSE: { label: 'Nurse', bg: 'bg-pink-100', text: 'text-pink-700' },
  RECEPTIONIST: { label: 'Receptionist', bg: 'bg-purple-100', text: 'text-purple-700' },
  LAB_TECHNICIAN: { label: 'Lab Technician', bg: 'bg-teal-100', text: 'text-teal-700' },
  PHARMACIST: { label: 'Pharmacist', bg: 'bg-orange-100', text: 'text-orange-700' },
  HR_ADMIN: { label: 'HR Admin', bg: 'bg-indigo-100', text: 'text-indigo-700' },
  FACILITY_MANAGER: { label: 'Facility Manager', bg: 'bg-cyan-100', text: 'text-cyan-700' },
  ADMIN: { label: 'Admin', bg: 'bg-gray-200', text: 'text-gray-700' },
};

export const ATTENDANCE_STATUS_STYLES: Record<string, string> = {
  PRESENT: 'bg-green-100 text-green-700',
  ABSENT: 'bg-red-100 text-red-700',
  HALF_DAY: 'bg-yellow-100 text-yellow-700',
  ON_LEAVE: 'bg-purple-100 text-purple-700',
  HOLIDAY: 'bg-gray-100 text-gray-600',
};

export const LEAVE_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

export const PAYROLL_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  FINALIZED: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
};

export const LEAVE_TYPES = ['CASUAL', 'SICK', 'EARNED', 'UNPAID', 'MATERNITY', 'PATERNITY'];

export function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function currency(v?: string | number | null) {
  const n = Number(v ?? 0);
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
