import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appointmentApi } from '@/lib/api';
import type {
  Shift,
  Attendance,
  LeaveRequest,
  LeaveBalance,
  SalaryStructure,
  PayrollRecord,
  DirectoryEntry,
} from './types';

// ─── Shifts ───────────────────────────────────────────────────────────────────

export function useShifts(filters: { userId?: string; from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: ['hrms', 'shifts', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.userId) params.set('userId', filters.userId);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      const res = await appointmentApi.get<Shift[]>(`/hrms/shifts?${params}`);
      return res.data;
    },
  });
}

export function useMyShifts() {
  return useQuery({
    queryKey: ['hrms', 'me', 'shifts'],
    queryFn: async () => (await appointmentApi.get<Shift[]>('/hrms/me/shifts')).data,
  });
}

export function useCreateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: {
      userId: string;
      shiftDate: string;
      startTime: string;
      endTime: string;
      departmentId?: string;
      notes?: string;
    }) => (await appointmentApi.post<Shift>('/hrms/shifts', dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hrms', 'shifts'] }),
  });
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export function useAttendance(filters: { userId?: string; date?: string; from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: ['hrms', 'attendance', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.userId) params.set('userId', filters.userId);
      if (filters.date) params.set('date', filters.date);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      const res = await appointmentApi.get<Attendance[]>(`/hrms/attendance?${params}`);
      return res.data;
    },
  });
}

export function useMyAttendance() {
  return useQuery({
    queryKey: ['hrms', 'me', 'attendance'],
    queryFn: async () => (await appointmentApi.get<Attendance[]>('/hrms/me/attendance')).data,
  });
}

export function useMarkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: { userId: string; date: string; status: string; notes?: string }) =>
      (await appointmentApi.post<Attendance>('/hrms/attendance', dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hrms', 'attendance'] }),
  });
}

// ─── Leave ────────────────────────────────────────────────────────────────────

export function useLeaveRequests(filters: { userId?: string; status?: string } = {}) {
  return useQuery({
    queryKey: ['hrms', 'leave-requests', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.userId) params.set('userId', filters.userId);
      if (filters.status) params.set('status', filters.status);
      const res = await appointmentApi.get<LeaveRequest[]>(`/hrms/leave-requests?${params}`);
      return res.data;
    },
  });
}

export function useMyLeaveRequests() {
  return useQuery({
    queryKey: ['hrms', 'me', 'leave-requests'],
    queryFn: async () => (await appointmentApi.get<LeaveRequest[]>('/hrms/me/leave-requests')).data,
  });
}

export function useDecideLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...dto
    }: {
      id: string;
      status: 'APPROVED' | 'REJECTED' | 'CANCELLED';
      rejectionReason?: string;
    }) => (await appointmentApi.patch<LeaveRequest>(`/hrms/leave-requests/${id}/decide`, dto)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hrms', 'leave-requests'] });
      qc.invalidateQueries({ queryKey: ['hrms', 'leave-balances'] });
    },
  });
}

export function useApplyLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: { leaveType: string; startDate: string; endDate: string; reason?: string }) =>
      (await appointmentApi.post<LeaveRequest>('/hrms/me/leave-requests', dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hrms', 'me', 'leave-requests'] }),
  });
}

export function useLeaveBalances(userId?: string, year?: number) {
  return useQuery({
    queryKey: ['hrms', 'leave-balances', userId, year],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userId) params.set('userId', userId);
      if (year) params.set('year', String(year));
      const res = await appointmentApi.get<LeaveBalance[]>(`/hrms/leave-balances?${params}`);
      return res.data;
    },
    enabled: !!userId,
  });
}

export function useMyLeaveBalance() {
  return useQuery({
    queryKey: ['hrms', 'me', 'leave-balance'],
    queryFn: async () => (await appointmentApi.get<LeaveBalance[]>('/hrms/me/leave-balance')).data,
  });
}

export function useUpsertLeaveBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: { userId: string; year: number; leaveType: string; allocated: number }) =>
      (await appointmentApi.post<LeaveBalance>('/hrms/leave-balances', dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hrms', 'leave-balances'] }),
  });
}

// ─── Salary & Payroll ───────────────────────────────────────────────────────────

export function useSalaryStructures(userId?: string) {
  return useQuery({
    queryKey: ['hrms', 'salary-structures', userId],
    queryFn: async () => {
      const params = userId ? `?userId=${userId}` : '';
      const res = await appointmentApi.get<SalaryStructure[]>(`/hrms/salary-structures${params}`);
      return res.data;
    },
    enabled: !!userId,
  });
}

export function useCreateSalaryStructure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: {
      userId: string;
      effectiveFrom: string;
      basic: number;
      hra?: number;
      otherAllowances?: number;
      panNumber?: string;
      bankAccountNo?: string;
      bankIfsc?: string;
      pfNumber?: string;
      esiNumber?: string;
    }) => (await appointmentApi.post<SalaryStructure>('/hrms/salary-structures', dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hrms', 'salary-structures'] }),
  });
}

export function usePayrollRecords(filters: { userId?: string; month?: number; year?: number; status?: string } = {}) {
  return useQuery({
    queryKey: ['hrms', 'payroll-records', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.userId) params.set('userId', filters.userId);
      if (filters.month) params.set('month', String(filters.month));
      if (filters.year) params.set('year', String(filters.year));
      if (filters.status) params.set('status', filters.status);
      const res = await appointmentApi.get<PayrollRecord[]>(`/hrms/payroll-records?${params}`);
      return res.data;
    },
  });
}

export function useCreatePayrollRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: {
      userId: string;
      month: number;
      year: number;
      grossPay: number;
      pfEmployee?: number;
      esiEmployee?: number;
      professionalTax?: number;
      tds?: number;
      otherDeductions?: number;
      notes?: string;
    }) => (await appointmentApi.post<PayrollRecord>('/hrms/payroll-records', dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hrms', 'payroll-records'] }),
  });
}

export function useUpdatePayrollStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'DRAFT' | 'FINALIZED' | 'PAID' }) =>
      (await appointmentApi.patch<PayrollRecord>(`/hrms/payroll-records/${id}/status`, { status })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hrms', 'payroll-records'] }),
  });
}

// ─── Directory ────────────────────────────────────────────────────────────────

export function useDirectoryLite() {
  return useQuery({
    queryKey: ['hrms', 'directory-lite'],
    queryFn: async () => (await appointmentApi.get<DirectoryEntry[]>('/hrms/directory-lite')).data,
  });
}
