'use client';
import { useState, useEffect, useCallback } from 'react';
import { appointmentApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/components/ui/toaster';
import { generateLabReportHtml, generateSampleLabelHtml, printDocument } from '@/lib/print';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { STATUS_STYLES, STATUS_LABELS, FLAG_STYLES, PRIORITY_STYLES, BILLING_MODE_STYLES, CATEGORY_ICONS, fmtDate } from './constants';
import { useLabDashboard } from './hooks';
import PaymentModal from './PaymentModal';
import OrdersTab from './OrdersTab';
import BillingTab from './BillingTab';
import IPRequestsTab from './IPRequestsTab';
import ReportsTab from './ReportsTab';
import type { LabTest, LabOrderItem, LabOrder, LabReagent, Stats, Analytics } from './types';

// ── Outsource Modal ───────────────────────────────────────────────────────────
function OutsourceModal({ orderId, item, onClose, onSaved }: {
  orderId: string; item: LabOrderItem; onClose: () => void; onSaved: () => void;
}) {
  const [labName, setLabName] = useState('');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!labName.trim()) { setError('External lab name is required'); return; }
    setSaving(true);
    try {
      await appointmentApi.patch(`/lab/orders/${orderId}/items/${item.id}/outsource`, {
        externalLabName: labName.trim(),
        externalReference: reference.trim() || undefined,
      });
      onSaved(); onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Outsource to External Lab</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
            <p className="font-medium text-gray-900">{item.labTest.name}</p>
            <p className="text-xs text-gray-400">{item.labTest.code}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">External Lab Name *</label>
            <input required value={labName} onChange={e => setLabName(e.target.value)} placeholder="e.g. City Diagnostics"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Reference No. (optional)</label>
            <input value={reference} onChange={e => setReference(e.target.value)} placeholder="External sample ID"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 text-sm bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-60">
              {saving ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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
            <p className="text-xs text-gray-500">
              {order.patient ? `${order.patient.firstName} ${order.patient.lastName} · ${order.patient.uhid}` : (order.walkInName ?? 'Walk-in')}
            </p>
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
  const [showPayment, setShowPayment] = useState(false);
  const [outsourceItem, setOutsourceItem] = useState<LabOrderItem | null>(null);
  const [actioning, setActioning] = useState(false);
  const { tenantProfile } = useAuthStore();
  const { toast } = useToast();

  const patientName = order.patient
    ? `${order.patient.firstName} ${order.patient.lastName}`
    : (order.walkInName ?? 'Walk-in');
  const patientPhone = order.patient ? order.patient.phone : (order.walkInPhone ?? '');

  async function action(endpoint: string, body?: object) {
    setActioning(true);
    try {
      await appointmentApi.patch(`/lab/orders/${order.id}/${endpoint}`, body ?? {});
      onRefresh(); onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast({ title: 'Action failed', description: e?.response?.data?.message ?? 'Please try again', variant: 'destructive' });
    } finally { setActioning(false); }
  }

  function handlePrint() {
    const tenant = tenantProfile ?? { name: 'Hospital' };
    const completedItems = order.items.filter(i => i.result);
    const html = generateLabReportHtml({
      tenant,
      orderNumber: order.orderNumber,
      reportDate: order.completedAt ?? order.createdAt,
      patient: {
        firstName: order.patient?.firstName ?? order.walkInName ?? 'Walk-in',
        lastName: order.patient?.lastName ?? '',
        uhid: order.patient?.uhid ?? '—',
        phone: patientPhone,
      },
      doctor: {
        firstName: order.orderedBy.firstName,
        lastName: order.orderedBy.lastName,
      },
      priority: order.priority,
      sampleType: order.sampleType,
      collectedAt: order.collectedAt,
      completedAt: order.completedAt,
      clinicalNotes: order.clinicalNotes,
      items: completedItems.map(i => ({
        name: i.labTest.name,
        code: i.labTest.code,
        result: i.result!,
        unit: i.unit ?? i.labTest.unit,
        normalRange: i.normalRange ?? i.labTest.normalRange,
        flag: i.flag,
        notes: i.notes,
      })),
    });
    printDocument(html);
  }

  function handlePrintLabel() {
    if (!order.sampleLabelCode) return;
    const tenant = tenantProfile ?? { name: 'Hospital' };
    const html = generateSampleLabelHtml({
      tenant,
      orderNumber: order.orderNumber,
      sampleLabelCode: order.sampleLabelCode,
      patientName,
      patientUhid: order.patient?.uhid,
      collectedAt: order.collectedAt,
      priority: order.priority,
      testNames: order.items.map(i => i.labTest.name),
    });
    printDocument(html);
  }

  function handleWhatsApp() {
    if (!patientPhone) { toast({ title: 'No phone number on file', variant: 'destructive' }); return; }
    const phone = patientPhone.replace(/\D/g, '');
    const completedItems = order.items.filter(i => i.result);
    const hasCritical = completedItems.some(i => i.flag === 'CRITICAL');
    const summary = completedItems.map(i => `• ${i.labTest.name}: ${i.result} ${i.unit ?? ''} ${i.flag ? `(${i.flag})` : ''}`).join('\n');
    const msg = encodeURIComponent(
      `Dear ${patientName}, your lab report (Order ${order.orderNumber}) from ${tenantProfile?.name ?? 'our lab'} is ready.\n\nResults:\n${summary}${hasCritical ? '\n\n⚠ Critical values detected — please contact your doctor immediately.' : '\n\nFor any queries, please contact us.'}`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  }

  function handleEmail() {
    const completedItems = order.items.filter(i => i.result);
    const summary = completedItems.map(i => `${i.labTest.name}: ${i.result} ${i.unit ?? ''} (${i.flag ?? 'NORMAL'})`).join('\n');
    const subject = encodeURIComponent(`Lab Report - ${order.orderNumber} - ${patientName}`);
    const body = encodeURIComponent(
      `Dear ${patientName},\n\nYour lab report (Order: ${order.orderNumber}) is ready.\n\n${summary}\n\nFor any queries, please contact ${tenantProfile?.name ?? 'us'}.\n\nRegards,\n${tenantProfile?.name ?? 'Hospital'}`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  }

  const orderValue = order.items.reduce((s, i) => s + Number(i.labTest.price), 0);

  return (
    <>
      {showResults && (
        <ResultsModal order={order} onClose={() => setShowResults(false)}
          onSaved={() => { setShowResults(false); onRefresh(); onClose(); }} />
      )}
      {showPayment && (
        <PaymentModal order={order} onClose={() => setShowPayment(false)}
          onSaved={() => { setShowPayment(false); onRefresh(); }} />
      )}
      {outsourceItem && (
        <OutsourceModal orderId={order.id} item={outsourceItem}
          onClose={() => setOutsourceItem(null)}
          onSaved={() => { setOutsourceItem(null); onRefresh(); }} />
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
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {order.patient ? 'Patient' : 'Walk-in / Outsider'}
            </p>
            <p className="font-semibold text-gray-900">{patientName}{order.walkInAge ? `, ${order.walkInAge}y` : ''}</p>
            <p className="text-sm text-gray-500">{order.patient ? order.patient.uhid : 'No patient record'}{patientPhone ? ` · ${patientPhone}` : ''}</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[order.status])}>{STATUS_LABELS[order.status]}</span>
              <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', PRIORITY_STYLES[order.priority])}>{order.priority}</span>
              <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', BILLING_MODE_STYLES[order.billingMode])}>
                {order.billingMode === 'CREDIT' ? `IP · Credit${order.admission ? ` (${order.admission.admissionNumber})` : ''}` : 'Cash'}
              </span>
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
            <div>
              <span className="text-xs text-teal-700 font-medium">Billing Amount</span>
              {order.paymentStatus && (
                <span className={cn('ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full',
                  order.paymentStatus === 'PAID' ? 'bg-green-100 text-green-700' :
                  order.paymentStatus === 'WAIVED' ? 'bg-gray-100 text-gray-600' :
                  'bg-orange-100 text-orange-700')}>
                  {order.paymentStatus === 'PAID' ? '✓ Paid' : order.paymentStatus === 'WAIVED' ? 'Waived' : 'Unpaid'}
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-teal-800">₹{orderValue.toLocaleString('en-IN')}</span>
              {order.billingMode === 'CREDIT' ? (
                <p className="text-xs text-purple-600 mt-0.5">Billed to admission at discharge</p>
              ) : (
                canEdit && (!order.paymentStatus || order.paymentStatus === 'UNPAID') && (
                  <button onClick={() => setShowPayment(true)} className="block ml-auto mt-0.5 text-xs text-teal-700 hover:text-teal-900 underline">
                    Collect Payment
                  </button>
                )
              )}
            </div>
          </div>

          {order.sampleLabelCode && (
            <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Sample Label</p>
                <p className="font-mono text-sm font-semibold text-gray-900">{order.sampleLabelCode}</p>
              </div>
              <button onClick={handlePrintLabel} className="text-xs text-teal-700 hover:text-teal-900 underline">
                Print Label
              </button>
            </div>
          )}

          {(order.collectionSite || order.collectionMethod) && (
            <div className="text-xs text-gray-500 flex gap-3">
              {order.collectionSite && <span>Site: {order.collectionSite}</span>}
              {order.collectionMethod && <span>Method: {order.collectionMethod}</span>}
            </div>
          )}

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
                  {item.isOutsourced ? (
                    <p className="text-xs text-blue-600 mt-1">
                      External: {item.externalLabName}
                      {item.externalReference && ` · Ref: ${item.externalReference}`}
                    </p>
                  ) : (canEdit && !item.result && (
                    <button onClick={() => setOutsourceItem(item)} className="mt-1 text-xs text-gray-400 hover:text-teal-600 underline">
                      Send to External Lab
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {(canEdit || order.status === 'COMPLETED') && (
          <div className="p-4 border-t border-gray-100 space-y-2">
            {canEdit && order.status === 'PENDING' && (
              <button onClick={() => action('sample-collected')} disabled={actioning}
                className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60">
                {actioning ? 'Processing…' : 'Mark Sample Collected'}
              </button>
            )}
            {canEdit && order.status === 'SAMPLE_COLLECTED' && (
              <button onClick={() => action('processing')} disabled={actioning}
                className="w-full py-2 text-sm bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-60">
                {actioning ? 'Processing…' : 'Start Processing'}
              </button>
            )}
            {canEdit && ['SAMPLE_COLLECTED', 'IN_PROGRESS'].includes(order.status) && (
              <button onClick={() => setShowResults(true)}
                className="w-full py-2 text-sm bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700">
                Enter Results
              </button>
            )}
            {canEdit && !['COMPLETED', 'CANCELLED'].includes(order.status) && (
              <button onClick={() => action('cancel')} disabled={actioning}
                className="w-full py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50">
                Cancel Order
              </button>
            )}
            {order.status === 'COMPLETED' && (
              <>
                <button onClick={handlePrint}
                  className="w-full py-2 text-sm bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-900 flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  Print Lab Report
                </button>
                <div className="flex gap-2">
                  <button onClick={handleWhatsApp}
                    className="flex-1 py-2 text-sm bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 flex items-center justify-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    WhatsApp
                  </button>
                  <button onClick={handleEmail}
                    className="flex-1 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    Email
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Analytics Tab ──────────────────────────────────────────────────────────────
function AnalyticsTab({ analytics, tests }: { analytics: Analytics | null; tests: LabTest[] }) {
  const { data: dashboard } = useLabDashboard(30);

  if (!analytics) return <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading analytics…</div>;

  const CATEGORIES = ['Haematology', 'Biochemistry', 'Microbiology', 'Serology', 'Urine Analysis', 'Radiology', 'Other'];
  const breakdown = analytics.categoryBreakdown ?? {};
  const maxRevenue = Math.max(...Object.values(breakdown).map(c => c.revenue), 1);
  const maxOrders = Math.max(...Object.values(breakdown).map(c => c.orderCount), 1);

  return (
    <div className="space-y-6">
      {/* Top metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Orders (30d)', value: analytics.totalOrders ?? 0, sub: `${analytics.completedOrders ?? 0} completed`, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
          { label: 'Revenue (30d)', value: `₹${(analytics.completedRevenue ?? 0).toLocaleString('en-IN')}`, sub: 'from completed tests', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
          { label: 'Avg Turnaround', value: `${analytics.avgTurnaroundHours ?? 0}h`, sub: 'order to completion', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
          { label: 'Critical Findings', value: `${analytics.criticalRate ?? 0}%`, sub: `${analytics.criticalItems ?? 0} critical items`, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
        ].map(m => (
          <div key={m.label} className={cn('rounded-xl border p-4', m.bg, m.border)}>
            <p className={cn('text-2xl font-bold', m.color)}>{m.value}</p>
            <p className="text-xs text-gray-600 font-medium mt-0.5">{m.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Daily trend */}
      {dashboard && dashboard.daily.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-gray-900">Daily Orders & Revenue</h3>
            <p className="text-xs text-gray-500">{dashboard.completionRate}% completion rate · {dashboard.lowReagentCount} reagents low</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dashboard.daily} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip />
              <Line type="monotone" dataKey="orders" stroke="#0d9488" strokeWidth={2} dot={false} name="Orders" />
              <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={false} name="Revenue (₹)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Category Performance</h3>
        <div className="space-y-3">
          {CATEGORIES.filter(cat => (breakdown[cat]?.testCount || 0) > 0 || tests.some(t => t.category === cat)).map(cat => {
            const data = breakdown[cat] || { orderCount: 0, revenue: 0, testCount: 0, activeTests: 0 };
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
            { label: 'Avg Price', value: `₹${tests.length > 0 ? Math.round(tests.reduce((s, t) => s + Number(t.price), 0) / tests.length) : 0}` },
            { label: 'Revenue Potential/Visit', value: `₹${tests.filter(t => t.isActive).reduce((s, t) => s + Number(t.price), 0).toLocaleString('en-IN')}` },
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

// ── Reagents Tab ──────────────────────────────────────────────────────────────
function ReagentsTab({ canEdit }: { canEdit: boolean }) {
  const [reagents, setReagents] = useState<LabReagent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<LabReagent | null>(null);
  const [usageModal, setUsageModal] = useState<LabReagent | null>(null);
  const EMPTY_FORM = { name: '', unit: 'mL', currentQty: '0', reorderLevel: '10', unitCost: '0', manufacturer: '', batchNo: '', expiryDate: '' };
  const [form, setForm] = useState(EMPTY_FORM);
  const [usageForm, setUsageForm] = useState({ quantity: '1', type: 'USE' as 'USE' | 'RESTOCK' | 'DISCARD', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await appointmentApi.get('/lab/reagents');
      setReagents(Array.isArray(res.data) ? res.data : []);
    } catch { setReagents([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openEdit(r: LabReagent) {
    setEditItem(r);
    setForm({ name: r.name, unit: r.unit, currentQty: r.currentQty, reorderLevel: r.reorderLevel, unitCost: r.unitCost, manufacturer: r.manufacturer ?? '', batchNo: r.batchNo ?? '', expiryDate: r.expiryDate ?? '' });
    setShowAdd(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, currentQty: parseFloat(form.currentQty), reorderLevel: parseFloat(form.reorderLevel), unitCost: parseFloat(form.unitCost) };
      if (editItem) { await appointmentApi.patch(`/lab/reagents/${editItem.id}`, payload); }
      else { await appointmentApi.post('/lab/reagents', payload); }
      setShowAdd(false); setEditItem(null); setForm(EMPTY_FORM); load();
    } catch { } finally { setSaving(false); }
  }

  async function handleLogUsage(e: React.FormEvent) {
    e.preventDefault();
    if (!usageModal) return;
    setSaving(true);
    try {
      await appointmentApi.post(`/lab/reagents/${usageModal.id}/usage`, {
        quantity: parseFloat(usageForm.quantity), type: usageForm.type,
        notes: usageForm.notes || undefined,
      });
      setUsageModal(null); setUsageForm({ quantity: '1', type: 'USE', notes: '' }); load();
    } catch { } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Chemical Reagents</h2>
          <p className="text-xs text-gray-500">Track reagent stock and log usage per session</p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditItem(null); setForm(EMPTY_FORM); setShowAdd(true); }}
            className="px-3 py-1.5 text-xs bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 flex items-center gap-1.5">
            + Add Reagent
          </button>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editItem ? 'Edit Reagent' : 'Add Reagent'}</h2>
              <button onClick={() => { setShowAdd(false); setEditItem(null); }} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Reagent Name *</label>
                <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. HbA1c Reagent Kit"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
                  <input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} placeholder="mL / strips / vials"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Unit Cost (₹)</label>
                  <input type="number" step="0.01" min="0" value={form.unitCost} onChange={e => setForm(p => ({ ...p, unitCost: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Current Qty</label>
                  <input type="number" step="0.01" min="0" value={form.currentQty} onChange={e => setForm(p => ({ ...p, currentQty: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Reorder Level</label>
                  <input type="number" step="0.01" min="0" value={form.reorderLevel} onChange={e => setForm(p => ({ ...p, reorderLevel: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Batch No.</label>
                  <input value={form.batchNo} onChange={e => setForm(p => ({ ...p, batchNo: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Expiry Date</label>
                  <input type="date" value={form.expiryDate} onChange={e => setForm(p => ({ ...p, expiryDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Manufacturer</label>
                <input value={form.manufacturer} onChange={e => setForm(p => ({ ...p, manufacturer: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowAdd(false); setEditItem(null); }} className="flex-1 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 text-sm bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-60">
                  {saving ? 'Saving…' : editItem ? 'Update' : 'Add Reagent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Usage Log Modal */}
      {usageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm">Log Usage — {usageModal.name}</h2>
              <button onClick={() => setUsageModal(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <form onSubmit={handleLogUsage} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['USE', 'RESTOCK', 'DISCARD'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setUsageForm(p => ({ ...p, type: t }))}
                      className={`py-2 text-xs rounded-lg border transition-colors ${usageForm.type === t ? 'bg-teal-600 text-white border-teal-600' : 'text-gray-600 border-gray-300 hover:border-teal-400'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Quantity ({usageModal.unit})</label>
                <input type="number" step="0.01" min="0.01" required value={usageForm.quantity} onChange={e => setUsageForm(p => ({ ...p, quantity: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
                <input value={usageForm.notes} onChange={e => setUsageForm(p => ({ ...p, notes: e.target.value }))} placeholder="Test session, lot number, reason…"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setUsageModal(null)} className="flex-1 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 text-sm bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-60">
                  {saving ? 'Saving…' : 'Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reagent list */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading reagents…</div>
      ) : reagents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <p className="text-3xl mb-2">🧪</p>
          <p className="text-sm">No reagents configured yet</p>
          {canEdit && <button onClick={() => setShowAdd(true)} className="mt-3 px-4 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700">Add first reagent</button>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Reagent</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Reorder At</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Expiry</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                {canEdit && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {reagents.map(r => {
                const qty = parseFloat(r.currentQty);
                const reorder = parseFloat(r.reorderLevel);
                const isLow = qty <= reorder;
                const expDate = r.expiryDate ? new Date(r.expiryDate) : null;
                const isExpiring = expDate && expDate < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
                return (
                  <tr key={r.id} className={`hover:bg-gray-50 ${isLow ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{r.name}</p>
                      {r.manufacturer && <p className="text-xs text-gray-400">{r.manufacturer}{r.batchNo ? ` · Batch: ${r.batchNo}` : ''}</p>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>{qty.toFixed(1)} {r.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">{reorder.toFixed(1)}</td>
                    <td className="px-4 py-3 text-xs">
                      {expDate ? (
                        <span className={isExpiring ? 'text-amber-600 font-medium' : 'text-gray-500'}>
                          {expDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}{isExpiring ? ' ⚠' : ''}
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isLow ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {isLow ? 'Low Stock' : 'OK'}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => setUsageModal(r)} className="text-xs text-teal-600 hover:text-teal-800 font-medium">Log</button>
                          <button onClick={() => openEdit(r)} className="text-xs text-gray-500 hover:text-gray-700">Edit</button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LabPage() {
  const { user } = useAuthStore();
  const role = user?.role ?? '';
  const canManageCatalog = ['ADMIN', 'NURSE'].includes(role);
  const canEdit = ['ADMIN', 'NURSE', 'DOCTOR'].includes(role);

  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [tests, setTests] = useState<LabTest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [mainTab, setMainTab] = useState<'orders' | 'billing' | 'ip' | 'catalog' | 'reports' | 'analytics'>('orders');
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');

  const CATEGORIES = ['Haematology', 'Biochemistry', 'Microbiology', 'Serology', 'Urine Analysis', 'Radiology', 'Other'];

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch all orders (filter client-side) and tests in parallel.
      // Analytics is fetched separately so a 403 doesn't break the main data.
      const [ordersRes, testsRes] = await Promise.all([
        appointmentApi.get('/lab/orders?limit=200'),
        appointmentApi.get('/lab/tests?all=true'),
      ]);
      const fetchedOrders: LabOrder[] = ordersRes.data?.data || ordersRes.data || [];
      setOrders(fetchedOrders);
      setTests(testsRes.data?.data || testsRes.data || []);

      // Compute mini stats from the orders list
      const today = new Date(); today.setHours(0, 0, 0, 0);
      setStats({
        pending: fetchedOrders.filter(o => o.status === 'PENDING').length,
        sampleCollected: fetchedOrders.filter(o => o.status === 'SAMPLE_COLLECTED').length,
        inProgress: fetchedOrders.filter(o => o.status === 'IN_PROGRESS').length,
        completedToday: fetchedOrders.filter(o => o.status === 'COMPLETED' && !!o.completedAt && new Date(o.completedAt) >= today).length,
        total: fetchedOrders.length,
      });
    } catch { setOrders([]); } finally { setLoading(false); }
  }, []);

  // Analytics fetch is separate and ADMIN/LAB_TECHNICIAN/DOCTOR/NURSE accessible.
  // It does not block the main data load.
  useEffect(() => {
    appointmentApi.get('/lab/analytics')
      .then(res => setAnalytics(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const groupedTests = CATEGORIES.reduce<Record<string, LabTest[]>>((acc, cat) => {
    acc[cat] = tests.filter(t => t.category === cat);
    return acc;
  }, {});

  const filteredOrders = orders
    .filter(o => activeTab === 'ALL' || o.status === activeTab)
    .filter(o => !categoryFilter || o.items.some(i => tests.find(t => t.id === i.labTestId)?.category === categoryFilter));

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
            const avgPrice = catTests.length > 0 ? Math.round(catTests.reduce((s, t) => s + Number(t.price), 0) / catTests.length) : 0;
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
                <p className="text-xs text-teal-700">{(analytics.categoryBreakdown?.[categoryFilter]?.orderCount || 0)} orders · ₹{(analytics.categoryBreakdown?.[categoryFilter]?.revenue || 0).toLocaleString('en-IN')} revenue (30d)</p>
              </div>
            </div>
            <button onClick={() => setCategoryFilter('')} className="text-xs text-teal-600 hover:text-teal-800 underline">Clear filter</button>
          </div>
        )}

        {/* Main tabs */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {[
              { key: 'orders', label: 'Orders' },
              { key: 'billing', label: 'Billing' },
              { key: 'ip', label: 'IP Requests' },
              { key: 'catalog', label: 'Catalog & Reagents' },
              { key: 'reports', label: 'Reports' },
              { key: 'analytics', label: 'Analytics' },
            ].map(t => (
              <button key={t.key} onClick={() => setMainTab(t.key as typeof mainTab)}
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
        ) : mainTab === 'catalog' ? (
          <ReagentsTab canEdit={canEdit} />
        ) : mainTab === 'billing' ? (
          <BillingTab onSelectOrder={setSelectedOrder} />
        ) : mainTab === 'ip' ? (
          <IPRequestsTab onSelectOrder={setSelectedOrder} />
        ) : mainTab === 'reports' ? (
          <ReportsTab onSelectOrder={setSelectedOrder} />
        ) : (
          <OrdersTab
            orders={filteredOrders}
            loading={loading}
            activeTab={activeTab}
            onActiveTabChange={setActiveTab}
            categoryFilter={categoryFilter}
            onSelectOrder={setSelectedOrder}
          />
        )}
      </div>
    </div>
  );
}
