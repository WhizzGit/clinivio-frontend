'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { appointmentApi, patientApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { generatePrescriptionHtml, printDocument } from '@/lib/print';

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
  inventoryId?: string;
}

interface InventorySuggestion {
  id: string; name: string; genericName?: string;
  unit: string; sellingPrice: string; stockQty: number;
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
  id: string; createdAt: string; diagnosis?: string; observations?: string; doctorNotes?: string;
  bpSystolic?: number; bpDiastolic?: number; pulseRate?: number; temperature?: number;
  spo2?: number; rbsMgDl?: number; weightKg?: number; heightCm?: number; bmi?: number;
  appointment: { visitType: string; chiefComplaint?: string; registeredAt: string };
  doctor: { firstName: string; lastName: string };
  prescriptions: Array<{ items: MedItem[] }>;
  labOrders?: Array<{ id: string; orderNumber: string; status: string; items: Array<{ id?: string; labTest: { name: string; code: string }; result?: string; unit?: string; flag?: string }> }>;
}

interface LabTestOption {
  id: string; name: string; code: string; category: string;
  price: number; turnaround: number; unit?: string;
}

interface LabOrderSummary {
  id: string; orderNumber: string; status: string; priority: string;
  createdAt: string; appointmentId?: string;
  items: Array<{ labTest: { name: string; code: string } }>;
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
  const { user, tenantProfile } = useAuthStore();

  const [appt, setAppt]                   = useState<Appointment | null>(null);
  const [consultation, setConsultation]   = useState<Consultation>({});
  const [printing, setPrinting]           = useState(false);
  const [vitals, setVitals]               = useState<Vitals>({});
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
  const [tab, setTab] = useState<'vitals' | 'prescription' | 'labtests' | 'followup' | 'history'>('vitals');
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [printingHistoryId, setPrintingHistoryId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [labTests, setLabTests] = useState<LabTestOption[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrderSummary[]>([]);
  const [selectedTestIds, setSelectedTestIds] = useState<Set<string>>(new Set());
  const [labPriority, setLabPriority] = useState('ROUTINE');
  const [labNotes, setLabNotes] = useState('');
  const [labSearch, setLabSearch] = useState('');
  const [labCategoryFilter, setLabCategoryFilter] = useState('');
  const [orderingLab, setOrderingLab] = useState(false);

  // Medicine autocomplete state (per-row)
  const [medSuggestions, setMedSuggestions] = useState<InventorySuggestion[]>([]);
  const [medSuggestIdx, setMedSuggestIdx] = useState<number | null>(null); // which row is open
  const medSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [inventoryCache, setInventoryCache] = useState<InventorySuggestion[]>([]);
  const [inventoryLoaded, setInventoryLoaded] = useState(false);

  // Patient condition tags
  const [patientConditions, setPatientConditions] = useState<string[]>([]);
  const [conditionSearch, setConditionSearch] = useState('');
  const [showConditionSuggestions, setShowConditionSuggestions] = useState(false);
  const [commonConditions, setCommonConditions] = useState<string[]>([]);
  const [savingConditions, setSavingConditions] = useState(false);

  // AI prescription suggestions
  const [aiSuggestions, setAiSuggestions] = useState<Array<{ name: string; dosage: string; frequency: string; duration: string; notes?: string }>>([]);
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);

  const [rxLayout, setRxLayout] = useState<'compact' | 'column'>('compact');

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const searchMedicines = useCallback((query: string, rowIdx: number, cache: InventorySuggestion[]) => {
    if (medSearchTimer.current) clearTimeout(medSearchTimer.current);

    // Instant local filter when cache is ready
    if (cache.length > 0) {
      const q = query.trim().toLowerCase();
      const filtered = q.length === 0
        ? cache.slice(0, 10)
        : cache.filter(it =>
            it.name.toLowerCase().includes(q) ||
            (it.genericName?.toLowerCase().includes(q))
          ).slice(0, 10);
      setMedSuggestions(filtered);
      setMedSuggestIdx(filtered.length > 0 ? rowIdx : null);
      return;
    }

    // Cache not ready — fall back to API search (2+ chars, debounced)
    if (!query || query.length < 2) { setMedSuggestions([]); setMedSuggestIdx(null); return; }
    medSearchTimer.current = setTimeout(async () => {
      try {
        const res = await appointmentApi.get(`/pharmacy/inventory?q=${encodeURIComponent(query)}&limit=8`);
        const items: InventorySuggestion[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        setMedSuggestions(items);
        setMedSuggestIdx(items.length > 0 ? rowIdx : null);
      } catch { /* doctor can still type freely */ }
    }, 300);
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
          hydrate(cRes.data);
        } catch {
          // No consultation yet — will be created on first save
        }

      } catch {
        setLoadError('Could not load appointment details');
      }
    }
    load();
  }, [appointmentId, user?.tenantId]);

  // Pre-load pharmacy inventory when prescription tab opens (enables instant autocomplete)
  useEffect(() => {
    if (tab !== 'prescription' || inventoryLoaded) return;
    appointmentApi.get('/pharmacy/inventory?limit=200&isActive=true')
      .then(res => {
        const items: InventorySuggestion[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        setInventoryCache(items);
      })
      .catch(() => {})
      .finally(() => setInventoryLoaded(true));
  }, [tab, inventoryLoaded]);

  // Load common conditions list once
  useEffect(() => {
    appointmentApi.get('/analytics/common-conditions')
      .then(r => setCommonConditions(r.data?.conditions ?? []))
      .catch(() => {});
  }, []);

  // Load patient conditions when appointment is loaded
  useEffect(() => {
    if (!appt?.patient?.id) return;
    appointmentApi.get(`/patients/${appt.patient.id}`)
      .then(r => setPatientConditions(r.data?.conditions ?? []))
      .catch(() => {});
  }, [appt?.patient?.id]);

  // Lab tests catalog — fetch once when tab first opens
  useEffect(() => {
    if (tab !== 'labtests' || labTests.length > 0) return;
    appointmentApi.get('/lab/tests').then(r => setLabTests(r.data || [])).catch(() => {});
  }, [tab, labTests.length]);

  // Lab orders for this appointment — refresh each time the tab is opened
  useEffect(() => {
    if (tab !== 'labtests' || !appt?.patient?.id) return;
    appointmentApi.get(`/lab/orders?patientId=${appt.patient.id}&limit=100`)
      .then(r => {
        const all: LabOrderSummary[] = r.data?.data || r.data || [];
        setLabOrders(all.filter(o => o.appointmentId === appointmentId));
      }).catch(() => {});
  }, [tab, appt?.patient?.id, appointmentId]);

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
        items: valid.map(m => ({
          medicineName: m.medicineName,
          genericName: m.genericName || undefined,
          dosage: m.dosage,
          frequency: m.frequency,
          duration: m.duration,
          instructions: m.instructions || undefined,
          quantity: m.quantity,
          isSubstitutable: m.isSubstitutable,
          inventoryId: m.inventoryId || undefined,
        })),
      });
      showToast('Prescription saved');
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Condition tag helpers ────────────────────────────────────────────────────

  async function saveConditions(updated: string[]) {
    if (!appt?.patient?.id) return;
    setSavingConditions(true);
    try {
      await appointmentApi.patch(`/patients/${appt.patient.id}/conditions`, { conditions: updated });
      setPatientConditions(updated);
    } catch { /* silently ignore — conditions are non-critical */ }
    finally { setSavingConditions(false); }
  }

  function addCondition(c: string) {
    const trimmed = c.trim();
    if (!trimmed || patientConditions.includes(trimmed)) return;
    const updated = [...patientConditions, trimmed];
    setPatientConditions(updated);
    saveConditions(updated);
    setConditionSearch('');
    setShowConditionSuggestions(false);
  }

  function removeCondition(c: string) {
    const updated = patientConditions.filter(x => x !== c);
    setPatientConditions(updated);
    saveConditions(updated);
  }

  const filteredConditions = conditionSearch.trim().length === 0
    ? commonConditions.filter(c => !patientConditions.includes(c)).slice(0, 8)
    : commonConditions
        .filter(c => c.toLowerCase().includes(conditionSearch.toLowerCase()) && !patientConditions.includes(c))
        .slice(0, 8);

  // ── AI prescription suggestions ──────────────────────────────────────────────

  async function getAiSuggestions() {
    setAiSuggestLoading(true);
    setShowAiPanel(true);
    setAiSuggestions([]);
    try {
      const res = await appointmentApi.post('/analytics/prescription-suggestions', {
        conditions: patientConditions,
        diagnosis: diagnosis || '',
        observations: observations || undefined,
        ageInYears: appt?.patient?.dob
          ? Math.floor((Date.now() - new Date(appt.patient.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
          : undefined,
        gender: appt?.patient?.gender,
      });
      setAiSuggestions(res.data?.suggestions ?? []);
    } catch {
      showToast('AI suggestions unavailable — check ANTHROPIC_API_KEY', 'error');
      setShowAiPanel(false);
    } finally {
      setAiSuggestLoading(false);
    }
  }

  function addAiSuggestionToRx(s: { name: string; dosage: string; frequency: string; duration: string; notes?: string }) {
    setMeds(prev => {
      // Replace the last empty row if it's blank, otherwise append
      const hasEmpty = prev[prev.length - 1]?.medicineName === '';
      const base: MedItem = { medicineName: s.name, genericName: '', dosage: s.dosage, frequency: s.frequency, duration: s.duration, instructions: s.notes || '', quantity: 1, isSubstitutable: true };
      return hasEmpty ? [...prev.slice(0, -1), base] : [...prev, base];
    });
    showToast(`Added ${s.name} to prescription`, 'success');
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

  async function orderLabTests() {
    if (selectedTestIds.size === 0) { showToast('Select at least one test', 'error'); return; }
    if (!appt) return;
    setOrderingLab(true);
    try {
      await appointmentApi.post('/lab/orders', {
        patientId: appt.patient.id,
        orderedById: user?.id,
        appointmentId,
        testIds: Array.from(selectedTestIds),
        priority: labPriority,
        clinicalNotes: labNotes || undefined,
      });
      showToast(`Lab order placed — ${selectedTestIds.size} test${selectedTestIds.size > 1 ? 's' : ''}`);
      setSelectedTestIds(new Set());
      setLabNotes('');
      // Refresh this appointment's orders
      if (appt.patient?.id) {
        const r = await appointmentApi.get(`/lab/orders?patientId=${appt.patient.id}&limit=100`);
        const all: LabOrderSummary[] = r.data?.data || r.data || [];
        setLabOrders(all.filter(o => o.appointmentId === appointmentId));
      }
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to place lab order', 'error');
    } finally {
      setOrderingLab(false);
    }
  }

  function printPrescription() {
    if (!appt) return;
    setPrinting(true);
    const html = generatePrescriptionHtml({
      tenant: tenantProfile ?? { name: 'Hospital' },
      doctor: {
        firstName: appt.doctor?.firstName ?? '',
        lastName:  appt.doctor?.lastName  ?? '',
      },
      patient: {
        firstName: appt.patient.firstName,
        lastName:  appt.patient.lastName,
        uhid:      appt.patient.uhid,
        dob:       appt.patient.dob,
        gender:    appt.patient.gender,
        bloodGroup: appt.patient.bloodGroup,
        phone:     appt.patient.phone,
      },
      appointment: {
        id:             appt.id,
        tokenNumber:    appt.tokenNumber,
        chiefComplaint: appt.chiefComplaint,
        scheduledAt:    appt.scheduledAt,
        department:     appt.department?.name,
      },
      vitals,
      diagnosis,
      observations,
      doctorNotes,
      icdCodes,
      medicines: meds.filter(m => m.medicineName.trim()),
      rxNotes:   rxNotes || undefined,
      followUpDate:  followUps[followUps.length - 1]?.followUpDate,
      followUpNotes: followUps[followUps.length - 1]?.notes,
    });
    printDocument(html);
    setPrinting(false);
  }

  function printHistoryRx(h: PastConsultation) {
    if (!appt) return;
    setPrintingHistoryId(h.id);
    try {
      const html = generatePrescriptionHtml({
        tenant: tenantProfile ?? { name: 'Hospital' },
        doctor: { firstName: h.doctor.firstName, lastName: h.doctor.lastName },
        patient: {
          firstName: appt.patient.firstName,
          lastName: appt.patient.lastName,
          uhid: appt.patient.uhid,
          phone: appt.patient.phone,
          dob: appt.patient.dob,
          gender: appt.patient.gender,
          bloodGroup: appt.patient.bloodGroup,
        },
        appointment: {
          chiefComplaint: h.appointment.chiefComplaint,
          scheduledAt: h.appointment.registeredAt,
        },
        vitals: {
          bpSystolic: h.bpSystolic,
          bpDiastolic: h.bpDiastolic,
          pulseRate: h.pulseRate,
          temperature: h.temperature ? Number(h.temperature) : undefined,
          spo2: h.spo2,
          rbsMgDl: h.rbsMgDl,
          weightKg: h.weightKg ? Number(h.weightKg) : undefined,
          heightCm: h.heightCm ? Number(h.heightCm) : undefined,
          bmi: h.bmi ? Number(h.bmi) : undefined,
        },
        diagnosis: h.diagnosis,
        observations: h.observations,
        doctorNotes: h.doctorNotes,
        medicines: h.prescriptions.flatMap(rx => rx.items),
      });
      printDocument(html);
    } finally {
      setPrintingHistoryId(null);
    }
  }

  // suppresses unused-read hint for consultation — used in hydrate + future features
  void consultation;

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

  const isNurse = user?.role === 'NURSE';
  const bmi = calcBMI(vitals.weightKg, vitals.heightCm);
  const bmiInfo = bmi ? bmiCategory(bmi) : null;

  const TABS = isNurse
    ? [
        { id: 'vitals', label: 'Vitals & Notes' },
        { id: 'history', label: 'History' + (history.length > 0 ? ` (${history.length})` : '') },
      ]
    : [
        { id: 'vitals', label: 'Vitals & Notes' },
        { id: 'prescription', label: 'Prescription' },
        { id: 'labtests', label: 'Lab Tests' + (labOrders.length > 0 ? ` (${labOrders.length})` : '') },
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
          {!isNurse && (
            <button
              onClick={printPrescription}
              disabled={printing || !appt}
              title="Print prescription"
              className="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              🖨 Print Rx
            </button>
          )}
          {!isNurse && (
            <button
              onClick={() => complete(false)}
              disabled={completing}
              className="px-4 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-800 font-medium disabled:opacity-50 transition-colors"
            >
              {completing ? '…' : 'Complete'}
            </button>
          )}
          {!isNurse && (
            <button
              onClick={() => complete(true)}
              disabled={completing}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {completing ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : null}
              Complete & Send to Pharmacy
            </button>
          )}
          {isNurse && (
            <button
              onClick={saveVitals}
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50 transition-colors"
            >
              {saving ? '…' : 'Save Vitals'}
            </button>
          )}
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

          {/* Condition tags card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-semibold text-gray-900 text-sm">Patient Conditions</h2>
              <span className="text-xs text-gray-400">chronic / recurring — saved to patient profile</span>
              {savingConditions && <span className="text-xs text-blue-500 ml-auto">Saving…</span>}
            </div>

            {/* Existing condition chips */}
            <div className="flex flex-wrap gap-2 mb-3 min-h-[28px]">
              {patientConditions.length === 0 && (
                <span className="text-xs text-gray-400 py-1">No conditions tagged — add below</span>
              )}
              {patientConditions.map(c => (
                <span key={c} className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-800 text-xs rounded-full border border-orange-200 font-medium">
                  {c}
                  <button type="button" onClick={() => removeCondition(c)} className="text-orange-400 hover:text-orange-700 leading-none">×</button>
                </span>
              ))}
            </div>

            {/* Add condition input */}
            <div className="relative">
              <input
                value={conditionSearch}
                onChange={e => { setConditionSearch(e.target.value); setShowConditionSuggestions(true); }}
                onFocus={() => setShowConditionSuggestions(true)}
                onBlur={() => setTimeout(() => setShowConditionSuggestions(false), 200)}
                onKeyDown={e => { if (e.key === 'Enter' && conditionSearch.trim()) { addCondition(conditionSearch); } }}
                placeholder="Search or type a condition, press Enter to add…"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 bg-gray-50"
              />
              {showConditionSuggestions && filteredConditions.length > 0 && (
                <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                  {filteredConditions.map(c => (
                    <button key={c} type="button" onMouseDown={() => addCondition(c)}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-800 border-b border-gray-50 last:border-0">
                      {c}
                    </button>
                  ))}
                  {conditionSearch.trim() && !commonConditions.includes(conditionSearch.trim()) && (
                    <button type="button" onMouseDown={() => addCondition(conditionSearch)}
                      className="w-full text-left px-4 py-2.5 text-sm text-blue-700 hover:bg-blue-50 border-t border-gray-100 font-medium">
                      + Add &quot;{conditionSearch.trim()}&quot; as custom condition
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Prescription</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={getAiSuggestions}
                  disabled={aiSuggestLoading}
                  title="Get AI-powered medicine suggestions based on patient conditions and diagnosis"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gradient-to-r from-violet-50 to-blue-50 text-violet-700 border border-violet-200 rounded-lg hover:from-violet-100 hover:to-blue-100 font-medium disabled:opacity-60"
                >
                  {aiSuggestLoading
                    ? <><div className="w-3 h-3 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" /> Thinking…</>
                    : <>✨ AI Suggest</>
                  }
                </button>
                <button
                  type="button"
                  onClick={() => setRxLayout(l => l === 'compact' ? 'column' : 'compact')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                  title="Toggle prescription layout"
                >
                  {rxLayout === 'compact' ? (
                    <><span>⊞</span> Column View</>
                  ) : (
                    <><span>☰</span> Compact View</>
                  )}
                </button>
                <button
                  onClick={() => setMeds([...meds, emptyMed()])}
                  className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium"
                >
                  + Add Medicine
                </button>
              </div>
            </div>

            {/* AI suggestions panel */}
            {showAiPanel && (
              <div className="mb-4 bg-gradient-to-br from-violet-50 to-blue-50 rounded-xl border border-violet-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-violet-700">✨ AI Suggested Medicines — click to add</p>
                  <button onClick={() => setShowAiPanel(false)} className="text-violet-400 hover:text-violet-700 text-sm leading-none">×</button>
                </div>
                {aiSuggestLoading && (
                  <div className="flex items-center gap-2 py-2">
                    <div className="w-4 h-4 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
                    <span className="text-xs text-violet-500">Analysing patient conditions and diagnosis…</span>
                  </div>
                )}
                {!aiSuggestLoading && aiSuggestions.length === 0 && (
                  <p className="text-xs text-violet-400 py-1">No suggestions available — add diagnosis and conditions for better results</p>
                )}
                {aiSuggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => addAiSuggestionToRx(s)}
                    className="w-full text-left mb-2 last:mb-0 p-3 bg-white/70 hover:bg-white rounded-xl border border-violet-100 hover:border-violet-300 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 group-hover:text-violet-700">{s.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{s.dosage} · {s.frequency} · {s.duration}</p>
                        {s.notes && <p className="text-xs text-amber-700 mt-1 bg-amber-50 px-2 py-0.5 rounded">{s.notes}</p>}
                      </div>
                      <span className="text-xs text-violet-500 font-medium flex-shrink-0 group-hover:text-violet-700">+ Add</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {meds.map((m, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">#{i + 1}</span>
                    {meds.length > 1 && (
                      <button onClick={() => removeMed(i)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                    )}
                  </div>
                  <div className={rxLayout === 'compact' ? "grid grid-cols-2 md:grid-cols-4 gap-3" : "grid grid-cols-1 gap-3"}>
                    <div className="md:col-span-2 relative">
                      <label className="text-xs text-gray-500 mb-1 block">
                        Medicine Name <span className="text-red-400">*</span>
                        {m.inventoryId && <span className="ml-1.5 text-xs text-green-600 font-medium">✓ from inventory</span>}
                      </label>
                      <input
                        value={m.medicineName}
                        onChange={e => {
                          updateMed(i, 'medicineName', e.target.value);
                          updateMed(i, 'inventoryId', undefined);
                          searchMedicines(e.target.value, i, inventoryCache);
                        }}
                        onFocus={() => searchMedicines(m.medicineName, i, inventoryCache)}
                        onBlur={() => setTimeout(() => { setMedSuggestIdx(null); setMedSuggestions([]); }, 200)}
                        placeholder="Click or type to search pharmacy inventory…"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                      {medSuggestIdx === i && medSuggestions.length > 0 && (
                        <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                          {medSuggestions.map(s => (
                            <button
                              key={s.id}
                              type="button"
                              onMouseDown={() => {
                                setMeds(prev => prev.map((med, idx) => idx !== i ? med : {
                                  ...med,
                                  medicineName: s.name,
                                  genericName: s.genericName || med.genericName,
                                  inventoryId: s.id,
                                }));
                                setMedSuggestions([]);
                                setMedSuggestIdx(null);
                              }}
                              className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-gray-50 last:border-0"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{s.name}</p>
                                  {s.genericName && <p className="text-xs text-gray-400">{s.genericName}</p>}
                                </div>
                                <div className="text-right flex-shrink-0 ml-3">
                                  <p className="text-xs font-semibold text-gray-700">₹{Number(s.sellingPrice).toFixed(2)}</p>
                                  <p className={`text-xs ${s.stockQty <= 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                    {s.stockQty <= 0 ? 'Out of stock' : `${s.stockQty} ${s.unit} in stock`}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
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

      {/* ── Lab Tests ── */}
      {tab === 'labtests' && (
        <div className="space-y-4">
          {/* Order form */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Order Lab Tests</h2>
              <select
                value={labPriority}
                onChange={e => setLabPriority(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ROUTINE">Routine</option>
                <option value="URGENT">Urgent</option>
                <option value="STAT">STAT</option>
              </select>
            </div>

            {/* Search + category filter */}
            <div className="flex gap-2 mb-3">
              <input
                value={labSearch}
                onChange={e => setLabSearch(e.target.value)}
                placeholder="Search tests by name or code…"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={labCategoryFilter}
                onChange={e => setLabCategoryFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none"
              >
                <option value="">All Categories</option>
                {['Haematology', 'Biochemistry', 'Microbiology', 'Serology', 'Urine Analysis', 'Radiology', 'Other'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Test grid */}
            {labTests.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">Loading tests…</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
                {labTests
                  .filter(t => !labCategoryFilter || t.category === labCategoryFilter)
                  .filter(t => !labSearch || t.name.toLowerCase().includes(labSearch.toLowerCase()) || t.code.toLowerCase().includes(labSearch.toLowerCase()))
                  .map(t => {
                    const selected = selectedTestIds.has(t.id);
                    return (
                      <label
                        key={t.id}
                        className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selected ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={e => {
                            const next = new Set(selectedTestIds);
                            if (e.target.checked) next.add(t.id); else next.delete(t.id);
                            setSelectedTestIds(next);
                          }}
                          className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900 leading-snug">{t.name}</p>
                          <p className="text-xs text-gray-400">{t.code} · ₹{Number(t.price)}</p>
                          {t.turnaround && <p className="text-xs text-gray-400">{t.turnaround}h TAT</p>}
                        </div>
                      </label>
                    );
                  })}
              </div>
            )}

            {/* Selected summary + notes + submit */}
            {selectedTestIds.size > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">
                    {selectedTestIds.size} test{selectedTestIds.size > 1 ? 's' : ''} selected
                    {' · '}₹{labTests.filter(t => selectedTestIds.has(t.id)).reduce((s, t) => s + Number(t.price), 0).toLocaleString('en-IN')}
                  </p>
                  <button onClick={() => setSelectedTestIds(new Set())} className="text-xs text-gray-400 hover:text-gray-600">Clear all</button>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {labTests.filter(t => selectedTestIds.has(t.id)).map(t => (
                    <span key={t.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                      {t.name}
                      <button
                        onClick={() => { const n = new Set(selectedTestIds); n.delete(t.id); setSelectedTestIds(n); }}
                        className="hover:text-blue-900 leading-none"
                      >×</button>
                    </span>
                  ))}
                </div>
                <textarea
                  rows={2}
                  value={labNotes}
                  onChange={e => setLabNotes(e.target.value)}
                  placeholder="Clinical indication / notes for the lab (optional)"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-3"
                />
                <button
                  onClick={orderLabTests}
                  disabled={orderingLab}
                  className="px-6 py-2.5 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 disabled:opacity-50 font-semibold flex items-center gap-2"
                >
                  {orderingLab && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                  {orderingLab ? 'Placing Order…' : `Place Lab Order (${selectedTestIds.size} test${selectedTestIds.size > 1 ? 's' : ''})`}
                </button>
              </div>
            )}
          </div>

          {/* Orders already placed for this visit */}
          {labOrders.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Orders for This Visit</h3>
              <div className="space-y-2">
                {labOrders.map(o => (
                  <div key={o.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 font-mono">{o.orderNumber}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{o.items.map(i => i.labTest.name).join(', ')}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        o.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                        o.status === 'IN_PROGRESS' ? 'bg-orange-100 text-orange-700' :
                        o.status === 'SAMPLE_COLLECTED' ? 'bg-blue-100 text-blue-700' :
                        o.status === 'CANCELLED' ? 'bg-gray-100 text-gray-500' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {o.status.replace(/_/g, ' ')}
                      </span>
                      <p className="text-xs text-gray-400 mt-0.5">{o.priority}</p>
                    </div>
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
              <div key={h.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {new Date(h.appointment.registeredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-gray-400">Dr. {h.doctor.firstName} {h.doctor.lastName} · {h.appointment.visitType}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {h.appointment.chiefComplaint && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{h.appointment.chiefComplaint}</span>
                    )}
                    <button
                      onClick={() => printHistoryRx(h)}
                      disabled={printingHistoryId === h.id}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      {printingHistoryId === h.id ? (
                        <span className="w-3 h-3 border border-gray-400 border-t-blue-500 rounded-full animate-spin" />
                      ) : (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                      )}
                      Print Rx
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  {h.diagnosis && (
                    <p className="text-sm text-gray-700 mb-2"><span className="font-medium text-gray-500">Dx:</span> {h.diagnosis}</p>
                  )}
                  {h.observations && (
                    <p className="text-sm text-gray-500 mb-2 line-clamp-2">{h.observations}</p>
                  )}
                  {h.prescriptions.flatMap(rx => rx.items).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-500 mb-1.5">Prescribed</p>
                      <div className="flex flex-wrap gap-1.5">
                        {h.prescriptions.flatMap(rx => rx.items).map((m, i) => (
                          <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                            {m.medicineName} {m.dosage} · {m.frequency} · {m.duration}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {h.labOrders && h.labOrders.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-500 mb-1.5">Lab Tests</p>
                      <div className="space-y-1.5">
                        {h.labOrders.map((o) => (
                          <div key={o.id} className="bg-gray-50 rounded-lg p-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-mono text-gray-600">{o.orderNumber}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${o.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{o.status.replace(/_/g, ' ')}</span>
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
    </div>
  );
}
