'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { appointmentApi } from '@/lib/api';

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
  CONFIRMED: 'bg-blue-100 text-blue-700',
  CHECKED_IN: 'bg-yellow-100 text-yellow-700',
  IN_PROGRESS: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
};

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Waiting',
  CHECKED_IN: 'Checked In',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export default function DoctorQueuePage() {
  const router = useRouter();
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

  async function startConsultation(appt: QueueEntry) {
    setActionLoading(appt.id);
    try {
      if (appt.status === 'CONFIRMED') {
        await appointmentApi.post(`/appointments/${appt.id}/check-in`);
        await appointmentApi.post(`/appointments/${appt.id}/start`);
      } else if (appt.status === 'CHECKED_IN') {
        await appointmentApi.post(`/appointments/${appt.id}/start`);
      }
      router.push(`/consultation/${appt.id}`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to start consultation';
      showToast(msg, 'error');
      setActionLoading(null);
    }
  }

  async function checkIn(appt: QueueEntry) {
    setActionLoading(appt.id);
    try {
      await appointmentApi.post(`/appointments/${appt.id}/check-in`);
      showToast(`${appt.patient.firstName} checked in`);
      await fetchQueue();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Check-in failed', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  const age = (dob?: string) => {
    if (!dob) return '—';
    return `${Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000))}y`;
  };

  const [activeFilter, setActiveFilter] = useState<'waiting' | 'completed' | 'all' | null>(null);

  const active = appointments.filter(a => ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'].includes(a.status));
  const completed = appointments.filter(a => a.status === 'COMPLETED');

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
                  const order: Record<string, number> = { IN_PROGRESS: 0, CHECKED_IN: 1, CONFIRMED: 2, COMPLETED: 3 };
                  return (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.tokenNumber - b.tokenNumber;
                })
                .map((appt) => {
                  const isLoading = actionLoading === appt.id;
                  return (
                    <tr
                      key={appt.id}
                      className={
                        appt.status === 'IN_PROGRESS' ? 'bg-orange-50' :
                        appt.status === 'COMPLETED' ? 'opacity-60 bg-gray-50' :
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
                      <td className="px-4 py-3">
                        {appt.status === 'CONFIRMED' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => checkIn(appt)}
                              disabled={isLoading}
                              className="px-2.5 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 disabled:opacity-50 transition-colors"
                            >
                              {isLoading ? '…' : 'Check In'}
                            </button>
                            <button
                              onClick={() => startConsultation(appt)}
                              disabled={isLoading}
                              className="px-2.5 py-1 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              {isLoading ? '…' : 'Start →'}
                            </button>
                          </div>
                        )}
                        {appt.status === 'CHECKED_IN' && (
                          <button
                            onClick={() => startConsultation(appt)}
                            disabled={isLoading}
                            className="px-3 py-1 text-xs font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
                          >
                            {isLoading ? '…' : 'Start Consultation →'}
                          </button>
                        )}
                        {appt.status === 'IN_PROGRESS' && (
                          <button
                            onClick={() => router.push(`/consultation/${appt.id}`)}
                            className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                          >
                            Continue →
                          </button>
                        )}
                        {appt.status === 'COMPLETED' && (
                          <button
                            onClick={() => router.push(`/consultation/${appt.id}`)}
                            className="px-3 py-1 text-xs font-medium text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            View
                          </button>
                        )}
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
