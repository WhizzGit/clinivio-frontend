// Shared display constants used across page.tsx and the extracted tab components.
// Centralized here so OrdersTab/IPRequestsTab/OrderDetailPanel/AnalyticsTab don't
// each redefine their own copy.

export const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700', SAMPLE_COLLECTED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-orange-100 text-orange-700', COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};
export const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending', SAMPLE_COLLECTED: 'Sample Collected',
  IN_PROGRESS: 'In Progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
};
export const FLAG_STYLES: Record<string, string> = {
  NORMAL: 'text-green-600', ABNORMAL: 'text-orange-600 font-semibold', CRITICAL: 'text-red-600 font-bold',
};
export const PRIORITY_STYLES: Record<string, string> = {
  ROUTINE: 'bg-gray-100 text-gray-600', URGENT: 'bg-orange-100 text-orange-700', STAT: 'bg-red-100 text-red-700',
};
export const CATEGORY_ICONS: Record<string, string> = {
  'Haematology': '🩸', 'Biochemistry': '🧪', 'Microbiology': '🦠',
  'Serology': '💉', 'Urine Analysis': '🔬', 'Radiology': '🩻', 'Other': '🧫',
};
export const BILLING_MODE_STYLES: Record<string, string> = {
  CASH: 'bg-teal-100 text-teal-700', CREDIT: 'bg-purple-100 text-purple-700',
};

export function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
}
