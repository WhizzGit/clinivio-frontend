'use client';
import { useState, useEffect, useCallback } from 'react';
import { appointmentApi } from '@/lib/api';
import { PatientHistoryDrawer } from '@/components/PatientHistoryDrawer';

interface ActivePatient {
  id: string;
  tokenNumber: number;
  status: string;
  visitType: string;
  chiefComplaint?: string;
  registeredAt: string;
  patient: { id: string; firstName: string; lastName: string; uhid: string; phone: string; dob?: string; gender?: string; bloodGroup?: string };
  doctor: { firstName: string; lastName: string };
  department?: { name: string; icon: string };
}

const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'INSURANCE', 'NEFT'];

export default function BillingCounterPage() {
  const [patients, setPatients] = useState<ActivePatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [selected, setSelected] = useState<ActivePatient | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [processing, setProcessing] = useState(false);
  const [search, setSearch] = useState('');
  const [historyPatient, setHistoryPatient] = useState<ActivePatient['patient'] | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      const res = await appointmentApi.get('/appointments/active?status=REGISTERED&status=PENDING_PAYMENT');
      setPatients(res.data || []);
      setFetchError(false);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
    const t = setInterval(fetchPending, 15000);
    return () => clearInterval(t);
  }, [fetchPending]);

  const confirmPayment = async () => {
    if (!selected || !amount) return;
    setProcessing(true);
    try {
      await appointmentApi.post(`/appointments/${selected.id}/confirm-payment`, {
        paymentMethod,
        amount: parseFloat(amount),
      });
      setSelected(null);
      setAmount('');
      setPaymentMethod('CASH');
      await fetchPending();
    } catch {
      alert('Payment confirmation failed');
    } finally {
      setProcessing(false);
    }
  };

  const filtered = patients.filter(p => {
    const q = search.toLowerCase();
    return (
      !q ||
      p.patient.firstName.toLowerCase().includes(q) ||
      p.patient.lastName.toLowerCase().includes(q) ||
      p.patient.uhid.toLowerCase().includes(q) ||
      p.patient.phone.includes(q)
    );
  });

  return (
    <div className="flex gap-6 h-full">
      {historyPatient && (
        <PatientHistoryDrawer patient={historyPatient} onClose={() => setHistoryPatient(null)} />
      )}
      {/* Patient Queue */}
      <div className="flex-1 min-w-0">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">Billing Counter</h1>
          <p className="text-sm text-gray-500">Select a patient to collect consultation fee</p>
        </div>

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, UHID, or phone..."
          className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">Loading...</div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-400">
            <p className="text-2xl">⚠️</p>
            <p className="text-sm text-gray-500">Could not reach appointment service</p>
            <button
              onClick={fetchPending}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <p className="text-3xl mb-2">✅</p>
            <p className="text-sm">No patients pending payment</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(p => (
              <button
                key={p.id}
                onClick={() => { setSelected(p); setAmount(''); }}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selected?.id === p.id
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-400'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-sm font-bold">
                      #{p.tokenNumber}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">
                        {p.patient.firstName} {p.patient.lastName}
                      </p>
                      <p className="text-xs text-gray-400">{p.patient.uhid} · {p.patient.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      p.visitType === 'IPD' ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700'
                    }`}>{p.visitType}</span>
                    <p className="text-xs text-gray-400 mt-1">
                      Dr. {p.doctor.firstName} {p.doctor.lastName}
                    </p>
                  </div>
                </div>
                {p.department && (
                  <p className="text-xs text-gray-500 mt-2 ml-13">
                    {p.department.icon} {p.department.name}
                    {p.chiefComplaint && ` · ${p.chiefComplaint}`}
                  </p>
                )}
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-400">
                    Registered {new Date(p.registeredAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setHistoryPatient(p.patient); }}
                    className="text-xs text-purple-600 hover:text-purple-800 font-medium px-2 py-0.5 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                  >
                    History
                  </button>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Payment Panel */}
      <div className="w-80 flex-shrink-0">
        <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-0">
          <h2 className="font-semibold text-gray-900 mb-4">Collect Payment</h2>

          {!selected ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <p className="text-3xl mb-2">👈</p>
              <p className="text-sm text-center">Select a patient from the queue to collect payment</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <p className="font-medium text-gray-900 text-sm">
                  {selected.patient.firstName} {selected.patient.lastName}
                </p>
                <p className="text-xs text-gray-500">{selected.patient.uhid}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Token #{selected.tokenNumber} · Dr. {selected.doctor.firstName} {selected.doctor.lastName}
                </p>
                {selected.department && (
                  <p className="text-xs text-gray-500">{selected.department.icon} {selected.department.name}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Amount (₹) *</label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`py-2 text-xs font-medium rounded-lg border transition-colors ${
                        paymentMethod === m
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={confirmPayment}
                disabled={!amount || processing}
                className="w-full py-3 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {processing ? 'Processing…' : `Confirm Payment · ₹${amount || '0'}`}
              </button>

              <button
                onClick={() => setSelected(null)}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
