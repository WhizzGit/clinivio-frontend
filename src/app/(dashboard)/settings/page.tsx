'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { iamApi } from '@/lib/api';

type Tab = 'profile' | 'hospital' | 'security';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const [tab, setTab] = useState<Tab>('profile');
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Hospital profile state
  const [hospitalForm, setHospitalForm] = useState({
    name: '',
    phone: '',
    email: '',
    website: '',
    registrationNo: '',
    tagline: '',
    printHeader: '',
    logoUrl: '',
    address: '',
    city: '',
    state: '',
    gstin: '',
    drugLicenseNo: '',
  });
  const [hospitalLoading, setHospitalLoading] = useState(false);
  const [hospitalSaving, setHospitalSaving] = useState(false);

  const fetchTenant = useCallback(async () => {
    if (!user?.tenantId) return;
    setHospitalLoading(true);
    try {
      const res = await iamApi.get(`/tenants/${user.tenantId}`);
      const t = res.data;
      setHospitalForm({
        name: t.name || '',
        phone: t.phone || '',
        email: t.email || '',
        website: t.website || '',
        registrationNo: t.registrationNo || '',
        tagline: t.tagline || '',
        printHeader: t.printHeader || '',
        logoUrl: t.logoUrl || '',
        address: t.address || '',
        city: t.city || '',
        state: t.state || '',
        gstin: t.gstin || '',
        drugLicenseNo: t.drugLicenseNo || '',
      });
    } catch {
      // silently fail — user will see empty form
    } finally {
      setHospitalLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    if (tab === 'hospital' && isAdmin) fetchTenant();
  }, [tab, isAdmin, fetchTenant]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await iamApi.patch(`/users/${user?.id}`, {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
      });
      setMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setMsg({ type: 'error', text: e?.response?.data?.message || 'Update failed.' });
    } finally {
      setSaving(false);
    }
  }

  async function saveHospital(e: React.FormEvent) {
    e.preventDefault();
    setHospitalSaving(true);
    setMsg(null);
    try {
      await iamApi.patch(`/tenants/${user?.tenantId}/profile`, {
        name: hospitalForm.name || undefined,
        phone: hospitalForm.phone || undefined,
        email: hospitalForm.email || undefined,
        website: hospitalForm.website || undefined,
        registrationNo: hospitalForm.registrationNo || undefined,
        tagline: hospitalForm.tagline || undefined,
        printHeader: hospitalForm.printHeader || undefined,
        logoUrl: hospitalForm.logoUrl || undefined,
        address: hospitalForm.address || undefined,
        city: hospitalForm.city || undefined,
        state: hospitalForm.state || undefined,
        gstin: hospitalForm.gstin || undefined,
        drugLicenseNo: hospitalForm.drugLicenseNo || undefined,
      });
      setMsg({ type: 'success', text: 'Hospital profile saved. Changes will reflect on printed documents.' });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setMsg({ type: 'error', text: e?.response?.data?.message || 'Save failed.' });
    } finally {
      setHospitalSaving(false);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'profile', label: 'My Profile' },
    ...(isAdmin ? [{ key: 'hospital' as Tab, label: 'Hospital Profile' }] : []),
    { key: 'security', label: 'Security' },
  ];

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Manage your account and hospital preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setMsg(null); }}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`mb-4 text-sm rounded-lg px-4 py-2.5 border ${
          msg.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {msg.text}
        </div>
      )}

      {/* My Profile */}
      {tab === 'profile' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-2xl">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{user?.firstName} {user?.lastName}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
              <span className="inline-flex mt-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                {user?.role}
              </span>
            </div>
          </div>

          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  value={form.firstName}
                  onChange={e => setForm({ ...form, firstName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  value={form.lastName}
                  onChange={e => setForm({ ...form, lastName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                value={user?.email || ''}
                disabled
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 9876543210"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </div>
      )}

      {/* Hospital Profile */}
      {tab === 'hospital' && isAdmin && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="mb-5 pb-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Hospital Profile</h2>
            <p className="text-xs text-gray-500 mt-1">
              This information appears on consultation prescriptions, billing receipts, and other printed documents.
            </p>
          </div>

          {hospitalLoading ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading…</div>
          ) : (
            <form onSubmit={saveHospital} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hospital Name</label>
                <input
                  value={hospitalForm.name}
                  onChange={e => setHospitalForm({ ...hospitalForm, name: e.target.value })}
                  placeholder="Green Valley Hospital"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
                <input
                  value={hospitalForm.tagline}
                  onChange={e => setHospitalForm({ ...hospitalForm, tagline: e.target.value })}
                  placeholder="Caring for you, always."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    value={hospitalForm.phone}
                    onChange={e => setHospitalForm({ ...hospitalForm, phone: e.target.value })}
                    placeholder="+91 44 1234 5678"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    value={hospitalForm.email}
                    onChange={e => setHospitalForm({ ...hospitalForm, email: e.target.value })}
                    placeholder="info@hospital.com"
                    type="email"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                  <input
                    value={hospitalForm.website}
                    onChange={e => setHospitalForm({ ...hospitalForm, website: e.target.value })}
                    placeholder="https://hospital.com"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registration No.</label>
                  <input
                    value={hospitalForm.registrationNo}
                    onChange={e => setHospitalForm({ ...hospitalForm, registrationNo: e.target.value })}
                    placeholder="MCI-TN-12345"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  value={hospitalForm.address}
                  onChange={e => setHospitalForm({ ...hospitalForm, address: e.target.value })}
                  placeholder="123, Main Road"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    value={hospitalForm.city}
                    onChange={e => setHospitalForm({ ...hospitalForm, city: e.target.value })}
                    placeholder="Chennai"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input
                    value={hospitalForm.state}
                    onChange={e => setHospitalForm({ ...hospitalForm, state: e.target.value })}
                    placeholder="Tamil Nadu"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
                  <input
                    value={hospitalForm.gstin}
                    onChange={e => setHospitalForm({ ...hospitalForm, gstin: e.target.value })}
                    placeholder="33ABCDE1234F1Z5"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Drug License No.</label>
                  <input
                    value={hospitalForm.drugLicenseNo}
                    onChange={e => setHospitalForm({ ...hospitalForm, drugLicenseNo: e.target.value })}
                    placeholder="DL-TN-12345"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                <input
                  value={hospitalForm.logoUrl}
                  onChange={e => setHospitalForm({ ...hospitalForm, logoUrl: e.target.value })}
                  placeholder="https://cdn.hospital.com/logo.png"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Appears on prescription headers and certificates</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom Print Header</label>
                <textarea
                  value={hospitalForm.printHeader}
                  onChange={e => setHospitalForm({ ...hospitalForm, printHeader: e.target.value })}
                  rows={3}
                  placeholder="Green Valley Hospital&#10;123 Main Road, Chennai - 600001&#10;Ph: 044-1234 5678 | www.greenvalley.com"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Multi-line text printed at the top of prescriptions, receipts, and certificates. Overrides auto-generated header if set.
                </p>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={hospitalSaving}
                  className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60"
                >
                  {hospitalSaving ? 'Saving…' : 'Save Hospital Profile'}
                </button>
                <button
                  type="button"
                  onClick={fetchTenant}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  Reset
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Security */}
      {tab === 'security' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Session Info</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Role</span>
                <span className="font-medium text-gray-800">{user?.role}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">User ID</span>
                <span className="font-mono text-xs text-gray-600">{user?.id}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Tenant ID</span>
                <span className="font-mono text-xs text-gray-600">{user?.tenantId}</span>
              </div>
            </div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-700">
            Password changes must be done by an Admin via the Staff & Passwords panel.
          </div>
        </div>
      )}
    </div>
  );
}
