'use client';
import { useState, useEffect, useCallback } from 'react';
import { iamApi } from '@/lib/api';

interface Tenant {
  id: string;
  name: string;
  city?: string;
  state?: string;
  address?: string;
  pincode?: string;
  gstin?: string;
  drugLicenseNo?: string;
  portalUrl?: string;
  subscriptionTier: string;
  isActive: boolean;
  createdAt: string;
  userCount: number;
  adminEmail?: string;
  adminName?: string;
  adminLastLogin?: string;
}

const TIER_CONFIG: Record<string, { label: string; limit: string; color: string; bg: string }> = {
  BASIC:      { label: 'Tier 1',      limit: '50 users',       color: 'text-gray-600',  bg: 'bg-gray-100'  },
  STANDARD:   { label: 'Tier 2',      limit: '100 users',      color: 'text-blue-700',  bg: 'bg-blue-100'  },
  PREMIUM:    { label: 'Tier 3',      limit: '300 users',      color: 'text-purple-700',bg: 'bg-purple-100'},
  ENTERPRISE: { label: 'Enterprise',  limit: 'Unlimited',      color: 'text-amber-700', bg: 'bg-amber-100' },
};

function CredentialBox({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
      <div>
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className={`text-sm font-semibold text-gray-800 ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
      <button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="text-xs text-blue-600 hover:text-blue-800 ml-3 flex-shrink-0">
        {copied ? '✓' : 'Copy'}
      </button>
    </div>
  );
}

function CredentialsModal({ creds, title, onClose }: {
  creds: { email: string; password?: string; temporaryPassword?: string; tenantId: string; adminName: string };
  title: string;
  onClose: () => void;
}) {
  const password = creds.temporaryPassword ?? creds.password ?? '';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-xl">🔐</div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <p className="text-xs text-green-600 font-medium">Share these credentials securely with the hospital admin</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
            Save these credentials now — the password cannot be retrieved again.
          </div>
          <CredentialBox label="Admin Name" value={creds.adminName} />
          <CredentialBox label="Login Email" value={creds.email} mono />
          <CredentialBox label="Password" value={password} mono />
          <CredentialBox label="Tenant ID" value={creds.tenantId} mono />
        </div>
        <div className="px-6 pb-5">
          <button onClick={onClose} className="w-full py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
            Done — I've saved these credentials
          </button>
        </div>
      </div>
    </div>
  );
}

const TIERS = [
  { value: 'BASIC', label: 'Tier 1 — Basic (up to 50 staff)' },
  { value: 'STANDARD', label: 'Tier 2 — Standard (up to 100 staff)' },
  { value: 'PREMIUM', label: 'Tier 3 — Premium (up to 300 staff)' },
  { value: 'ENTERPRISE', label: 'Enterprise (unlimited)' },
];

function OnboardModal({ onClose, onSuccess }: {
  onClose: () => void;
  onSuccess: (creds: any) => void;
}) {
  const [form, setForm] = useState({
    name: '', city: '', state: '', address: '', pincode: '', gstin: '', drugLicenseNo: '',
    portalUrl: '',
    subscriptionTier: 'BASIC',
    adminFirstName: '', adminLastName: '', adminEmail: '', adminPassword: '', adminPhone: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);

  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
    let pwd = '';
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    setForm(f => ({ ...f, adminPassword: pwd }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.adminPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    setSaving(true); setError(null);
    try {
      const res = await iamApi.post('/tenants', form);
      onSuccess(res.data.credentials);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string | string[] } } };
      const msg = e?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to onboard hospital');
    } finally { setSaving(false); }
  }

  const inp = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-base font-semibold text-gray-900">Onboard New Hospital</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Hospital Details</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Hospital Name *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="City General Hospital" className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                  <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Chennai" className={inp} /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                  <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="Tamil Nadu" className={inp} /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="123, Hospital Road" className={inp} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Pincode</label>
                  <input value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value })} placeholder="600001" className={inp} /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">GSTIN</label>
                  <input value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value })} placeholder="29ABCDE1234F1Z5" className={inp} /></div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Portal URL</label>
                <div className="flex items-center gap-1">
                  <input value={form.portalUrl} onChange={e => setForm({ ...form, portalUrl: e.target.value })} placeholder="greenvalley.mediflow.io" className={inp} />
                </div>
                <p className="text-xs text-gray-400 mt-1">The URL where this hospital accesses MediFlow (optional)</p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Subscription Tier</p>
            <div className="space-y-2">
              {TIERS.map(t => (
                <label key={t.value} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${form.subscriptionTier === t.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="tier" value={t.value} checked={form.subscriptionTier === t.value}
                    onChange={e => setForm({ ...form, subscriptionTier: e.target.value })} className="text-blue-600" />
                  <span className="text-sm font-medium text-gray-800">{t.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Admin Account</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">First Name *</label>
                  <input required value={form.adminFirstName} onChange={e => setForm({ ...form, adminFirstName: e.target.value })} placeholder="Rajesh" className={inp} /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Last Name *</label>
                  <input required value={form.adminLastName} onChange={e => setForm({ ...form, adminLastName: e.target.value })} placeholder="Kumar" className={inp} /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Admin Email *</label>
                <input required type="email" value={form.adminEmail} onChange={e => setForm({ ...form, adminEmail: e.target.value })} placeholder="admin@hospital.com" className={inp} /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Phone *</label>
                <input required value={form.adminPhone} onChange={e => setForm({ ...form, adminPhone: e.target.value })} placeholder="+919876543210" className={inp} /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Initial Password *</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input required type={showPwd ? 'text' : 'password'} minLength={8} value={form.adminPassword}
                      onChange={e => setForm({ ...form, adminPassword: e.target.value })} placeholder="Min 8 chars" className={inp + ' pr-14'} />
                    <button type="button" onClick={() => setShowPwd(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">{showPwd ? 'Hide' : 'Show'}</button>
                  </div>
                  <button type="button" onClick={generatePassword} className="px-3 py-2 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Generate</button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Onboarding…</> : 'Onboard Hospital'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditTenantModal({ tenant, onClose, onSuccess }: { tenant: Tenant; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: tenant.name, city: tenant.city ?? '', state: tenant.state ?? '',
    address: tenant.address ?? '', pincode: tenant.pincode ?? '',
    gstin: tenant.gstin ?? '', drugLicenseNo: tenant.drugLicenseNo ?? '',
    portalUrl: tenant.portalUrl ?? '',
    subscriptionTier: tenant.subscriptionTier,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      await iamApi.patch(`/tenants/${tenant.id}`, form);
      onSuccess();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string | string[] } } };
      const msg = e?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Save failed');
    } finally { setSaving(false); }
  }

  const inp = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Edit — {tenant.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-3">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Hospital Name *</label>
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inp} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">City</label>
              <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className={inp} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">State</label>
              <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} className={inp} /></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
            <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className={inp} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Pincode</label>
              <input value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value })} className={inp} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">GSTIN</label>
              <input value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value })} className={inp} /></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Subscription Tier</label>
            <select value={form.subscriptionTier} onChange={e => setForm({ ...form, subscriptionTier: e.target.value })}
              className={inp}>
              {TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Portal URL</label>
            <input value={form.portalUrl} onChange={e => setForm({ ...form, portalUrl: e.target.value })}
              placeholder="greenvalley.mediflow.io" className={inp} />
            <p className="text-xs text-gray-400 mt-1">The URL where this hospital accesses MediFlow</p>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving…</> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type ModalState =
  | { type: 'onboard' }
  | { type: 'credentials'; creds: any; title: string }
  | { type: 'edit'; tenant: Tenant }
  | null;

export default function HospitalsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      const res = await iamApi.get('/tenants');
      setTenants(res.data || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 4000); }

  async function handleResetPassword(tenant: Tenant) {
    if (!confirm(`Reset admin password for ${tenant.name}?`)) return;
    setResetting(tenant.id);
    try {
      const res = await iamApi.post(`/tenants/${tenant.id}/reset-admin-password`);
      setModal({ type: 'credentials', creds: { ...res.data, tenantId: tenant.id }, title: `New Credentials — ${tenant.name}` });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      showToast(e?.response?.data?.message || 'Failed to reset password');
    } finally { setResetting(null); }
  }

  return (
    <div>
      {modal?.type === 'onboard' && (
        <OnboardModal onClose={() => setModal(null)}
          onSuccess={creds => setModal({ type: 'credentials', creds, title: 'Hospital Onboarded' })} />
      )}
      {modal?.type === 'credentials' && (
        <CredentialsModal creds={modal.creds} title={modal.title}
          onClose={() => { setModal(null); fetchTenants(); showToast('Done!'); }} />
      )}
      {modal?.type === 'edit' && (
        <EditTenantModal tenant={modal.tenant} onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); fetchTenants(); showToast('Hospital updated!'); }} />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Hospitals</h1>
          <p className="text-sm text-gray-500">{tenants.length} tenant{tenants.length !== 1 ? 's' : ''} onboarded</p>
        </div>
        <button onClick={() => setModal({ type: 'onboard' })}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
          + Onboard Hospital
        </button>
      </div>

      {toast && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2.5 flex items-center gap-2">
          <span>✓</span> {toast}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Hospital</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Admin</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Tier</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Staff</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Last Login</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  No hospitals yet.{' '}
                  <button onClick={() => setModal({ type: 'onboard' })} className="text-blue-600 hover:underline">Onboard the first one</button>
                </td></tr>
              ) : tenants.map((t, i) => {
                const tier = TIER_CONFIG[t.subscriptionTier] ?? TIER_CONFIG.BASIC;
                const tierLimit = { BASIC: 50, STANDARD: 100, PREMIUM: 300, ENTERPRISE: Infinity }[t.subscriptionTier] ?? 50;
                const usage = tierLimit === Infinity ? `${t.userCount}` : `${t.userCount} / ${tierLimit}`;
                const pct = tierLimit === Infinity ? 0 : Math.min(100, Math.round((t.userCount / tierLimit) * 100));
                return (
                  <tr key={t.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i === tenants.length - 1 ? 'border-b-0' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-400">{[t.city, t.state].filter(Boolean).join(', ') || '—'}</p>
                      {t.portalUrl ? (
                        <p className="text-xs text-blue-500 font-mono mt-0.5 truncate max-w-[160px]" title={t.portalUrl}>{t.portalUrl}</p>
                      ) : (
                        <p className="text-xs text-gray-300 font-mono mt-0.5">{t.id.slice(0, 8)}…</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{t.adminName ?? '—'}</p>
                      <p className="text-xs text-gray-400 font-mono">{t.adminEmail ?? ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tier.bg} ${tier.color}`}>{tier.label}</span>
                      <p className="text-xs text-gray-400 mt-0.5">{tier.limit}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-800">{usage}</p>
                      {tierLimit < Infinity && (
                        <div className="w-20 h-1.5 bg-gray-200 rounded-full mt-1">
                          <div className={`h-1.5 rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${t.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {t.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {t.adminLastLogin ? new Date(t.adminLastLogin).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleResetPassword(t)}
                          disabled={resetting === t.id}
                          title="Reset admin password"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-amber-600 hover:bg-amber-50 disabled:opacity-50 transition-colors">
                          {resetting === t.id
                            ? <span className="w-3.5 h-3.5 border border-amber-400 border-t-amber-700 rounded-full animate-spin" />
                            : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>}
                        </button>
                        <button
                          onClick={() => setModal({ type: 'edit', tenant: t })}
                          title="Edit hospital"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
