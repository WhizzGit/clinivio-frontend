'use client';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { fmtDate } from './constants';
import { useOrders, useTATReport } from './hooks';
import type { LabOrder } from './types';

export default function ReportsTab({ onSelectOrder }: { onSelectOrder: (order: LabOrder) => void }) {
  const [breachedOnly, setBreachedOnly] = useState(false);
  const { data: tat, isLoading } = useTATReport({ breachedOnly }, 1, 50);
  const { data: completed = [] } = useOrders({ status: 'COMPLETED' }, 1, 20);

  return (
    <div className="space-y-6">
      {/* TAT report */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Turnaround Time Report</h2>
            <p className="text-xs text-gray-500">Actual vs. promised turnaround per test, breach-flagged</p>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={breachedOnly} onChange={e => setBreachedOnly(e.target.checked)} className="rounded" />
            Breached only
          </label>
        </div>

        {tat?.summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {[
              { label: 'Tests Completed', value: tat.summary.totalTests, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
              { label: 'Breached', value: tat.summary.breachedCount, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
              { label: 'Breach Rate', value: `${tat.summary.breachRate}%`, color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
              { label: 'Avg Actual Hours', value: `${tat.summary.avgActualHours}h`, color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
            ].map(m => (
              <div key={m.label} className={cn('rounded-xl border p-4', m.bg, m.border)}>
                <p className={cn('text-2xl font-bold', m.color)}>{m.value}</p>
                <p className="text-xs text-gray-600 font-medium mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>
          ) : !tat?.data.length ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
              <span className="text-3xl">⏱️</span>
              <p className="text-sm">No completed tests {breachedOnly ? 'have breached TAT' : 'yet'}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Order #</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Test</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Category</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Promised</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Actual</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Completed</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tat.data.map(row => (
                  <tr key={`${row.orderId}-${row.testId}`} className={cn('hover:bg-gray-50', row.breached && 'bg-red-50/40')}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-800">{row.orderNumber}</td>
                    <td className="px-4 py-3 text-gray-900">{row.testName}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{row.category}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{row.promisedHours}h</td>
                    <td className={cn('px-4 py-3 text-right font-semibold', row.breached ? 'text-red-600' : 'text-gray-900')}>{row.actualHours}h</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(row.completedAt)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', row.breached ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700')}>
                        {row.breached ? 'Breached' : 'On Time'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Results / report viewer */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Recently Completed Reports</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {completed.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-400">
              <span className="text-3xl">📄</span>
              <p className="text-sm">No completed reports yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {completed.map(order => (
                  <tr key={order.id} onClick={() => onSelectOrder(order)} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-800">{order.orderNumber}</td>
                    <td className="px-4 py-3 text-gray-900">
                      {order.patient ? `${order.patient.firstName} ${order.patient.lastName}` : (order.walkInName ?? 'Walk-in')}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(order.completedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-blue-600 text-xs hover:underline">View & Print →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
