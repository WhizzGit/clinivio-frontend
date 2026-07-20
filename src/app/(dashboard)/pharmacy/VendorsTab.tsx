'use client';
import { useState } from 'react';
import { useToast } from '@/components/ui/toaster';
import { useCreateVendor, useUpdateVendor, useVendors } from './hooks';
import type { Vendor } from '@/types';

const EMPTY_FORM = {
  name: '', contactPerson: '', phone: '', email: '', gstin: '',
  addressLine1: '', addressLine2: '', city: '', state: '', pincode: '', notes: '',
};

function VendorFormModal({
  vendor, onClose,
}: {
  vendor: Vendor | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const createVendor = useCreateVendor();
  const updateVendor = useUpdateVendor();
  const isEdit = !!vendor;
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    ...(vendor ? {
      name: vendor.name,
      contactPerson: vendor.contactPerson ?? '',
      phone: vendor.phone ?? '',
      email: vendor.email ?? '',
      gstin: vendor.gstin ?? '',
      addressLine1: vendor.addressLine1 ?? '',
      addressLine2: vendor.addressLine2 ?? '',
      city: vendor.city ?? '',
      state: vendor.state ?? '',
      pincode: vendor.pincode ?? '',
      notes: vendor.notes ?? '',
    } : {}),
  });
  const [error, setError] = useState<string | null>(null);
  const saving = createVendor.isPending || updateVendor.isPending;

  const f = (field: keyof typeof EMPTY_FORM, val: string) => setForm(p => ({ ...p, [field]: val }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError('Vendor name is required'); return; }
    try {
      if (isEdit) {
        await updateVendor.mutateAsync({ id: vendor!.id, ...form });
        toast({ title: 'Vendor updated', description: form.name, variant: 'success' });
      } else {
        await createVendor.mutateAsync(form);
        toast({ title: 'Vendor added', description: form.name, variant: 'success' });
      }
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || 'Save failed');
    }
  }

  const INP = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
  const LBL = 'block text-xs font-medium text-gray-700 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Edit Vendor' : 'Add Vendor'}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className={LBL}>Vendor Name *</label>
            <input required value={form.name} onChange={e => f('name', e.target.value)} className={INP} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>Contact Person</label>
              <input value={form.contactPerson} onChange={e => f('contactPerson', e.target.value)} className={INP} />
            </div>
            <div>
              <label className={LBL}>Phone</label>
              <input value={form.phone} onChange={e => f('phone', e.target.value)} className={INP} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>Email</label>
              <input type="email" value={form.email} onChange={e => f('email', e.target.value)} className={INP} />
            </div>
            <div>
              <label className={LBL}>GSTIN</label>
              <input value={form.gstin} onChange={e => f('gstin', e.target.value.toUpperCase())} className={INP} />
            </div>
          </div>
          <div>
            <label className={LBL}>Address Line 1</label>
            <input value={form.addressLine1} onChange={e => f('addressLine1', e.target.value)} className={INP} />
          </div>
          <div>
            <label className={LBL}>Address Line 2</label>
            <input value={form.addressLine2} onChange={e => f('addressLine2', e.target.value)} className={INP} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={LBL}>City</label>
              <input value={form.city} onChange={e => f('city', e.target.value)} className={INP} />
            </div>
            <div>
              <label className={LBL}>State</label>
              <input value={form.state} onChange={e => f('state', e.target.value)} className={INP} />
            </div>
            <div>
              <label className={LBL}>Pincode</label>
              <input value={form.pincode} onChange={e => f('pincode', e.target.value)} className={INP} />
            </div>
          </div>
          <div>
            <label className={LBL}>Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => f('notes', e.target.value)}
              className={INP + ' resize-none'} />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Saving…' : isEdit ? 'Update Vendor' : 'Add Vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VendorsTab({ isAdmin }: { isAdmin: boolean }) {
  const [search, setSearch] = useState('');
  const { data: vendors = [], isLoading, refetch } = useVendors(search || undefined);
  const [selected, setSelected] = useState<Vendor | null>(null);
  const [modal, setModal] = useState<{ open: boolean; vendor: Vendor | null }>({ open: false, vendor: null });
  const updateVendor = useUpdateVendor();
  const { toast } = useToast();

  async function toggleActive(v: Vendor) {
    try {
      await updateVendor.mutateAsync({ id: v.id, isActive: !v.isActive });
      toast({ title: v.isActive ? 'Vendor deactivated' : 'Vendor reactivated', description: v.name, variant: 'success' });
      if (selected?.id === v.id) setSelected(null);
    } catch {
      toast({ title: 'Could not update vendor', variant: 'destructive' });
    }
  }

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search vendors by name or GSTIN…"
            className="w-72 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button onClick={() => refetch()} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">Refresh</button>
            {isAdmin && (
              <button onClick={() => setModal({ open: true, vendor: null })}
                className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Vendor
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading…</div>
        ) : vendors.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <p className="text-3xl mb-2">🏭</p>
            <p className="text-sm">{search ? 'No vendors match your search' : 'No vendors added yet'}</p>
            {isAdmin && !search && (
              <button onClick={() => setModal({ open: true, vendor: null })} className="mt-3 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Add first vendor
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">GSTIN</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {vendors.map(v => (
                  <tr key={v.id} onClick={() => setSelected(v === selected ? null : v)}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${selected?.id === v.id ? 'bg-blue-50' : ''} ${!v.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{v.name}</p>
                      {v.city && <p className="text-xs text-gray-400">{v.city}{v.state ? `, ${v.state}` : ''}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {v.contactPerson || '—'}
                      {v.phone && <p className="text-xs text-gray-400">{v.phone}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{v.gstin || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {v.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="w-80 flex-shrink-0">
        <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-0 max-h-[80vh] overflow-y-auto">
          <h2 className="font-semibold text-gray-900 mb-4">Vendor Detail</h2>
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <p className="text-3xl mb-2">🏭</p>
              <p className="text-sm text-center">Select a vendor to view details</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100 space-y-1">
                <p className="font-semibold text-gray-900 text-sm">{selected.name}</p>
                {selected.gstin && <p className="text-xs text-gray-500">GSTIN: {selected.gstin}</p>}
                {selected.contactPerson && <p className="text-xs text-gray-500">Contact: {selected.contactPerson}</p>}
                {selected.phone && <p className="text-xs text-gray-500">{selected.phone}</p>}
                {selected.email && <p className="text-xs text-gray-500">{selected.email}</p>}
              </div>
              {(selected.addressLine1 || selected.city) && (
                <div className="text-xs text-gray-600 space-y-0.5">
                  {selected.addressLine1 && <p>{selected.addressLine1}</p>}
                  {selected.addressLine2 && <p>{selected.addressLine2}</p>}
                  <p>{[selected.city, selected.state, selected.pincode].filter(Boolean).join(', ')}</p>
                </div>
              )}
              {selected.notes && <p className="text-xs text-gray-600 italic">{selected.notes}</p>}
              {isAdmin && (
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button onClick={() => setModal({ open: true, vendor: selected })}
                    className="flex-1 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">Edit</button>
                  <button onClick={() => toggleActive(selected)}
                    className={`flex-1 py-1.5 text-xs rounded-lg ${selected.isActive ? 'border border-red-300 text-red-600 hover:bg-red-50' : 'border border-green-300 text-green-600 hover:bg-green-50'}`}>
                    {selected.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {modal.open && (
        <VendorFormModal vendor={modal.vendor} onClose={() => setModal({ open: false, vendor: null })} />
      )}
    </div>
  );
}
