'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { appointmentApi, patientApi } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Patient {
  id: string; firstName: string; lastName: string; uhid: string;
  dob?: string; gender?: string; bloodGroup?: string; phone: string;
}

interface Appointment {
  id: string; tokenNumber: number; status: string; visitType: string;
  appointmentType: string; chiefComplaint?: string; scheduledAt?: string;
  registeredAt: string;
  patient: Patient;
  doctor: { firstName: string; lastName: string };
  department?: { name: string };
}

interface Vitals {
  bpSystolic?: number; bpDiastolic?: number; pulseRate?: number;
  temperature?: number; weightKg?: number; heightCm?: number;
  spo2?: number; rbsMgDl?: number; respiratoryRate?: number;
}

interface MedItem {
  medicineName: string; genericName?: string; dosage: string;
  frequency: string; duration: string; instructions?: string;
  quantity: number; isSubstitutable?: boolean;
}

interface FollowUp {
  id: string; followUpDate: string; notes?: string; isCompleted: boolean;
}

interface Consultation {
  id?: string;
  bpSystolic?: number; bpDiastolic?: number; pulseRate?: number;
  temperature?: number; weightKg?: number; heightCm?: number;
  bmi?: number; spo2?: number; rbsMgDl?: number; respiratoryRate?: number;
  observations?: string; diagnosis?: string; doctorNotes?: string; icdCodes?: string[];
  prescriptions?: Array<{ id: string; notes?: string; items: MedItem[] }>;
  followUps?: FollowUp[];
}

interface PastConsultation {
  id: string; createdAt: string; diagnosis?: string; observations?: string;
  appointment: { visitType: string; chiefComplaint?: string; registeredAt: string };
  doctor: { firstName: string; lastName: string };
  prescriptions: Array<{ items: MedItem[] }>;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const FREQ_OPTIONS = [
  '1-0-0', '0-1-0', '0-0-1', '1-0-1', '1-1-0', '0-1-1', '1-1-1',
  'Once daily', 'Twice daily', 'Thrice daily', 'Four times daily',
  'Every 6h', 'Every 8h', 'Every 12h', 'SOS / PRN', 'Stat (once)',
];

const DURATION_OPTS = ['1 day', '3 days', '5 days', '7 days', '10 days', '14 days', '1 month', '3 months', 'Ongoing'];

const VITAL_FIELDS = [
  { label: 'BP Systolic', key: 'bpSystolic', unit: 'mmHg', min: 60, max: 250 },
  { label: 'BP Diastolic', key: 'bpDiastolic', unit: 'mmHg', min: 40, max: 150 },
  { label: 'Pulse Rate', key: 'pulseRate', unit: 'bpm', min: 30, max: 250 },
  { label: 'Temperature', key: 'temperature', unit: '°C', step: 0.1, min: 34, max: 42 },
  { label: 'SpO2', key: 'spo2', unit: '%', min: 70, max: 100 },
  { label: 'RBS', key: 'rbsMgDl', unit: 'mg/dL', min: 40, max: 600 },
  { label: 'Weight', key: 'weightKg', unit: 'kg', step: 0.1, min: 1, max: 300 },
  { label: 'Height', key: 'heightCm', unit: 'cm', step: 0.1, min: 30, max: 250 },
  { label: 'Resp. Rate', key: 'respiratoryRate', unit: '/min', min: 5, max: 60 },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcAge(dob?: string) {
  if (!dob) return null;
  const y = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  return `${y}y`;
}

function calcBMI(weight?: number, height?: number) {
  if (!weight || !height || height < 10) return null;
  const bmi = weight / Math.pow(height / 100, 2);
  return Math.round(bmi * 10) / 10;
}

function bmiCategory(bmi: number) {
  if (bmi < 18.5) return { label: 'Underweight', color: 'text-blue-600' };
  if (bmi < 25) return { label: 'Normal', color: 'text-green-600' };
  if (bmi < 30) return { label: 'Overweight', color: 'text-yellow-600' };
  return { label: 'Obese', color: 'text-red-600' };
}

function emptyMed(): MedItem {
  return { medicineName: '', genericName: '', dosage: '', frequency: '1-0-1', duration: '5 days', instructions: '', quantity: 1, isSubstitutable: true };
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function ConsultationPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const router = useRouter();

  const [appt, setAppt] = useState<Appointment | null>(null);
  const [consultation, setConsultation] = useState<Consultation>({});
  const [vitals, setVitals] = useState<Vitals>({});
  const [observations, setObservations] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [icdInput, setIcdInput] = useState('');
  const [icdCodes, setIcdCodes] = useState<string[]>([]);
  const [meds, setMeds] = useState<MedItem[]>([emptyMed()]);
  const [rxNotes, setRxNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [history, setHistory] = useState<PastConsultation[]>([]);
  const [tab, setTab] = useState<'vitals' | 'prescription' | 'followup' | 'history'>('vitals');
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Load appointment + consultation
  useEffect(() => {
    async function load() {
      try {
        const apptRes = await appointmentApi.get(`/appointments/${appointmentId}`);
        const a: Appointment = apptRes.data;
        setAppt(a);

        // Load past history in background
        if (a.patient?.id) {
          appointmentApi.get(`/patients/${a.patient.id}/history`).then(r => {
            setHistory((r.data || []).filter((c: PastConsultation) => true));
          }).catch(() => {});
        }

        // Try to load existing consultation
        try {
          const cRes = await appointmentApi.get(`/appointments/${appointmentId}/consultation`);
          const c: Consultation = cRes.data;
          hydrate(c);
        } catch {
          // No consultation yet — that's fine, will be created on first save
        }
      } catch {
        setLoadError('Could not load appointment details');
      }
    }
    load();
  }, [appointmentId]);

  function hydrate(c: Consultation) {
    setConsultation(c);
    setVitals({
      bpSystolic: c.bpSystolic, bpDiastolic: c.bpDiastolic,
      pulseRate: c.pulseRate,
      temperature: c.temperature ? Number(c.temperature) : undefined,
      weightKg: c.weightKg ? Number(c.weightKg) : undefined,
      heightCm: c.heightCm ? Number(c.heightCm) : undefined,
      spo2: c.spo2,
      rbsMgDl: c.rbsMgDl ? Number(c.rbsMgDl) : undefined,
      respiratoryRate: c.respiratoryRate,
    });
    setObservations(c.observations || '');
    setDiagnosis(c.diagnosis || '');
    setDoctorNotes(c.doctorNotes || '');
    setIcdCodes(c.icdCodes || []);
    setFollowUps(c.followUps || []);
    if (c.prescriptions?.[0]?.items?.length) {
      setMeds(c.prescriptions[0].items);
      setRxNotes(c.prescriptions[0].notes || '');
    }
  }

  async function saveVitals() {
    setSaving(true);
    try {
      const res = await appointmentApi.post(`/appointments/${appointmentId}/consultation`, {
        vitals,
        observations,
        diagnosis,
        doctorNotes,
        icdCodes,
      });
      hydrate(res.data);
      showToast('Vitals & notes saved');
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function savePrescription() {
    const valid = meds.filter(m => m.medicineName.trim() && m.dosage.trim());
    if (valid.length === 0) { showToast('Add at least one medicine with name and dosage', 'error'); return; }
    setSaving(true);
    try {
      await appointmentApi.post(`/appointments/${appointmentId}/consultation/prescription`, {
        notes: rxNotes || undefined,
        items: valid,
      });
      showToast('Prescription saved');
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function addFollowUp() {
    if (!followUpDate) return;
    setSaving(true);
    try {
      const res = await appointmentApi.post(`/appointments/${appointmentId}/consultation/follow-up`, {
        followUpDate, notes: followUpNotes || undefined,
      });
      setFollowUps(prev => [...prev, res.data]);
      setFollowUpDate('');
      setFollowUpNotes('');
      showToast('Follow-up scheduled');
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to schedule', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function complete(sendToPharmacy: boolean) {
    setCompleting(true);
    try {
      // Ensure consultation is saved first
      await appointmentApi.post(`/appointments/${appointmentId}/consultation`, {
        vitals, observations, diagnosis, doctorNotes, icdCodes,
      });
      await appointmentApi.post(`/appointments/${appointmentId}/complete`);
      if (sendToPharmacy) {
        await appointmentApi.post(`/appointments/${appointmentId}/send-to-pharmacy`);
      }
      showToast(sendToPharmacy ? 'Consultation complete — sent to pharmacy' : 'Consultation completed', 'success');
      setTimeout(() => router.push('/doctor-queue'), 1500);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to complete consultation', 'error');
      setCompleting(false);
    }
  }

  // Med helpers
  const updateMed = (i: number, f: keyof MedItem, v: any) =>
    setMeds(meds.map((m, idx) => idx === i ? { ...m, [f]: v } : m));
  const removeMed = (i: number) => setMeds(meds.filter((_, idx) => idx !== i));

  const bmi = calcBMI(vitals.weightKg, vitals.heightCm);
  const bmiInfo = bmi ? bmiCategory(bmi) : null;

  const TABS = [
    { id: 'vitals', label: 'Vitals & Notes' },
    { id: 'prescription', label: 'Prescription' },
    { id: 'followup', label: 'Follow-up' + (followUps.length > 0 ? ` (${followUps.length})` : '') },
    { id: 'history', label: 'History' + (history.length > 0 ? ` (${history.length})` : '') },
  ];

  const tabCls = (t: string) =>
    `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
      tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`;

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-500">{loadError}</p>
        <button onClick={() => router.back()} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Go Back</button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg max-w-sm ${
          toast.type === 'success' ? 'bg-green-600 text-white' :
          toast.type === 'error' ? 'bg-red-600 text-white' :
          'bg-blue-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <button onClick={() => router.push('/doctor-queue')} className="text-sm text-gray-500 hover:text-gray-700 mb-1.5 flex items-center gap-1">
            ← Back to Queue
          </button>
          <h1 className="text-xl font-bold text-gray-900">Consultation</h1>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => complete(false)}
            disabled={completing}
            className="px-4 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-800 font-medium disabled:opacity-50 transition-colors"
          >
            {completing ? '…' : 'Complete'}
          </button>
          <button
            onClick={() => complete(true)}
            disabled={completing}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {completing ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : null}
            Complete & Send to Pharmacy
          </button>
        </div>
      </div>

      {/* Patient Banner */}
      {appt && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-bold flex-shrink-0">
                {appt.patient?.firstName?.[0]}{appt.patient?.lastName?.[0]}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-gray-900">
                    {appt.patient?.firstName} {appt.patient?.lastName}
                  </h2>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-mono">{appt.patient?.uhid}</span>
                  {appt.patient?.gender && (
                    <span className="text-xs text-gray-500">{appt.patient.gender}</span>
                  )}
                  {appt.patient?.dob && (
                    <span className="text-xs text-gray-500">{calcAge(appt.patient.dob)}</span>
                  )}
                  {appt.patient?.bloodGroup && (
                    <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded font-medium">{appt.patient.bloodGroup}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-gray-500">{appt.patient?.phone}</span>
                  {appt.department && <span className="text-xs text-gray-500">· {appt.department.name}</span>}
                  <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded">{appt.visitType}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Token #{appt.tokenNumber}</span>
                </div>
              </div>
            </div>
            {appt.chiefComplaint && (
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Chief Complaint</p>
                <p className="text-sm text-gray-700 font-medium mt-0.5 max-w-xs text-right">{appt.chiefComplaint}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 flex gap-0 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} className={tabCls(t.id)} onClick={() => setTab(t.id as any)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Vitals & Notes ── */}
      {tab === 'vitals' && (
        <div className="space-y-5">
          {/* Vitals grid */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Vitals</h2>
            <div className="grid grid-cols-3 gap-4">
              {VITAL_FIELDS.map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    {f.label} <span className="text-gray-400 font-normal">{f.unit}</span>
                  </label>
                  <input
                    type="number"
                    step={(f as any).step ?? 1}
                    min={(f as any).min}
                    max={(f as any).max}
                    value={(vitals as any)[f.key] ?? ''}
                    onChange={e => setVitals({ ...vitals, [f.key]: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="—"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              {/* BMI display */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  BMI <span className="text-gray-400 font-normal">kg/m²</span>
                </label>
                <div className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 flex items-center gap-2">
                  {bmi ? (
                    <>
                      <span className="font-semibold text-gray-900">{bmi}</span>
                      <span className={`text-xs font-medium ${bmiInfo?.color}`}>{bmiInfo?.label}</span>
                    </>
                  ) : (
                    <span className="text-gray-400">Auto-calculated</span>
                  )}
                </div>
              </div>
            </div>

            {/* BP visual */}
            {(vitals.bpSystolic || vitals.bpDiastolic) && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg inline-flex items-center gap-3">
                <span className="text-xs font-medium text-blue-600 uppercase">BP</span>
                <span className="text-xl font-bold text-gray-900">
                  {vitals.bpSystolic ?? '—'}/{vitals.bpDiastolic ?? '—'}
                </span>
                <span className="text-xs text-gray-500">mmHg</span>
                {vitals.bpSystolic && vitals.bpSystolic >= 140 && (
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">High</span>
                )}
                {vitals.bpSystolic && vitals.bpSystolic < 90 && (
                  <span className="text-xs bg-yellow-100 text-yellow-600 px-2 py-0.5 rounded-full font-medium">Low</span>
                )}
              </div>
            )}
          </div>

          {/* Clinical Notes */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Clinical Notes</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Observations</label>
                <textarea
                  rows={3}
                  value={observations}
                  onChange={e => setObservations(e.target.value)}
                  placeholder="Patient presents with... examination findings..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Diagnosis</label>
                <textarea
                  rows={2}
                  value={diagnosis}
                  onChange={e => setDiagnosis(e.target.value)}
                  placeholder="Primary and secondary diagnoses..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* ICD Codes */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ICD-10 Codes <span className="text-gray-400 font-normal">(optional)</span></label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={icdInput}
                    onChange={e => setIcdInput(e.target.value.toUpperCase())}
                    onKeyDown={e => {
                      if ((e.key === 'Enter' || e.key === ',') && icdInput.trim()) {
                        e.preventDefault();
                        setIcdCodes(prev => [...prev, icdInput.trim()]);
                        setIcdInput('');
                      }
                    }}
                    placeholder="e.g. J06.9 — press Enter to add"
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {icdInput.trim() && (
                    <button
                      type="button"
                      onClick={() => { setIcdCodes(prev => [...prev, icdInput.trim()]); setIcdInput(''); }}
                      className="px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
                    >
                      Add
                    </button>
                  )}
                </div>
                {icdCodes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {icdCodes.map((code, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-mono">
                        {code}
                        <button onClick={() => setIcdCodes(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-blue-900">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Doctor &apos s Notes <span className="text-gray-400 font-normal">(internal, not on prescription)</span></label>
                <textarea
                  rows={2}
                  value={doctorNotes}
                  onChange={e => setDoctorNotes(e.target.value)}
                  placeholder="Internal notes, differential diagnoses, care plan..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
          </div>

          <button
            onClick={saveVitals}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center gap-2"
          >
            {saving && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {saving ? 'Saving…' : 'Save Vitals & Notes'}
          </button>
        </div>
      )}

      {/* ── Prescription ── */}
      {tab === 'prescription' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-900">Prescription</h2>
              <button
                onClick={() => setMeds([...meds, emptyMed()])}
                className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium"
              >
                + Add Medicine
              </button>
            </div>

            <div className="space-y-3">
              {meds.map((m, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">#{i + 1}</span>
                    {meds.length > 1 && (
                      <button onClick={() => removeMed(i)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                      <label className="text-xs text-gray-500 mb-1 block">Medicine Name <span className="text-red-400">*</span></label>
                      <input
                        value={m.medicineName}
                        onChange={e => updateMed(i, 'medicineName', e.target.value)}
                        placeholder="e.g. Paracetamol"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Generic Name</label>
                      <input
                        value={m.genericName || ''}
                        onChange={e => updateMed(i, 'genericName', e.target.value)}
                        placeholder="Acetaminophen"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Dosage <span className="text-red-400">*</span></label>
                      <input
                        value={m.dosage}
                        onChange={e => updateMed(i, 'dosage', e.target.value)}
                        placeholder="500mg"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Frequency <span className="text-red-400">*</span></label>
                      <select
                        value={m.frequency}
                        onChange={e => updateMed(i, 'frequency', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none bg-white"
                      >
                        {FREQ_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Duration <span className="text-red-400">*</span></label>
                      <div className="flex gap-1">
                        <input
                          value={m.duration}
                          onChange={e => updateMed(i, 'duration', e.target.value)}
                          placeholder="5 days"
                          className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <select
                          onChange={e => updateMed(i, 'duration', e.target.value)}
                          className="px-2 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none"
                          value=""
                        >
                          <option value="" disabled>→</option>
                          {DURATION_OPTS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Qty</label>
                      <input
                        type="number"
                        min={1}
                        value={m.quantity}
                        onChange={e => updateMed(i, 'quantity', Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs text-gray-500 mb-1 block">Instructions</label>
                      <input
                        value={m.instructions || ''}
                        onChange={e => updateMed(i, 'instructions', e.target.value)}
                        placeholder="After food, with water..."
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`sub-${i}`}
                        checked={m.isSubstitutable ?? true}
                        onChange={e => updateMed(i, 'isSubstitutable', e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor={`sub-${i}`} className="text-xs text-gray-500 cursor-pointer">Allow substitution</label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Prescription Notes <span className="text-gray-400 font-normal">(printed at bottom)</span></label>
              <textarea
                rows={2}
                value={rxNotes}
                onChange={e => setRxNotes(e.target.value)}
                placeholder="General instructions: drink plenty of water, avoid spicy food for 5 days..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={savePrescription}
                disabled={saving}
                className="px-6 py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center gap-2"
              >
                {saving && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {saving ? 'Saving…' : 'Save Prescription'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Follow-up ── */}
      {tab === 'followup' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Schedule Follow-up</h2>
            <div className="grid grid-cols-2 gap-4 max-w-lg">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Follow-up Date <span className="text-red-400">*</span></label>
                <input
                  type="date"
                  value={followUpDate}
                  min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                  onChange={e => setFollowUpDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Instructions / Notes</label>
                <textarea
                  rows={3}
                  value={followUpNotes}
                  onChange={e => setFollowUpNotes(e.target.value)}
                  placeholder="Review reports, check BP, bring previous prescription..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
            <button
              onClick={addFollowUp}
              disabled={!followUpDate || saving}
              className="mt-4 px-6 py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {saving ? 'Scheduling…' : 'Schedule Follow-up'}
            </button>
          </div>

          {followUps.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Scheduled Follow-ups</h3>
              <div className="space-y-2">
                {followUps.map((f) => (
                  <div key={f.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(f.followUpDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      {f.notes && <p className="text-xs text-gray-500 mt-0.5">{f.notes}</p>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${f.isCompleted ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {f.isCompleted ? 'Completed' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── History ── */}
      {tab === 'history' && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
              <p className="text-2xl mb-2">📋</p>
              <p>No past consultation history for this patient</p>
            </div>
          ) : (
            history.map((h) => (
              <div key={h.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {new Date(h.appointment.registeredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-gray-400">Dr. {h.doctor.firstName} {h.doctor.lastName} · {h.appointment.visitType}</p>
                  </div>
                  {h.appointment.chiefComplaint && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{h.appointment.chiefComplaint}</span>
                  )}
                </div>
                {h.diagnosis && (
                  <p className="text-sm text-gray-700 mb-2"><span className="font-medium text-gray-500">Dx:</span> {h.diagnosis}</p>
                )}
                {h.observations && (
                  <p className="text-sm text-gray-500 mb-2 line-clamp-2">{h.observations}</p>
                )}
                {h.prescriptions?.[0]?.items?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 mb-1.5">Prescribed</p>
                    <div className="flex flex-wrap gap-1.5">
                      {h.prescriptions[0].items.map((m, i) => (
                        <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                          {m.medicineName} {m.dosage} · {m.frequency} · {m.duration}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
