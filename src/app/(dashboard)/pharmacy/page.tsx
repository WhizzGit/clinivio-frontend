'use client';
import { useState, useEffect, useCallback } from 'react';
import { appointmentApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

interface PharmacyOrder {
  id: string;
  status: 'PENDING' | 'DISPENSING' | 'DISPENSED' | 'RETURNED';
  createdAt: string;
  appointment: {
    id: string;
    tokenNumber: number;
    patient: { firstName: string; lastName: string; uhid: string };
    doctor: { firstName: string; lastName: string };
    department?: { name: string; icon: string };
    consultation?: {
      prescriptions?: Array<{
        id: string;
        items: Array<{
          medicineName: string;
          genericName?: string;
          dosage: string;
          frequency: string;
          duration: string;
          instructions?: string;
          quantity: number;
        }>;
      }>;
    };
  };
}

interface InventoryItem {
  id: string;
  name: string;
  genericName?: string;
  category?: string;
  unit: string;
  stockQty: number;
  reorderLevel: number;
  batchNo?: string;
  expiryDate?: string;
  mrp: number;
  sellingPrice: number;
  manufacturer?: string;
  hsn?: string;
  isActive: boolean;
}

const STATUS_CONFIG = {
  PENDING:    { label: 'Pending',    bg: 'bg-yellow-100', text: 'text-yellow-700' },
  DISPENSING: { label: 'Dispensing', bg: 'bg-blue-100',   text: 'text-blue-700'   },
  DISPENSED:  { label: 'Dispensed',  bg: 'bg-green-100',  text: 'text-green-700'  },
  RETURNED:   { label: 'Returned',   bg: 'bg-red-100',    text: 'text-red-700'    },
};

const EMPTY_ITEM = {
  name: '', genericName: '', category: '', unit: 'Tablet',
  stockQty: 0, reorderLevel: 10, batchNo: '', expiryDate: '',
  mrp: 0, sellingPrice: 0, manufacturer: '', hsn: '',
};

function InventoryModal({
  item, onClose, onSave,
}: {
  item: Partial<InventoryItem> | null;
  onClose: () => void;
  onSave: (data: typeof EMPTY_ITEM) => Promise<void>;
}) {
  const [form, setForm] = useState({
    ...EMPTY_ITEM,
    ...(item ? {
      name: item.name || '',
      genericName: item.genericName || '',
      category: item.category || '',
      unit: item.unit || 'Tablet',
      stockQty: item.stockQty ?? 0,
      reorderLevel: item.reorderLevel ?? 10,
      batchNo: item.batchNo || '',
      expiryDate: item.expiryDate ? item.expiryDate.split('T')[0] : '',
      mrp: item.mrp ?? 0,
      sellingPrice: item.sellingPrice ?? 0,
      manufacturer: item.manufacturer || '',
      hsn: item.hsn || '',
    } : {}),
  });
  const [saving, setSaving] = useState(false);
  const isEdit = !!item?.id;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); onClose(); }
    catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e?.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  }

  const f = (field: keyof typeof EMPTY_ITEM, val: string | number) =>
    setForm(p => ({ ...p, [field]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Edit Medicine' : 'Add Medicine'}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Medicine Name *</label>
            <input required value={form.name} onChange={e => f('name', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Generic Name</label>
              <input value={form.genericName} onChange={e => f('genericName', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <input value={form.category} onChange={e => f('category', e.target.value)}
                placeholder="Antibiotic, Analgesic…"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
              <select value={form.unit} onChange={e => f('unit', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['Tablet', 'Capsule', 'Syrup (ml)', 'Injection (ml)', 'Cream (g)', 'Drops', 'Sachet', 'Inhaler', 'Strip'].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Stock Qty</label>
              <input type="number" min={0} value={form.stockQty} onChange={e => f('stockQty', Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Reorder At</label>
              <input type="number" min={0} value={form.reorderLevel} onChange={e => f('reorderLevel', Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">MRP (₹)</label>
              <input type="number" min={0} step="0.01" value={form.mrp} onChange={e => f('mrp', Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Selling Price (₹)</label>
              <input type="number" min={0} step="0.01" value={form.sellingPrice} onChange={e => f('sellingPrice', Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Batch No.</label>
              <input value={form.batchNo} onChange={e => f('batchNo', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Expiry Date</label>
              <input type="date" value={form.expiryDate} onChange={e => f('expiryDate', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Manufacturer</label>
              <input value={form.manufacturer} onChange={e => f('manufacturer', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">HSN Code</label>
              <input value={form.hsn} onChange={e => f('hsn', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Saving…' : isEdit ? 'Update' : 'Add Medicine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StockAdjustModal({ item, onClose, onSave }: {
  item: InventoryItem;
  onClose: () => void;
  onSave: (qty: number) => Promise<void>;
}) {
  const [qty, setQty] = useState(0);
  const [saving, setSaving] = useState(false);
  const preview = item.stockQty + qty;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (qty === 0) { onClose(); return; }
    setSaving(true);
    try { await onSave(qty); onClose(); }
    catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e?.response?.data?.message || 'Adjustment failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Adjust Stock</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="font-medium text-gray-900">{item.name}</p>
            <p className="text-gray-500 text-xs mt-0.5">Current stock: <span className="font-semibold text-gray-800">{item.stockQty} {item.unit}</span></p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Adjustment (use negative to reduce stock)
            </label>
            <input
              type="number"
              value={qty}
              onChange={e => setQty(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {qty !== 0 && (
            <div className={`text-sm rounded-lg px-3 py-2 ${preview < 0 ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
              New stock: <span className="font-bold">{preview} {item.unit}</span>
              {preview < 0 && ' — cannot go below zero'}
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving || preview < 0}
              className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Saving…' : 'Apply'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface PharmacyAnalytics {
  inventory: {
    totalItems: number; inventoryValue: number; lowStockCount: number; lowStockValue: number;
    expiringSoonCount: number; expiringSoonValue: number;
    categoryBreakdown: Record<string, { count: number; value: number }>;
  };
  orders: { dispensedToday: number; dispensedMTD: number; pending: number; revenueMTD: number };
}

function PharmacyAnalyticsTab() {
  const [data, setData] = useState<PharmacyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    appointmentApi.get('/stats/pharmacy')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading analytics…</div>;
  if (!data) return <div className="text-center text-gray-400 py-12">Analytics unavailable</div>;

  const fmt = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString('en-IN')}`;
  const categoryEntries = Object.entries(data.inventory.categoryBreakdown).sort(([, a], [, b]) => b.value - a.value);
  const maxValue = Math.max(...categoryEntries.map(([, v]) => v.value), 1);

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Inventory Value', value: fmt(data.inventory.inventoryValue), sub: `${data.inventory.totalItems} active medicines`, icon: '📦', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
          { label: 'Revenue (MTD)', value: fmt(data.orders.revenueMTD), sub: `${data.orders.dispensedMTD} orders dispensed`, icon: '💰', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
          { label: 'Low Stock Risk', value: fmt(data.inventory.lowStockValue), sub: `${data.inventory.lowStockCount} items below reorder`, icon: '⚠️', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
          { label: 'Expiring Soon', value: fmt(data.inventory.expiringSoonValue), sub: `${data.inventory.expiringSoonCount} items in 90 days`, icon: '📅', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
        ].map(card => (
          <div key={card.label} className={`rounded-xl border p-4 ${card.bg} ${card.border}`}>
            <div className="text-2xl mb-2">{card.icon}</div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-sm text-gray-600 font-medium mt-0.5">{card.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Orders summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Dispensing Activity</h3>
          <div className="space-y-3">
            {[
              { label: 'Dispensed Today', value: data.orders.dispensedToday, color: 'text-green-700', bg: 'bg-green-100' },
              { label: 'Dispensed This Month', value: data.orders.dispensedMTD, color: 'text-blue-700', bg: 'bg-blue-100' },
              { label: 'Pending Orders', value: data.orders.pending, color: 'text-yellow-700', bg: 'bg-yellow-100' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{item.label}</span>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${item.bg} ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Inventory by Category</h3>
          {categoryEntries.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No categorized inventory</p>
          ) : (
            <div className="space-y-2">
              {categoryEntries.slice(0, 6).map(([cat, vals]) => {
                const pct = Math.round((vals.value / maxValue) * 100);
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-700 font-medium">{cat || 'Uncategorized'}</span>
                      <div className="flex gap-2 text-gray-500">
                        <span>{vals.count} items</span>
                        <span className="font-semibold text-gray-900">{fmt(vals.value)}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {(data.inventory.lowStockCount > 0 || data.inventory.expiringSoonCount > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Action Required</h3>
          <div className="space-y-2">
            {data.inventory.lowStockCount > 0 && (
              <div className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <span className="text-orange-500 text-lg mt-0.5">⚠️</span>
                <div>
                  <p className="text-sm font-medium text-orange-900">{data.inventory.lowStockCount} medicines below reorder level</p>
                  <p className="text-xs text-orange-700 mt-0.5">Inventory at risk: {fmt(data.inventory.lowStockValue)} — place purchase orders soon</p>
                </div>
              </div>
            )}
            {data.inventory.expiringSoonCount > 0 && (
              <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <span className="text-red-500 text-lg mt-0.5">📅</span>
                <div>
                  <p className="text-sm font-medium text-red-900">{data.inventory.expiringSoonCount} medicines expiring within 90 days</p>
                  <p className="text-xs text-red-700 mt-0.5">Value at risk: {fmt(data.inventory.expiringSoonValue)} — review and return/write-off</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PharmacyPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PHARMACIST';
  const [tab, setTab] = useState<'orders' | 'inventory' | 'analytics' | 'settings'>('orders');

  // Orders state
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [selected, setSelected] = useState<PharmacyOrder | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('PENDING');
  const [updating, setUpdating] = useState<string | null>(null);

  // Pharmacy settings state
  const [pharmaSettings, setPharmaSettings] = useState({
    pharmacyName: '', drugLicenseNo: '', gstin: '', registrationNo: '',
    address: '', city: '', state: '', pincode: '', phone: '', email: '',
    printHeader: '',
  });
  const [pharmaSettingsLoading, setPharmaSettingsLoading] = useState(false);
  const [pharmaSettingsSaving, setPharmaSettingsSaving] = useState(false);
  const [pharmaSettingsMsg, setPharmaSettingsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchPharmaSettings = useCallback(async () => {
    if (!user?.tenantId) return;
    setPharmaSettingsLoading(true);
    try {
      const res = await appointmentApi.get(`/pharmacy/settings`);
      const t = res.data;
      setPharmaSettings({
        pharmacyName: t.pharmacyName || '',
        drugLicenseNo: t.drugLicenseNo || '',
        gstin: t.gstin || '',
        registrationNo: t.registrationNo || '',
        address: t.address || '',
        city: t.city || '',
        state: t.state || '',
        pincode: t.pincode || '',
        phone: t.phone || '',
        email: t.email || '',
        printHeader: t.printHeader || '',
      });
    } catch {
      // silently fail — empty form
    } finally {
      setPharmaSettingsLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    if (tab === 'settings') fetchPharmaSettings();
  }, [tab, fetchPharmaSettings]);

  async function savePharmaSettings(e: React.FormEvent) {
    e.preventDefault();
    setPharmaSettingsSaving(true);
    setPharmaSettingsMsg(null);
    try {
      await appointmentApi.patch('/pharmacy/settings', pharmaSettings);
      setPharmaSettingsMsg({ type: 'success', text: 'Pharmacy profile saved. Changes will reflect on printed bills.' });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setPharmaSettingsMsg({ type: 'error', text: e?.response?.data?.message || 'Save failed.' });
    } finally {
      setPharmaSettingsSaving(false);
    }
  }

  // Inventory state
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [invLoading, setInvLoading] = useState(false);
  const [invSearch, setInvSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [invModal, setInvModal] = useState<{ open: boolean; item: Partial<InventoryItem> | null }>({ open: false, item: null });
  const [stockModal, setStockModal] = useState<InventoryItem | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const params = filterStatus ? `?status=${filterStatus}` : '';
      const res = await appointmentApi.get(`/pharmacy/orders${params}`);
      setOrders(Array.isArray(res.data) ? res.data : (res.data?.data ?? []));
    } finally {
      setOrdersLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchOrders();
    const t = setInterval(fetchOrders, 15000);
    return () => clearInterval(t);
  }, [fetchOrders]);

  const fetchInventory = useCallback(async () => {
    setInvLoading(true);
    try {
      const params = new URLSearchParams();
      if (invSearch) params.set('q', invSearch);
      if (lowStockOnly) params.set('lowStock', 'true');
      const res = await appointmentApi.get(`/pharmacy/inventory?${params}`);
      setInventory(Array.isArray(res.data) ? res.data : (res.data?.data ?? []));
    } finally {
      setInvLoading(false);
    }
  }, [invSearch, lowStockOnly]);

  useEffect(() => {
    if (tab === 'inventory') fetchInventory();
  }, [tab, fetchInventory]);

  const updateStatus = async (orderId: string, status: string) => {
    setUpdating(orderId);
    try {
      await appointmentApi.patch(`/pharmacy/orders/${orderId}`, { status });
      await fetchOrders();
      if (selected?.id === orderId) setSelected(null);
    } catch {
      alert('Update failed');
    } finally {
      setUpdating(null);
    }
  };

  async function saveInventoryItem(data: typeof EMPTY_ITEM) {
    if (invModal.item?.id) {
      await appointmentApi.patch(`/pharmacy/inventory/${invModal.item.id}`, data);
    } else {
      await appointmentApi.post('/pharmacy/inventory', data);
    }
    await fetchInventory();
  }

  async function adjustStock(qty: number) {
    if (!stockModal) return;
    await appointmentApi.patch(`/pharmacy/inventory/${stockModal.id}/stock`, { qty });
    await fetchInventory();
  }

  async function deactivateItem(id: string) {
    if (!confirm('Remove this item from inventory?')) return;
    await appointmentApi.delete(`/pharmacy/inventory/${id}`);
    await fetchInventory();
  }

  const filtered = orders.filter(o => !filterStatus || o.status === filterStatus);

  return (
    <div>
      {/* Page header + tabs */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pharmacy</h1>
          <p className="text-sm text-gray-500">
            {tab === 'orders' ? 'Dispense prescriptions from completed consultations' : tab === 'inventory' ? 'Manage medicine inventory and stock levels' : tab === 'analytics' ? 'Cost analysis, inventory health, and dispensing trends' : 'Pharmacy profile for printing on bills and receipts'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {[
              { key: 'orders', label: 'Orders' },
              { key: 'inventory', label: 'Inventory' },
              { key: 'analytics', label: 'Analytics' },
              { key: 'settings', label: 'Settings' },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key as 'orders' | 'inventory' | 'analytics' | 'settings')}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── ORDERS TAB ── */}
      {tab === 'orders' && (
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-2">
                {['', 'PENDING', 'DISPENSING', 'DISPENSED'].map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      filterStatus === s
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {s || 'All'}
                  </button>
                ))}
              </div>
              <button onClick={fetchOrders} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Refresh
              </button>
            </div>

            {ordersLoading ? (
              <div className="flex items-center justify-center h-40 text-gray-400">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <p className="text-3xl mb-2">💊</p>
                <p className="text-sm">No {filterStatus.toLowerCase() || ''} orders</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(order => {
                  const cfg = STATUS_CONFIG[order.status];
                  const apt = order.appointment;
                  const items = apt.consultation?.prescriptions?.[0]?.items || [];
                  return (
                    <button
                      key={order.id}
                      onClick={() => setSelected(order)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        selected?.id === order.id
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-400'
                          : 'border-gray-200 bg-white hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">
                            #{apt.tokenNumber}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">
                              {apt.patient.firstName} {apt.patient.lastName}
                            </p>
                            <p className="text-xs text-gray-400">{apt.patient.uhid}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Dr. {apt.doctor.firstName} {apt.doctor.lastName}
                              {apt.department && ` · ${apt.department.icon} ${apt.department.name}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>
                            {cfg.label}
                          </span>
                          <p className="text-xs text-gray-400 mt-1">{items.length} med{items.length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      {items.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {items.slice(0, 3).map((item, i) => (
                            <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                              {item.medicineName} {item.dosage}
                            </span>
                          ))}
                          {items.length > 3 && <span className="text-xs text-gray-400">+{items.length - 3} more</span>}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detail Panel */}
          <div className="w-80 flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-0">
              <h2 className="font-semibold text-gray-900 mb-4">Order Detail</h2>
              {!selected ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                  <p className="text-3xl mb-2">💊</p>
                  <p className="text-sm text-center">Select an order to view prescription details</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                    <p className="font-medium text-gray-900 text-sm">
                      {selected.appointment.patient.firstName} {selected.appointment.patient.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{selected.appointment.patient.uhid}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Token #{selected.appointment.tokenNumber} · Dr. {selected.appointment.doctor.firstName} {selected.appointment.doctor.lastName}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Medicines</h3>
                    {(selected.appointment.consultation?.prescriptions?.[0]?.items || []).length === 0 ? (
                      <p className="text-xs text-gray-400">No prescription found</p>
                    ) : (
                      <div className="space-y-2">
                        {selected.appointment.consultation!.prescriptions![0].items.map((item, i) => (
                          <div key={i} className="p-2.5 bg-gray-50 rounded-lg text-xs">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium text-gray-900">{item.medicineName}</p>
                                {item.genericName && <p className="text-gray-500">{item.genericName}</p>}
                              </div>
                              <span className="text-gray-600 font-medium">×{item.quantity}</span>
                            </div>
                            <p className="text-gray-600 mt-1">{item.dosage} · {item.frequency} · {item.duration}</p>
                            {item.instructions && <p className="text-gray-500 mt-0.5 italic">{item.instructions}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    {selected.status === 'PENDING' && (
                      <button onClick={() => updateStatus(selected.id, 'DISPENSING')} disabled={updating === selected.id}
                        className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        {updating === selected.id ? 'Updating…' : 'Start Dispensing'}
                      </button>
                    )}
                    {selected.status === 'DISPENSING' && (
                      <button onClick={() => updateStatus(selected.id, 'DISPENSED')} disabled={updating === selected.id}
                        className="w-full py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50">
                        {updating === selected.id ? 'Updating…' : 'Mark Dispensed'}
                      </button>
                    )}
                    {['PENDING', 'DISPENSING'].includes(selected.status) && (
                      <button onClick={() => updateStatus(selected.id, 'RETURNED')} disabled={updating === selected.id}
                        className="w-full py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50">
                        Return / Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── INVENTORY TAB ── */}
      {tab === 'inventory' && (
        <div>
          {/* Toolbar */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={invSearch}
                onChange={e => setInvSearch(e.target.value)}
                placeholder="Search medicines…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={e => setLowStockOnly(e.target.checked)}
                className="rounded border-gray-300 text-amber-500"
              />
              Low stock only
            </label>
            <button onClick={fetchInventory} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              Refresh
            </button>
            {isAdmin && (
              <button
                onClick={() => setInvModal({ open: true, item: null })}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Medicine
              </button>
            )}
          </div>

          {/* Table */}
          {invLoading ? (
            <div className="flex items-center justify-center h-40 text-gray-400">Loading…</div>
          ) : inventory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <p className="text-3xl mb-2">📦</p>
              <p className="text-sm">{lowStockOnly ? 'No low-stock items' : 'No medicines in inventory'}</p>
              {isAdmin && !lowStockOnly && (
                <button
                  onClick={() => setInvModal({ open: true, item: null })}
                  className="mt-3 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add first medicine
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Medicine</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">MRP</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Selling</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Expiry</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {inventory.map(item => {
                    const isLow = item.stockQty <= item.reorderLevel;
                    const expDate = item.expiryDate ? new Date(item.expiryDate) : null;
                    const isExpiringSoon = expDate && expDate < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{item.name}</p>
                          {item.genericName && <p className="text-xs text-gray-400">{item.genericName}</p>}
                          <p className="text-xs text-gray-400">{item.unit} · {item.manufacturer || '—'}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{item.category || '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>
                            {item.stockQty}
                          </span>
                          {isLow && (
                            <span className="ml-1.5 text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full">Low</span>
                          )}
                          <p className="text-xs text-gray-400">min {item.reorderLevel}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">₹{Number(item.mrp).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">₹{Number(item.sellingPrice).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          {expDate ? (
                            <span className={isExpiringSoon ? 'text-amber-600 font-medium' : 'text-gray-600'}>
                              {expDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                              {isExpiringSoon && <span className="ml-1 text-xs">(soon)</span>}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setStockModal(item)}
                              title="Adjust stock"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                              </svg>
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => setInvModal({ open: true, item })}
                                  title="Edit"
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => deactivateItem(item.id)}
                                  title="Remove"
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </>
                            )}
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
      )}

      {/* ── ANALYTICS TAB ── */}
      {tab === 'analytics' && <PharmacyAnalyticsTab />}

      {/* ── SETTINGS TAB ── */}
      {tab === 'settings' && (
        <div className="max-w-2xl">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="mb-5 pb-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Pharmacy Profile</h2>
              <p className="text-xs text-gray-500 mt-1">
                These details appear on pharmacy bills, receipts, and dispensing records.
              </p>
            </div>

            {pharmaSettingsMsg && (
              <div className={`mb-4 text-sm rounded-lg px-4 py-2.5 border ${
                pharmaSettingsMsg.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                {pharmaSettingsMsg.text}
              </div>
            )}

            {pharmaSettingsLoading ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading…</div>
            ) : (
              <form onSubmit={savePharmaSettings} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Pharmacy Name</label>
                  <input
                    value={pharmaSettings.pharmacyName}
                    onChange={e => setPharmaSettings({ ...pharmaSettings, pharmacyName: e.target.value })}
                    placeholder="Green Valley Pharmacy"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Printed at the top of pharmacy bills. Leave blank to use hospital name.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Drug License No.</label>
                    <input
                      value={pharmaSettings.drugLicenseNo}
                      onChange={e => setPharmaSettings({ ...pharmaSettings, drugLicenseNo: e.target.value })}
                      placeholder="DL-TN-12345"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">GSTIN</label>
                    <input
                      value={pharmaSettings.gstin}
                      onChange={e => setPharmaSettings({ ...pharmaSettings, gstin: e.target.value })}
                      placeholder="29ABCDE1234F1Z5"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Registration No.</label>
                    <input
                      value={pharmaSettings.registrationNo}
                      onChange={e => setPharmaSettings({ ...pharmaSettings, registrationNo: e.target.value })}
                      placeholder="PCI-TN-789"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      value={pharmaSettings.phone}
                      onChange={e => setPharmaSettings({ ...pharmaSettings, phone: e.target.value })}
                      placeholder="+91 44 1234 5678"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <input
                    value={pharmaSettings.email}
                    onChange={e => setPharmaSettings({ ...pharmaSettings, email: e.target.value })}
                    type="email"
                    placeholder="pharmacy@hospital.com"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
                  <input
                    value={pharmaSettings.address}
                    onChange={e => setPharmaSettings({ ...pharmaSettings, address: e.target.value })}
                    placeholder="123, Hospital Road"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
                    <input
                      value={pharmaSettings.city}
                      onChange={e => setPharmaSettings({ ...pharmaSettings, city: e.target.value })}
                      placeholder="Chennai"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">State</label>
                    <input
                      value={pharmaSettings.state}
                      onChange={e => setPharmaSettings({ ...pharmaSettings, state: e.target.value })}
                      placeholder="Tamil Nadu"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Pincode</label>
                    <input
                      value={pharmaSettings.pincode}
                      onChange={e => setPharmaSettings({ ...pharmaSettings, pincode: e.target.value })}
                      placeholder="600001"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Custom Bill Header</label>
                  <textarea
                    value={pharmaSettings.printHeader}
                    onChange={e => setPharmaSettings({ ...pharmaSettings, printHeader: e.target.value })}
                    rows={3}
                    placeholder="Green Valley Pharmacy&#10;Drug Lic: DL-TN-12345 | GSTIN: 33ABCDE1234F1Z5&#10;123 Main Road, Chennai - 600001 | Ph: 044-1234 5678"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">Printed at the top of pharmacy bills. Overrides auto-generated header if set.</p>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={pharmaSettingsSaving}
                    className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60"
                  >
                    {pharmaSettingsSaving ? 'Saving…' : 'Save Pharmacy Profile'}
                  </button>
                  <button
                    type="button"
                    onClick={fetchPharmaSettings}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                  >
                    Reset
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {invModal.open && (
        <InventoryModal
          item={invModal.item}
          onClose={() => setInvModal({ open: false, item: null })}
          onSave={saveInventoryItem}
        />
      )}
      {stockModal && (
        <StockAdjustModal
          item={stockModal}
          onClose={() => setStockModal(null)}
          onSave={adjustStock}
        />
      )}
    </div>
  );
}
