import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appointmentApi } from '@/lib/api';
import type {
  PharmacyPagedResult,
  PharmacyPurchaseReturn,
  PharmacyStockLedgerEntry,
  Vendor,
} from '@/types';

// ─── Vendors ──────────────────────────────────────────────────────────────────

export function useVendors(q?: string) {
  return useQuery({
    queryKey: ['pharmacy', 'vendors', q ?? ''],
    queryFn: async () => {
      const params = q ? `?q=${encodeURIComponent(q)}` : '';
      const res = await appointmentApi.get<Vendor[]>(`/pharmacy/vendors${params}`);
      return res.data;
    },
  });
}

export function useVendor(id: string | null) {
  return useQuery({
    queryKey: ['pharmacy', 'vendor', id],
    queryFn: async () => {
      const res = await appointmentApi.get<Vendor>(`/pharmacy/vendors/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: Partial<Vendor>) => {
      const res = await appointmentApi.post<Vendor>('/pharmacy/vendors', dto);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pharmacy', 'vendors'] });
    },
  });
}

export function useUpdateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...dto }: Partial<Vendor> & { id: string }) => {
      const res = await appointmentApi.patch<Vendor>(`/pharmacy/vendors/${id}`, dto);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['pharmacy', 'vendors'] });
      qc.invalidateQueries({ queryKey: ['pharmacy', 'vendor', variables.id] });
    },
  });
}

// ─── Purchase Returns ─────────────────────────────────────────────────────────

export function usePurchaseReturns(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['pharmacy', 'purchase-returns', page, limit],
    queryFn: async () => {
      const res = await appointmentApi.get<PharmacyPagedResult<PharmacyPurchaseReturn>>(
        `/pharmacy/purchase-returns?page=${page}&limit=${limit}`,
      );
      return res.data;
    },
  });
}

export function usePurchaseReturn(id: string | null) {
  return useQuery({
    queryKey: ['pharmacy', 'purchase-return', id],
    queryFn: async () => {
      const res = await appointmentApi.get<PharmacyPurchaseReturn>(`/pharmacy/purchase-returns/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export interface CreatePurchaseReturnPayload {
  vendorId: string;
  originalPurchaseId?: string;
  debitNoteNo?: string;
  returnDate: string;
  notes?: string;
  items: Array<{
    inventoryId?: string;
    originalPurchaseItemId?: string;
    medicineName: string;
    batchNo?: string;
    expiryDate?: string;
    quantity: number;
    purchasePrice: number;
    gstRate?: number;
    reason: string;
  }>;
}

export function useCreatePurchaseReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreatePurchaseReturnPayload) => {
      const res = await appointmentApi.post<PharmacyPurchaseReturn>('/pharmacy/purchase-returns', dto);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pharmacy', 'purchase-returns'] });
      // Ledger drawers keyed by inventoryId — invalidate the whole family so any
      // open/cached drawer picks up the new RETURN_TO_VENDOR row.
      qc.invalidateQueries({ queryKey: ['pharmacy', 'stock-ledger'] });
      // Note: the legacy Inventory tab manages its own stockQty list via local
      // useState/useEffect (not react-query), and already refetches whenever the
      // Inventory tab becomes active — so there's no react-query cache entry for
      // it to invalidate here.
    },
  });
}

// ─── Stock Ledger ─────────────────────────────────────────────────────────────

export function useStockLedger(inventoryId: string | null, page = 1, limit = 50) {
  return useQuery({
    queryKey: ['pharmacy', 'stock-ledger', inventoryId, page, limit],
    queryFn: async () => {
      const res = await appointmentApi.get<PharmacyPagedResult<PharmacyStockLedgerEntry>>(
        `/pharmacy/inventory/${inventoryId}/ledger?page=${page}&limit=${limit}`,
      );
      return res.data;
    },
    enabled: !!inventoryId,
  });
}
