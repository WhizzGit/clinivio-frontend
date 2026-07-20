'use client';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/components/ui/toaster';
import { STATUS_STYLES, STATUS_LABELS, PRIORITY_STYLES, fmtDate } from './constants';
import { useAdmissions, useCreateOrder, useIPRequests, useTests } from './hooks';
import type { LabOrder, LabPriority } from './types';

function NewIPOrderModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const { data: admissions = [] } = useAdmissions();
  const { data: tests = [] } = useTests();
  const createOrder = useCreateOrder();

  const activeAdmissions = admissions.filter(a => a.status !== 'DISCHARGED');

  const [admissionId, setAdmissionId] = useState('');
  const [testIds, setTestIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<LabPriority>('ROUTINE');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [sampleType, setSampleType] = useState('');
  const [error, setError] = useState<string | null>(null);

  function toggleTest(id: string) {
    setTestIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!admissionId) { setError('Select an admission'); return; }
    if (!testIds.length) { setError('Select at least one test'); return; }
    try {
      await createOrder.mutateAsync({
        admissionId,
        orderedById: user?.id ?? '',
        priority,
        clinicalNotes: clinicalNotes || undefined,
        sampleType: sampleType || undefined,
        testIds,
      });
      toast({ title: 'IP lab order created', description: `${testIds.length} test(s) requested`, variant: 'success' });
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
          <h2 className="font-semibold text-gray-900">New IP Lab Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Admission *</label>
            <select required value={admissionId} onChange={e => setAdmissionId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
              <option value="">Select admission</option>
              {activeAdmissions.map(a => (
                <option key={a.id} value={a.id}>
                  {a.admissionNumber} — {a.patient.firstName} {a.patient.lastName} ({a.patient.uhid})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tests *</label>
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {tests.map(t => (
                <label key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={testIds.includes(t.id)} onChange={() => toggleTest(t.id)} className="rounded" />
                  <span className="flex-1">{t.name}</span>
                  <span className="text-xs text-gray-400">₹{t.price}</span>
                </label>
              ))}
            </div>
            {testIds.length > 0 && <p className="text-xs text-gray-500 mt-1">{testIds.length} test(s) selected</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['ROUTINE', 'URGENT', 'STAT'] as const).map(p => (
                  <button key={p} type="button" onClick={() => setPriority(p)}
                    className={cn('py-1.5 text-xs rounded-lg border transition-colors',
                      priority === p ? PRIORITY_STYLES[p] + ' border-transparent font-semibold' : 'text-gray-600 border-gray-300 hover:border-teal-400')}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Sample Type</label>
              <input value={sampleType} onChange={e => setSampleType(e.target.value)} placeholder="Blood, urine…"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Clinical Notes</label>
            <textarea rows={2} value={clinicalNotes} onChange={e => setClinicalNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
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

export default function IPRequestsTab({ onSelectOrder }: { onSelectOrder: (order: LabOrder) => void }) {
  const [status, setStatus] = useState('');
  const { data: orders = [], isLoading, refetch } = useIPRequests(status || undefined);
  const [showNew, setShowNew] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">IP Lab Requests</h2>
          <p className="text-xs text-gray-500">Orders billed on credit against an active admission</p>
        </div>
        <div className="flex gap-2">
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white">
            <option value="">All statuses</option>
            {['PENDING', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED'].map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <button onClick={() => refetch()} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">Refresh</button>
          <button onClick={() => setShowNew(true)}
            className="px-3 py-1.5 text-xs bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700">
            + New IP Lab Order
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
            <span className="text-4xl">🏥</span>
            <p className="text-sm">No IP lab requests yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Order #</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Patient</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Admission</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Tests</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Time</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map(order => (
                <tr key={order.id} onClick={() => onSelectOrder(order)} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-800">{order.orderNumber}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{order.patient ? `${order.patient.firstName} ${order.patient.lastName}` : '—'}</p>
                    <p className="text-xs text-gray-400">{order.patient?.uhid}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{order.admission?.admissionNumber ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{order.items.length} test{order.items.length !== 1 ? 's' : ''}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(order.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[order.status])}>
                      {STATUS_LABELS[order.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && <NewIPOrderModal onClose={() => setShowNew(false)} onSaved={() => refetch()} />}
    </div>
  );
}
