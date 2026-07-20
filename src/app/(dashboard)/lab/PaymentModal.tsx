'use client';
import { useState } from 'react';
import { appointmentApi } from '@/lib/api';
import type { LabOrder } from './types';

export default function PaymentModal({ order, onClose, onSaved }: { order: LabOrder; onClose: () => void; onSaved: () => void }) {
  const [method, setMethod] = useState<'CASH' | 'CARD' | 'UPI' | 'ONLINE'>('CASH');
  const [amount, setAmount] = useState(String(order.amountDue ?? order.items.reduce((s, i) => s + Number(i.labTest.price), 0)));
  const [waived, setWaived] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await appointmentApi.post(`/lab/orders/${order.id}/collect-payment`, {
        paymentMethod: waived ? undefined : method,
        amountPaid: waived ? 0 : parseFloat(amount),
        waived,
      });
      onSaved(); onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || 'Payment collection failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Collect Payment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
            <p className="font-medium text-gray-900">{order.orderNumber}</p>
            <p className="text-gray-500 text-xs">
              {order.patient ? `${order.patient.firstName} ${order.patient.lastName}` : (order.walkInName ?? 'Walk-in')} · {order.items.length} test(s)
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={waived} onChange={e => setWaived(e.target.checked)} className="rounded" />
            Waive payment (insurance / free service)
          </label>
          {!waived && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Amount (₹) *</label>
                <input type="number" step="0.01" min="0" required value={amount} onChange={e => setAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Payment Method</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['CASH', 'CARD', 'UPI', 'ONLINE'] as const).map(m => (
                    <button key={m} type="button" onClick={() => setMethod(m)}
                      className={`py-2 text-xs rounded-lg border transition-colors ${method === m ? 'bg-teal-600 text-white border-teal-600' : 'text-gray-600 border-gray-300 hover:border-teal-400'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 text-sm bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-60">
              {saving ? 'Saving…' : waived ? 'Waive' : `Collect ₹${parseFloat(amount || '0').toFixed(2)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
