'use client';
import { useState } from 'react';
import { useStockLedger } from './hooks';
import type { StockMovementType } from '@/types';

const MOVEMENT_CONFIG: Record<StockMovementType, { label: string; bg: string; text: string; sign: string }> = {
  PURCHASE:         { label: 'Purchase',        bg: 'bg-green-100', text: 'text-green-700', sign: '+' },
  DISPENSE:         { label: 'Dispensed',       bg: 'bg-blue-100',  text: 'text-blue-700',  sign: '' },
  ADJUSTMENT:       { label: 'Adjustment',      bg: 'bg-amber-100', text: 'text-amber-700', sign: '' },
  RETURN_TO_VENDOR: { label: 'Return to Vendor', bg: 'bg-red-100',   text: 'text-red-700',   sign: '' },
};

const REF_LABEL: Record<string, string> = {
  PHARMACY_PURCHASE: 'Purchase invoice',
  PHARMACY_ORDER: 'Pharmacy order',
  PHARMACY_PURCHASE_RETURN: 'Purchase return',
  MANUAL_ADJUSTMENT: 'Manual adjustment',
};

export default function StockLedgerDrawer({
  inventoryId, itemName, onClose,
}: {
  inventoryId: string;
  itemName: string;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useStockLedger(inventoryId, page, 50);
  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-xl h-full shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Stock Movement History</h2>
            <p className="text-xs text-gray-500 mt-0.5">{itemName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <p className="text-3xl mb-2">📋</p>
              <p className="text-sm">No stock movements recorded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map(row => {
                const cfg = MOVEMENT_CONFIG[row.movementType];
                const isPositive = row.quantityChange > 0;
                return (
                  <div key={row.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                      <span className={`text-sm font-bold ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
                        {isPositive ? '+' : ''}{row.quantityChange}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-xs text-gray-500">
                      <span>{new Date(row.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      <span>Balance: <span className="font-semibold text-gray-800">{row.balanceAfter}</span></span>
                    </div>
                    {(row.batchNo || row.refType) && (
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400">
                        {row.batchNo && <span>Batch: {row.batchNo}</span>}
                        {row.refType && <span>{REF_LABEL[row.refType] ?? row.refType}</span>}
                      </div>
                    )}
                    {row.notes && <p className="mt-1 text-xs text-gray-500 italic">{row.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Page {pagination.page} of {pagination.totalPages} · {pagination.total} movements</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-2 py-1 border border-gray-300 rounded disabled:opacity-40">Prev</button>
              <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}
                className="px-2 py-1 border border-gray-300 rounded disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
