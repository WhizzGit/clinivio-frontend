'use client';
import { useState, useEffect, useCallback } from 'react';
import { iamApi, appointmentApi } from '@/lib/api';

interface DoctorProfile {
  id: string;
  specialty?: string;
  subSpecialty?: string;
  qualification?: string;
  experienceYears?: number;
  consultationFee?: number;
  registrationNo?: string;
  isAcceptingPatients: boolean;
  department?: { id: string; name: string; icon?: string };
  departmentId?: string;
}

interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  doctorProfile?: DoctorProfile;
}

interface Department { id: string; name: string; icon?: string }

type ModalMode = 'add' | 'edit';

interface DoctorFormState {
  firstName: string; lastName: string; email: string; phone: string; password: string;
  specialty: string; subSpecialty: string; qualification: string; registrationNo: string;
  experienceYears: string; consultationFee: string; departmentId: string;
  isAcceptingPatients: boolean; isActive: boolean;
}

function DoctorModal({ mode, doctor, departments, onClose, onSuccess }: {
  mode: ModalMode;
  doctor?: Doctor;
  departments: Department[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const p = doctor?.doctorProfile;
  const [form, setForm] = useState<DoctorFormState>({
    firstName: doctor?.firstName ?? '',
    lastName: doctor?.lastName ?? '',
    email: doctor?.email ?? '',
    phone: doctor?.phone ?? '',
    password: '',
    specialty: p?.specialty ?? '',
    subSpecialty: p?.subSpecialty ?? '',
    qualification: p?.qualification ?? '',
    registrationNo: p?.registrationNo ?? '',
    experienceYears: p?.experienceYears != null ? String(p.experienceYears) : '',
    consultationFee: p?.consultationFee != null ? String(p.consultationFee) : '',
    departmentId: p?.department?.id ?? p?.departmentId ?? '',
    isAcceptingPatients: p?.isAcceptingPatients !== false,
    isActive: doctor?.isActive !== false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const f = (field: keyof DoctorFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (mode === 'add') {
        await iamApi.post('/users', {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone || undefined,
          password: form.password,
          role: 'DOCTOR',
          specialty: form.specialty || undefined,
          subSpecialty: form.subSpecialty || undefined,
          qualification: form.qualification || undefined,
          registrationNo: form.registrationNo || undefined,
          experienceYears: form.experienceYears ? parseInt(form.experienceYears) : undefined,
          consultationFee: form.consultationFee ? parseFloat(form.consultationFee) : undefined,
        });
      } else {
        await iamApi.patch(`/users/${doctor!.id}`, {
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone || undefined,
          isActive: form.isActive,
          specialty: form.specialty || undefined,
          subSpecialty: form.subSpecialty || undefined,
          qualification: form.qualification || undefined,
          registrationNo: form.registrationNo || undefined,
          experienceYears: form.experienceYears ? parseInt(form.experienceYears) : undefined,
          consultationFee: form.consultationFee ? parseFloat(form.consultationFee) : undefined,
          departmentId: form.departmentId || undefined,
          isAcceptingPatients: form.isAcceptingPatients,
        });
      }
      onSuccess();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string | string[] } } };
      const msg = e?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold text-gray-900">
            {mode === 'add' ? 'Add New Doctor' : `Edit Dr. ${doctor?.firstName} ${doctor?.lastName}`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

          {/* Basic info */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Basic Info</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>First Name *</label>
                <input required value={form.firstName} onChange={f('firstName')} placeholder="Rajesh" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Last Name *</label>
                <input required value={form.lastName} onChange={f('lastName')} placeholder="Patel" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Email {mode === 'edit' && <span className="text-gray-400 font-normal">(read-only)</span>}</label>
                <input
                  required={mode === 'add'}
                  type="email"
                  value={form.email}
                  onChange={f('email')}
                  disabled={mode === 'edit'}
                  placeholder="dr@hospital.com"
                  className={mode === 'edit' ? 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed' : inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input value={form.phone} onChange={f('phone')} placeholder="+91 9876543210" className={inputCls} />
              </div>
              {mode === 'add' && (
                <div className="col-span-2">
                  <label className={labelCls}>Password *</label>
                  <input required type="password" value={form.password} onChange={f('password')} placeholder="min 8 chars" className={inputCls} />
                </div>
              )}
            </div>
          </div>

          {/* Professional details */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Professional Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Specialty</label>
                <input value={form.specialty} onChange={f('specialty')} placeholder="Cardiology" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Sub-Specialty</label>
                <input value={form.subSpecialty} onChange={f('subSpecialty')} placeholder="Interventional" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Qualification</label>
                <input value={form.qualification} onChange={f('qualification')} placeholder="MBBS, MD" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Reg. No.</label>
                <input value={form.registrationNo} onChange={f('registrationNo')} placeholder="MCI-12345" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Experience (yrs)</label>
                <input type="number" min="0" value={form.experienceYears} onChange={f('experienceYears')} placeholder="10" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Consultation Fee (₹)</label>
                <input type="number" min="0" value={form.consultationFee} onChange={f('consultationFee')} placeholder="500" className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Department</label>
                <select value={form.departmentId} onChange={f('departmentId')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">— None —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.icon} {d.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Status toggles (edit only) */}
          {mode === 'edit' && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</p>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-700">Accepting Patients</span>
                <div className="relative">
                  <input type="checkbox" className="sr-only peer" checked={form.isAcceptingPatients}
                    onChange={e => setForm(prev => ({ ...prev, isAcceptingPatients: e.target.checked }))} />
                  <div className="w-10 h-5 bg-gray-200 peer-checked:bg-green-500 rounded-full transition-colors" />
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                </div>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-700">Account Active</span>
                <div className="relative">
                  <input type="checkbox" className="sr-only peer" checked={form.isActive}
                    onChange={e => setForm(prev => ({ ...prev, isActive: e.target.checked }))} />
                  <div className="w-10 h-5 bg-gray-200 peer-checked:bg-blue-500 rounded-full transition-colors" />
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                </div>
              </label>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving
                ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{mode === 'add' ? 'Adding…' : 'Saving…'}</>
                : mode === 'add' ? 'Add Doctor' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: ModalMode; doctor?: Doctor } | null>(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const fetchDoctors = useCallback(async () => {
    try {
      setLoading(true);
      const res = await iamApi.get('/users?limit=100');
      const body = res.data;
      const all: Doctor[] = body?.data || body || [];
      setDoctors(all.filter(u => u.role === 'DOCTOR'));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDoctors();
    appointmentApi.get('/departments').then(r => {
      const b = r.data;
      setDepartments(b?.data || b || []);
    }).catch(() => {});
  }, [fetchDoctors]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  function handleSuccess() {
    const msg = modal?.mode === 'add' ? 'Doctor added successfully!' : 'Doctor updated successfully!';
    setModal(null);
    showToast(msg);
    fetchDoctors();
  }

  const filtered = doctors.filter(d => {
    const q = search.toLowerCase();
    return !q || `${d.firstName} ${d.lastName}`.toLowerCase().includes(q) ||
      d.email.toLowerCase().includes(q) ||
      (d.doctorProfile?.specialty?.toLowerCase().includes(q) ?? false);
  });

  return (
    <div>
      {modal && (
        <DoctorModal
          mode={modal.mode}
          doctor={modal.doctor}
          departments={departments}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Doctors</h1>
          <p className="text-sm text-gray-500">{doctors.length} registered</p>
        </div>
        <button
          onClick={() => setModal({ mode: 'add' })}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <span className="text-base leading-none">+</span> Add Doctor
        </button>
      </div>

      {toast && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2.5 flex items-center gap-2">
          <span>✓</span> {toast}
        </div>
      )}

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, email, or specialty..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
          <p className="text-4xl">🩺</p>
          <p>{search ? 'No doctors match your search' : 'No doctors added yet'}</p>
          {!search && (
            <button onClick={() => setModal({ mode: 'add' })} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Add First Doctor
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(doc => {
            const p = doc.doctorProfile;
            return (
              <div key={doc.id} className={`bg-white rounded-xl border border-gray-200 p-5 transition-shadow hover:shadow-md ${!doc.isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg flex-shrink-0">
                    {doc.firstName[0]}{doc.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">Dr. {doc.firstName} {doc.lastName}</p>
                    <p className="text-xs text-gray-500 truncate">{doc.email}</p>
                    {p?.specialty && (
                      <span className="inline-flex mt-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                        {p.specialty}{p.subSpecialty ? ` · ${p.subSpecialty}` : ''}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setModal({ mode: 'edit', doctor: doc })}
                    className="flex-shrink-0 px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    Edit
                  </button>
                </div>

                <div className="space-y-1.5 text-xs text-gray-500">
                  {p?.qualification && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400">🎓</span>
                      <span>{p.qualification}</span>
                    </div>
                  )}
                  {p?.registrationNo && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400">📋</span>
                      <span className="font-mono">{p.registrationNo}</span>
                    </div>
                  )}
                  {p?.experienceYears != null && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400">⏱</span>
                      <span>{p.experienceYears} yrs experience</span>
                    </div>
                  )}
                  {p?.department && (
                    <div className="flex items-center gap-1.5">
                      <span>{p.department.icon || '🏥'}</span>
                      <span>{p.department.name}</span>
                    </div>
                  )}
                  {doc.phone && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400">📱</span>
                      <span>{doc.phone}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  {p?.consultationFee != null ? (
                    <span className="text-sm font-semibold text-gray-900">₹{Number(p.consultationFee).toLocaleString('en-IN')}</span>
                  ) : (
                    <span className="text-xs text-gray-400">Fee not set</span>
                  )}
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      p?.isAcceptingPatients !== false ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-500'
                    }`}>
                      {p?.isAcceptingPatients !== false ? 'Accepting' : 'Closed'}
                    </span>
                    {!doc.isActive && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setModal({ mode: 'edit', doctor: doc })}
                  className="mt-3 w-full py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  Edit Details
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
