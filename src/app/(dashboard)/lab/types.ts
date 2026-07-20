// Lab module-local view types shared across page.tsx and the extracted
// tab/modal components. Extends the interfaces that used to be inlined at the
// top of page.tsx with the new backend fields (admission linking, walk-ins,
// sample labels, billing mode).

export type LabPriority = 'ROUTINE' | 'URGENT' | 'STAT';
export type LabBillingMode = 'CASH' | 'CREDIT';

export interface LabTest {
  id: string; name: string; code: string; category: string;
  unit?: string; normalRange?: string; price: number; turnaround: number; isActive: boolean;
}

export interface LabOrderItem {
  id: string; labTestId: string; result?: string; unit?: string;
  normalRange?: string; flag?: 'NORMAL' | 'ABNORMAL' | 'CRITICAL'; notes?: string;
  isOutsourced?: boolean; externalLabName?: string | null; externalReference?: string | null;
  labTest: { id: string; name: string; code: string; unit?: string; normalRange?: string; price: number };
}

export interface LabOrder {
  id: string; orderNumber: string; status: string; priority: LabPriority;
  clinicalNotes?: string; sampleType?: string; collectedAt?: string;
  completedAt?: string; createdAt: string;
  paymentStatus?: string; amountDue?: number; amountPaid?: number;
  // Nullable: walk-in/outsider orders have no linked Patient row.
  patient: { id: string; firstName: string; lastName: string; uhid: string; phone: string } | null;
  walkInName?: string | null;
  walkInAge?: number | null;
  walkInPhone?: string | null;
  admissionId?: string | null;
  admission?: { id: string; admissionNumber: string; status: string } | null;
  billingMode: LabBillingMode;
  collectionSite?: string | null;
  collectionMethod?: string | null;
  sampleLabelCode?: string | null;
  orderedBy: { firstName: string; lastName: string };
  assignedTo?: { firstName: string; lastName: string };
  items: LabOrderItem[];
}

export interface LabReagent {
  id: string; name: string; unit: string;
  currentQty: string; reorderLevel: string; unitCost: string;
  manufacturer?: string | null; batchNo?: string | null; expiryDate?: string | null;
  isActive: boolean;
}

export interface Stats { pending: number; sampleCollected: number; inProgress: number; completedToday: number; total: number }

export interface Analytics {
  period: number; totalOrders: number; completedOrders: number; todayOrders: number;
  completedRevenue: number; avgTurnaroundHours: number; criticalItems: number; criticalRate: number;
  categoryBreakdown: Record<string, { orderCount: number; revenue: number; testCount: number; activeTests: number }>;
}

export interface LabDashboard {
  period: number;
  totalOrders: number;
  completedOrders: number;
  completionRate: number;
  revenue: number;
  daily: Array<{ date: string; orders: number; revenue: number }>;
  lowReagentCount: number;
  lowReagents: LabReagent[];
}

export interface TATReportRow {
  orderId: string;
  orderNumber: string;
  testId: string;
  testName: string;
  category: string;
  completedAt: string;
  promisedHours: number;
  actualHours: number;
  breached: boolean;
}

export interface TATReport {
  data: TATReportRow[];
  summary: { totalTests: number; breachedCount: number; breachRate: number; avgActualHours: number };
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface Admission {
  id: string;
  admissionNumber: string;
  status: string;
  patient: { id: string; firstName: string; lastName: string; uhid: string };
}

export interface PagedResult<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
