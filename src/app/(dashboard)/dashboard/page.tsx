'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { appointmentApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ActivePatient {
  id: string; tokenNumber: number; status: string; visitType: string;
  chiefComplaint?: string; registeredAt: string;
  patient: { firstName: string; lastName: string; uhid: string; phone: string; dob?: string; gender?: string };
  doctor: { firstName: string; lastName: string };
  department?: { name: string; code: string; color: string; icon: string };
  consultation?: { bpSystolic?: number; bpDiastolic?: number; pulseRate?: number };
}
interface Department { id: string; name: string; code: string; color: string; icon: string }
interface AdminStats {
  today: { appointments: number; ipdAdmissions: number; labCompleted: number };
  ipd: { activeAdmissions: number; bedsOccupied: number; bedsTotal: number; occupancyRate: number };
  lab: { pending: number; inProgress: number; completedToday: number };
  revenue: { today: number; mtd: number; pendingAmount: number; pendingCount: number; byType: Record<string, number> };
  departmentLoad: Array<{ department: { id: string; name: string; icon: string; color: string }; count: number }>;
}

const STATUS_ORDER = ['REGISTERED', 'PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'];
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  REGISTERED:      { label: 'Registered',     bg: 'bg-slate-100',  text: 'text-slate-600',  dot: 'bg-slate-400' },
  PENDING_PAYMENT: { label: 'Pending Payment', bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  CONFIRMED:       { label: 'Confirmed',       bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-400' },
  CHECKED_IN:      { label: 'Checked In',      bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  IN_PROGRESS:     { label: 'In Consultation', bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
};

function age(dob?: string) {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}
function fmt(n: number) {
  return n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString('en-IN')}`;
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

// ── Admin Analytics Header ─────────────────────────────────────────────────────
function AdminAnalytics() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    appointmentApi.get('/stats/admin/dashboard')
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-pulse">
        {Array(8).fill(0).map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl" />
        ))}
      </div>
    );
  }
  if (!stats) return null;

  const invoiceTypes: Record<string, { label: string; color: string }> = {
    CONSULTATION: { label: 'Consultation', color: 'bg-blue-500' },
    LAB: { label: 'Lab Tests', color: 'bg-teal-500' },
    PHARMACY: { label: 'Pharmacy', color: 'bg-violet-500' },
    PROCEDURE: { label: 'Procedures', color: 'bg-orange-500' },
    PACKAGE: { label: 'Packages', color: 'bg-pink-500' },
  };

  const maxDeptCount = Math.max(...stats.departmentLoad.map(d => d.count), 1);
  const totalRevenueByType = Object.values(stats.revenue.byType).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5 mb-8">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today's OPD/IPD", value: stats.today.appointments, sub: `${stats.today.ipdAdmissions} new IPD admissions`, icon: '🏥', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', onClick: () => router.push('/appointments') },
          { label: 'Active IPD', value: stats.ipd.activeAdmissions, sub: `${stats.ipd.occupancyRate}% bed occupancy`, icon: '🛏️', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', onClick: () => router.push('/ipd') },
          { label: 'Revenue Today', value: fmt(stats.revenue.today), sub: `${fmt(stats.revenue.mtd)} this month`, icon: '💰', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', onClick: undefined },
          { label: 'Pending Billing', value: stats.revenue.pendingCount, sub: `${fmt(stats.revenue.pendingAmount)} outstanding`, icon: '⏳', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', onClick: undefined },
        ].map(card => (
          <div key={card.label}
            onClick={card.onClick}
            className={`rounded-xl border p-4 ${card.bg} ${card.border} ${card.onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}>
            <div className="flex items-start justify-between mb-2">
              <span className="text-2xl">{card.icon}</span>
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-sm text-gray-600 font-medium mt-0.5">{card.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Second row: beds, lab, revenue breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bed occupancy */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Bed Occupancy</h3>
            <button onClick={() => router.push('/rooms')} className="text-xs text-blue-500 hover:underline">Manage Rooms →</button>
          </div>
          <div className="flex items-end gap-3 mb-3">
            <p className="text-4xl font-bold text-gray-900">{stats.ipd.occupancyRate}%</p>
            <p className="text-sm text-gray-500 mb-1">{stats.ipd.bedsOccupied} / {stats.ipd.bedsTotal} beds</p>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all ${stats.ipd.occupancyRate >= 90 ? 'bg-red-500' : stats.ipd.occupancyRate >= 70 ? 'bg-orange-500' : 'bg-green-500'}`}
              style={{ width: `${stats.ipd.occupancyRate}%` }}
            />
          </div>
          <p className="text-xs text-gray-400">
            {stats.ipd.bedsTotal - stats.ipd.bedsOccupied} beds available · {stats.ipd.activeAdmissions} active admissions
          </p>
        </div>

        {/* Lab queue */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Lab Queue</h3>
            <button onClick={() => router.push('/lab')} className="text-xs text-teal-500 hover:underline">Open Lab →</button>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Pending', value: stats.lab.pending, color: 'bg-yellow-400', textColor: 'text-yellow-700' },
              { label: 'Processing', value: stats.lab.inProgress, color: 'bg-orange-400', textColor: 'text-orange-700' },
              { label: 'Done Today', value: stats.lab.completedToday, color: 'bg-green-400', textColor: 'text-green-700' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${item.color} flex-shrink-0`} />
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <span className={`text-sm font-bold ${item.textColor}`}>{item.value}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
            {stats.lab.pending + stats.lab.inProgress} tests in queue
          </div>
        </div>

        {/* Revenue by type */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Revenue Mix (MTD)</h3>
          {Object.keys(stats.revenue.byType).length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No paid invoices this month yet</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(stats.revenue.byType).sort(([, a], [, b]) => b - a).map(([type, amount]) => {
                const pct = totalRevenueByType > 0 ? Math.round((amount / totalRevenueByType) * 100) : 0;
                const cfg = invoiceTypes[type] || { label: type, color: 'bg-gray-400' };
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${cfg.color}`} />
                        <span className="text-gray-600">{cfg.label}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-gray-400">{pct}%</span>
                        <span className="font-semibold text-gray-900">{fmt(amount)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${cfg.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">Total: <span className="font-bold text-gray-900">{fmt(stats.revenue.mtd)}</span></p>
          </div>
        </div>
      </div>

      {/* Department load */}
      {stats.departmentLoad.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Department Load Today</h3>
            <span className="text-xs text-gray-400">{stats.today.appointments} total appointments</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {stats.departmentLoad.map(d => {
              const pct = Math.round((d.count / maxDeptCount) * 100);
              return (
                <div key={d.department.id} className="text-center">
                  <div className="relative w-14 h-14 mx-auto mb-2">
                    <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15" fill="none" stroke={d.department.color || '#6366f1'}
                        strokeWidth="3" strokeDasharray={`${pct * 0.942} 94.2`} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-base">{d.department.icon || '🏥'}</span>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{d.count}</p>
                  <p className="text-xs text-gray-500 leading-tight">{d.department.name}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Active Patient Board ────────────────────────────────────────────────────────
export default function ActivePatientBoard() {
  const { user } = useAuthStore();
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role ?? '');

  const [patients, setPatients] = useState<ActivePatient[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDept, setFilterDept] = useState<string>('');
  const [filterVisit, setFilterVisit] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [counts, setCounts] = useState({ registered: 0, confirmed: 0, inProgress: 0 });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchActive = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterDept) params.set('departmentId', filterDept);
      if (filterVisit) params.set('visitType', filterVisit);
      const res = await appointmentApi.get(`/appointments/active?${params}`);
      const data: ActivePatient[] = res.data || [];
      const filtered = filterStatus ? data.filter(p => p.status === filterStatus) : data;
      setPatients(filtered);
      setCounts({
        registered: data.filter(p => ['REGISTERED', 'PENDING_PAYMENT'].includes(p.status)).length,
        confirmed: data.filter(p => p.status === 'CONFIRMED').length,
        inProgress: data.filter(p => ['CHECKED_IN', 'IN_PROGRESS'].includes(p.status)).length,
      });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filterDept, filterVisit, filterStatus]);

  useEffect(() => {
    appointmentApi.get('/departments').then(r => setDepartments(r.data || [])).catch(() => {});
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
      {isAdmin && <AdminAnalytics />}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Active Patient Board</h1>
          <p className="text-sm text-gray-400 mt-0.5">{patients.length} active · auto-refreshes every 20s</p>
        </div>
        <button onClick={fetchActive} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Refresh</button>
      </div>

      {/* Quick counts */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Waiting to Pay', value: counts.registered, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Confirmed', value: counts.confirmed, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'In Consultation', value: counts.inProgress, color: 'text-green-600', bg: 'bg-green-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        {['', 'OPD', 'IPD'].map(v => (
          <button key={v} onClick={() => setFilterVisit(v)}
            className={`px-3 py-1.5 text-sm rounded-lg border font-medium transition-colors ${filterVisit === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
            {v || 'All Types'}
          </button>
        ))}
        <span className="w-px bg-gray-200 mx-1" />
        {['', ...STATUS_ORDER].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 text-sm rounded-lg border font-medium transition-colors ${filterStatus === s ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>
            {s ? STATUS_CONFIG[s]?.label || s : 'All Statuses'}
          </button>
        ))}
        <span className="w-px bg-gray-200 mx-1" />
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white text-gray-600 focus:outline-none focus:border-blue-400">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.icon} {d.name}</option>)}
        </select>
      </div>

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
                {group.map(p => <PatientCard key={p.id} patient={p} />)}
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
      className={`bg-white rounded-xl border p-4 transition-shadow ${p.status === 'IN_PROGRESS' ? 'border-green-300 ring-1 ring-green-200' : 'border-gray-200'} ${canOpenConsultation ? 'cursor-pointer hover:shadow-md hover:border-blue-300' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${p.status === 'IN_PROGRESS' ? 'bg-green-100 text-green-700' : p.status === 'CHECKED_IN' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
            #{p.tokenNumber}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{p.patient.firstName} {p.patient.lastName}</p>
            <p className="text-xs text-gray-400">
              {p.patient.uhid}{patientAge && ` · ${patientAge}y`}{p.patient.gender && ` · ${p.patient.gender.toLowerCase()}`}
            </p>
          </div>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.visitType === 'IPD' ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700'}`}>
          {p.visitType}
        </span>
      </div>
      {p.department && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-sm">{p.department.icon}</span>
          <span className="text-xs text-gray-500">{p.department.name}</span>
        </div>
      )}
      <div className="text-xs text-gray-500 mb-2">Dr. {p.doctor.firstName} {p.doctor.lastName}</div>
      {p.chiefComplaint && (
        <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5 mb-2 truncate">{p.chiefComplaint}</p>
      )}
      {p.consultation && (p.consultation.bpSystolic || p.consultation.pulseRate) && (
        <div className="flex gap-3 text-xs text-gray-500 mt-1">
          {p.consultation.bpSystolic && <span>BP: {p.consultation.bpSystolic}/{p.consultation.bpDiastolic}</span>}
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
