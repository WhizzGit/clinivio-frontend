'use client';
import { useState, useEffect, useCallback } from 'react';
import { iamApi, appointmentApi } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffProfile {
  id: string;
  employeeId?: string;
  qualification?: string;
  registrationNo?: string;
  departmentId?: string;
  department?: { id: string; name: string; icon?: string };
  joiningDate?: string;
  shift?: string;
  experienceYears?: number;
  specialization?: string;
  metadata?: Record<string, any>;
  isActive?: boolean;
}

interface DoctorProfile {
  id: string;
  specialty?: string;
  qualification?: string;
  registrationNo?: string;
  department?: { id: string; name: string; icon?: string };
  experienceYears?: number;
  consultationFee?: number;
  isAcceptingPatients?: boolean;
}

interface StaffUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  staffProfile?: StaffProfile;
  doctorProfile?: DoctorProfile;
}

interface Department { id: string; name: string; icon?: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_META: Record<string, {
  label: string; plural: string; emoji: string; color: string; bg: string;
  regLabel: string; qualPlaceholder: string; specLabel: string; specPlaceholder: string;
}> = {
  ALL:           { label: 'All',           plural: 'All Staff',     emoji: '👥', color: 'text-gray-700',    bg: 'bg-gray-100',    regLabel: 'Registration No.', qualPlaceholder: '',        specLabel: 'Specialization', specPlaceholder: '' },
  NURSE:         { label: 'Nurse',         plural: 'Nurses',        emoji: '🩺', color: 'text-green-700',   bg: 'bg-green-100',   regLabel: 'NNC / Council Reg. No.', qualPlaceholder: 'GNM / B.Sc Nursing / M.Sc Nursing', specLabel: 'Ward / Specialization', specPlaceholder: 'ICU, Paeds, OT Scrub…' },
  RECEPTIONIST:  { label: 'Receptionist', plural: 'Receptionists', emoji: '🗂️', color: 'text-yellow-700',  bg: 'bg-yellow-100',  regLabel: 'Employee ID',      qualPlaceholder: 'BBA / Diploma / Graduate', specLabel: 'Languages Known',       specPlaceholder: 'English, Tamil, Hindi…' },
  LAB_TECHNICIAN:{ label: 'Lab Tech',     plural: 'Lab Technicians', emoji: '🔬', color: 'text-teal-700',   bg: 'bg-teal-100',    regLabel: 'Lab Reg. / Cert. No.', qualPlaceholder: 'DMLT / BMLT / MLT',       specLabel: 'Area of Specialization', specPlaceholder: 'Clinical Biochemistry, Microbiology…' },
  PHARMACIST:    { label: 'Pharmacist',   plural: 'Pharmacists',   emoji: '💊', color: 'text-orange-700',  bg: 'bg-orange-100',  regLabel: 'Pharmacy License No.', qualPlaceholder: 'D.Pharm / B.Pharm / M.Pharm', specLabel: 'Area',            specPlaceholder: 'Clinical / Retail / Hospital…' },
  DOCTOR:        { label: 'Doctor',       plural: 'Doctors',       emoji: '👨‍⚕️', color: 'text-blue-700',    bg: 'bg-blue-100',    regLabel: 'MCI / Council Reg.', qualPlaceholder: 'MBBS, MD', specLabel: 'Specialty', specPlaceholder: 'Cardiology…' },
  ADMIN:         { label: 'Admin',        plural: 'Admins',        emoji: '⚙️', color: 'text-purple-700',  bg: 'bg-purple-100',  regLabel: 'Employee ID', qualPlaceholder: '', specLabel: '', specPlaceholder: '' },
};

const TABS = ['ALL', 'NURSE', 'RECEPTIONIST', 'LAB_TECHNICIAN', 'PHARMACIST'];
const SHIFTS = ['MORNING', 'AFTERNOON', 'NIGHT', 'ROTATIONAL'];

// ─── Shared Input Style ───────────────────────────────────────────────────────
const inp = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
const lbl = 'block text-xs font-medium text-gray-600 mb-1';

// ─── Set Password Modal ───────────────────────────────────────────────────────
function SetPasswordModal({ user, onClose, onSuccess }: { user: StaffUser; onClose: () => void; onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [show, setShow]         = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { setError('Min 6 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setSaving(true); setError(null);
    try {
      await iamApi.patch(`/users/${user.id}`, { password });
      onSuccess();
    } catch (err: any) {
      const m = err?.response?.data?.message;
      setError(Array.isArray(m) ? m.join(', ') : m || 'Failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Set Password</h2>
            <p className="text-xs text-gray-500">{user.firstName} {user.lastName} · {user.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
          <div>
            <label className={lbl}>New Password</label>
            <div className="relative">
              <input type={show ? 'text' : 'password'} required minLength={6} value={password}
                onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" className={inp + ' pr-16'} />
              <button type="button" onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                {show ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <div>
            <label className={lbl}>Confirm Password</label>
            <input type={show ? 'text' : 'password'} required value={confirm}
              onChange={e => setConfirm(e.target.value)} placeholder="Re-enter" className={inp} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving…</> : 'Set Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Staff Form Modal ─────────────────────────────────────────────────────────
interface StaffFormState {
  firstName: string; lastName: string; email: string; phone: string; password: string;
  isActive: boolean;
  // profile
  employeeId: string; qualification: string; registrationNo: string;
  departmentId: string; joiningDate: string; shift: string;
  experienceYears: string; specialization: string;
}

function StaffModal({ mode, role, user, departments, onClose, onSuccess }: {
  mode: 'add' | 'edit';
  role: string;
  user?: StaffUser;
  departments: Department[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const sp = user?.staffProfile;
  const meta = ROLE_META[role] ?? ROLE_META.ALL;

  const [form, setForm] = useState<StaffFormState>({
    firstName: user?.firstName ?? '',
    lastName:  user?.lastName ?? '',
    email:     user?.email ?? '',
    phone:     user?.phone ?? '',
    password:  '',
    isActive:  user?.isActive !== false,
    employeeId:     sp?.employeeId ?? '',
    qualification:  sp?.qualification ?? '',
    registrationNo: sp?.registrationNo ?? '',
    departmentId:   sp?.department?.id ?? sp?.departmentId ?? '',
    joiningDate:    sp?.joiningDate ?? '',
    shift:          sp?.shift ?? '',
    experienceYears: sp?.experienceYears != null ? String(sp.experienceYears) : '',
    specialization: sp?.specialization ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const f = (field: keyof StaffFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const payload: any = {
        firstName: form.firstName,
        lastName:  form.lastName,
        phone: form.phone || undefined,
        qualification:  form.qualification  || undefined,
        registrationNo: form.registrationNo || undefined,
        departmentId:   form.departmentId   || undefined,
        joiningDate:    form.joiningDate    || undefined,
        shift:          form.shift          || undefined,
        experienceYears: form.experienceYears ? parseInt(form.experienceYears) : undefined,
        specialization: form.specialization || undefined,
        employeeId:     form.employeeId     || undefined,
      };
      if (mode === 'add') {
        payload.email    = form.email;
        payload.password = form.password;
        payload.role     = role;
        await iamApi.post('/users', payload);
      } else {
        payload.isActive = form.isActive;
        await iamApi.patch(`/users/${user!.id}`, payload);
      }
      onSuccess();
    } catch (err: any) {
      const m = err?.response?.data?.message;
      setError(Array.isArray(m) ? m.join(', ') : m || 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <span className="text-xl">{meta.emoji}</span>
            <h2 className="text-base font-semibold text-gray-900">
              {mode === 'add' ? `Add ${meta.label}` : `Edit ${user?.firstName} ${user?.lastName}`}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

          {/* Basic Info */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Basic Information</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>First Name *</label>
                <input required value={form.firstName} onChange={f('firstName')} placeholder="Priya" className={inp} /></div>
              <div><label className={lbl}>Last Name *</label>
                <input required value={form.lastName}  onChange={f('lastName')}  placeholder="Sharma" className={inp} /></div>
              <div>
                <label className={lbl}>Email {mode === 'edit' && <span className="text-gray-400 font-normal">(read-only)</span>}</label>
                <input required={mode === 'add'} type="email" value={form.email} onChange={f('email')}
                  disabled={mode === 'edit'} placeholder="staff@hospital.com"
                  className={mode === 'edit' ? `${inp} bg-gray-50 text-gray-400 cursor-not-allowed` : inp} />
              </div>
              <div><label className={lbl}>Phone</label>
                <input value={form.phone} onChange={f('phone')} placeholder="+91 9876543210" className={inp} /></div>
              {mode === 'add' && (
                <div className="col-span-2">
                  <label className={lbl}>Password *</label>
                  <input required type="password" value={form.password} onChange={f('password')} placeholder="Min. 6 characters" className={inp} />
                </div>
              )}
            </div>
          </div>

          {/* Professional Details */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Professional Details</p>
            <div className="grid grid-cols-2 gap-3">
              {meta.qualPlaceholder && (
                <div className="col-span-2">
                  <label className={lbl}>Qualification</label>
                  <input value={form.qualification} onChange={f('qualification')} placeholder={meta.qualPlaceholder} className={inp} />
                </div>
              )}
              <div>
                <label className={lbl}>{meta.regLabel}</label>
                <input value={form.registrationNo} onChange={f('registrationNo')} placeholder="e.g. KNC-2024-1234" className={inp} />
              </div>
              <div>
                <label className={lbl}>Employee ID</label>
                <input value={form.employeeId} onChange={f('employeeId')} placeholder="EMP-001" className={inp} />
              </div>
              {meta.specPlaceholder && (
                <div className="col-span-2">
                  <label className={lbl}>{meta.specLabel}</label>
                  <input value={form.specialization} onChange={f('specialization')} placeholder={meta.specPlaceholder} className={inp} />
                </div>
              )}
              <div>
                <label className={lbl}>Experience (yrs)</label>
                <input type="number" min="0" value={form.experienceYears} onChange={f('experienceYears')} placeholder="3" className={inp} />
              </div>
              <div>
                <label className={lbl}>Joining Date</label>
                <input type="date" value={form.joiningDate} onChange={f('joiningDate')} className={inp} />
              </div>
              <div>
                <label className={lbl}>Department / Ward</label>
                <select value={form.departmentId} onChange={f('departmentId')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">— None —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.icon} {d.name}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Shift</label>
                <select value={form.shift} onChange={f('shift')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">— Not set —</option>
                  {SHIFTS.map(s => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Status (edit only) */}
          {mode === 'edit' && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Status</p>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-700">Account Active</span>
                <div className="relative">
                  <input type="checkbox" className="sr-only peer" checked={form.isActive}
                    onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} />
                  <div className="w-10 h-5 bg-gray-200 peer-checked:bg-green-500 rounded-full transition-colors" />
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                </div>
              </label>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving
                ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{mode === 'add' ? 'Adding…' : 'Saving…'}</>
                : mode === 'add' ? `Add ${meta.label}` : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Staff Card ───────────────────────────────────────────────────────────────
function StaffCard({ user, onEdit, onSetPassword }: {
  user: StaffUser;
  onEdit: () => void;
  onSetPassword: () => void;
}) {
  const meta = ROLE_META[user.role] ?? ROLE_META.ALL;
  const sp   = user.staffProfile;

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 transition-shadow hover:shadow-md ${!user.isActive ? 'opacity-60' : ''}`}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-11 h-11 rounded-full ${meta.bg} flex items-center justify-center ${meta.color} font-bold text-base flex-shrink-0`}>
          {user.firstName[0]}{user.lastName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{user.firstName} {user.lastName}</p>
          <p className="text-xs text-gray-500 truncate">{user.email}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`inline-flex px-2 py-0.5 text-xs rounded-full font-medium ${meta.bg} ${meta.color}`}>
              {meta.emoji} {meta.label}
            </span>
            {!user.isActive && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>}
          </div>
        </div>
      </div>

      {/* Profile details */}
      {sp && (
        <div className="space-y-1 text-xs text-gray-500 mb-3">
          {sp.registrationNo && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">📋</span>
              <span className="font-mono">{sp.registrationNo}</span>
            </div>
          )}
          {sp.qualification && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">🎓</span>
              <span>{sp.qualification}</span>
            </div>
          )}
          {sp.specialization && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">🏷</span>
              <span>{sp.specialization}</span>
            </div>
          )}
          {sp.department && (
            <div className="flex items-center gap-1.5">
              <span>{sp.department.icon || '🏥'}</span>
              <span>{sp.department.name}</span>
            </div>
          )}
          {sp.shift && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">🕐</span>
              <span>{sp.shift.charAt(0) + sp.shift.slice(1).toLowerCase()} shift</span>
            </div>
          )}
          {sp.experienceYears != null && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">⏱</span>
              <span>{sp.experienceYears} yrs experience</span>
            </div>
          )}
          {sp.joiningDate && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">📅</span>
              <span>Joined {new Date(sp.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          )}
          {user.phone && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">📱</span>
              <span>{user.phone}</span>
            </div>
          )}
          {sp.employeeId && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">🪪</span>
              <span className="font-mono">{sp.employeeId}</span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-gray-100">
        <button onClick={onEdit}
          className="flex-1 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
          Edit Details
        </button>
        <button onClick={onSetPassword}
          className="flex-1 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors">
          Set Password
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
type ModalState =
  | { type: 'add'; role: string }
  | { type: 'edit'; user: StaffUser }
  | { type: 'password'; user: StaffUser }
  | null;

export default function StaffPage() {
  const [users, setUsers]           = useState<StaffUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState<ModalState>(null);
  const [toast, setToast]           = useState<string | null>(null);
  const [activeTab, setActiveTab]   = useState('ALL');
  const [search, setSearch]         = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await iamApi.get('/users?limit=200');
      const body = res.data;
      const all: StaffUser[] = body?.data || body || [];
      // Show only non-doctor, non-admin staff (or all based on tab)
      setUsers(all.filter(u => !['DOCTOR', 'SUPER_ADMIN', 'ADMIN'].includes(u.role)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    appointmentApi.get('/departments').then(r => {
      const b = r.data;
      setDepartments(b?.data || b || []);
    }).catch(() => {});
  }, [fetchUsers]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  function handleSuccess(msg: string) {
    setModal(null);
    showToast(msg);
    fetchUsers();
  }

  const filtered = users.filter(u => {
    const matchTab = activeTab === 'ALL' || u.role === activeTab;
    const q = search.toLowerCase();
    const matchSearch = !q
      || `${u.firstName} ${u.lastName}`.toLowerCase().includes(q)
      || u.email.toLowerCase().includes(q)
      || (u.staffProfile?.registrationNo?.toLowerCase().includes(q) ?? false)
      || (u.staffProfile?.specialization?.toLowerCase().includes(q) ?? false);
    return matchTab && matchSearch;
  });

  const tabCounts: Record<string, number> = { ALL: users.length };
  users.forEach(u => { tabCounts[u.role] = (tabCounts[u.role] ?? 0) + 1; });

  const activeRoleForAdd = activeTab === 'ALL' ? null : activeTab;

  return (
    <div>
      {/* Modals */}
      {modal?.type === 'password' && (
        <SetPasswordModal user={modal.user} onClose={() => setModal(null)}
          onSuccess={() => handleSuccess('Password updated!')} />
      )}
      {modal?.type === 'add' && (
        <StaffModal mode="add" role={modal.role} departments={departments}
          onClose={() => setModal(null)}
          onSuccess={() => handleSuccess(`${ROLE_META[modal.role]?.label ?? 'Staff'} added!`)} />
      )}
      {modal?.type === 'edit' && (
        <StaffModal mode="edit" role={modal.user.role} user={modal.user} departments={departments}
          onClose={() => setModal(null)}
          onSuccess={() => handleSuccess('Staff record updated!')} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Staff Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Onboard and manage nurses, receptionists, lab technicians and pharmacists
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeRoleForAdd && (
            <button
              onClick={() => setModal({ type: 'add', role: activeRoleForAdd })}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2">
              <span className="text-base leading-none">+</span>
              Add {ROLE_META[activeRoleForAdd]?.label}
            </button>
          )}
          {!activeRoleForAdd && (
            <div className="relative group">
              <button className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2">
                <span className="text-base leading-none">+</span> Add Staff ▾
              </button>
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-20 hidden group-hover:block">
                {['NURSE', 'RECEPTIONIST', 'LAB_TECHNICIAN', 'PHARMACIST'].map(r => (
                  <button key={r} onClick={() => setModal({ type: 'add', role: r })}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl flex items-center gap-2">
                    <span>{ROLE_META[r].emoji}</span> {ROLE_META[r].label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2.5 flex items-center gap-2">
          <span>✓</span> {toast}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {TABS.map(tab => {
          const m = ROLE_META[tab];
          const count = tabCounts[tab] ?? 0;
          return (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              <span>{m.emoji}</span>
              <span>{tab === 'ALL' ? 'All Staff' : m.label}</span>
              {count > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${
                  activeTab === tab ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, registration no. or specialization…"
          className="w-full max-w-md px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
          <p className="text-4xl">{activeTab === 'ALL' ? '👥' : ROLE_META[activeTab]?.emoji}</p>
          <p className="font-medium">
            {search
              ? 'No staff match your search'
              : activeTab === 'ALL'
                ? 'No staff added yet'
                : `No ${ROLE_META[activeTab]?.plural} added yet`}
          </p>
          {!search && activeRoleForAdd && (
            <button onClick={() => setModal({ type: 'add', role: activeRoleForAdd })}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Add First {ROLE_META[activeRoleForAdd]?.label}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map(u => (
            <StaffCard
              key={u.id}
              user={u}
              onEdit={() => setModal({ type: 'edit', user: u })}
              onSetPassword={() => setModal({ type: 'password', user: u })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
