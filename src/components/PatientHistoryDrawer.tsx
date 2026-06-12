'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { appointmentApi, billingApi, patientApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import {
  generatePrescriptionHtml,
  generateReceiptHtml,
  generatePatientReportHtml,
  printDocument,
} from '@/lib/print';
import type { PrintMedItem } from '@/lib/print';

// ── Types ──────────────────────────────────────────────────────────────────────

interface PatientSummary {
  id: string;
  firstName: string;
  lastName?: string;
  uhid: string;
  phone?: string;
  dob?: string;
  gender?: string;
  bloodGroup?: string;
}

interface VisitRecord {
  id: string;
  tokenNumber?: number;
  status: string;
  visitType: string;
  appointmentType: string;
  chiefComplaint?: string;
  scheduledAt?: string;
  registeredAt: string;
  paymentStatus: string;
  paymentAmount?: string | number;
  doctor: { firstName: string; lastName: string };
  department?: { name: string; icon?: string };
}

interface RxItem {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  quantity?: number;
}

interface LabOrderItem {
  id?: string;
  labTest: { name: string; code: string };
  result?: string;
  unit?: string;
  flag?: string;
}

interface LabOrder {
  id: string;
  orderNumber: string;
  status: string;
  priority?: string;
  items: LabOrderItem[];
}

interface ConsultRecord {
  id: string;
  createdAt: string;
  diagnosis?: string;
  observations?: string;
  doctorNotes?: string;
  bpSystolic?: number;
  bpDiastolic?: number;
  pulseRate?: number;
  temperature?: number;
  spo2?: number;
  rbsMgDl?: number;
  weightKg?: number;
  heightCm?: number;
  bmi?: number;
  respiratoryRate?: number;
  appointment: { visitType: string; chiefComplaint?: string; registeredAt: string };
  doctor: { firstName: string; lastName: string };
  prescriptions: Array<{ id?: string; items: RxItem[] }>;
  followUps: Array<{ id: string; followUpDate: string; notes?: string; isCompleted: boolean }>;
  labOrders: LabOrder[];
}

interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceType: string;
  totalAmount: string;
  paymentStatus: string;
  paymentMethod: string | null;
  paidAt?: string | null;
  appointmentId?: string | null;
  notes?: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  REGISTERED: 'bg-yellow-100 text-yellow-700',
  PENDING_PAYMENT: 'bg-orange-100 text-orange-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  CHECKED_IN: 'bg-teal-100 text-teal-700',
  IN_PROGRESS: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-gray-100 text-gray-600',
  SENT_TO_PHARMACY: 'bg-purple-100 text-purple-700',
  CANCELLED: 'bg-red-100 text-red-600',
  NO_SHOW: 'bg-red-50 text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  REGISTERED: 'Registered',
  PENDING_PAYMENT: 'Pending Payment',
  CONFIRMED: 'Confirmed',
  CHECKED_IN: 'Checked In',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  SENT_TO_PHARMACY: 'At Pharmacy',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show',
};

function age(dob?: string) {
  if (!dob) return null;
  return `${Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000))}y`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  patient: PatientSummary;
  onClose: () => void;
}

type Tab = 'visits' | 'consultations' | 'medications' | 'billing' | 'followups' | 'ai';

interface AiSummary {
  summary: string | null;
  visitCount: number;
  generatedAt: string;
  fromCache: boolean;
  reason?: string;
}

export function PatientHistoryDrawer({ patient, onClose }: Props) {
  const { tenantProfile } = useAuthStore();
  const [tab, setTab] = useState<Tab>('visits');
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [consultations, setConsultations] = useState<ConsultRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [printingReport, setPrintingReport] = useState(false);
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // ── Derived: follow-ups across all consultations ──
  const allFollowUps = consultations.flatMap(c =>
    (c.followUps || []).map(f => ({ ...f, doctor: c.doctor, consultationDate: c.appointment.registeredAt }))
  ).sort((a, b) => new Date(a.followUpDate).getTime() - new Date(b.followUpDate).getTime());

  const pendingFollowUps = allFollowUps.filter(f => !f.isCompleted);

  // ── Derived: medication history aggregated across all consultations ──
  type MedEntry = {
    medicineName: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string;
    count: number;
    lastDate: string;
    lastDoctor: { firstName: string; lastName: string };
  };

  const medMap = new Map<string, MedEntry>();
  for (const c of consultations) {
    for (const rx of c.prescriptions) {
      for (const item of rx.items) {
        const key = item.medicineName.toLowerCase().trim();
        const existing = medMap.get(key);
        if (!existing) {
          medMap.set(key, {
            medicineName: item.medicineName,
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration,
            instructions: item.instructions,
            count: 1,
            lastDate: c.appointment.registeredAt,
            lastDoctor: c.doctor,
          });
        } else {
          existing.count++;
          if (new Date(c.appointment.registeredAt) > new Date(existing.lastDate)) {
            existing.lastDate = c.appointment.registeredAt;
            existing.lastDoctor = c.doctor;
            existing.dosage = item.dosage;
            existing.frequency = item.frequency;
            existing.duration = item.duration;
          }
        }
      }
    }
  }
  const medicationHistory = Array.from(medMap.values())
    .sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime());

  // ── Derived: lab result trends (numeric results across consultations) ──────────

  type TrendPoint = { label: string; value: number };
  type LabTrend = { testName: string; unit?: string; points: TrendPoint[] };

  const labTrends: LabTrend[] = (() => {
    const trendMap = new Map<string, { unit?: string; points: TrendPoint[] }>();

    const sorted = [...consultations].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    for (const c of sorted) {
      const label = new Date(c.appointment.registeredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      for (const order of c.labOrders || []) {
        for (const item of order.items || []) {
          if (!item.result) continue;
          const numeric = parseFloat(item.result);
          if (isNaN(numeric)) continue;
          const key = item.labTest?.name?.toLowerCase() ?? 'unknown';
          if (!trendMap.has(key)) {
            trendMap.set(key, { unit: item.unit ?? undefined, points: [] });
          }
          trendMap.get(key)!.points.push({ label, value: numeric });
        }
      }
    }

    return Array.from(trendMap.entries())
      .filter(([, v]) => v.points.length >= 2)
      .map(([key, v]) => ({
        testName: key.charAt(0).toUpperCase() + key.slice(1),
        unit: v.unit,
        points: v.points,
      }));
  })();

  // ── Data loading ──────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [visitsRes, consultRes, invoicesRes] = await Promise.all([
        appointmentApi.get(`/appointments?patientId=${patient.id}&limit=100`),
        appointmentApi.get(`/patients/${patient.id}/history`).catch(() => ({ data: [] })),
        billingApi.get(`/invoices/by-patient/${patient.id}`).catch(() => ({ data: [] })),
      ]);
      const vBody = visitsRes.data;
      setVisits(vBody?.data || vBody || []);
      setConsultations(consultRes.data || []);
      setInvoices(invoicesRes.data || []);
    } catch {
      // show empty state
    } finally {
      setLoading(false);
    }
  }, [patient.id]);

  useEffect(() => { load(); }, [load]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── Print handlers ────────────────────────────────────────────────────────────

  function printConsultation(c: ConsultRecord) {
    setPrintingId(c.id);
    try {
      const html = generatePrescriptionHtml({
        tenant: tenantProfile ?? { name: 'Hospital' },
        doctor: { firstName: c.doctor.firstName, lastName: c.doctor.lastName },
        patient: {
          firstName: patient.firstName,
          lastName: patient.lastName || '',
          uhid: patient.uhid,
          phone: patient.phone || '',
          dob: patient.dob,
          gender: patient.gender,
          bloodGroup: patient.bloodGroup,
        },
        appointment: {
          chiefComplaint: c.appointment.chiefComplaint,
          scheduledAt: c.appointment.registeredAt,
        },
        vitals: {
          bpSystolic: c.bpSystolic,
          bpDiastolic: c.bpDiastolic,
          pulseRate: c.pulseRate,
          temperature: c.temperature ? Number(c.temperature) : undefined,
          spo2: c.spo2,
          rbsMgDl: c.rbsMgDl,
          weightKg: c.weightKg ? Number(c.weightKg) : undefined,
          heightCm: c.heightCm ? Number(c.heightCm) : undefined,
          bmi: c.bmi ? Number(c.bmi) : undefined,
          respiratoryRate: c.respiratoryRate,
        },
        diagnosis: c.diagnosis,
        observations: c.observations,
        doctorNotes: c.doctorNotes,
        medicines: c.prescriptions.flatMap(rx => rx.items) as PrintMedItem[],
      });
      printDocument(html);
    } finally {
      setPrintingId(null);
    }
  }

  function printInvoiceReceipt(inv: InvoiceRecord) {
    setPrintingId(inv.id);
    try {
      const visit = visits.find(v => v.id === inv.appointmentId);
      const html = generateReceiptHtml({
        tenant: tenantProfile ?? { name: 'Hospital' },
        receiptNo: inv.invoiceNumber,
        date: inv.paidAt || inv.invoiceDate,
        patient: {
          firstName: patient.firstName,
          lastName: patient.lastName || '',
          uhid: patient.uhid,
          phone: patient.phone || '',
        },
        doctor: {
          firstName: visit?.doctor?.firstName ?? '—',
          lastName: visit?.doctor?.lastName ?? '',
        },
        department: visit?.department?.name,
        amount: parseFloat(inv.totalAmount),
        paymentMethod: inv.paymentMethod || 'CASH',
        tokenNumber: visit?.tokenNumber ?? 0,
      });
      printDocument(html);
    } finally {
      setPrintingId(null);
    }
  }

  function printFullReport() {
    setPrintingReport(true);
    try {
      const html = generatePatientReportHtml({
        tenant: tenantProfile ?? { name: 'Hospital' },
        patient: {
          firstName: patient.firstName,
          lastName: patient.lastName || '',
          uhid: patient.uhid,
          phone: patient.phone,
          dob: patient.dob,
          gender: patient.gender,
          bloodGroup: patient.bloodGroup,
        },
        consultations: consultations.map(c => ({
          id: c.id,
          date: c.appointment.registeredAt,
          doctor: c.doctor,
          visitType: c.appointment.visitType,
          chiefComplaint: c.appointment.chiefComplaint,
          diagnosis: c.diagnosis,
          observations: c.observations,
          vitals: {
            bpSystolic: c.bpSystolic,
            bpDiastolic: c.bpDiastolic,
            pulseRate: c.pulseRate,
            temperature: c.temperature ? Number(c.temperature) : undefined,
            spo2: c.spo2,
            weightKg: c.weightKg ? Number(c.weightKg) : undefined,
            heightCm: c.heightCm ? Number(c.heightCm) : undefined,
          },
          medicines: c.prescriptions.flatMap(rx => rx.items) as PrintMedItem[],
          labOrders: (c.labOrders || []).map(o => ({
            orderNumber: o.orderNumber,
            status: o.status,
            items: (o.items || []).map(it => ({
              name: it.labTest?.name ?? '',
              result: it.result,
              unit: it.unit,
              flag: it.flag,
            })),
          })),
        })),
        invoices: invoices.map(inv => ({
          invoiceNumber: inv.invoiceNumber,
          date: inv.invoiceDate,
          amount: parseFloat(inv.totalAmount),
          paymentStatus: inv.paymentStatus,
          paymentMethod: inv.paymentMethod,
        })),
        generatedAt: new Date().toISOString(),
      });
      printDocument(html);
    } finally {
      setPrintingReport(false);
    }
  }

  // ── AI Summary ───────────────────────────────────────────────────────────────

  const fetchAiSummary = useCallback(async (refresh = false) => {
    setAiLoading(true);
    setAiError(null);
    try {
      const url = `/patients/${patient.id}/ai-summary${refresh ? '?refresh=true' : ''}`;
      const res = await appointmentApi.get(url);
      setAiSummary(res.data);
    } catch (err: any) {
      setAiError(err?.response?.data?.message || 'Failed to generate AI summary');
    } finally {
      setAiLoading(false);
    }
  }, [patient.id]);

  useEffect(() => {
    if (tab === 'ai' && !aiSummary && !aiLoading) {
      fetchAiSummary();
    }
  }, [tab, aiSummary, aiLoading, fetchAiSummary]);

  // ── UI helpers ────────────────────────────────────────────────────────────────

  const tabCls = (t: Tab) =>
    `px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
      tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
    }`;

  const patAge = age(patient.dob);
  const paidTotal = invoices
    .filter(i => i.paymentStatus === 'PAID')
    .reduce((s, i) => s + parseFloat(i.totalAmount), 0);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full z-50 w-full max-w-2xl bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-200">
          <div className="flex items-start justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-bold flex-shrink-0">
                {patient.firstName?.[0]}{patient.lastName?.[0] || ''}
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">{patient.firstName} {patient.lastName}</h2>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs font-mono text-blue-600 font-medium">{patient.uhid}</span>
                  {patAge && <span className="text-xs text-gray-500">{patAge}</span>}
                  {patient.gender && (
                    <span className="text-xs text-gray-500">· {patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1).toLowerCase()}</span>
                  )}
                  {patient.bloodGroup && (
                    <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">{patient.bloodGroup}</span>
                  )}
                  {patient.phone && <span className="text-xs text-gray-400">{patient.phone}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!loading && (consultations.length > 0 || invoices.length > 0) && (
                <button
                  onClick={printFullReport}
                  disabled={printingReport}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  title="Print full patient report"
                >
                  {printingReport ? (
                    <span className="w-3 h-3 border-2 border-gray-400 border-t-blue-600 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  )}
                  Full Report
                </button>
              )}
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
                &times;
              </button>
            </div>
          </div>

          {/* Stats row */}
          {!loading && (
            <div className="flex gap-0 px-6 pb-3">
              <div className="text-center pr-6 border-r border-gray-200">
                <p className="text-lg font-bold text-gray-900">{visits.length}</p>
                <p className="text-xs text-gray-400">Visits</p>
              </div>
              <div className="text-center px-6 border-r border-gray-200">
                <p className="text-lg font-bold text-gray-900">{consultations.length}</p>
                <p className="text-xs text-gray-400">Consultations</p>
              </div>
              <div className="text-center px-6 border-r border-gray-200">
                <p className="text-lg font-bold text-gray-900">{medicationHistory.length}</p>
                <p className="text-xs text-gray-400">Medications</p>
              </div>
              <div className="text-center px-6 border-r border-gray-200">
                <p className="text-lg font-bold text-gray-900">{invoices.length}</p>
                <p className="text-xs text-gray-400">Invoices</p>
              </div>
              <div className="text-center px-6">
                <p className={`text-lg font-bold ${pendingFollowUps.length > 0 ? 'text-orange-500' : 'text-gray-900'}`}>
                  {pendingFollowUps.length}
                </p>
                <p className="text-xs text-gray-400">Pending Follow-ups</p>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-t border-gray-100 overflow-x-auto">
            <button className={tabCls('visits')} onClick={() => setTab('visits')}>
              Visits {visits.length > 0 && `(${visits.length})`}
            </button>
            <button className={tabCls('consultations')} onClick={() => setTab('consultations')}>
              Consultations {consultations.length > 0 && `(${consultations.length})`}
            </button>
            <button className={tabCls('medications')} onClick={() => setTab('medications')}>
              Medications {medicationHistory.length > 0 && `(${medicationHistory.length})`}
            </button>
            <button className={tabCls('billing')} onClick={() => setTab('billing')}>
              Billing {invoices.length > 0 && `(${invoices.length})`}
            </button>
            <button className={tabCls('followups')} onClick={() => setTab('followups')}>
              Follow-ups {allFollowUps.length > 0 && `(${allFollowUps.length})`}
              {pendingFollowUps.length > 0 && (
                <span className="ml-1.5 w-4 h-4 bg-orange-500 text-white text-xs rounded-full inline-flex items-center justify-center">
                  {pendingFollowUps.length}
                </span>
              )}
            </button>
            <button className={tabCls('ai')} onClick={() => setTab('ai')}>
              AI Summary
              <span className="ml-1.5 text-xs bg-purple-100 text-purple-700 px-1 py-0.5 rounded font-medium">Beta</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400">
              <span className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="p-5">

              {/* ── Visits ── */}
              {tab === 'visits' && (
                <div className="space-y-3">
                  {visits.length === 0 ? (
                    <div className="text-center text-gray-400 py-12">
                      <p className="text-3xl mb-2">📅</p>
                      <p>No visits on record</p>
                    </div>
                  ) : (
                    visits
                      .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())
                      .map(v => (
                        <div key={v.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-200 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                <span className="text-sm font-semibold text-gray-900">{fmtDate(v.scheduledAt || v.registeredAt)}</span>
                                <span className="text-xs text-gray-400">{fmtTime(v.registeredAt)}</span>
                                {v.tokenNumber && (
                                  <span className="text-xs font-mono text-gray-400">Token #{v.tokenNumber}</span>
                                )}
                              </div>
                              <p className="text-sm text-gray-700">
                                Dr. {v.doctor?.firstName} {v.doctor?.lastName}
                                {v.department && <span className="text-gray-400"> · {v.department.icon} {v.department.name}</span>}
                              </p>
                              {v.chiefComplaint && (
                                <p className="text-xs text-gray-500 mt-1">
                                  <span className="font-medium">Complaint:</span> {v.chiefComplaint}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[v.status] || 'bg-gray-100 text-gray-500'}`}>
                                {STATUS_LABELS[v.status] || v.status}
                              </span>
                              <div className="flex gap-1">
                                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{v.visitType}</span>
                                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{v.appointmentType?.replace('_', ' ')}</span>
                              </div>
                              {v.paymentAmount && (
                                <span className="text-xs text-gray-400">₹{Number(v.paymentAmount).toLocaleString('en-IN')}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              )}

              {/* ── Consultations ── */}
              {tab === 'consultations' && (
                <div className="space-y-4">

                  {/* Lab trends section — only shown when 2+ data points for any test */}
                  {labTrends.length > 0 && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-2">
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">
                        Lab Result Trends
                      </p>
                      <div className="space-y-5">
                        {labTrends.map(trend => (
                          <div key={trend.testName}>
                            <p className="text-xs font-medium text-gray-600 mb-1">
                              {trend.testName}{trend.unit ? ` (${trend.unit})` : ''}
                            </p>
                            <ResponsiveContainer width="100%" height={120}>
                              <LineChart data={trend.points} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} />
                                <Tooltip
                                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                                  formatter={(v: number) => [`${v}${trend.unit ? ' ' + trend.unit : ''}`, trend.testName]}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="value"
                                  stroke="#2563eb"
                                  strokeWidth={2}
                                  dot={{ r: 4, fill: '#2563eb' }}
                                  activeDot={{ r: 6 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {consultations.length === 0 ? (
                    <div className="text-center text-gray-400 py-12">
                      <p className="text-3xl mb-2">🩺</p>
                      <p>No consultation records found</p>
                    </div>
                  ) : (
                    consultations
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map(c => (
                        <div key={c.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                          {/* Header */}
                          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                            <div>
                              <span className="text-sm font-semibold text-gray-900">{fmtDate(c.appointment.registeredAt)}</span>
                              <span className="text-xs text-gray-400 ml-2">Dr. {c.doctor.firstName} {c.doctor.lastName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{c.appointment.visitType}</span>
                              <button
                                onClick={() => printConsultation(c)}
                                disabled={printingId === c.id}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                                title="Print prescription"
                              >
                                {printingId === c.id ? (
                                  <span className="w-3 h-3 border border-gray-400 border-t-blue-600 rounded-full animate-spin" />
                                ) : (
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                )}
                                Print Rx
                              </button>
                            </div>
                          </div>

                          <div className="p-4 space-y-3">
                            {c.appointment.chiefComplaint && (
                              <p className="text-sm text-gray-600">
                                <span className="font-medium text-gray-500">Complaint:</span> {c.appointment.chiefComplaint}
                              </p>
                            )}

                            {/* Vitals */}
                            {(c.bpSystolic || c.pulseRate || c.temperature || c.spo2 || c.weightKg) && (
                              <div className="flex flex-wrap gap-2">
                                {c.bpSystolic && c.bpDiastolic && (
                                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">BP {c.bpSystolic}/{c.bpDiastolic}</span>
                                )}
                                {c.pulseRate && (
                                  <span className="text-xs bg-pink-50 text-pink-700 px-2 py-1 rounded">Pulse {c.pulseRate}bpm</span>
                                )}
                                {c.temperature && (
                                  <span className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded">Temp {Number(c.temperature)}°C</span>
                                )}
                                {c.spo2 && (
                                  <span className="text-xs bg-teal-50 text-teal-700 px-2 py-1 rounded">SpO2 {c.spo2}%</span>
                                )}
                                {c.bmi && (
                                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">BMI {Number(c.bmi)}</span>
                                )}
                                {c.weightKg && (
                                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{Number(c.weightKg)}kg</span>
                                )}
                              </div>
                            )}

                            {c.diagnosis && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Diagnosis</p>
                                <p className="text-sm text-gray-800">{c.diagnosis}</p>
                              </div>
                            )}

                            {c.observations && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Observations</p>
                                <p className="text-sm text-gray-600 leading-relaxed">{c.observations}</p>
                              </div>
                            )}

                            {/* All prescription sets */}
                            {c.prescriptions.filter(rx => rx.items.length > 0).length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Prescription</p>
                                <div className="space-y-1.5">
                                  {c.prescriptions.flatMap(rx => rx.items).map((m, i) => (
                                    <div key={i} className="flex items-start gap-2 text-sm">
                                      <span className="text-gray-400 w-4 flex-shrink-0">{i + 1}.</span>
                                      <div>
                                        <span className="font-medium text-gray-900">{m.medicineName}</span>
                                        {m.dosage && <span className="text-gray-500"> {m.dosage}</span>}
                                        <span className="text-gray-400"> — {m.frequency} × {m.duration}</span>
                                        {m.instructions && (
                                          <span className="text-xs text-gray-400 ml-1">({m.instructions})</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Lab orders */}
                            {c.labOrders?.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Lab Tests</p>
                                <div className="space-y-1.5">
                                  {c.labOrders.map(o => (
                                    <div key={o.id} className="bg-gray-50 rounded-lg p-2">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-mono text-gray-600">{o.orderNumber}</span>
                                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${o.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                          {o.status.replace(/_/g, ' ')}
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {o.items?.map((item, idx) => (
                                          <span key={idx} className={`text-xs px-2 py-0.5 rounded ${item.result ? 'bg-teal-50 text-teal-800' : 'bg-gray-100 text-gray-500'}`}>
                                            {item.labTest?.name}
                                            {item.result ? `: ${item.result} ${item.unit ?? ''}`.trim() : ''}
                                            {item.flag && item.flag !== 'NORMAL' ? ' ⚠' : ''}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              )}

              {/* ── Medications ── */}
              {tab === 'medications' && (
                <div>
                  {medicationHistory.length === 0 ? (
                    <div className="text-center text-gray-400 py-12">
                      <p className="text-3xl mb-2">💊</p>
                      <p>No medications on record</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-gray-400 mb-3">
                        Aggregated across all consultations — sorted by most recently prescribed.
                        Repeated prescriptions show the latest dosage and cumulative count.
                      </p>
                      <div className="space-y-2">
                        {medicationHistory.map((med, i) => (
                          <div key={i} className="flex items-start justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-blue-100 transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-gray-900">{med.medicineName}</p>
                                {med.count > 1 && (
                                  <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                                    ×{med.count} times
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {med.dosage} · {med.frequency} · {med.duration}
                                {med.instructions && <span className="text-gray-400"> · {med.instructions}</span>}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0 ml-3">
                              <p className="text-xs text-gray-500">{fmtDate(med.lastDate)}</p>
                              <p className="text-xs text-gray-400">Dr. {med.lastDoctor.firstName} {med.lastDoctor.lastName}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Billing ── */}
              {tab === 'billing' && (
                <div>
                  {invoices.length === 0 ? (
                    <div className="text-center text-gray-400 py-12">
                      <p className="text-3xl mb-2">🧾</p>
                      <p>No billing records found</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-gray-400">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
                        {paidTotal > 0 && (
                          <p className="text-xs font-semibold text-gray-700">
                            Total paid: <span className="text-green-700">₹{paidTotal.toLocaleString('en-IN')}</span>
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        {invoices.map(inv => {
                          const isPaid = inv.paymentStatus === 'PAID';
                          const isRefunded = inv.paymentStatus === 'REFUNDED';
                          const statusCls = isPaid
                            ? 'bg-green-100 text-green-700'
                            : isRefunded
                            ? 'bg-gray-100 text-gray-500'
                            : 'bg-yellow-100 text-yellow-700';
                          const visit = visits.find(v => v.id === inv.appointmentId);

                          return (
                            <div key={inv.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-blue-100 transition-colors">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-xs font-mono font-medium text-blue-700">{inv.invoiceNumber}</p>
                                  <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                    {inv.invoiceType.replace(/_/g, ' ')}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {fmtDate(inv.invoiceDate)}
                                  {visit && <span> · Dr. {visit.doctor.firstName} {visit.doctor.lastName}</span>}
                                  {inv.paymentMethod && <span> · {inv.paymentMethod}</span>}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                <div className="text-right">
                                  <p className="text-sm font-bold text-gray-900">₹{parseFloat(inv.totalAmount).toLocaleString('en-IN')}</p>
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusCls}`}>{inv.paymentStatus}</span>
                                </div>
                                {isPaid && (
                                  <button
                                    onClick={() => printInvoiceReceipt(inv)}
                                    disabled={printingId === inv.id}
                                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                                    title="Print receipt"
                                  >
                                    {printingId === inv.id ? (
                                      <span className="w-3 h-3 border border-gray-400 border-t-blue-600 rounded-full animate-spin" />
                                    ) : (
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                    )}
                                    Receipt
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Follow-ups ── */}
              {tab === 'followups' && (
                <div className="space-y-3">
                  {allFollowUps.length === 0 ? (
                    <div className="text-center text-gray-400 py-12">
                      <p className="text-3xl mb-2">📆</p>
                      <p>No follow-ups scheduled</p>
                    </div>
                  ) : (
                    <>
                      {pendingFollowUps.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-2">Pending</p>
                          {pendingFollowUps.map(f => (
                            <div key={f.id} className="flex items-start justify-between p-3 bg-orange-50 border border-orange-200 rounded-xl mb-2">
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{fmtDate(f.followUpDate)}</p>
                                <p className="text-xs text-gray-500">Dr. {f.doctor.firstName} {f.doctor.lastName}</p>
                                {f.notes && <p className="text-xs text-gray-600 mt-0.5">{f.notes}</p>}
                              </div>
                              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">Pending</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {allFollowUps.filter(f => f.isCompleted).length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Completed</p>
                          {allFollowUps.filter(f => f.isCompleted).map(f => (
                            <div key={f.id} className="flex items-start justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl mb-2">
                              <div>
                                <p className="text-sm font-medium text-gray-600">{fmtDate(f.followUpDate)}</p>
                                <p className="text-xs text-gray-400">Dr. {f.doctor.firstName} {f.doctor.lastName}</p>
                                {f.notes && <p className="text-xs text-gray-400 mt-0.5">{f.notes}</p>}
                              </div>
                              <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-medium">Done</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── AI Summary ── */}
              {tab === 'ai' && (
                <div>
                  {/* Disclaimer banner */}
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
                    <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      <span className="font-semibold">AI-generated — for clinical reference only.</span> Not a substitute for physician assessment. Patient data is de-identified before processing.
                    </p>
                  </div>

                  {aiLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <span className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                      <p className="text-sm text-gray-500">Generating clinical summary…</p>
                    </div>
                  ) : aiError ? (
                    <div className="text-center py-12">
                      <p className="text-3xl mb-2">⚠️</p>
                      <p className="text-sm text-red-600 mb-3">{aiError}</p>
                      <button
                        onClick={() => fetchAiSummary()}
                        className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
                      >
                        Retry
                      </button>
                    </div>
                  ) : !aiSummary ? null : aiSummary.summary === null ? (
                    <div className="text-center text-gray-400 py-12">
                      <p className="text-3xl mb-2">🩺</p>
                      <p className="text-sm">{aiSummary.reason || 'No consultation history available yet'}</p>
                    </div>
                  ) : (
                    <div>
                      {/* Cache / meta row */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          {aiSummary.fromCache ? (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <span className="w-2 h-2 bg-green-400 rounded-full inline-block" />
                              Cached · Generated {Math.round((Date.now() - new Date(aiSummary.generatedAt).getTime()) / 3600000)}h ago
                            </span>
                          ) : (
                            <span className="text-xs text-purple-600 flex items-center gap-1">
                              <span className="w-2 h-2 bg-purple-400 rounded-full inline-block" />
                              Live · Just generated
                            </span>
                          )}
                          <span className="text-xs text-gray-400">· {aiSummary.visitCount} consultation{aiSummary.visitCount !== 1 ? 's' : ''} analysed</span>
                        </div>
                        <button
                          onClick={() => fetchAiSummary(true)}
                          disabled={aiLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-50 disabled:opacity-50"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Regenerate
                        </button>
                      </div>

                      {/* Summary content — rendered as markdown-like sections */}
                      <div className="prose prose-sm max-w-none space-y-4">
                        {aiSummary.summary.split(/^(#{1,3} .+)$/m).filter(Boolean).map((block, i) => {
                          const headingMatch = block.match(/^#{1,3} (.+)/);
                          if (headingMatch) {
                            return (
                              <h3 key={i} className="text-sm font-semibold text-gray-700 uppercase tracking-wide mt-4 mb-1">
                                {headingMatch[1]}
                              </h3>
                            );
                          }
                          const lines = block.trim().split('\n').filter(Boolean);
                          const isList = lines.every(l => l.startsWith('- ') || l.startsWith('* ') || /^\d+\./.test(l));
                          if (isList) {
                            return (
                              <ul key={i} className="space-y-1 pl-4">
                                {lines.map((line, j) => (
                                  <li key={j} className="text-sm text-gray-700 list-disc">
                                    {line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '')}
                                  </li>
                                ))}
                              </ul>
                            );
                          }
                          return (
                            <p key={i} className="text-sm text-gray-700 leading-relaxed">{block.trim()}</p>
                          );
                        })}
                      </div>

                      {/* Footer disclaimer from Claude */}
                      <div className="mt-6 pt-4 border-t border-gray-100">
                        <p className="text-xs text-gray-400 italic text-center">
                          AI-generated summary · De-identified data · For clinical reference only
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </>
  );
}
