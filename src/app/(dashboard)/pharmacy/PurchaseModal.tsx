'use client';
import { useRef, useState } from 'react';
import { appointmentApi } from '@/lib/api';
import { useToast } from '@/components/ui/toaster';
import VendorPicker from './VendorPicker';
import type { InventoryItem, PurchaseItemForm } from './types';

const EMPTY_PI: PurchaseItemForm = {
  inventoryId: '', medicineName: '', batchNo: '', expiryDate: '',
  quantity: 1, freeQty: 0, purchasePrice: 0, mrp: 0, sellingPrice: 0,
  discountPercent: 0, gstRate: 12,
};

export default function PurchaseModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [header, setHeader] = useState({
    vendorId: '', vendorName: '', invoiceNo: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [items, setItems] = useState<PurchaseItemForm[]>([{ ...EMPTY_PI }]);
  const [suggestions, setSuggestions] = useState<Record<number, InventoryItem[]>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const lineTotal = (it: PurchaseItemForm) =>
    Math.round(it.quantity * it.purchasePrice * (1 - it.discountPercent / 100) * 100) / 100;

  const totalAmount = items.reduce((s, it) => s + lineTotal(it), 0);
  const totalDiscount = items.reduce((s, it) =>
    s + Math.round(it.quantity * it.purchasePrice * (it.discountPercent / 100) * 100) / 100, 0);

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
      mrp: Number(inv.mrp), sellingPrice: Number(inv.sellingPrice),
      batchNo: inv.batchNo || '', expiryDate: inv.expiryDate ? inv.expiryDate.split('T')[0] : '',
    }));
    setSuggestions(p => ({ ...p, [idx]: [] }));
  }

  const upd = (idx: number, field: keyof PurchaseItemForm, val: string | number) =>
    setItems(prev => prev.map((it, i) => i !== idx ? it : { ...it, [field]: val }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!header.vendorId && !header.vendorName.trim()) { setError('Select or enter a vendor name'); return; }
    if (items.some(it => !it.medicineName.trim())) { setError('All items must have a medicine name'); return; }
    setSaving(true);
    try {
      await appointmentApi.post('/pharmacy/purchases', {
        vendorId: header.vendorId || undefined,
        vendorName: header.vendorName || undefined,
        invoiceNo: header.invoiceNo,
        purchaseDate: header.purchaseDate,
        notes: header.notes,
        items: items.map(it => ({ ...it, lineTotal: lineTotal(it) })),
      });
      toast({ title: 'Purchase recorded', description: `₹${totalAmount.toFixed(2)} added to stock`, variant: 'success' });
      onSaved();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || 'Failed to save purchase');
    } finally {
      setSaving(false);
    }
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Record Purchase Invoice</h2>
            <p className="text-xs text-gray-500 mt-0.5">Log incoming stock from vendor</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Vendor / Supplier *</label>
                <VendorPicker
                  vendorId={header.vendorId}
                  vendorName={header.vendorName}
                  onSelect={v => setHeader(p => ({ ...p, vendorId: v.id, vendorName: v.name }))}
                  onFreeText={name => setHeader(p => ({ ...p, vendorId: '', vendorName: name }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Invoice No.</label>
                <input value={header.invoiceNo} onChange={e => setHeader(p => ({ ...p, invoiceNo: e.target.value }))}
                  placeholder="INV-2025-0042"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Purchase Date</label>
                <input type="date" value={header.purchaseDate} onChange={e => setHeader(p => ({ ...p, purchaseDate: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Line Items</h3>
                <button type="button" onClick={() => setItems(p => [...p, { ...EMPTY_PI }])}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Add row</button>
              </div>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-400 w-5 flex-shrink-0">#{idx + 1}</span>
                      <div className="flex-1 relative">
                        {item.inventoryId ? (
                          <div className="flex items-center justify-between bg-white border border-green-300 rounded-lg px-3 py-2">
                            <p className="text-sm font-medium text-gray-900">{item.medicineName}</p>
                            <button type="button" onClick={() => upd(idx, 'inventoryId', '')}
                              className="text-xs text-gray-400 hover:text-gray-700 ml-2">Change</button>
                          </div>
                        ) : (
                          <div className="relative">
                            <input
                              value={item.medicineName}
                              onChange={e => {
                                upd(idx, 'medicineName', e.target.value);
                                searchInv(idx, e.target.value);
                              }}
                              onBlur={() => setTimeout(() => setSuggestions(p => ({ ...p, [idx]: [] })), 200)}
                              placeholder="Medicine name or search inventory…"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {(suggestions[idx] ?? []).length > 0 && (
                              <div className="absolute z-20 left-0 right-0 top-full mt-0.5 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                                {suggestions[idx].map(s => (
                                  <button key={s.id} type="button" onMouseDown={() => pickInv(idx, s)}
                                    className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-50 last:border-0 text-sm">
                                    <span className="font-medium">{s.name}</span>
                                    {s.genericName && <span className="text-gray-400 ml-2 text-xs">{s.genericName}</span>}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {items.length > 1 && (
                        <button type="button" onClick={() => setItems(p => p.filter((_, i) => i !== idx))}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-4 md:grid-cols-8 gap-2 pl-7">
                      {([
                        { label: 'Batch No', field: 'batchNo', type: 'text', placeholder: 'BT001' },
                        { label: 'Expiry', field: 'expiryDate', type: 'date', placeholder: '' },
                        { label: 'Qty', field: 'quantity', type: 'number', placeholder: '100' },
                        { label: 'Free Qty', field: 'freeQty', type: 'number', placeholder: '0' },
                        { label: 'Purchase ₹', field: 'purchasePrice', type: 'number', placeholder: '0.00' },
                        { label: 'MRP ₹', field: 'mrp', type: 'number', placeholder: '0.00' },
                        { label: 'Selling ₹', field: 'sellingPrice', type: 'number', placeholder: '0.00' },
                        { label: 'Disc %', field: 'discountPercent', type: 'number', placeholder: '0' },
                      ] as const).map(({ label, field, type, placeholder }) => (
                        <div key={field}>
                          <label className="block text-xs text-gray-500 mb-1">{label}</label>
                          <input
                            type={type} placeholder={placeholder}
                            value={item[field]}
                            step={type === 'number' ? '0.01' : undefined}
                            min={type === 'number' ? '0' : undefined}
                            onChange={e => upd(idx, field, type === 'number' ? Number(e.target.value) : e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="pl-7 flex justify-end">
                      <span className="text-xs text-gray-500">
                        Line total: <span className="font-semibold text-gray-900">₹{r2(lineTotal(item)).toFixed(2)}</span>
                        {item.freeQty > 0 && <span className="ml-2 text-green-600">+{item.freeQty} free units</span>}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea rows={3} value={header.notes} onChange={e => setHeader(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Received in good condition, return policy 30 days…"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-4 flex flex-col justify-center space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Sub-total (before discount)</span>
                  <span className="font-medium text-gray-900">₹{r2(totalAmount + totalDiscount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Discount</span>
                  <span className="font-medium text-green-700">−₹{r2(totalDiscount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t border-indigo-200 pt-2">
                  <span className="text-gray-900">Invoice Total</span>
                  <span className="text-indigo-700">₹{r2(totalAmount).toFixed(2)}</span>
                </div>
              </div>
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
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 text-sm bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {saving ? 'Saving…' : `Save Purchase · ₹${r2(totalAmount).toFixed(2)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
