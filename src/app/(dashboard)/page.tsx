'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { appointmentApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

interface ActivePatient {
  id: string;
  tokenNumber: number;
  status: string;
  visitType: string;
  chiefComplaint?: string;
  registeredAt: string;
  patient: { firstName: string; lastName: string; uhid: string; phone: string; dob?: string; gender?: string };
  doctor: { firstName: string; lastName: string };
  department?: { name: string; code: string; color: string; icon: string };
  consultation?: { bpSystolic?: number; bpDiastolic?: number; pulseRate?: number };
}

interface Department {
  id: string;
  name: string;
  code: string;
  color: string;
  icon: string;
}

const STATUS_ORDER = ['REGISTERED', 'PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'];

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  REGISTERED:      { label: 'Registered',      bg: 'bg-slate-100',  text: 'text-slate-600',  dot: 'bg-slate-400' },
  PENDING_PAYMENT: { label: 'Pending Payment',  bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  CONFIRMED:       { label: 'Confirmed',        bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-400' },
  CHECKED_IN:      { label: 'Checked In',       bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  IN_PROGRESS:     { label: 'In Consultation',  bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
};

function age(dob?: string) {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export default function ActivePatientBoard() {
  const { user } = useAuthStore();
  const [patients, setPatients] = useState<ActivePatient[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDept, setFilterDept] = useState<string>('');
  const [filterVisit, setFilterVisit] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDoctor, setFilterDoctor] = useState<string>('');
  const [counts, setCounts] = useState({ registered: 0, confirmed: 0, inProgress: 0, completed: 0 });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchActive = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterDept) params.set('departmentId', filterDept);
      if (filterVisit) params.set('visitType', filterVisit);
      if (filterDoctor && user?.role !== 'DOCTOR') params.set('doctorId', filterDoctor);

      const res = await appointmentApi.get(`/appointments/active?${params}`);
      const data: ActivePatient[] = res.data || [];

      // Apply status filter client-side
      const filtered = filterStatus ? data.filter(p => p.status === filterStatus) : data;
      setPatients(filtered);

      setCounts({
        registered: data.filter(p => ['REGISTERED', 'PENDING_PAYMENT'].includes(p.status)).length,
        confirmed: data.filter(p => p.status === 'CONFIRMED').length,
        inProgress: data.filter(p => ['CHECKED_IN', 'IN_PROGRESS'].includes(p.status)).length,
        completed: 0,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterDept, filterVisit, filterStatus, filterDoctor, user]);

  const fetchDepts = async () => {
    try {
      const res = await appointmentApi.get('/departments');
      setDepartments(res.data || []);
    } catch {}
  };

  useEffect(() => {
    fetchDepts();
  }, []);

  useEffect(() => {
    fetchActive();
    intervalRef.current = setInterval(fetchActive, 20000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchActive]);

  const grouped = STATUS_ORDER.reduce<Record<string, ActivePatient[]>>((acc, s) => {
    acc[s] = patients.filter(p => p.status === s);
    return acc;
  }, {});

  const visibleGroups = filterStatus
    ? [[filterStatus, grouped[filterStatus] || []]] as [string, ActivePatient[]][]
    : STATUS_ORDER.filter(s => (grouped[s]?.length || 0) > 0).map(s => [s, grouped[s]] as [string, ActivePatient[]]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Active Patient Board</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {patients.length} active · auto-refreshes every 20s
          </p>
        </div>
        <button
          onClick={fetchActive}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Waiting to Pay', value: counts.registered, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Confirmed', value: counts.confirmed, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'In Consultation', value: counts.inProgress, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Total Today', value: patients.length, color: 'text-gray-700', bg: 'bg-gray-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        {/* Visit type */}
        {['', 'OPD', 'IPD'].map(v => (
          <button
            key={v}
            onClick={() => setFilterVisit(v)}
            className={`px-3 py-1.5 text-sm rounded-lg border font-medium transition-colors ${
              filterVisit === v
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
            }`}
          >
            {v || 'All Types'}
          </button>
        ))}

        <span className="w-px bg-gray-200 mx-1" />

        {/* Status filter */}
        {['', ...STATUS_ORDER].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 text-sm rounded-lg border font-medium transition-colors ${
              filterStatus === s
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            {s ? STATUS_CONFIG[s]?.label || s : 'All Statuses'}
          </button>
        ))}

        <span className="w-px bg-gray-200 mx-1" />

        {/* Department filter */}
        <select
          value={filterDept}
          onChange={e => setFilterDept(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white text-gray-600 focus:outline-none focus:border-blue-400"
        >
          <option value="">All Departments</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.icon} {d.name}</option>
          ))}
        </select>
      </div>

      {/* Patient cards grouped by status */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400">Loading...</div>
      ) : patients.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <p className="text-4xl mb-2">🏥</p>
          <p className="text-sm">No active patients right now</p>
        </div>
      ) : (
        <div className="space-y-6">
          {visibleGroups.map(([status, group]) => (
            <div key={status}>
              <div className="flex items-center gap-2 mb-3">
                <StatusBadge status={status} />
                <span className="text-sm text-gray-400">({group.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {group.map((p) => (
                  <PatientCard key={p.id} patient={p} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PatientCard({ patient: p }: { patient: ActivePatient }) {
  const router = useRouter();
  const patientAge = age(p.patient.dob);
  const canOpenConsultation = ['CHECKED_IN', 'IN_PROGRESS'].includes(p.status);

  return (
    <div
      onClick={canOpenConsultation ? () => router.push(`/consultation/${p.id}`) : undefined}
      className={`bg-white rounded-xl border p-4 transition-shadow
        ${p.status === 'IN_PROGRESS' ? 'border-green-300 ring-1 ring-green-200' : 'border-gray-200'}
        ${canOpenConsultation ? 'cursor-pointer hover:shadow-md hover:border-blue-300' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
            ${p.status === 'IN_PROGRESS' ? 'bg-green-100 text-green-700' :
              p.status === 'CHECKED_IN' ? 'bg-indigo-100 text-indigo-700' :
              'bg-blue-100 text-blue-700'}`}>
            #{p.tokenNumber}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">
              {p.patient.firstName} {p.patient.lastName}
            </p>
            <p className="text-xs text-gray-400">
              {p.patient.uhid}
              {patientAge && ` · ${patientAge}y`}
              {p.patient.gender && ` · ${p.patient.gender.toLowerCase()}`}
            </p>
          </div>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          p.visitType === 'IPD' ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700'
        }`}>{p.visitType}</span>
      </div>

      {p.department && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-sm">{p.department.icon}</span>
          <span className="text-xs text-gray-500">{p.department.name}</span>
        </div>
      )}

      <div className="text-xs text-gray-500 mb-2">
        Dr. {p.doctor.firstName} {p.doctor.lastName}
      </div>

      {p.chiefComplaint && (
        <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5 mb-2 truncate">
          {p.chiefComplaint}
        </p>
      )}

      {p.consultation && (p.consultation.bpSystolic || p.consultation.pulseRate) && (
        <div className="flex gap-3 text-xs text-gray-500 mt-1">
          {p.consultation.bpSystolic && (
            <span>BP: {p.consultation.bpSystolic}/{p.consultation.bpDiastolic}</span>
          )}
          {p.consultation.pulseRate && <span>Pulse: {p.consultation.pulseRate}</span>}
        </div>
      )}

      <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
        <StatusBadge status={p.status} />
        {canOpenConsultation ? (
          <span className="text-xs text-blue-500 font-medium">Open →</span>
        ) : (
          <span className="text-xs text-gray-400">
            {new Date(p.registeredAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  );
}
