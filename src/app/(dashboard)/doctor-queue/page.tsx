'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { appointmentApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

interface QueueEntry {
  id: string;
  tokenNumber: number;
  status: string;
  chiefComplaint?: string;
  scheduledAt?: string;
  registeredAt?: string;
  patient: { firstName: string; lastName: string; uhid: string; phone: string; gender: string; dob?: string };
  checkedInAt?: string;
}

interface QueueStatus {
  currentPatient: QueueEntry | null;
  waitingCount: number;
  completedCount: number;
  doctorId: string;
}

const STATUS_COLORS: Record<string, string> = {
  REGISTERED: 'bg-gray-100 text-gray-600',
  PENDING_PAYMENT: 'bg-purple-100 text-purple-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  CHECKED_IN: 'bg-yellow-100 text-yellow-700',
  IN_PROGRESS: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-green-100 text-green-700',
  SENT_TO_PHARMACY: 'bg-teal-100 text-teal-700',
  CANCELLED: 'bg-red-100 text-red-600',
};

const STATUS_LABELS: Record<string, string> = {
  REGISTERED: 'Registered',
  PENDING_PAYMENT: 'Pending Payment',
  CONFIRMED: 'Waiting',
  CHECKED_IN: 'Checked In',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  SENT_TO_PHARMACY: 'At Pharmacy',
  CANCELLED: 'Cancelled',
};

export default function DoctorQueuePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isNurse = user?.role === 'NURSE';
  const [queue, setQueue] = useState<QueueStatus | null>(null);
  const [appointments, setAppointments] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchQueue = async () => {
    try {
      const [queueRes, apptRes] = await Promise.all([
        appointmentApi.get('/appointments/queue/status'),
        appointmentApi.get('/appointments/doctor-queue'),
      ]);
      setQueue(queueRes.data);
      setAppointments(apptRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    intervalRef.current = setInterval(fetchQueue, 15000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // ── Doctor actions ──────────────────────────────────────────────────────────

  /** Check in (if needed) then start consultation and navigate */
  async function startConsultation(appt: QueueEntry) {
    if (['REGISTERED', 'PENDING_PAYMENT'].includes(appt.status)) {
      showToast('Payment must be confirmed before starting consultation', 'error');
      return;
    }
    setActionLoading(appt.id + '-start');
    try {
      if (appt.status === 'CONFIRMED') {
        await appointmentApi.post(`/appointments/${appt.id}/check-in`);
        await appointmentApi.post(`/appointments/${appt.id}/start`);
      } else if (appt.status === 'CHECKED_IN') {
        await appointmentApi.post(`/appointments/${appt.id}/start`);
      }
      router.push(`/consultation/${appt.id}`);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to start', 'error');
      setActionLoading(null);
    }
  }

  /** Reverse an accidental check-in — CHECKED_IN → CONFIRMED */
  async function undoCheckIn(appt: QueueEntry) {
    setActionLoading(appt.id + '-undo');
    try {
      await appointmentApi.post(`/appointments/${appt.id}/undo-check-in`);
      showToast(`Check-in reversed for ${appt.patient.firstName}`);
      await fetchQueue();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Could not undo check-in', 'error');
    } finally { setActionLoading(null); }
  }

  // ── Nurse actions ────────────────────────────────────────────────────────────

  /** Navigate to consultation page for vitals — does NOT change appointment status */
  function enterVitals(appt: QueueEntry) {
    router.push(`/consultation/${appt.id}`);
  }

  const age = (dob?: string) => {
    if (!dob) return '—';
    return `${Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000))}y`;
  };

  const [activeFilter, setActiveFilter] = useState<'waiting' | 'completed' | 'all' | null>(null);

  const active = appointments.filter(a => !['COMPLETED', 'SENT_TO_PHARMACY', 'CANCELLED'].includes(a.status));
  const completed = appointments.filter(a => ['COMPLETED', 'SENT_TO_PHARMACY'].includes(a.status));

  const filteredAppointments = activeFilter === 'waiting'
    ? active
    : activeFilter === 'completed'
    ? completed
    : appointments;

  const toggleFilter = (f: 'waiting' | 'completed' | 'all') => {
    setActiveFilter(prev => prev === f ? null : f);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading queue...</div>;
  }

  // ── Nurse view: all active patients today across all doctors ─────────────────
  if (isNurse) {
    const nurseActive    = appointments.filter(a => ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'].includes(a.status));
    const nurseCompleted = appointments.filter(a => a.status === 'COMPLETED');

    const STATUS_ROW_CLS: Record<string, string> = {
      CONFIRMED:   'bg-blue-50 hover:bg-blue-100',
      CHECKED_IN:  'bg-yellow-50 hover:bg-yellow-100',
      IN_PROGRESS: 'bg-orange-50 hover:bg-orange-100',
    };
    const STATUS_BADGE_CLS: Record<string, string> = {
      CONFIRMED:   'bg-blue-100 text-blue-700',
      CHECKED_IN:  'bg-yellow-100 text-yellow-700',
      IN_PROGRESS: 'bg-orange-100 text-orange-700',
    };

    return (
      <div>
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {toast.msg}
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Patient Queue — Vitals</h1>
            <p className="text-sm text-gray-500">All active patients today · auto-refreshes every 15 s</p>
          </div>
          <button onClick={fetchQueue} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Refresh
          </button>
        </div>

        {/* Summary chips */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Waiting',     count: appointments.filter(a => a.status === 'CONFIRMED').length,   color: 'bg-blue-50 text-blue-700'    },
            { label: 'Checked In',  count: appointments.filter(a => a.status === 'CHECKED_IN').length,  color: 'bg-yellow-50 text-yellow-700' },
            { label: 'In Progress', count: appointments.filter(a => a.status === 'IN_PROGRESS').length, color: 'bg-orange-50 text-orange-700' },
          ].map(s => (
            <div key={s.label} className={`${s.color} rounded-xl p-4`}>
              <p className="text-2xl font-bold">{s.count}</p>
              <p className="text-xs mt-0.5 opacity-80">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-medium text-gray-700">Active Patients ({nurseActive.length})</h2>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-400">Loading…</div>
          ) : nurseActive.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <p className="text-3xl mb-2">🏥</p>
              <p className="text-sm">No active patients today</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 w-16">Token</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Patient</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Doctor</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Complaint</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 w-32">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {nurseActive
                  .sort((a, b) => a.tokenNumber - b.tokenNumber)
                  .map(appt => (
                    <tr key={appt.id} className={`${STATUS_ROW_CLS[appt.status] ?? 'hover:bg-gray-50'} transition-colors`}>
                      <td className="px-4 py-3 font-mono font-bold text-gray-900">#{appt.tokenNumber}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{appt.patient?.firstName} {appt.patient?.lastName}</p>
                        <p className="text-xs text-gray-400">{appt.patient?.uhid} · {age(appt.patient?.dob)} · {appt.patient?.gender?.toLowerCase()}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {(appt as any).doctor ? `Dr. ${(appt as any).doctor.firstName} ${(appt as any).doctor.lastName}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE_CLS[appt.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABELS[appt.status] ?? appt.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{appt.chiefComplaint || '—'}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => enterVitals(appt)}
                          className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          📋 Vitals
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>

        {nurseCompleted.length > 0 && (
          <div className="mt-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-medium text-gray-500 text-sm">Completed Today ({nurseCompleted.length})</h2>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {nurseCompleted.sort((a, b) => a.tokenNumber - b.tokenNumber).map(appt => (
                  <tr key={appt.id} className="hover:bg-gray-50 text-gray-400">
                    <td className="px-4 py-2.5 font-mono text-xs w-16">#{appt.tokenNumber}</td>
                    <td className="px-4 py-2.5 text-xs">{appt.patient?.firstName} {appt.patient?.lastName}</td>
                    <td className="px-4 py-2.5 text-xs">{(appt as any).doctor ? `Dr. ${(appt as any).doctor.firstName} ${(appt as any).doctor.lastName}` : '—'}</td>
                    <td className="px-4 py-2.5"><span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Completed</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── Doctor / Admin view ───────────────────────────────────────────────────────
  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg transition-all ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Queue</h1>
          <p className="text-sm text-gray-500">Auto-refreshes every 15 seconds</p>
        </div>
        <button
          onClick={fetchQueue}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <button
          onClick={() => toggleFilter('waiting')}
          className={`rounded-xl border p-5 text-center transition-all cursor-pointer hover:shadow-md ${
            activeFilter === 'waiting'
              ? 'bg-orange-50 border-orange-400 ring-2 ring-orange-300'
              : 'bg-white border-gray-200 hover:border-orange-300'
          }`}
        >
          <p className="text-3xl font-bold text-orange-500">{queue?.waitingCount ?? active.length}</p>
          <p className="text-sm text-gray-500 mt-1">Waiting</p>
          {activeFilter === 'waiting' && <p className="text-xs text-orange-500 mt-1 font-medium">Filtered ×</p>}
        </button>
        <button
          onClick={() => toggleFilter('completed')}
          className={`rounded-xl border p-5 text-center transition-all cursor-pointer hover:shadow-md ${
            activeFilter === 'completed'
              ? 'bg-green-50 border-green-400 ring-2 ring-green-300'
              : 'bg-white border-gray-200 hover:border-green-300'
          }`}
        >
          <p className="text-3xl font-bold text-green-600">{queue?.completedCount ?? completed.length}</p>
          <p className="text-sm text-gray-500 mt-1">Completed Today</p>
          {activeFilter === 'completed' && <p className="text-xs text-green-500 mt-1 font-medium">Filtered ×</p>}
        </button>
        <button
          onClick={() => toggleFilter('all')}
          className={`rounded-xl border p-5 text-center transition-all cursor-pointer hover:shadow-md ${
            activeFilter === 'all' || activeFilter === null
              ? 'bg-white border-gray-200'
              : 'bg-white border-gray-200 hover:border-blue-300'
          }`}
        >
          <p className="text-3xl font-bold text-blue-600">{appointments.length}</p>
          <p className="text-sm text-gray-500 mt-1">Total Today</p>
          {activeFilter !== null && activeFilter !== 'all' && <p className="text-xs text-blue-500 mt-1 font-medium">Show all</p>}
        </button>
      </div>

      {queue?.currentPatient && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-orange-500 uppercase tracking-wide mb-1">Currently Consulting</p>
              <p className="text-xl font-bold text-gray-900">
                #{queue.currentPatient.tokenNumber} — {queue.currentPatient.patient.firstName} {queue.currentPatient.patient.lastName}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                {queue.currentPatient.patient.uhid} · {age(queue.currentPatient.patient.dob)} · {queue.currentPatient.patient.gender?.toLowerCase()}
              </p>
              {queue.currentPatient.chiefComplaint && (
                <p className="text-sm text-gray-600 mt-1">
                  <span className="font-medium">Complaint:</span> {queue.currentPatient.chiefComplaint}
                </p>
              )}
            </div>
            <button
              onClick={() => router.push(`/consultation/${queue.currentPatient!.id}`)}
              className="px-4 py-2 bg-orange-600 text-white text-sm font-semibold rounded-lg hover:bg-orange-700 transition-colors"
            >
              Resume Consultation →
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-medium text-gray-700">
            {activeFilter === 'waiting' ? 'Waiting Patients' : activeFilter === 'completed' ? 'Completed Today' : "Today's Queue"}
          </h2>
          <div className="flex items-center gap-2">
            {activeFilter && activeFilter !== 'all' && (
              <button
                onClick={() => setActiveFilter(null)}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Clear filter
              </button>
            )}
            {active.length > 0 && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{active.length} active</span>
            )}
          </div>
        </div>
        {filteredAppointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <p>{activeFilter ? 'No patients in this category' : 'No patients in queue today'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500 w-16">Token</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Patient</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Complaint</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 w-28">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 w-44">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAppointments
                .sort((a, b) => {
                  const order: Record<string, number> = { IN_PROGRESS: 0, CHECKED_IN: 1, CONFIRMED: 2, REGISTERED: 3, PENDING_PAYMENT: 4, SENT_TO_PHARMACY: 5, COMPLETED: 6 };
                  return (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.tokenNumber - b.tokenNumber;
                })
                .map((appt) => {
                  const busy = (suffix: string) => actionLoading === appt.id + suffix;
                  return (
                    <tr
                      key={appt.id}
                      className={
                        appt.status === 'IN_PROGRESS' ? 'bg-orange-50' :
                        appt.status === 'COMPLETED' || appt.status === 'SENT_TO_PHARMACY' ? 'opacity-60 bg-gray-50' :
                        'hover:bg-gray-50'
                      }
                    >
                      <td className="px-4 py-3 font-mono font-bold text-gray-900">#{appt.tokenNumber}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{appt.patient?.firstName} {appt.patient?.lastName}</p>
                        <p className="text-xs text-gray-400">{appt.patient?.uhid} · {age(appt.patient?.dob)} · {appt.patient?.gender?.toLowerCase()}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                        {appt.chiefComplaint || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[appt.status] || 'bg-gray-100 text-gray-500'}`}>
                          {STATUS_LABELS[appt.status] || appt.status}
                        </span>
                      </td>

                      {/* ── Doctor action buttons ─────────────────── */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {['REGISTERED', 'PENDING_PAYMENT'].includes(appt.status) && (
                            <span className="text-xs text-gray-400 italic">Awaiting payment</span>
                          )}
                          {appt.status === 'CONFIRMED' && (
                            <button onClick={() => startConsultation(appt)} disabled={busy('-start')}
                              className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                              {busy('-start') ? '…' : 'Check In + Start →'}
                            </button>
                          )}
                          {appt.status === 'CHECKED_IN' && (
                            <>
                              <button onClick={() => startConsultation(appt)} disabled={busy('-start')}
                                className="px-3 py-1 text-xs font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">
                                {busy('-start') ? '…' : 'Start →'}
                              </button>
                              <button onClick={() => undoCheckIn(appt)} disabled={busy('-undo')}
                                title="Reverse accidental check-in"
                                className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50">
                                {busy('-undo') ? '…' : '↩ Undo'}
                              </button>
                            </>
                          )}
                          {appt.status === 'IN_PROGRESS' && (
                            <button onClick={() => router.push(`/consultation/${appt.id}`)}
                              className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700">
                              Continue →
                            </button>
                          )}
                          {['COMPLETED', 'SENT_TO_PHARMACY'].includes(appt.status) && (
                            <button onClick={() => router.push(`/consultation/${appt.id}`)}
                              className="px-3 py-1 text-xs font-medium text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50">
                              View
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
