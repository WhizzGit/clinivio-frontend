'use client';
import { useState, useEffect, useCallback } from 'react';
import { appointmentApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';

interface LabTest {
  id: string; name: string; code: string; category: string;
  unit?: string; normalRange?: string; price: number; turnaround: number; isActive: boolean;
}
interface LabOrderItem {
  id: string; labTestId: string; result?: string; unit?: string;
  normalRange?: string; flag?: 'NORMAL' | 'ABNORMAL' | 'CRITICAL'; notes?: string;
  labTest: { id: string; name: string; code: string; unit?: string; normalRange?: string; price: number };
}
interface LabOrder {
  id: string; orderNumber: string; status: string; priority: string;
  clinicalNotes?: string; sampleType?: string; collectedAt?: string;
  completedAt?: string; createdAt: string;
  patient: { id: string; firstName: string; lastName: string; uhid: string; phone: string };
  orderedBy: { firstName: string; lastName: string };
  assignedTo?: { firstName: string; lastName: string };
  items: LabOrderItem[];
}
interface Stats { pending: number; sampleCollected: number; inProgress: number; completedToday: number; total: number }
interface Analytics {
  period: number; totalOrders: number; completedOrders: number; todayOrders: number;
  completedRevenue: number; avgTurnaroundHours: number; criticalItems: number; criticalRate: number;
  categoryBreakdown: Record<string, { orderCount: number; revenue: number; testCount: number; activeTests: number }>;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700', SAMPLE_COLLECTED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-orange-100 text-orange-700', COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending', SAMPLE_COLLECTED: 'Sample Collected',
  IN_PROGRESS: 'In Progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
};
const FLAG_STYLES: Record<string, string> = {
  NORMAL: 'text-green-600', ABNORMAL: 'text-orange-600 font-semibold', CRITICAL: 'text-red-600 font-bold',
};
const PRIORITY_STYLES: Record<string, string> = {
  ROUTINE: 'bg-gray-100 text-gray-600', URGENT: 'bg-orange-100 text-orange-700', STAT: 'bg-red-100 text-red-700',
};
const CATEGORY_ICONS: Record<string, string> = {
  'Haematology': '🩸', 'Biochemistry': '🧪', 'Microbiology': '🦠',
  'Serology': '💉', 'Urine Analysis': '🔬', 'Radiology': '🩻', 'Other': '🧫',
};

// ── Results Entry Modal ────────────────────────────────────────────────────────
function ResultsModal({ order, onClose, onSaved }: { order: LabOrder; onClose: () => void; onSaved: () => void }) {
  const [results, setResults] = useState<Record<string, { result: string; flag: string; notes: string }>>(
    Object.fromEntries(order.items.map(i => [i.id, { result: i.result ?? '', flag: i.flag ?? '', notes: i.notes ?? '' }]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField(itemId: string, field: string, value: string) {
    setResults(prev => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));
  }

  async function handleSave() {
    const filled = Object.entries(results).filter(([, v]) => v.result.trim());
    if (!filled.length) { setError('Enter at least one result'); return; }
    setSaving(true); setError(null);
    try {
      await appointmentApi.patch(`/lab/orders/${order.id}/results`, {
        results: filled.map(([itemId, v]) => ({
          itemId, result: v.result.trim(),
          ...(v.flag && { flag: v.flag }),
          ...(v.notes.trim() && { notes: v.notes.trim() }),
          unit: order.items.find(i => i.id === itemId)?.labTest.unit,
          normalRange: order.items.find(i => i.id === itemId)?.labTest.normalRange,
        })),
      });
      onSaved();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string | string[] } } };
      const msg = e?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to save results');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Enter Results — {order.orderNumber}</h2>
            <p className="text-xs text-gray-500">{order.patient.firstName} {order.patient.lastName} · {order.patient.uhid}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
          {order.items.map(item => (
            <div key={item.id} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.labTest.name}</p>
                  <p className="text-xs text-gray-400">{item.labTest.code} {item.labTest.normalRange && `· Normal: ${item.labTest.normalRange}`} {item.labTest.unit && `· Unit: ${item.labTest.unit}`}</p>
                </div>
                {item.result && (
                  <span className={cn('text-xs font-medium', item.flag ? FLAG_STYLES[item.flag] : 'text-gray-600')}>
                    {item.result} {item.labTest.unit} {item.flag && `(${item.flag})`}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Result *</label>
                  <input type="text" value={results[item.id]?.result ?? ''} onChange={e => updateField(item.id, 'result', e.target.value)}
                    placeholder={item.labTest.unit ? `Value in ${item.labTest.unit}` : 'Enter result'}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Flag</label>
                  <select value={results[item.id]?.flag ?? ''} onChange={e => updateField(item.id, 'flag', e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
                    <option value="">— Select —</option>
                    <option value="NORMAL">Normal</option>
                    <option value="ABNORMAL">Abnormal</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <input type="text" value={results[item.id]?.notes ?? ''} onChange={e => updateField(item.id, 'notes', e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
              </div>
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2 text-sm bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving…</> : 'Save Results'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Test Catalog Slide-over ────────────────────────────────────────────────────
function TestCatalogPanel({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [tests, setTests] = useState<LabTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', code: '', category: '', unit: '', normalRange: '', price: '0', turnaround: '24' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('');

  const CATEGORIES = ['Haematology', 'Biochemistry', 'Microbiology', 'Serology', 'Urine Analysis', 'Radiology', 'Other'];

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await appointmentApi.get('/lab/tests?all=true');
      setTests(res.data?.data || res.data || []);
    } catch { setTests([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.code || !form.category) { setError('Name, code, and category are required'); return; }
    setSaving(true); setError(null);
    try {
      await appointmentApi.post('/lab/tests', { ...form, price: parseFloat(form.price), turnaround: parseInt(form.turnaround) });
      setForm({ name: '', code: '', category: '', unit: '', normalRange: '', price: '0', turnaround: '24' });
      load(); onSaved();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string | string[] } } };
      const msg = e?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to add test');
    } finally { setSaving(false); }
  }

  async function toggleActive(test: LabTest) {
    await appointmentApi.patch(`/lab/tests/${test.id}`, { isActive: !test.isActive });
    load();
  }

  const grouped = CATEGORIES.reduce<Record<string, LabTest[]>>((acc, cat) => {
    acc[cat] = tests.filter(t => t.category === cat);
    return acc;
  }, {});
  const visibleTests = activeCategory ? tests.filter(t => t.category === activeCategory) : tests;

  return (
    <div className="fixed inset-0 z-50 flex bg-black/40 backdrop-blur-sm">
      <div className="ml-auto w-full max-w-4xl bg-white shadow-2xl flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-teal-600 to-teal-700">
          <div>
            <h2 className="text-base font-semibold text-white">Lab Test Catalog</h2>
            <p className="text-teal-100 text-xs mt-0.5">{tests.length} tests configured · {tests.filter(t => t.isActive).length} active</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl">&times;</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Category sidebar */}
          <div className="w-44 border-r border-gray-100 bg-gray-50 overflow-y-auto flex-shrink-0">
            <div className="p-3">
              <button onClick={() => setActiveCategory('')}
                className={cn('w-full text-left px-3 py-2 rounded-lg text-sm font-medium mb-1 transition-colors',
                  activeCategory === '' ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-200')}>
                All Tests ({tests.length})
              </button>
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className={cn('w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors',
                    activeCategory === cat ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-200')}>
                  <span className="mr-1.5">{CATEGORY_ICONS[cat] || '🧫'}</span>
                  {cat}
                  <span className={cn('ml-1 text-xs', activeCategory === cat ? 'text-teal-100' : 'text-gray-400')}>
                    ({grouped[cat]?.length || 0})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Add form */}
            <div className="p-5 border-b border-gray-100 bg-white">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Add New Test</p>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 mb-3">{error}</div>}
              <form onSubmit={handleAdd} className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Test Name *</label>
                    <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Complete Blood Count"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Code *</label>
                    <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="e.g. CBC"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Category *</label>
                    <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
                      <option value="">Select category</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Unit</label>
                    <input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} placeholder="mg/dL"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Normal Range</label>
                    <input value={form.normalRange} onChange={e => setForm(p => ({ ...p, normalRange: e.target.value }))} placeholder="4.5–11.0"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Price (₹)</label>
                    <input type="number" min="0" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">TAT (hrs)</label>
                    <input type="number" min="1" value={form.turnaround} onChange={e => setForm(p => ({ ...p, turnaround: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                </div>
                <button type="submit" disabled={saving}
                  className="w-full py-2 text-sm bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-60">
                  {saving ? 'Adding…' : '+ Add Test'}
                </button>
              </form>
            </div>

            {/* Tests table */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading…</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Test</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Category</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Normal Range</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Price</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">TAT</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visibleTests.map(t => (
                      <tr key={t.id} className={cn('hover:bg-gray-50', !t.isActive && 'opacity-50')}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{t.name}</p>
                          <p className="text-xs text-gray-400">{t.code} {t.unit && `· ${t.unit}`}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          <span className="inline-flex items-center gap-1">
                            <span>{CATEGORY_ICONS[t.category] || '🧫'}</span>
                            {t.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{t.normalRange || '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">₹{t.price}</td>
                        <td className="px-4 py-3 text-right text-gray-500 text-xs">{t.turnaround}h</td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => toggleActive(t)}
                            className={cn('px-2 py-0.5 text-xs rounded-full font-medium transition-colors',
                              t.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
                            {t.isActive ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Order Detail Panel ─────────────────────────────────────────────────────────
function OrderDetailPanel({ order, onClose, onRefresh, canEdit }: {
  order: LabOrder; onClose: () => void; onRefresh: () => void; canEdit: boolean;
}) {
  const [showResults, setShowResults] = useState(false);
  const [actioning, setActioning] = useState(false);

  async function action(endpoint: string, body?: object) {
    setActioning(true);
    try {
      await appointmentApi.patch(`/lab/orders/${order.id}/${endpoint}`, body ?? {});
      onRefresh(); onClose();
    } finally { setActioning(false); }
  }

  const orderValue = order.items.reduce((s, i) => s + Number(i.labTest.price), 0);

  return (
    <>
      {showResults && (
        <ResultsModal order={order} onClose={() => setShowResults(false)}
          onSaved={() => { setShowResults(false); onRefresh(); onClose(); }} />
      )}
      <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-500">Lab Order</p>
            <h2 className="text-base font-bold text-gray-900">{order.orderNumber}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Patient</p>
            <p className="font-semibold text-gray-900">{order.patient.firstName} {order.patient.lastName}</p>
            <p className="text-sm text-gray-500">{order.patient.uhid} · {order.patient.phone}</p>
            <div className="flex gap-2 mt-2">
              <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[order.status])}>{STATUS_LABELS[order.status]}</span>
              <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', PRIORITY_STYLES[order.priority])}>{order.priority}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Ordered by</p>
              <p className="font-medium text-gray-900">Dr. {order.orderedBy.firstName} {order.orderedBy.lastName}</p>
            </div>
            {order.assignedTo && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Technician</p>
                <p className="font-medium text-gray-900">{order.assignedTo.firstName} {order.assignedTo.lastName}</p>
              </div>
            )}
          </div>

          <div className="bg-teal-50 rounded-xl p-3 flex items-center justify-between">
            <span className="text-xs text-teal-700 font-medium">Billing Amount</span>
            <span className="text-lg font-bold text-teal-800">₹{orderValue.toLocaleString('en-IN')}</span>
          </div>

          {order.clinicalNotes && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Clinical Notes</p>
              <p className="text-sm text-gray-700 bg-blue-50 rounded-lg px-3 py-2">{order.clinicalNotes}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tests ({order.items.length})</p>
            <div className="space-y-2">
              {order.items.map(item => (
                <div key={item.id} className="border border-gray-200 rounded-xl p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.labTest.name}</p>
                      <p className="text-xs text-gray-400">{item.labTest.code}</p>
                    </div>
                    <div className="text-right">
                      {item.result ? (
                        <div>
                          <p className={cn('text-sm font-semibold', item.flag ? FLAG_STYLES[item.flag] : 'text-gray-900')}>
                            {item.result} {item.unit}
                          </p>
                          {item.flag && <span className={cn('text-xs', FLAG_STYLES[item.flag])}>{item.flag}</span>}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Pending</span>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">₹{Number(item.labTest.price).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                  {item.normalRange && <p className="text-xs text-gray-400 mt-1">Normal: {item.normalRange}</p>}
                  {item.notes && <p className="text-xs text-gray-500 mt-1 italic">{item.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="p-4 border-t border-gray-100 space-y-2">
            {order.status === 'PENDING' && (
              <button onClick={() => action('collect-sample')} disabled={actioning}
                className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60">
                {actioning ? 'Processing…' : 'Mark Sample Collected'}
              </button>
            )}
            {order.status === 'SAMPLE_COLLECTED' && (
              <button onClick={() => action('start-processing')} disabled={actioning}
                className="w-full py-2 text-sm bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-60">
                {actioning ? 'Processing…' : 'Start Processing'}
              </button>
            )}
            {['SAMPLE_COLLECTED', 'IN_PROGRESS'].includes(order.status) && (
              <button onClick={() => setShowResults(true)}
                className="w-full py-2 text-sm bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700">
                Enter Results
              </button>
            )}
            {!['COMPLETED', 'CANCELLED'].includes(order.status) && (
              <button onClick={() => action('cancel')} disabled={actioning}
                className="w-full py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50">
                Cancel Order
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Analytics Tab ──────────────────────────────────────────────────────────────
function AnalyticsTab({ analytics, tests }: { analytics: Analytics | null; tests: LabTest[] }) {
  if (!analytics) return <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading analytics…</div>;

  const CATEGORIES = ['Haematology', 'Biochemistry', 'Microbiology', 'Serology', 'Urine Analysis', 'Radiology', 'Other'];
  const maxRevenue = Math.max(...Object.values(analytics.categoryBreakdown).map(c => c.revenue), 1);
  const maxOrders = Math.max(...Object.values(analytics.categoryBreakdown).map(c => c.orderCount), 1);

  return (
    <div className="space-y-6">
      {/* Top metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Orders (30d)', value: analytics.totalOrders, sub: `${analytics.completedOrders} completed`, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
          { label: 'Revenue (30d)', value: `₹${analytics.completedRevenue.toLocaleString('en-IN')}`, sub: 'from completed tests', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
          { label: 'Avg Turnaround', value: `${analytics.avgTurnaroundHours}h`, sub: 'order to completion', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
          { label: 'Critical Findings', value: `${analytics.criticalRate}%`, sub: `${analytics.criticalItems} critical items`, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
        ].map(m => (
          <div key={m.label} className={cn('rounded-xl border p-4', m.bg, m.border)}>
            <p className={cn('text-2xl font-bold', m.color)}>{m.value}</p>
            <p className="text-xs text-gray-600 font-medium mt-0.5">{m.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Category Performance</h3>
        <div className="space-y-3">
          {CATEGORIES.filter(cat => (analytics.categoryBreakdown[cat]?.testCount || 0) > 0 || tests.some(t => t.category === cat)).map(cat => {
            const data = analytics.categoryBreakdown[cat] || { orderCount: 0, revenue: 0, testCount: 0, activeTests: 0 };
            const catTests = tests.filter(t => t.category === cat);
            const revenueWidth = data.revenue > 0 ? Math.round((data.revenue / maxRevenue) * 100) : 0;
            const ordersWidth = data.orderCount > 0 ? Math.round((data.orderCount / maxOrders) * 100) : 0;
            return (
              <div key={cat} className="flex items-center gap-4">
                <div className="w-32 flex-shrink-0 flex items-center gap-2">
                  <span className="text-lg">{CATEGORY_ICONS[cat] || '🧫'}</span>
                  <div>
                    <p className="text-xs font-semibold text-gray-800 leading-tight">{cat}</p>
                    <p className="text-xs text-gray-400">{catTests.length} tests</p>
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${revenueWidth}%` }} />
                    </div>
                    <span className="text-xs text-gray-600 w-20 text-right">₹{data.revenue.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${ordersWidth}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 w-20 text-right">{data.orderCount} orders</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100">
          <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-2 bg-teal-500 rounded" />Revenue</span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-1.5 bg-blue-400 rounded" />Order volume</span>
        </div>
      </div>

      {/* Test catalog summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Catalog Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Tests', value: tests.length },
            { label: 'Active Tests', value: tests.filter(t => t.isActive).length },
            { label: 'Avg Price', value: `₹${tests.length > 0 ? Math.round(tests.reduce((s, t) => s + t.price, 0) / tests.length) : 0}` },
            { label: 'Revenue Potential/Visit', value: `₹${tests.filter(t => t.isActive).reduce((s, t) => s + t.price, 0).toLocaleString('en-IN')}` },
          ].map(m => (
            <div key={m.label} className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-gray-900">{m.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LabPage() {
  const { user } = useAuthStore();
  const role = user?.role ?? '';
  const canManageCatalog = ['ADMIN', 'LAB_TECHNICIAN'].includes(role);
  const canEdit = ['ADMIN', 'LAB_TECHNICIAN'].includes(role);

  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [tests, setTests] = useState<LabTest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [mainTab, setMainTab] = useState<'orders' | 'analytics'>('orders');
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');

  const CATEGORIES = ['Haematology', 'Biochemistry', 'Microbiology', 'Serology', 'Urine Analysis', 'Radiology', 'Other'];
  const STATUS_TABS = [
    { key: 'ALL', label: 'All' }, { key: 'PENDING', label: 'Pending' },
    { key: 'SAMPLE_COLLECTED', label: 'Sample Collected' }, { key: 'IN_PROGRESS', label: 'In Progress' },
    { key: 'COMPLETED', label: 'Completed' },
  ];

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [ordersRes, statsRes, testsRes, analyticsRes] = await Promise.all([
        appointmentApi.get(`/lab/orders${activeTab !== 'ALL' ? `?status=${activeTab}` : ''}`),
        appointmentApi.get('/lab/stats'),
        appointmentApi.get('/lab/tests?all=true'),
        canManageCatalog ? appointmentApi.get('/lab/analytics') : Promise.resolve({ data: null }),
      ]);
      setOrders(ordersRes.data?.data || ordersRes.data || []);
      setStats(statsRes.data);
      setTests(testsRes.data?.data || testsRes.data || []);
      if (analyticsRes.data) setAnalytics(analyticsRes.data);
    } catch { setOrders([]); } finally { setLoading(false); }
  }, [activeTab, canManageCatalog]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function fmtDate(iso?: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
  }

  const groupedTests = CATEGORIES.reduce<Record<string, LabTest[]>>((acc, cat) => {
    acc[cat] = tests.filter(t => t.category === cat);
    return acc;
  }, {});

  const filteredOrders = categoryFilter
    ? orders.filter(o => o.items.some(i => tests.find(t => t.id === i.labTestId)?.category === categoryFilter))
    : orders;

  return (
    <div className="flex gap-6 -mx-6 -mt-6 h-[calc(100vh-4rem)]">
      {/* ── Left Panel: Catalog ── */}
      <div className="w-64 flex-shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-white">
          <h1 className="text-sm font-bold text-gray-900">Laboratory</h1>
          <p className="text-xs text-gray-400 mt-0.5">{tests.filter(t => t.isActive).length} active tests configured</p>
          {canManageCatalog && (
            <button onClick={() => setShowCatalog(true)}
              className="mt-3 w-full py-2 px-3 text-xs bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition-colors flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Manage Test Catalog
            </button>
          )}
        </div>

        {/* Stats mini */}
        {stats && (
          <div className="p-3 border-b border-gray-200 grid grid-cols-2 gap-2">
            {[
              { label: 'Pending', value: stats.pending, color: 'text-yellow-700', bg: 'bg-yellow-50' },
              { label: 'In Progress', value: stats.inProgress, color: 'text-orange-700', bg: 'bg-orange-50' },
              { label: 'Collected', value: stats.sampleCollected, color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'Done Today', value: stats.completedToday, color: 'text-green-700', bg: 'bg-green-50' },
            ].map(s => (
              <div key={s.label} className={cn('rounded-lg p-2 text-center', s.bg)}>
                <p className={cn('text-lg font-bold leading-none', s.color)}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Category list */}
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Categories</p>
          <button onClick={() => setCategoryFilter('')}
            className={cn('w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition-colors flex items-center justify-between',
              categoryFilter === '' ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-200')}>
            <span>All Categories</span>
            <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', categoryFilter === '' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600')}>{tests.length}</span>
          </button>
          {CATEGORIES.filter(cat => (groupedTests[cat]?.length || 0) > 0).map(cat => {
            const catTests = groupedTests[cat] || [];
            const activeCount = catTests.filter(t => t.isActive).length;
            const avgPrice = catTests.length > 0 ? Math.round(catTests.reduce((s, t) => s + t.price, 0) / catTests.length) : 0;
            return (
              <button key={cat} onClick={() => setCategoryFilter(cat === categoryFilter ? '' : cat)}
                className={cn('w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-colors',
                  categoryFilter === cat ? 'bg-teal-600 text-white' : 'text-gray-700 hover:bg-gray-200')}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <span>{CATEGORY_ICONS[cat] || '🧫'}</span>
                    <span className="truncate">{cat}</span>
                  </span>
                  <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0',
                    categoryFilter === cat ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600')}>
                    {catTests.length}
                  </span>
                </div>
                <div className={cn('flex justify-between text-xs', categoryFilter === cat ? 'text-teal-100' : 'text-gray-400')}>
                  <span>{activeCount} active</span>
                  <span>avg ₹{avgPrice}</span>
                </div>
              </button>
            );
          })}
          {CATEGORIES.filter(cat => (groupedTests[cat]?.length || 0) === 0).length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-400 px-1 mb-1">Empty categories</p>
              {CATEGORIES.filter(cat => (groupedTests[cat]?.length || 0) === 0).map(cat => (
                <div key={cat} className="px-3 py-1.5 text-xs text-gray-400 flex items-center gap-1.5">
                  <span>{CATEGORY_ICONS[cat]}</span>{cat}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Main content ── */}
      <div className="flex-1 overflow-y-auto pt-6 pr-6 pb-6 min-w-0">
        {selectedOrder && (
          <OrderDetailPanel order={selectedOrder} onClose={() => setSelectedOrder(null)} onRefresh={fetchData} canEdit={canEdit} />
        )}
        {showCatalog && (
          <TestCatalogPanel onClose={() => setShowCatalog(false)} onSaved={fetchData} />
        )}

        {/* Revenue highlight if category selected */}
        {categoryFilter && analytics && (
          <div className="mb-5 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{CATEGORY_ICONS[categoryFilter]}</span>
              <div>
                <p className="text-sm font-semibold text-teal-900">Filtered: {categoryFilter}</p>
                <p className="text-xs text-teal-700">{(analytics.categoryBreakdown[categoryFilter]?.orderCount || 0)} orders · ₹{(analytics.categoryBreakdown[categoryFilter]?.revenue || 0).toLocaleString('en-IN')} revenue (30d)</p>
              </div>
            </div>
            <button onClick={() => setCategoryFilter('')} className="text-xs text-teal-600 hover:text-teal-800 underline">Clear filter</button>
          </div>
        )}

        {/* Main tabs */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {[{ key: 'orders', label: 'Orders' }, { key: 'analytics', label: 'Analytics' }].map(t => (
              <button key={t.key} onClick={() => setMainTab(t.key as 'orders' | 'analytics')}
                className={cn('px-4 py-1.5 text-sm font-medium rounded-lg transition-colors',
                  mainTab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={fetchData} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refresh
          </button>
        </div>

        {mainTab === 'analytics' ? (
          <AnalyticsTab analytics={analytics} tests={tests} />
        ) : (
          <>
            {/* Status filter tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 w-fit">
              {STATUS_TABS.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={cn('px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                    activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Orders table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>
              ) : filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
                  <span className="text-4xl">🔬</span>
                  <p className="text-sm">No lab orders{categoryFilter ? ` in ${categoryFilter}` : ''}</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Order #</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Patient</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Tests</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Value</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Doctor</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Time</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredOrders.map(order => {
                      const hasCritical = order.items.some(i => i.flag === 'CRITICAL');
                      const pendingCount = order.items.filter(i => !i.result).length;
                      const orderValue = order.items.reduce((s, i) => s + Number(i.labTest.price), 0);
                      return (
                        <tr key={order.id}
                          className={cn('hover:bg-gray-50 cursor-pointer transition-colors', hasCritical && 'bg-red-50 hover:bg-red-100')}
                          onClick={() => setSelectedOrder(order)}>
                          <td className="px-4 py-3">
                            <p className="font-mono text-xs font-semibold text-gray-800">{order.orderNumber}</p>
                            <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', PRIORITY_STYLES[order.priority])}>{order.priority}</span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{order.patient.firstName} {order.patient.lastName}</p>
                            <p className="text-xs text-gray-400">{order.patient.uhid}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-gray-700">{order.items.length} test{order.items.length !== 1 ? 's' : ''}</p>
                            {pendingCount > 0 && order.status !== 'PENDING' && (
                              <p className="text-xs text-orange-500">{pendingCount} results pending</p>
                            )}
                            {hasCritical && <p className="text-xs text-red-600 font-semibold">⚠ Critical</p>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <p className="font-semibold text-gray-900">₹{orderValue.toLocaleString('en-IN')}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">Dr. {order.orderedBy.firstName} {order.orderedBy.lastName}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(order.createdAt)}</td>
                          <td className="px-4 py-3">
                            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[order.status])}>
                              {STATUS_LABELS[order.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-blue-600 text-xs hover:underline">View →</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
