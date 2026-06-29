'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { patientApi, appointmentApi, billingApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { generateReceiptHtml, printDocument } from '@/lib/print';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Patient {
  id: string; uhid: string; firstName: string; lastName?: string;
  phone: string; whatsappPhone?: string; email?: string;
  dob?: string; gender?: string; bloodGroup?: string;
  preferredLanguage: string; address?: string;
  emergencyContactName?: string; emergencyContactPhone?: string;
  consentGivenAt?: string; isActive: boolean; createdAt: string;
  conditions?: string[];
}

// ─── Condition helpers ────────────────────────────────────────────────────────

const CONDITION_COLORS = [
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-red-100 text-red-700 border-red-200',
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-green-100 text-green-700 border-green-200',
];
function conditionColor(c: string) {
  const idx = Math.abs(c.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0)) % CONDITION_COLORS.length;
  return CONDITION_COLORS[idx];
}

function ConditionTagInput({
  value, onChange, commonConditions,
}: { value: string[]; onChange: (t: string[]) => void; commonConditions: string[] }) {
  const [search, setSearch] = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowDrop(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const filtered = commonConditions.filter(
    c => !value.includes(c) && c.toLowerCase().includes(search.toLowerCase()),
  );

  function add(c: string) {
    const clean = c.trim();
    if (clean && !value.includes(clean)) onChange([...value, clean]);
    setSearch(''); setShowDrop(false);
  }
  function remove(c: string) { onChange(value.filter(x => x !== c)); }
  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && search.trim()) { e.preventDefault(); add(search); }
    if (e.key === 'Backspace' && !search && value.length) onChange(value.slice(0, -1));
  }

  return (
    <div ref={ref} className="relative">
      <div className="min-h-[42px] w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-orange-400 flex flex-wrap gap-1.5 items-center">
        {value.map(c => (
          <span key={c} className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', conditionColor(c))}>
            {c}
            <button type="button" onClick={() => remove(c)} className="hover:opacity-70 leading-none font-bold">&times;</button>
          </span>
        ))}
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setShowDrop(true); }}
          onFocus={() => setShowDrop(true)}
          onKeyDown={onKey}
          placeholder={value.length ? '' : 'Search or type condition…'}
          className="flex-1 min-w-[140px] outline-none text-sm bg-transparent placeholder-gray-400"
        />
      </div>
      {showDrop && (search || filtered.length > 0) && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 && search.trim() ? (
            <button type="button" onMouseDown={() => add(search)}
              className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50 text-blue-600">
              Add &ldquo;{search}&rdquo;
            </button>
          ) : filtered.slice(0, 20).map(c => (
            <button type="button" key={c} onMouseDown={() => add(c)}
              className="w-full px-3 py-2 text-sm text-left hover:bg-orange-50 hover:text-orange-700">{c}</button>
          ))}
        </div>
      )}
    </div>
  );
}

interface Appointment {
  id: string; tokenNumber: number; status: string; visitType: string;
  appointmentType: string; chiefComplaint?: string; registeredAt: string;
  doctor?: { firstName: string; lastName: string };
  department?: { name: string; icon?: string };
  slot?: { slotDate: string; startTime: string };
}

interface Invoice {
  id: string; invoiceNumber: string; invoiceType: string;
  invoiceDate: string; totalAmount: string; paymentStatus: string;
  paymentMethod?: string; paidAt?: string; notes?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const age = (dob?: string) => {
  if (!dob) return null;
  const y = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  return `${y} yrs`;
};

const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const STATUS_COLORS: Record<string, string> = {
  REGISTERED: 'bg-blue-100 text-blue-700',
  PENDING_PAYMENT: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  CHECKED_IN: 'bg-sky-100 text-sky-700',
  IN_PROGRESS: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-600',
  NO_SHOW: 'bg-red-50 text-red-400',
};

// ─── Edit modal (same form fields as EnrollModal on list page) ────────────────

const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];
const LANGUAGES = ['EN', 'HI', 'TA', 'TE', 'KN', 'BN'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

function EditPatientModal({ patient, onClose, onSuccess }: {
  patient: Patient; onClose: () => void; onSuccess: (updated: Patient) => void;
}) {
  const [form, setForm] = useState({
    firstName: patient.firstName, lastName: patient.lastName ?? '',
    phone: patient.phone, whatsappPhone: patient.whatsappPhone ?? '',
    email: patient.email ?? '', dob: patient.dob ? patient.dob.slice(0, 10) : '',
    gender: patient.gender ?? 'MALE', bloodGroup: patient.bloodGroup ?? '',
    preferredLanguage: patient.preferredLanguage ?? 'EN',
    address: patient.address ?? '',
    emergencyContactName: patient.emergencyContactName ?? '',
    emergencyContactPhone: patient.emergencyContactPhone ?? '',
    consentGiven: !!patient.consentGivenAt,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null);
    try {
      const res = await patientApi.patch(`/patients/${patient.id}`, {
        firstName: form.firstName, lastName: form.lastName || undefined,
        phone: form.phone, whatsappPhone: form.whatsappPhone || undefined,
        email: form.email || undefined, dob: form.dob || undefined,
        gender: form.gender, bloodGroup: form.bloodGroup || undefined,
        preferredLanguage: form.preferredLanguage, address: form.address || undefined,
        emergencyContactName: form.emergencyContactName || undefined,
        emergencyContactPhone: form.emergencyContactPhone || undefined,
        consentGiven: form.consentGiven,
      });
      onSuccess(res.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string | string[] } } };
      const m = e?.response?.data?.message;
      setError(Array.isArray(m) ? m.join(', ') : m || 'Save failed');
    } finally { setSaving(false); }
  }

  const inp = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';
  const lbl = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold text-gray-900">Edit Patient</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Personal Info</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>First Name *</label>
                <input required value={form.firstName} onChange={set('firstName')} className={inp} /></div>
              <div><label className={lbl}>Last Name</label>
                <input value={form.lastName} onChange={set('lastName')} className={inp} /></div>
              <div><label className={lbl}>Date of Birth</label>
                <input type="date" value={form.dob} onChange={set('dob')} className={inp} /></div>
              <div><label className={lbl}>Gender</label>
                <select value={form.gender} onChange={set('gender')} className={inp}>
                  {GENDERS.map(g => <option key={g} value={g}>{g.replace('_', ' ')}</option>)}
                </select></div>
              <div><label className={lbl}>Blood Group</label>
                <select value={form.bloodGroup} onChange={set('bloodGroup')} className={inp}>
                  <option value="">— Select —</option>
                  {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
                </select></div>
              <div><label className={lbl}>Language</label>
                <select value={form.preferredLanguage} onChange={set('preferredLanguage')} className={inp}>
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select></div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contact</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Phone *</label>
                <input required value={form.phone} onChange={set('phone')} className={inp} /></div>
              <div><label className={lbl}>WhatsApp</label>
                <input value={form.whatsappPhone} onChange={set('whatsappPhone')} className={inp} /></div>
              <div className="col-span-2"><label className={lbl}>Email</label>
                <input type="email" value={form.email} onChange={set('email')} className={inp} /></div>
              <div className="col-span-2"><label className={lbl}>Address</label>
                <textarea value={form.address} onChange={set('address')} rows={2}
                  className={cn(inp, 'resize-none')} /></div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Emergency Contact</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Name</label>
                <input value={form.emergencyContactName} onChange={set('emergencyContactName')} className={inp} /></div>
              <div><label className={lbl}>Phone</label>
                <input value={form.emergencyContactPhone} onChange={set('emergencyContactPhone')} className={inp} /></div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.consentGiven}
                onChange={e => setForm(p => ({ ...p, consentGiven: e.target.checked }))}
                className="mt-0.5 w-4 h-4 rounded border-gray-300" />
              <span className="text-sm text-gray-700">Consent given for data collection and treatment</span>
            </label>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving…</> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── New Appointment mini-modal ───────────────────────────────────────────────

function NewApptModal({ patientId, onClose, onSuccess }: {
  patientId: string; onClose: () => void; onSuccess: () => void;
}) {
  const [doctors, setDoctors] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [doctorId, setDoctorId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [visitType, setVisitType] = useState('OPD');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    import('@/lib/api').then(({ iamApi, appointmentApi }) => {
      iamApi.get('/users?limit=100').then(r => {
        const all = r.data?.data || r.data || [];
        setDoctors(all.filter((u: { role: string }) => u.role === 'DOCTOR'));
      }).catch(() => {});
      appointmentApi.get('/departments').then(r => {
        setDepartments(r.data?.data || r.data || []);
      }).catch(() => {});
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!doctorId) { setError('Select a doctor'); return; }
    setSaving(true); setError(null);
    try {
      await appointmentApi.post('/appointments', {
        patientId, doctorId,
        ...(departmentId && { departmentId }),
        visitType, appointmentType: 'IN_PERSON',
        ...(chiefComplaint.trim() && { chiefComplaint: chiefComplaint.trim() }),
        payAtCounter: true,
      });
      onSuccess();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string | string[] } } };
      const m = e?.response?.data?.message;
      setError(Array.isArray(m) ? m.join(', ') : m || 'Booking failed');
    } finally { setSaving(false); }
  }

  const inp = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">New Appointment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Doctor *</label>
            <select value={doctorId} onChange={e => setDoctorId(e.target.value)} className={inp}>
              <option value="">— Select doctor —</option>
              {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
            <select value={departmentId} onChange={e => setDepartmentId(e.target.value)} className={inp}>
              <option value="">— Select department —</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Visit Type</label>
            <div className="flex gap-2">
              {['OPD', 'IPD'].map(v => (
                <button key={v} type="button" onClick={() => setVisitType(v)}
                  className={cn('flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                    visitType === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400')}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Chief Complaint</label>
            <textarea value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} rows={2}
              placeholder="Describe the reason for visit…" className={cn(inp, 'resize-none')} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Booking…</> : 'Book Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'history' | 'billing';

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, tenantProfile } = useAuthStore();
  const canEdit = ['ADMIN', 'RECEPTIONIST'].includes(user?.role ?? '');

  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [loadingPatient, setLoadingPatient] = useState(true);
  const [loadingAppts, setLoadingAppts] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [apptModal, setApptModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [printingReceiptId, setPrintingReceiptId] = useState<string | null>(null);

  // Conditions — editable inline from the header
  const [editingConditions, setEditingConditions] = useState(false);
  const [draftConditions, setDraftConditions] = useState<string[]>([]);
  const [savingConditions, setSavingConditions] = useState(false);
  const [commonConditions, setCommonConditions] = useState<string[]>([]);
  // roles that can tag (wider than canEdit)
  const canTag = ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'].includes(user?.role ?? '');

  const fetchPatient = useCallback(async () => {
    try {
      setLoadingPatient(true);
      const res = await patientApi.get(`/patients/${id}`);
      setPatient(res.data);
    } catch { router.push('/patients'); }
    finally { setLoadingPatient(false); }
  }, [id, router]);

  const fetchAppointments = useCallback(async () => {
    try {
      setLoadingAppts(true);
      const res = await appointmentApi.get(`/appointments?patientId=${id}&limit=50`);
      const body = res.data;
      setAppointments(body?.data || body || []);
    } catch { setAppointments([]); }
    finally { setLoadingAppts(false); }
  }, [id]);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoadingInvoices(true);
      const res = await billingApi.get(`/invoices/by-patient/${id}`);
      setInvoices(res.data || []);
    } catch { setInvoices([]); }
    finally { setLoadingInvoices(false); }
  }, [id]);

  useEffect(() => { fetchPatient(); }, [fetchPatient]);
  useEffect(() => { if (tab === 'history' || tab === 'billing') fetchAppointments(); }, [tab, fetchAppointments]);
  useEffect(() => { if (tab === 'billing') fetchInvoices(); }, [tab, fetchInvoices]);
  useEffect(() => {
    appointmentApi.get('/analytics/common-conditions')
      .then(r => setCommonConditions(r.data?.conditions ?? [])).catch(() => {});
  }, []);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 4000); }

  function startEditConditions() {
    setDraftConditions(patient?.conditions ?? []);
    setEditingConditions(true);
  }

  async function saveConditions() {
    if (!patient) return;
    setSavingConditions(true);
    try {
      await patientApi.patch(`/patients/${patient.id}/conditions`, { conditions: draftConditions });
      setPatient(prev => prev ? { ...prev, conditions: draftConditions } : prev);
      setEditingConditions(false);
      showToast('Conditions saved!');
    } catch {
      showToast('Failed to save conditions');
    } finally {
      setSavingConditions(false);
    }
  }

  function printInvoiceReceipt(inv: Invoice) {
    if (!patient) return;
    setPrintingReceiptId(inv.id);
    try {
      const apptForInvoice = appointments.find(a => (inv as any).appointmentId === a.id);
      const html = generateReceiptHtml({
        tenant: tenantProfile ?? { name: 'Hospital' },
        receiptNo: inv.invoiceNumber,
        date: inv.paidAt || inv.invoiceDate,
        patient: {
          firstName: patient.firstName,
          lastName: patient.lastName || '',
          uhid: patient.uhid,
          phone: patient.phone,
        },
        doctor: {
          firstName: apptForInvoice?.doctor?.firstName ?? '—',
          lastName: apptForInvoice?.doctor?.lastName ?? '',
        },
        department: apptForInvoice?.department?.name,
        amount: parseFloat(inv.totalAmount),
        paymentMethod: inv.paymentMethod || 'CASH',
        tokenNumber: apptForInvoice?.tokenNumber ?? 0,
      });
      printDocument(html);
    } finally {
      setPrintingReceiptId(null);
    }
  }

  if (loadingPatient) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading patient…</div>;
  }
  if (!patient) return null;

  const p = patient;
  const patientAge = age(p.dob);

  return (
    <div>
      {editModal && (
        <EditPatientModal
          patient={p}
          onClose={() => setEditModal(false)}
          onSuccess={updated => { setPatient(updated); setEditModal(false); showToast('Patient updated!'); }}
        />
      )}
      {apptModal && (
        <NewApptModal
          patientId={p.id}
          onClose={() => setApptModal(false)}
          onSuccess={() => { setApptModal(false); showToast('Appointment booked!'); if (tab === 'history') fetchAppointments(); }}
        />
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-5">
        <button onClick={() => router.push('/patients')} className="hover:text-blue-600">Patients</button>
        <span>/</span>
        <span className="text-gray-700 font-medium">{p.firstName} {p.lastName}</span>
      </div>

      {toast && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2.5 flex items-center gap-2">
          <span>✓</span> {toast}
        </div>
      )}

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl flex-shrink-0">
              {p.firstName[0]}{p.lastName?.[0] ?? ''}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900">{p.firstName} {p.lastName}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
                <span className="font-mono text-blue-600 font-medium">{p.uhid}</span>
                {patientAge && <span>{patientAge}</span>}
                {p.gender && <span className="capitalize">{p.gender.toLowerCase()}</span>}
                {p.bloodGroup && (
                  <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-xs font-medium">{p.bloodGroup}</span>
                )}
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.consentGivenAt ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  Consent {p.consentGivenAt ? 'Given' : 'Pending'}
                </span>
              </div>

              {/* Condition tags — inline editor */}
              <div className="mt-3">
                {!editingConditions ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(p.conditions ?? []).length === 0 ? (
                      canTag ? (
                        <button
                          onClick={startEditConditions}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-orange-300 text-orange-500 hover:bg-orange-50 transition-colors"
                        >
                          <span className="text-sm leading-none">+</span> Tag major condition
                        </button>
                      ) : null
                    ) : (
                      <>
                        {(p.conditions ?? []).map(c => (
                          <span key={c} className={cn('inline-flex px-2.5 py-1 rounded-full text-xs font-medium border', conditionColor(c))}>
                            {c}
                          </span>
                        ))}
                        {canTag && (
                          <button
                            onClick={startEditConditions}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-gray-400 hover:text-orange-600 hover:bg-orange-50 border border-transparent hover:border-orange-200 transition-colors"
                            title="Edit conditions"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            Edit tags
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="mt-1 space-y-2 max-w-xl">
                    <ConditionTagInput
                      value={draftConditions}
                      onChange={setDraftConditions}
                      commonConditions={commonConditions}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveConditions}
                        disabled={savingConditions}
                        className="px-3 py-1.5 text-xs bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-60 flex items-center gap-1.5"
                      >
                        {savingConditions
                          ? <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving…</>
                          : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingConditions(false)}
                        className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {canEdit && (
              <>
                <button
                  onClick={() => setApptModal(true)}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                >
                  + New Appointment
                </button>
                <button
                  onClick={() => setEditModal(true)}
                  className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Edit Patient
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        {(['overview', 'history', 'billing'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-5 py-1.5 text-sm font-medium rounded-lg transition-colors',
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            {t === 'history' ? 'Appointment History' : t === 'billing' ? 'Billing' : 'Overview'}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Contact Information</h2>
            <dl className="space-y-3 text-sm">
              <Row label="Phone" value={p.phone} />
              {p.whatsappPhone && <Row label="WhatsApp" value={p.whatsappPhone} />}
              {p.email && <Row label="Email" value={p.email} />}
              {p.address && <Row label="Address" value={p.address} />}
            </dl>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Demographics</h2>
            <dl className="space-y-3 text-sm">
              {p.dob && <Row label="Date of Birth" value={`${new Date(p.dob).toLocaleDateString('en-IN')} (${patientAge})`} />}
              {p.gender && <Row label="Gender" value={p.gender.replace('_', ' ')} />}
              {p.bloodGroup && <Row label="Blood Group" value={p.bloodGroup} />}
              <Row label="Language" value={p.preferredLanguage} />
              <Row label="Enrolled On" value={fmt(p.createdAt)} />
            </dl>
          </div>
          {(p.emergencyContactName || p.emergencyContactPhone) && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Emergency Contact</h2>
              <dl className="space-y-3 text-sm">
                {p.emergencyContactName && <Row label="Name" value={p.emergencyContactName} />}
                {p.emergencyContactPhone && <Row label="Phone" value={p.emergencyContactPhone} />}
              </dl>
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Identifiers</h2>
            <dl className="space-y-3 text-sm">
              <Row label="UHID" value={p.uhid} mono />
              {p.consentGivenAt && <Row label="Consent Given" value={fmt(p.consentGivenAt)} />}
            </dl>
          </div>

          {/* Medical Conditions card */}
          <div className="md:col-span-2 bg-white rounded-xl border border-orange-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">Major Medical Conditions</h2>
                <p className="text-xs text-gray-400 mt-0.5">Chronic or pre-existing conditions used for clinical analytics</p>
              </div>
              {!editingConditions && canEdit && (
                <button
                  onClick={startEditConditions}
                  className="px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
                >
                  {(p.conditions ?? []).length === 0 ? '+ Add Conditions' : 'Edit'}
                </button>
              )}
            </div>

            {editingConditions ? (
              <div className="space-y-3">
                <ConditionTagInput
                  value={draftConditions}
                  onChange={setDraftConditions}
                  commonConditions={commonConditions}
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveConditions}
                    disabled={savingConditions}
                    className="px-4 py-1.5 text-sm bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-60 flex items-center gap-2"
                  >
                    {savingConditions
                      ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving…</>
                      : 'Save Conditions'}
                  </button>
                  <button
                    onClick={() => setEditingConditions(false)}
                    className="px-4 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (p.conditions ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 italic">No conditions tagged yet.{canEdit ? ' Click Edit to add.' : ''}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(p.conditions ?? []).map(c => (
                  <span key={c} className={cn('inline-flex px-3 py-1 rounded-full text-xs font-medium border', conditionColor(c))}>
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Billing tab */}
      {tab === 'billing' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loadingInvoices ? (
            <div className="flex items-center justify-center h-32 text-gray-400">Loading invoices…</div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <p>No invoices found for this patient</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Invoice #</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Method</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map(inv => {
                  const statusColor =
                    inv.paymentStatus === 'PAID' ? 'bg-green-100 text-green-700' :
                    inv.paymentStatus === 'REFUNDED' ? 'bg-gray-100 text-gray-500' :
                    'bg-yellow-100 text-yellow-700';
                  const typeLabel = inv.invoiceType.replace(/_/g, ' ');
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-blue-700">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{typeLabel}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{fmt(inv.invoiceDate)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        ₹{parseFloat(inv.totalAmount).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{inv.paymentMethod ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', statusColor)}>
                          {inv.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {inv.paymentStatus === 'PAID' && (
                          <button
                            onClick={() => printInvoiceReceipt(inv)}
                            disabled={printingReceiptId === inv.id}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                          >
                            {printingReceiptId === inv.id ? (
                              <span className="w-3 h-3 border border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                            ) : (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            )}
                            Receipt
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-sm font-medium text-gray-600">Total paid</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                    ₹{invoices
                      .filter(i => i.paymentStatus === 'PAID')
                      .reduce((sum, i) => sum + parseFloat(i.totalAmount), 0)
                      .toLocaleString('en-IN')}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loadingAppts ? (
            <div className="flex items-center justify-center h-32 text-gray-400">Loading history…</div>
          ) : appointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-3 text-gray-400">
              <p>No appointments found for this patient</p>
              {canEdit && (
                <button onClick={() => setApptModal(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Book First Appointment
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Token</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Doctor</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Department</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Complaint</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {appointments
                  .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())
                  .map(appt => (
                    <tr key={appt.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-bold text-gray-900">#{appt.tokenNumber}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {appt.doctor ? `Dr. ${appt.doctor.firstName} ${appt.doctor.lastName}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {appt.department ? `${appt.department.icon ?? ''} ${appt.department.name}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {fmt(appt.registeredAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{appt.visitType}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{appt.chiefComplaint || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[appt.status] ?? 'bg-gray-100 text-gray-600')}>
                          {appt.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500 flex-shrink-0">{label}</dt>
      <dd className={cn('text-gray-900 text-right', mono && 'font-mono text-xs')}>{value}</dd>
    </div>
  );
}
