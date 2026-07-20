import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appointmentApi } from '@/lib/api';
import type {
  Admission,
  LabDashboard,
  LabOrder,
  LabTest,
  PagedResult,
  TATReport,
} from './types';

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface OrderFilters {
  status?: string;
  patientId?: string;
  from?: string;
  to?: string;
  admissionId?: string;
  ipOnly?: boolean;
  paymentStatus?: string;
}

export function useOrders(filters: OrderFilters = {}, page = 1, limit = 200) {
  return useQuery({
    queryKey: ['lab', 'orders', filters, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.patientId) params.set('patientId', filters.patientId);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.admissionId) params.set('admissionId', filters.admissionId);
      if (filters.ipOnly) params.set('ipOnly', 'true');
      params.set('page', String(page));
      params.set('limit', String(limit));
      const res = await appointmentApi.get<PagedResult<LabOrder> | LabOrder[]>(
        `/lab/orders?${params}`,
      );
      const data = Array.isArray(res.data) ? res.data : res.data.data;
      // Client-side filter for paymentStatus — not a backend query param, kept
      // small/local since only the Billing tab's Receipts pill needs it.
      const filtered = filters.paymentStatus
        ? data.filter((o) => o.paymentStatus === filters.paymentStatus)
        : data;
      return filtered;
    },
  });
}

export function useIPRequests(status?: string, page = 1, limit = 50) {
  return useOrders({ ipOnly: true, status }, page, limit);
}

export interface CreateOrderPayload {
  patientId?: string;
  walkInName?: string;
  walkInAge?: number;
  walkInPhone?: string;
  admissionId?: string;
  orderedById: string;
  appointmentId?: string;
  priority?: string;
  clinicalNotes?: string;
  sampleType?: string;
  collectionSite?: string;
  collectionMethod?: string;
  testIds: string[];
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateOrderPayload) => {
      const res = await appointmentApi.post<LabOrder>('/lab/orders', dto);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lab', 'orders'] });
      qc.invalidateQueries({ queryKey: ['lab', 'dashboard'] });
    },
  });
}

export function useCollectPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      ...dto
    }: {
      orderId: string;
      paymentMethod?: 'CASH' | 'CARD' | 'UPI' | 'ONLINE';
      amountPaid: number;
      waived?: boolean;
    }) => {
      const res = await appointmentApi.post<LabOrder>(
        `/lab/orders/${orderId}/collect-payment`,
        dto,
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lab', 'orders'] });
    },
  });
}

// ─── TAT Report ───────────────────────────────────────────────────────────────

export interface TATFilters {
  from?: string;
  to?: string;
  testId?: string;
  category?: string;
  breachedOnly?: boolean;
}

export function useTATReport(filters: TATFilters = {}, page = 1, limit = 50) {
  return useQuery({
    queryKey: ['lab', 'tat-report', filters, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.testId) params.set('testId', filters.testId);
      if (filters.category) params.set('category', filters.category);
      if (filters.breachedOnly) params.set('breachedOnly', 'true');
      params.set('page', String(page));
      params.set('limit', String(limit));
      const res = await appointmentApi.get<TATReport>(`/lab/tat-report?${params}`);
      return res.data;
    },
  });
}

// ─── Bulk result import ───────────────────────────────────────────────────────

export interface BulkImportRow {
  sampleLabelCode?: string;
  orderNumber?: string;
  labTestId?: string;
  result: string;
  unit?: string;
  normalRange?: string;
  flag?: 'NORMAL' | 'ABNORMAL' | 'CRITICAL';
  notes?: string;
}

export function useBulkImportResults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: BulkImportRow[]) => {
      const res = await appointmentApi.post<{
        updatedCount: number;
        skipped: Array<{ row: BulkImportRow; reason: string }>;
      }>('/lab/orders/bulk-import-results', { rows });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lab', 'orders'] });
    },
  });
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function useLabDashboard(days = 30) {
  return useQuery({
    queryKey: ['lab', 'dashboard', days],
    queryFn: async () => {
      const res = await appointmentApi.get<LabDashboard>(`/lab/dashboard?days=${days}`);
      return res.data;
    },
  });
}

// ─── Test catalog ─────────────────────────────────────────────────────────────

export function useTests(q?: string, category?: string, all = false) {
  return useQuery({
    queryKey: ['lab', 'tests', q ?? '', category ?? '', all],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (category) params.set('category', category);
      if (all) params.set('all', 'true');
      const res = await appointmentApi.get<LabTest[] | { data: LabTest[] }>(
        `/lab/tests?${params}`,
      );
      return Array.isArray(res.data) ? res.data : res.data.data;
    },
  });
}

// ─── IPD admissions (for the "+ New IP Lab Order" admission picker) ───────────

export function useAdmissions(status?: string) {
  return useQuery({
    queryKey: ['lab', 'admissions', status ?? ''],
    queryFn: async () => {
      const params = status ? `?status=${status}` : '';
      const res = await appointmentApi.get<PagedResult<Admission>>(
        `/ipd/admissions${params}`,
      );
      return res.data.data;
    },
  });
}
