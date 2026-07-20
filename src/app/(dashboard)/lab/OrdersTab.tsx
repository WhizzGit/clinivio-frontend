'use client';
import { cn } from '@/lib/utils';
import { STATUS_STYLES, STATUS_LABELS, PRIORITY_STYLES, BILLING_MODE_STYLES, fmtDate } from './constants';
import type { LabOrder } from './types';

const STATUS_TABS = [
  { key: 'ALL', label: 'All' }, { key: 'PENDING', label: 'Pending' },
  { key: 'SAMPLE_COLLECTED', label: 'Sample Collected' }, { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'COMPLETED', label: 'Completed' },
];

export default function OrdersTab({
  orders, loading, activeTab, onActiveTabChange, categoryFilter, onSelectOrder,
}: {
  orders: LabOrder[];
  loading: boolean;
  activeTab: string;
  onActiveTabChange: (tab: string) => void;
  categoryFilter: string;
  onSelectOrder: (order: LabOrder) => void;
}) {
  return (
    <>
      {/* Status filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 w-fit">
        {STATUS_TABS.map(tab => (
          <button key={tab.key} onClick={() => onActiveTabChange(tab.key)}
            className={cn('px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
              activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
            <span className="text-4xl">🔬</span>
            <p className="text-sm">No lab orders{categoryFilter ? ` in ${categoryFilter}` : ''}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Order #</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Patient</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Tests</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Value</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Doctor</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Time</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map(order => {
                const hasCritical = order.items.some(i => i.flag === 'CRITICAL');
                const pendingCount = order.items.filter(i => !i.result).length;
                const orderValue = order.items.reduce((s, i) => s + Number(i.labTest.price), 0);
                const patientLabel = order.patient
                  ? `${order.patient.firstName} ${order.patient.lastName}`
                  : (order.walkInName ?? 'Walk-in');
                const patientSub = order.patient ? order.patient.uhid : 'Walk-in / outsider';
                return (
                  <tr key={order.id}
                    className={cn('hover:bg-gray-50 cursor-pointer transition-colors', hasCritical && 'bg-red-50 hover:bg-red-100')}
                    onClick={() => onSelectOrder(order)}>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-semibold text-gray-800">{order.orderNumber}</p>
                      <div className="flex gap-1 mt-0.5">
                        <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', PRIORITY_STYLES[order.priority])}>{order.priority}</span>
                        <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', BILLING_MODE_STYLES[order.billingMode])}>
                          {order.billingMode === 'CREDIT' ? 'IP · Credit' : 'Cash'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{patientLabel}</p>
                      <p className="text-xs text-gray-400">{patientSub}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700">{order.items.length} test{order.items.length !== 1 ? 's' : ''}</p>
                      {pendingCount > 0 && order.status !== 'PENDING' && (
                        <p className="text-xs text-orange-500">{pendingCount} results pending</p>
                      )}
                      {hasCritical && <p className="text-xs text-red-600 font-semibold">⚠ Critical</p>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-semibold text-gray-900">₹{orderValue.toLocaleString('en-IN')}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">Dr. {order.orderedBy.firstName} {order.orderedBy.lastName}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(order.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[order.status])}>
                        {STATUS_LABELS[order.status]}
                      </span>
                      {order.sampleLabelCode && (
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">{order.sampleLabelCode}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-blue-600 text-xs hover:underline">View →</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
