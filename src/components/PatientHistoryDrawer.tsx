'use client';
import { useState, useEffect, useCallback } from 'react';
import { appointmentApi } from '@/lib/api';

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
  weightKg?: number;
  heightCm?: number;
  bmi?: number;
  appointment: { visitType: string; chiefComplaint?: string; registeredAt: string };
  doctor: { firstName: string; lastName: string };
  prescriptions: Array<{ items: RxItem[] }>;
  followUps: Array<{ id: string; followUpDate: string; notes?: string; isCompleted: boolean }>;
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

export function PatientHistoryDrawer({ patient, onClose }: Props) {
  const [tab, setTab] = useState<'visits' | 'consultations' | 'followups'>('visits');
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [consultations, setConsultations] = useState<ConsultRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const allFollowUps = consultations.flatMap(c =>
    (c.followUps || []).map(f => ({ ...f, doctor: c.doctor, consultationDate: c.appointment.registeredAt }))
  ).sort((a, b) => new Date(a.followUpDate).getTime() - new Date(b.followUpDate).getTime());

  const pendingFollowUps = allFollowUps.filter(f => !f.isCompleted);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [visitsRes, consultRes] = await Promise.all([
        appointmentApi.get(`/appointments?patientId=${patient.id}&limit=100`),
        appointmentApi.get(`/patients/${patient.id}/history`).catch(() => ({ data: [] })),
      ]);
      const vBody = visitsRes.data;
      setVisits(vBody?.data || vBody || []);
      setConsultations(consultRes.data || []);
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

  const tabCls = (t: string) =>
    `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
      tab === t
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-gray-500 hover:text-gray-700'
    }`;

  const patAge = age(patient.dob);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

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
                <h2 className="text-base font-bold text-gray-900">
                  {patient.firstName} {patient.lastName}
                </h2>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs font-mono text-blue-600 font-medium">{patient.uhid}</span>
                  {patAge && <span className="text-xs text-gray-500">{patAge}</span>}
                  {patient.gender && (
                    <span className="text-xs text-gray-500">· {patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1).toLowerCase()}</span>
                  )}
                  {patient.bloodGroup && (
                    <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">{patient.bloodGroup}</span>
                  )}
                  {patient.phone && (
                    <span className="text-xs text-gray-400">{patient.phone}</span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none mt-1 flex-shrink-0"
            >
              &times;
            </button>
          </div>

          {/* Stats row */}
          {!loading && (
            <div className="flex gap-0 px-6 pb-3">
              <div className="text-center pr-6 border-r border-gray-200">
                <p className="text-lg font-bold text-gray-900">{visits.length}</p>
                <p className="text-xs text-gray-400">Total Visits</p>
              </div>
              <div className="text-center px-6 border-r border-gray-200">
                <p className="text-lg font-bold text-gray-900">{consultations.length}</p>
                <p className="text-xs text-gray-400">Consultations</p>
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
            <button className={tabCls('followups')} onClick={() => setTab('followups')}>
              Follow-ups {allFollowUps.length > 0 && `(${allFollowUps.length})`}
              {pendingFollowUps.length > 0 && (
                <span className="ml-1.5 w-4 h-4 bg-orange-500 text-white text-xs rounded-full inline-flex items-center justify-center">
                  {pendingFollowUps.length}
                </span>
              )}
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
                          {/* Consult header */}
                          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                            <div>
                              <span className="text-sm font-semibold text-gray-900">{fmtDate(c.appointment.registeredAt)}</span>
                              <span className="text-xs text-gray-400 ml-2">Dr. {c.doctor.firstName} {c.doctor.lastName}</span>
                            </div>
                            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{c.appointment.visitType}</span>
                          </div>

                          <div className="p-4 space-y-3">
                            {/* Chief complaint */}
                            {c.appointment.chiefComplaint && (
                              <p className="text-sm text-gray-600">
                                <span className="font-medium text-gray-500">Complaint:</span> {c.appointment.chiefComplaint}
                              </p>
                            )}

                            {/* Vitals mini-bar */}
                            {(c.bpSystolic || c.pulseRate || c.temperature || c.spo2) && (
                              <div className="flex flex-wrap gap-2">
                                {c.bpSystolic && c.bpDiastolic && (
                                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                    BP {c.bpSystolic}/{c.bpDiastolic}
                                  </span>
                                )}
                                {c.pulseRate && (
                                  <span className="text-xs bg-pink-50 text-pink-700 px-2 py-1 rounded">
                                    Pulse {c.pulseRate}bpm
                                  </span>
                                )}
                                {c.temperature && (
                                  <span className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded">
                                    Temp {Number(c.temperature)}°C
                                  </span>
                                )}
                                {c.spo2 && (
                                  <span className="text-xs bg-teal-50 text-teal-700 px-2 py-1 rounded">
                                    SpO2 {c.spo2}%
                                  </span>
                                )}
                                {c.bmi && (
                                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                    BMI {Number(c.bmi)}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Diagnosis */}
                            {c.diagnosis && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Diagnosis</p>
                                <p className="text-sm text-gray-800">{c.diagnosis}</p>
                              </div>
                            )}

                            {/* Observations */}
                            {c.observations && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Observations</p>
                                <p className="text-sm text-gray-600 leading-relaxed">{c.observations}</p>
                              </div>
                            )}

                            {/* Prescription */}
                            {c.prescriptions?.[0]?.items?.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Prescription</p>
                                <div className="space-y-1.5">
                                  {c.prescriptions[0].items.map((m, i) => (
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
                          </div>
                        </div>
                      ))
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
            </div>
          )}
        </div>
      </div>
    </>
  );
}
