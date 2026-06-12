'use client';
import { useState, useEffect, useCallback } from 'react';
import { appointmentApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';

interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  userEmail: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string;
  success: boolean;
  createdAt: string;
}

interface AuditResponse {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ── Display maps ──────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  PAYMENT:            'Payment Collected',
  CREATE:             'Created',
  UPDATE:             'Updated',
  DELETE:             'Deleted',
  CANCEL:             'Cancelled',
  CHECK_IN:           'Checked In',
  UNDO_CHECK_IN:      'Check-in Reversed',
  START_CONSULTATION: 'Consultation Started',
  COMPLETE:           'Consultation Completed',
  SEND_TO_PHARMACY:   'Sent to Pharmacy',
  DISCHARGE:          'Discharged',
  DISPENSE:           'Dispensed',
  CHANGE_PASSWORD:    'Password Changed',
  STATUS_CHANGE:      'Status Changed',
  SAVE:               'Saved',
};

const ACTION_COLORS: Record<string, string> = {
  PAYMENT:            'bg-green-100 text-green-700',
  CREATE:             'bg-blue-100 text-blue-700',
  UPDATE:             'bg-amber-100 text-amber-700',
  DELETE:             'bg-red-100 text-red-700',
  CANCEL:             'bg-red-100 text-red-700',
  CHECK_IN:           'bg-indigo-100 text-indigo-700',
  UNDO_CHECK_IN:      'bg-slate-100 text-slate-600',
  START_CONSULTATION: 'bg-teal-100 text-teal-700',
  COMPLETE:           'bg-emerald-100 text-emerald-700',
  SEND_TO_PHARMACY:   'bg-cyan-100 text-cyan-700',
  DISCHARGE:          'bg-purple-100 text-purple-700',
  DISPENSE:           'bg-lime-100 text-lime-700',
  CHANGE_PASSWORD:    'bg-orange-100 text-orange-700',
  STATUS_CHANGE:      'bg-violet-100 text-violet-700',
  SAVE:               'bg-sky-100 text-sky-700',
};

const ENTITY_LABELS: Record<string, string> = {
  Appointment:  'Appointment',
  Patient:      'Patient',
  Invoice:      'Invoice',
  LabOrder:     'Lab Order',
  IpdAdmission: 'IPD Admission',
  PharmacyOrder:'Pharmacy',
  Prescription: 'Prescription',
  FollowUp:     'Follow-up',
  Consultation: 'Consultation',
  User:         'Staff User',
  DoctorSlot:   'Schedule',
  Department:   'Department',
  Tenant:       'Hospital Profile',
};

const ALL_ACTIONS = Object.keys(ACTION_LABELS);
const ALL_ENTITIES = Object.keys(ENTITY_LABELS);

function ActionBadge({ action, success }: { action: string; success: boolean }) {
  const color = success ? (ACTION_COLORS[action] ?? 'bg-gray-100 text-gray-600') : 'bg-red-100 text-red-700';
  const label = ACTION_LABELS[action] ?? action;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${color}`}>
      {!success && <span className="text-red-500">✗</span>}
      {label}
    </span>
  );
}

function DetailPanel({ log }: { log: AuditLog }) {
  const hasAfter  = log.after  && Object.keys(log.after).length  > 0;
  const hasBefore = log.before && Object.keys(log.before).length > 0;
  const hasMeta   = log.metadata && Object.keys(log.metadata).length > 0;

  if (!hasAfter && !hasBefore && !hasMeta) return null;

  return (
    <div className="mt-2 space-y-1.5 bg-gray-50 rounded-lg p-3 text-xs font-mono text-gray-600 max-h-48 overflow-y-auto">
      {hasBefore && (
        <div>
          <span className="text-gray-400 font-sans font-medium not-italic">Before:</span>
          <pre className="whitespace-pre-wrap break-all mt-0.5">{JSON.stringify(log.before, null, 2)}</pre>
        </div>
      )}
      {hasAfter && (
        <div>
          <span className="text-gray-400 font-sans font-medium not-italic">{hasBefore ? 'After:' : 'Changes:'}</span>
          <pre className="whitespace-pre-wrap break-all mt-0.5">{JSON.stringify(log.after, null, 2)}</pre>
        </div>
      )}
      {hasMeta && (
        <div>
          <span className="text-gray-400 font-sans font-medium not-italic">Context:</span>
          <pre className="whitespace-pre-wrap break-all mt-0.5">{JSON.stringify(log.metadata, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function LogRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = log.after || log.before || log.metadata;
  const entityLabel = ENTITY_LABELS[log.entityType] ?? log.entityType;

  return (
    <div className={`border-b border-gray-100 px-5 py-3.5 hover:bg-gray-50/50 transition-colors ${!log.success ? 'bg-red-50/30' : ''}`}>
      <div className="flex items-start gap-4">
        {/* Timestamp */}
        <div className="w-36 flex-shrink-0 text-xs text-gray-400 pt-0.5">
          <p>{new Date(log.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
          <p>{new Date(log.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
        </div>

        {/* Action + Entity */}
        <div className="w-52 flex-shrink-0 space-y-1">
          <ActionBadge action={log.action} success={log.success} />
          <p className="text-xs text-gray-500">{entityLabel}{log.entityId && <span className="text-gray-300 ml-1">· {log.entityId.slice(0, 8)}…</span>}</p>
        </div>

        {/* Description */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 leading-snug">{log.description || '—'}</p>
          {log.userEmail && (
            <p className="text-xs text-gray-400 mt-0.5">
              {log.userEmail}
              {log.userRole && <span className="ml-1 text-gray-300">({log.userRole})</span>}
            </p>
          )}
          {expanded && <DetailPanel log={log} />}
        </div>

        {/* IP + expand */}
        <div className="flex-shrink-0 text-right space-y-1">
          {log.ipAddress && <p className="text-xs text-gray-300 font-mono">{log.ipAddress}</p>}
          {hasDetail && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-xs text-blue-500 hover:text-blue-700 font-medium"
            >
              {expanded ? 'Hide' : 'Details'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [filterAction, setFilterAction]     = useState('');
  const [filterEntity, setFilterEntity]     = useState('');
  const [filterFrom, setFilterFrom]         = useState('');
  const [filterTo, setFilterTo]             = useState('');
  const [filterSuccess, setFilterSuccess]   = useState('');

  // Admin-only guard
  useEffect(() => {
    if (user && !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const fetchLogs = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '50' });
      if (filterAction) params.set('action', filterAction);
      if (filterEntity) params.set('entityType', filterEntity);
      if (filterFrom)   params.set('from', filterFrom);
      if (filterTo)     params.set('to', filterTo + 'T23:59:59');
      const res = await appointmentApi.get<AuditResponse>(`/audit-logs?${params}`);
      setLogs(res.data.data);
      setTotal(res.data.total);
      setPages(res.data.pages);
      setPage(p);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filterAction, filterEntity, filterFrom, filterTo]);

  useEffect(() => { fetchLogs(1); }, [fetchLogs]);

  const visibleLogs = filterSuccess === 'failed'
    ? logs.filter(l => !l.success)
    : filterSuccess === 'ok'
    ? logs.filter(l => l.success)
    : logs;

  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    return null;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Audit Trail</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Complete history of all changes · {total.toLocaleString()} entries
          </p>
        </div>
        <button
          onClick={() => fetchLogs(page)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          >
            <option value="">All actions</option>
            {ALL_ACTIONS.map(a => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Entity Type</label>
          <select
            value={filterEntity}
            onChange={e => setFilterEntity(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          >
            <option value="">All types</option>
            {ALL_ENTITIES.map(e => <option key={e} value={e}>{ENTITY_LABELS[e]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input
            type="date"
            value={filterFrom}
            onChange={e => setFilterFrom(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input
            type="date"
            value={filterTo}
            onChange={e => setFilterTo(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select
            value={filterSuccess}
            onChange={e => setFilterSuccess(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          >
            <option value="">All</option>
            <option value="ok">Successful</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <button
          onClick={() => { setFilterAction(''); setFilterEntity(''); setFilterFrom(''); setFilterTo(''); setFilterSuccess(''); }}
          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:border-gray-400"
        >
          Clear
        </button>
      </div>

      {/* Log table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center gap-4 px-5 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
          <span className="w-36 flex-shrink-0">Timestamp</span>
          <span className="w-52 flex-shrink-0">Action · Entity</span>
          <span className="flex-1">Description · User</span>
          <span className="flex-shrink-0 text-right">IP</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>
        ) : visibleLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <p className="text-2xl mb-2">📋</p>
            <p className="text-sm">No audit entries found</p>
          </div>
        ) : (
          visibleLogs.map(log => <LogRow key={log.id} log={log} />)
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-400">
            Page {page} of {pages} · {total.toLocaleString()} total entries
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => fetchLogs(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => fetchLogs(page + 1)}
              disabled={page >= pages}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
