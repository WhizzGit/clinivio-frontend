'use client';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { appointmentApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/components/ui/toaster';
import { STATUS_STYLES, STATUS_LABELS, fmtDate } from './constants';
import { useCreateOrder, useOrders, useTests } from './hooks';
import PaymentModal from './PaymentModal';
import type { LabOrder, LabPriority } from './types';

interface PatientHit { id: string; firstName: string; lastName: string; uhid: string }

function CashOrderModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const { data: tests = [] } = useTests();
  const createOrder = useCreateOrder();

  const [mode, setMode] = useState<'patient' | 'walkin'>('walkin');
  const [patientQuery, setPatientQuery] = useState('');
  const [patientHits, setPatientHits] = useState<PatientHit[]>([]);
  const [patient, setPatient] = useState<PatientHit | null>(null);
  const [walkInName, setWalkInName] = useState('');
  const [walkInAge, setWalkInAge] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [testIds, setTestIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<LabPriority>('ROUTINE');
  const [error, setError] = useState<string | null>(null);

  async function searchPatients(q: string) {
    setPatientQuery(q);
    if (q.length < 2) { setPatientHits([]); return; }
    try {
      const r = await appointmentApi.get(`/patients?q=${encodeURIComponent(q)}&limit=10`);
      setPatientHits(r.data?.data ?? []);
    } catch { /* ignore */ }
  }

  function toggleTest(id: string) {
    setTestIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!testIds.length) { setError('Select at least one test'); return; }
    if (mode === 'patient' && !patient) { setError('Search and select a patient'); return; }
    if (mode === 'walkin' && !walkInName.trim()) { setError('Walk-in name is required'); return; }
    try {
      await createOrder.mutateAsync({
        patientId: mode === 'patient' ? patient!.id : undefined,
        walkInName: mode === 'walkin' ? walkInName.trim() : undefined,
        walkInAge: mode === 'walkin' && walkInAge ? Number(walkInAge) : undefined,
        walkInPhone: mode === 'walkin' ? walkInPhone || undefined : undefined,
        orderedById: user?.id ?? '',
        priority,
        testIds,
      });
      toast({ title: 'Cash order created', description: `${testIds.length} test(s) — collect payment before sample collection`, variant: 'success' });
      onSaved();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || 'Failed to create order');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">New Cash Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMode('walkin')}
              className={cn('py-2 text-xs rounded-lg border font-medium', mode === 'walkin' ? 'bg-teal-600 text-white border-teal-600' : 'text-gray-600 border-gray-300')}>
              Walk-in / Outsider
            </button>
            <button type="button" onClick={() => setMode('patient')}
              className={cn('py-2 text-xs rounded-lg border font-medium', mode === 'patient' ? 'bg-teal-600 text-white border-teal-600' : 'text-gray-600 border-gray-300')}>
              Registered Patient
            </button>
          </div>

          {mode === 'walkin' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                <input required value={walkInName} onChange={e => setWalkInName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Age</label>
                <input type="number" min="0" value={walkInAge} onChange={e => setWalkInAge(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                <input value={walkInPhone} onChange={e => setWalkInPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
            </div>
          ) : (
            <div className="relative">
              <label className="block text-xs font-medium text-gray-700 mb-1">Patient *</label>
              {patient ? (
                <div className="flex items-center justify-between bg-white border border-green-300 rounded-lg px-3 py-2">
                  <p className="text-sm font-medium text-gray-900">{patient.firstName} {patient.lastName} · {patient.uhid}</p>
                  <button type="button" onClick={() => { setPatient(null); setPatientQuery(''); }} className="text-xs text-gray-400 hover:text-gray-700">Change</button>
                </div>
              ) : (
                <div>
                  <input value={patientQuery} onChange={e => searchPatients(e.target.value)} placeholder="Search by name or UHID…"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  {patientHits.length > 0 && (
                    <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden">
                      {patientHits.map(p => (
                        <button key={p.id} type="button" onClick={() => { setPatient(p); setPatientHits([]); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-teal-50 border-b border-gray-50 last:border-0">
                          {p.firstName} {p.lastName} <span className="text-xs text-gray-400">{p.uhid}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tests *</label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {tests.map(t => (
                <label key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={testIds.includes(t.id)} onChange={() => toggleTest(t.id)} className="rounded" />
                  <span className="flex-1">{t.name}</span>
                  <span className="text-xs text-gray-400">₹{t.price}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['ROUTINE', 'URGENT', 'STAT'] as const).map(p => (
                <button key={p} type="button" onClick={() => setPriority(p)}
                  className={cn('py-1.5 text-xs rounded-lg border', priority === p ? 'bg-teal-600 text-white border-teal-600 font-semibold' : 'text-gray-600 border-gray-300')}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={createOrder.isPending}
              className="flex-1 py-2 text-sm bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-60">
              {createOrder.isPending ? 'Creating…' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BillingOrderRow({ order, onClick }: { order: LabOrder; onClick: () => void }) {
  const orderValue = order.items.reduce((s, i) => s + Number(i.labTest.price), 0);
  const label = order.patient ? `${order.patient.firstName} ${order.patient.lastName}` : (order.walkInName ?? 'Walk-in');
  return (
    <tr onClick={onClick} className="hover:bg-gray-50 cursor-pointer">
      <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-800">{order.orderNumber}</td>
      <td className="px-4 py-3 text-gray-900">{label}</td>
      <td className="px-4 py-3 text-right font-semibold text-gray-900">₹{orderValue.toLocaleString('en-IN')}</td>
      <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(order.createdAt)}</td>
      <td className="px-4 py-3">
        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[order.status])}>{STATUS_LABELS[order.status]}</span>
      </td>
    </tr>
  );
}

export default function BillingTab({ onSelectOrder }: { onSelectOrder: (order: LabOrder) => void }) {
  const [pill, setPill] = useState<'cash' | 'company' | 'receipts'>('cash');
  const [showNew, setShowNew] = useState(false);
  const [payOrder, setPayOrder] = useState<LabOrder | null>(null);

  const unpaidCash = useOrders({}, 1, 200);
  const creditOrders = useOrders({ admissionId: undefined }, 1, 200);
  const receipts = useOrders({ paymentStatus: 'PAID' }, 1, 200);

  const cashUnpaid = (unpaidCash.data ?? []).filter(o => o.billingMode === 'CASH' && o.paymentStatus !== 'PAID' && o.paymentStatus !== 'WAIVED');
  const company = (creditOrders.data ?? []).filter(o => o.billingMode === 'CREDIT');

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {[{ key: 'cash', label: 'Cash Bill' }, { key: 'company', label: 'Company Bill' }, { key: 'receipts', label: 'Receipts' }].map(p => (
            <button key={p.key} onClick={() => setPill(p.key as 'cash' | 'company' | 'receipts')}
              className={cn('px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                pill === p.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {p.label}
            </button>
          ))}
        </div>
        {pill === 'cash' && (
          <button onClick={() => setShowNew(true)} className="px-3 py-1.5 text-xs bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700">
            + New Cash Order
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {pill === 'cash' && (
          cashUnpaid.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
              <span className="text-3xl">💵</span>
              <p className="text-sm">No unpaid cash orders</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Order #</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Patient</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Time</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cashUnpaid.map(o => <BillingOrderRow key={o.id} order={o} onClick={() => setPayOrder(o)} />)}
              </tbody>
            </table>
          )
        )}
        {pill === 'company' && (
          company.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
              <span className="text-3xl">🏢</span>
              <p className="text-sm">No credit (IP) orders yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Order #</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Patient</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Time</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {company.map(o => <BillingOrderRow key={o.id} order={o} onClick={() => onSelectOrder(o)} />)}
              </tbody>
            </table>
          )
        )}
        {pill === 'receipts' && (
          (receipts.data ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
              <span className="text-3xl">🧾</span>
              <p className="text-sm">No receipts yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Order #</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Patient</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Time</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(receipts.data ?? []).map(o => <BillingOrderRow key={o.id} order={o} onClick={() => onSelectOrder(o)} />)}
              </tbody>
            </table>
          )
        )}
      </div>

      {showNew && <CashOrderModal onClose={() => setShowNew(false)} onSaved={() => unpaidCash.refetch()} />}
      {payOrder && (
        <PaymentModal order={payOrder} onClose={() => setPayOrder(null)}
          onSaved={() => { setPayOrder(null); unpaidCash.refetch(); }} />
      )}
    </div>
  );
}
