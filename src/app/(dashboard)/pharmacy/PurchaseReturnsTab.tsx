'use client';
import { useRef, useState } from 'react';
import { appointmentApi } from '@/lib/api';
import { useToast } from '@/components/ui/toaster';
import VendorPicker from './VendorPicker';
import { useCreatePurchaseReturn, usePurchaseReturns } from './hooks';
import type { InventoryItem } from './types';
import type { PharmacyPurchaseReturn, PurchaseReturnReason, Vendor } from '@/types';

const REASONS: PurchaseReturnReason[] = ['DAMAGED', 'EXPIRED', 'WRONG_ITEM', 'QUALITY_ISSUE', 'OVERSTOCK', 'OTHER'];
const REASON_LABEL: Record<PurchaseReturnReason, string> = {
  DAMAGED: 'Damaged', EXPIRED: 'Expired', WRONG_ITEM: 'Wrong Item',
  QUALITY_ISSUE: 'Quality Issue', OVERSTOCK: 'Overstock', OTHER: 'Other',
};

interface ReturnItemForm {
  inventoryId: string;
  originalPurchaseItemId?: string;
  medicineName: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  maxQuantity?: number;
  purchasePrice: number;
  gstRate: number;
  reason: PurchaseReturnReason;
}

export interface PurchaseReturnPrefill {
  vendorId: string;
  vendorName: string;
  originalPurchaseId: string;
  items: ReturnItemForm[];
}

const EMPTY_ITEM: ReturnItemForm = {
  inventoryId: '', medicineName: '', batchNo: '', expiryDate: '',
  quantity: 1, purchasePrice: 0, gstRate: 0, reason: 'DAMAGED',
};

export function PurchaseReturnModal({
  prefill, onClose, onSaved,
}: {
  prefill?: PurchaseReturnPrefill;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const createReturn = useCreatePurchaseReturn();
  const [vendorId, setVendorId] = useState(prefill?.vendorId ?? '');
  const [vendorName, setVendorName] = useState(prefill?.vendorName ?? '');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [debitNoteNo, setDebitNoteNo] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ReturnItemForm[]>(prefill?.items ?? [{ ...EMPTY_ITEM }]);
  const [suggestions, setSuggestions] = useState<Record<number, InventoryItem[]>>({});
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const lineTotal = (it: ReturnItemForm) =>
    Math.round(it.quantity * it.purchasePrice * (1 + it.gstRate / 100) * 100) / 100;
  const totalAmount = items.reduce((s, it) => s + lineTotal(it), 0);

  function searchInv(idx: number, q: string) {
    if (timers.current[idx]) clearTimeout(timers.current[idx]);
    if (!q || q.length < 2) { setSuggestions(p => ({ ...p, [idx]: [] })); return; }
    timers.current[idx] = setTimeout(async () => {
      try {
        const r = await appointmentApi.get(`/pharmacy/inventory?q=${encodeURIComponent(q)}&limit=5`);
        setSuggestions(p => ({ ...p, [idx]: Array.isArray(r.data) ? r.data : (r.data?.data ?? []) }));
      } catch { /* ignore */ }
    }, 300);
  }

  function pickInv(idx: number, inv: InventoryItem) {
    setItems(prev => prev.map((it, i) => i !== idx ? it : {
      ...it, inventoryId: inv.id, medicineName: inv.name,
      batchNo: inv.batchNo || '', expiryDate: inv.expiryDate ? inv.expiryDate.split('T')[0] : '',
      purchasePrice: Number(inv.mrp) || it.purchasePrice, maxQuantity: inv.stockQty,
    }));
    setSuggestions(p => ({ ...p, [idx]: [] }));
  }

  const upd = (idx: number, patch: Partial<ReturnItemForm>) =>
    setItems(prev => prev.map((it, i) => i !== idx ? it : { ...it, ...patch }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!vendorId) { setError('Select a vendor'); return; }
    if (items.some(it => !it.medicineName.trim() || it.quantity <= 0)) {
      setError('Every item needs a medicine and a quantity greater than zero');
      return;
    }
    try {
      await createReturn.mutateAsync({
        vendorId,
        originalPurchaseId: prefill?.originalPurchaseId,
        debitNoteNo: debitNoteNo || undefined,
        returnDate,
        notes: notes || undefined,
        items: items.map(it => ({
          inventoryId: it.inventoryId || undefined,
          originalPurchaseItemId: it.originalPurchaseItemId,
          medicineName: it.medicineName,
          batchNo: it.batchNo || undefined,
          expiryDate: it.expiryDate || undefined,
          quantity: it.quantity,
          purchasePrice: it.purchasePrice,
          gstRate: it.gstRate || undefined,
          reason: it.reason,
        })),
      });
      toast({ title: 'Return recorded', description: `₹${totalAmount.toFixed(2)} sent back to ${vendorName}`, variant: 'success' });
      onSaved();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || 'Failed to record return');
    }
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Return Stock to Vendor</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {prefill ? 'Returning items from an existing purchase' : 'Deducts stock and logs a movement against the vendor'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Vendor *</label>
                <VendorPicker
                  vendorId={vendorId}
                  vendorName={vendorName}
                  allowFreeText={false}
                  onSelect={(v: Vendor) => { setVendorId(v.id); setVendorName(v.name); }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Return Date</label>
                <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Debit Note No.</label>
                <input value={debitNoteNo} onChange={e => setDebitNoteNo(e.target.value)}
                  placeholder="DN-2025-0012"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Items to Return</h3>
                {!prefill && (
                  <button type="button" onClick={() => setItems(p => [...p, { ...EMPTY_ITEM }])}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Add row</button>
                )}
              </div>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-400 w-5 flex-shrink-0">#{idx + 1}</span>
                      <div className="flex-1 relative">
                        {prefill || item.inventoryId ? (
                          <div className="flex items-center justify-between bg-white border border-green-300 rounded-lg px-3 py-2">
                            <p className="text-sm font-medium text-gray-900">{item.medicineName}</p>
                            {item.batchNo && <span className="text-xs text-gray-400">Batch {item.batchNo}</span>}
                          </div>
                        ) : (
                          <div className="relative">
                            <input
                              value={item.medicineName}
                              onChange={e => { upd(idx, { medicineName: e.target.value }); searchInv(idx, e.target.value); }}
                              onBlur={() => setTimeout(() => setSuggestions(p => ({ ...p, [idx]: [] })), 200)}
                              placeholder="Search inventory…"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {(suggestions[idx] ?? []).length > 0 && (
                              <div className="absolute z-20 left-0 right-0 top-full mt-0.5 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                                {suggestions[idx].map(s => (
                                  <button key={s.id} type="button" onMouseDown={() => pickInv(idx, s)}
                                    className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-50 last:border-0 text-sm">
                                    <span className="font-medium">{s.name}</span>
                                    <span className="text-gray-400 ml-2 text-xs">{s.stockQty} in stock</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {!prefill && items.length > 1 && (
                        <button type="button" onClick={() => setItems(p => p.filter((_, i) => i !== idx))}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pl-7">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Qty{item.maxQuantity ? ` (max ${item.maxQuantity})` : ''}
                        </label>
                        <input type="number" min={1} max={item.maxQuantity} value={item.quantity}
                          onChange={e => upd(idx, { quantity: Number(e.target.value) })}
                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Price ₹</label>
                        <input type="number" min={0} step="0.01" value={item.purchasePrice}
                          onChange={e => upd(idx, { purchasePrice: Number(e.target.value) })}
                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">GST %</label>
                        <input type="number" min={0} step="0.01" value={item.gstRate}
                          onChange={e => upd(idx, { gstRate: Number(e.target.value) })}
                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Reason</label>
                        <select value={item.reason} onChange={e => upd(idx, { reason: e.target.value as PurchaseReturnReason })}
                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500">
                          {REASONS.map(r => <option key={r} value={r}>{REASON_LABEL[r]}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="pl-7 flex justify-end">
                      <span className="text-xs text-gray-500">
                        Line total: <span className="font-semibold text-gray-900">₹{r2(lineTotal(item)).toFixed(2)}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700">{error}</div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium">
              Cancel
            </button>
            <button type="submit" disabled={createReturn.isPending}
              className="flex-1 py-2.5 text-sm bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {createReturn.isPending && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {createReturn.isPending ? 'Saving…' : `Confirm Return · ₹${r2(totalAmount).toFixed(2)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PurchaseReturnsTab({ isAdmin }: { isAdmin: boolean }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = usePurchaseReturns(page, 20);
  const [selected, setSelected] = useState<PharmacyPurchaseReturn | null>(null);
  const [showModal, setShowModal] = useState(false);
  const returns = data?.data ?? [];
  const pagination = data?.pagination;

  const fmt = (n: number) => {
    const v = Number(n ?? 0);
    return v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${v.toLocaleString('en-IN')}`;
  };

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Purchase Returns</h2>
          {isAdmin && (
            <button onClick={() => setShowModal(true)}
              className="px-4 py-1.5 text-xs bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              New Return
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading…</div>
        ) : returns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <p className="text-3xl mb-2">↩️</p>
            <p className="text-sm">No purchase returns recorded yet</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Debit Note</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Items</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {returns.map(r => (
                    <tr key={r.id} onClick={() => setSelected(r === selected ? null : r)}
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${selected?.id === r.id ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{r.debitNoteNo || '—'}</td>
                      <td className="px-4 py-3 text-gray-700">{r.vendor?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(r.returnDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{r.items?.length ?? 0}</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-700">−{fmt(r.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                <span>Page {pagination.page} of {pagination.totalPages} · {pagination.total} returns</span>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                    className="px-2 py-1 border border-gray-300 rounded disabled:opacity-40">Prev</button>
                  <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}
                    className="px-2 py-1 border border-gray-300 rounded disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="w-80 flex-shrink-0">
        <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-0 max-h-[80vh] overflow-y-auto">
          <h2 className="font-semibold text-gray-900 mb-4">Return Detail</h2>
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <p className="text-3xl mb-2">↩️</p>
              <p className="text-sm text-center">Select a return to view details</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-red-50 rounded-lg p-3 border border-red-100 space-y-1">
                <p className="font-semibold text-gray-900 text-sm">{selected.vendor?.name ?? '—'}</p>
                {selected.debitNoteNo && <p className="text-xs text-gray-500">Debit Note: {selected.debitNoteNo}</p>}
                <p className="text-xs text-gray-500">
                  {new Date(selected.returnDate).toLocaleDateString('en-IN', { dateStyle: 'long' })}
                </p>
                {selected.notes && <p className="text-xs text-gray-600 italic mt-1">{selected.notes}</p>}
              </div>
              <div>
                <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Items</h3>
                <div className="space-y-2">
                  {(selected.items ?? []).map((item, i) => (
                    <div key={i} className="p-2.5 bg-gray-50 rounded-lg text-xs">
                      <div className="flex justify-between">
                        <p className="font-medium text-gray-900">{item.medicineName}</p>
                        <p className="text-gray-600">₹{Number(item.lineTotal).toFixed(2)}</p>
                      </div>
                      <div className="text-gray-500 mt-0.5 space-y-0.5">
                        <p>Qty: {item.quantity} · Reason: {REASON_LABEL[item.reason]}</p>
                        {item.batchNo && <p>Batch: {item.batchNo}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-gray-100 pt-3 flex justify-between text-sm">
                <span className="text-gray-600">Total Returned</span>
                <span className="font-bold text-red-700">−₹{Number(selected.totalAmount).toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <PurchaseReturnModal onClose={() => setShowModal(false)} onSaved={() => setSelected(null)} />
      )}
    </div>
  );
}
