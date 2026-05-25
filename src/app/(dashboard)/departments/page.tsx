'use client';
import { useState, useEffect } from 'react';
import { appointmentApi } from '@/lib/api';

interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  icon?: string;
  color?: string;
  isActive: boolean;
  sortOrder: number;
  _count?: { doctors: number; appointments: number };
}

type ModalMode = 'add' | 'edit';

const DEFAULT_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

function DeptModal({ mode, dept, onClose, onSuccess }: {
  mode: ModalMode;
  dept?: Department;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    name: dept?.name ?? '',
    code: dept?.code ?? '',
    description: dept?.description ?? '',
    icon: dept?.icon ?? '',
    color: dept?.color ?? '#3B82F6',
    sortOrder: dept?.sortOrder != null ? String(dept.sortOrder) : '0',
    isActive: dept?.isActive !== false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        icon: form.icon || undefined,
        color: form.color,
        sortOrder: form.sortOrder ? parseInt(form.sortOrder) : 0,
        ...(mode === 'add' && { code: form.code }),
        ...(mode === 'edit' && { isActive: form.isActive }),
      };
      if (mode === 'add') {
        await appointmentApi.post('/departments', payload);
      } else {
        await appointmentApi.patch(`/departments/${dept!.id}`, payload);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {mode === 'add' ? 'New Department' : `Edit — ${dept?.name}`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Cardiology" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Code * {mode === 'edit' && <span className="text-gray-400 font-normal">(read-only)</span>}
              </label>
              <input
                required={mode === 'add'}
                value={mode === 'edit' ? dept!.code : form.code}
                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                disabled={mode === 'edit'}
                placeholder="CARDIO"
                className={mode === 'edit' ? 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed font-mono' : inputCls}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Heart & blood vessel treatments" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Icon (emoji)</label>
              <input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })}
                placeholder="❤️" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sort Order</label>
              <input type="number" min="0" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: e.target.value })}
                placeholder="0" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {DEFAULT_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                  className={`w-8 h-8 rounded-full border-4 transition-transform ${form.color === c ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
                className="w-8 h-8 rounded-full cursor-pointer border-2 border-gray-200"
                title="Custom color" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: form.color }} />
              <span className="text-xs font-mono text-gray-500">{form.color}</span>
            </div>
          </div>

          {mode === 'edit' && (
            <label className="flex items-center justify-between cursor-pointer pt-1">
              <span className="text-sm text-gray-700">Active</span>
              <div className="relative">
                <input type="checkbox" className="sr-only peer" checked={form.isActive}
                  onChange={e => setForm({ ...form, isActive: e.target.checked })} />
                <div className="w-10 h-5 bg-gray-200 peer-checked:bg-green-500 rounded-full transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
              </div>
            </label>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving
                ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{mode === 'add' ? 'Creating…' : 'Saving…'}</>
                : mode === 'add' ? 'Create' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: ModalMode; dept?: Department } | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchDepts = async () => {
    try {
      setLoading(true);
      const res = await appointmentApi.get('/departments?activeOnly=false');
      setDepartments(res.data || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchDepts(); }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  function handleSuccess() {
    const msg = modal?.mode === 'add' ? 'Department created!' : 'Department updated!';
    setModal(null);
    showToast(msg);
    fetchDepts();
  }

  const seed = async () => {
    if (!confirm('Add default departments (General, Emergency, Cardiology, etc)?')) return;
    setSeeding(true);
    try {
      await appointmentApi.post('/departments/seed-defaults');
      await fetchDepts();
      showToast('Default departments seeded!');
    } finally { setSeeding(false); }
  };

  return (
    <div>
      {modal && (
        <DeptModal
          mode={modal.mode}
          dept={modal.dept}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Departments & Specialties</h1>
          <p className="text-sm text-gray-500">Configure departments for the patient board and appointment form</p>
        </div>
        <div className="flex gap-2">
          {departments.length === 0 && (
            <button onClick={seed} disabled={seeding}
              className="px-4 py-2 text-sm border border-blue-300 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50">
              {seeding ? 'Seeding…' : 'Add Defaults'}
            </button>
          )}
          <button
            onClick={() => setModal({ mode: 'add' })}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
            + New Department
          </button>
        </div>
      </div>

      {toast && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2.5 flex items-center gap-2">
          <span>✓</span> {toast}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">Loading…</div>
      ) : departments.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
          <p className="text-4xl">🏥</p>
          <p>No departments yet</p>
          <button onClick={seed} disabled={seeding} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {seeding ? 'Seeding…' : 'Add Default Departments'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {departments.map(d => (
            <div key={d.id}
              className={`bg-white rounded-xl border p-4 transition-shadow hover:shadow-md ${!d.isActive ? 'opacity-50 border-gray-200' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ backgroundColor: (d.color ?? '#3B82F6') + '20' }}>
                    {d.icon || '🏥'}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{d.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{d.code}</p>
                  </div>
                </div>
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color ?? '#3B82F6' }} />
              </div>

              {d.description && <p className="text-xs text-gray-500 mt-2">{d.description}</p>}

              <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                <span>{d._count?.doctors || 0} doctors</span>
                <span>{d._count?.appointments || 0} appointments</span>
                <span>Order: {d.sortOrder}</span>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className={`text-xs px-2 py-0.5 rounded-full ${d.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {d.isActive ? 'Active' : 'Inactive'}
                </span>
                <button
                  onClick={() => setModal({ mode: 'edit', dept: d })}
                  className="px-3 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
