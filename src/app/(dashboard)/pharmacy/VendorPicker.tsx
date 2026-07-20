'use client';
import { useState } from 'react';
import { useToast } from '@/components/ui/toaster';
import { useCreateVendor, useVendors } from './hooks';
import type { Vendor } from '@/types';

// Shared vendor search-and-pick control used by the Purchase and Purchase
// Return forms — search existing vendors, quick-add a new one inline, or
// (when allowFreeText is true) fall back to a plain vendor name string.
export default function VendorPicker({
  vendorId, vendorName, onSelect, onFreeText, allowFreeText = true,
}: {
  vendorId: string;
  vendorName: string;
  onSelect: (v: Vendor) => void;
  onFreeText?: (name: string) => void;
  allowFreeText?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const { data: suggestions = [] } = useVendors(query.length >= 2 ? query : undefined);
  const createVendor = useCreateVendor();
  const { toast } = useToast();

  if (vendorId) {
    return (
      <div className="flex items-center justify-between bg-white border border-green-300 rounded-lg px-3 py-2">
        <p className="text-sm font-medium text-gray-900">{vendorName}</p>
        <button type="button" onClick={() => { onSelect({ id: '', name: '' } as Vendor); setQuery(''); }}
          className="text-xs text-gray-400 hover:text-gray-700">Change</button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        required={allowFreeText ? !vendorName : true}
        value={query || vendorName}
        onChange={e => {
          setQuery(e.target.value);
          onFreeText?.(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={allowFreeText ? 'Search vendor or type a new name…' : 'Search vendor…'}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {open && query.length >= 2 && (
        <div className="absolute z-20 left-0 right-0 top-full mt-0.5 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map(v => (
            <button key={v.id} type="button" onMouseDown={() => { onSelect(v); setQuery(''); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-50 last:border-0 text-sm">
              <span className="font-medium">{v.name}</span>
              {v.gstin && <span className="text-gray-400 ml-2 text-xs">{v.gstin}</span>}
            </button>
          ))}
          {!adding ? (
            <button type="button" onMouseDown={() => { setAdding(true); setNewVendorName(query); }}
              className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50">
              + Add &ldquo;{query}&rdquo; as a new vendor
            </button>
          ) : (
            <div className="p-2 flex gap-2" onMouseDown={e => e.preventDefault()}>
              <input value={newVendorName} onChange={e => setNewVendorName(e.target.value)}
                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
              <button type="button"
                onClick={async () => {
                  if (!newVendorName.trim()) return;
                  try {
                    const v = await createVendor.mutateAsync({ name: newVendorName.trim() });
                    toast({ title: 'Vendor added', description: v.name, variant: 'success' });
                    onSelect(v);
                    setAdding(false);
                    setQuery('');
                    setOpen(false);
                  } catch {
                    toast({ title: 'Could not add vendor', variant: 'destructive' });
                  }
                }}
                disabled={createVendor.isPending}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-60">
                {createVendor.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
