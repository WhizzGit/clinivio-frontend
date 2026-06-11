"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { appointmentApi, billingApi } from "@/lib/api";
import {
  Activity, Stethoscope, Scissors, FileText, ClipboardList,
  ChevronLeft, Plus, X, CheckCircle, AlertCircle, Camera,
  Pill, Utensils, Dumbbell, Heart, CalendarCheck, Save,
  Clock, User, Bed, Building2, LogOut
} from "lucide-react";

// ─── Shared helpers ───────────────────────────────────────────────────────────
function calcAge(dob?: string) {
  if (!dob) return "—";
  return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) + "y";
}
function fmt(d?: string) { return d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }
function fmtDate(d?: string) { return d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"; }

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  ADMITTED: { label: "Admitted", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  UNDER_TREATMENT: { label: "Under Treatment", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  READY_FOR_DISCHARGE: { label: "Ready for Discharge", cls: "bg-green-50 text-green-700 border-green-200" },
  DISCHARGED: { label: "Discharged", cls: "bg-gray-100 text-gray-600 border-gray-200" },
};

const TABS = [
  { key: "vitals", label: "Vitals", icon: Activity },
  { key: "consultation", label: "Consultation", icon: Stethoscope },
  { key: "treatments", label: "Treatments", icon: Pill },
  { key: "procedures", label: "Procedures", icon: Scissors },
  { key: "discharge-advice", label: "Discharge Advice", icon: ClipboardList },
  { key: "discharge-summary", label: "Discharge Summary", icon: FileText },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function IPDDetailPage() {
  const { admissionId } = useParams<{ admissionId: string }>();
  const router = useRouter();
  const [admission, setAdmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("vitals");
  const [actionMsg, setActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [admissionPaymentPending, setAdmissionPaymentPending] = useState(false);

  useEffect(() => { load(); }, [admissionId]);

  async function load() {
    setLoading(true);
    try {
      const r = await appointmentApi.get(`/ipd/admissions/${admissionId}`);
      setAdmission(r.data);
      billingApi.get(`/invoices/by-admission/${admissionId}`).then(res => {
        const invoices: any[] = res.data || [];
        setAdmissionPaymentPending(invoices.some(inv => inv.paymentStatus === 'PENDING'));
      }).catch(() => {});
    }
    catch { /* handled */ }
    finally { setLoading(false); }
  }

  function notify(type: "success" | "error", text: string) {
    setActionMsg({ type, text });
    setTimeout(() => setActionMsg(null), 3500);
  }

  async function markReadyForDischarge() {
    try { await appointmentApi.patch(`/ipd/admissions/${admissionId}/ready-for-discharge`); load(); notify("success", "Marked ready for discharge"); }
    catch { notify("error", "Failed to update status"); }
  }

  async function discharge() {
    if (!confirm("Confirm patient discharge? Bed will be released.")) return;
    try { await appointmentApi.patch(`/ipd/admissions/${admissionId}/discharge`, {}); load(); notify("success", "Patient discharged"); }
    catch { notify("error", "Failed to discharge patient"); }
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading…</div>;
  if (!admission) return <div className="flex items-center justify-center h-screen text-gray-400">Admission not found</div>;

  const st = STATUS_MAP[admission.status] ?? STATUS_MAP.ADMITTED;
  const isActive = admission.status !== "DISCHARGED";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {actionMsg && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${actionMsg.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {actionMsg.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {actionMsg.text}
        </div>
      )}

      {/* Patient Banner */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-start gap-4">
          <button onClick={() => router.push("/ipd")} className="mt-1 text-gray-400 hover:text-gray-700">
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <span className="text-blue-700 font-bold text-lg">
              {admission.patient?.firstName?.[0]}{admission.patient?.lastName?.[0]}
            </span>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{admission.patient?.firstName} {admission.patient?.lastName}</h1>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${st.cls}`}>{st.label}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
              <span>UHID: <strong className="text-gray-700">{admission.patient?.uhid}</strong></span>
              <span>Adm No: <strong className="text-gray-700">{admission.admissionNumber}</strong></span>
              <span>{admission.patient?.gender} · {calcAge(admission.patient?.dob)}</span>
              {admission.patient?.bloodGroup && <span className="font-semibold text-red-600">{admission.patient.bloodGroup}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-gray-400">
              <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{admission.room?.name} · Bed {admission.bed?.bedNumber}</span>
              <span className="flex items-center gap-1"><User className="h-3 w-3" />Dr. {admission.attendingDoctor?.firstName} {admission.attendingDoctor?.lastName}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Admitted {fmtDate(admission.admittedAt)}</span>
              {admission.estimatedDischargeAt && <span className="flex items-center gap-1"><CalendarCheck className="h-3 w-3" />Est. discharge {fmtDate(admission.estimatedDischargeAt)}</span>}
            </div>
            <p className="text-xs text-gray-500 mt-1 italic">{admission.admissionReason}</p>
          </div>

          {isActive && (
            <div className="flex gap-2 flex-shrink-0">
              {admission.status !== "READY_FOR_DISCHARGE" && (
                <button onClick={markReadyForDischarge} className="flex items-center gap-1.5 border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg text-xs font-medium">
                  <CheckCircle className="h-3.5 w-3.5" /> Ready for Discharge
                </button>
              )}
              <button onClick={discharge} className="flex items-center gap-1.5 border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-medium">
                <LogOut className="h-3.5 w-3.5" /> Discharge
              </button>
            </div>
          )}
        </div>

        {admissionPaymentPending && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            Admission fee payment pending — visit Billing Counter to collect payment
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mt-4 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === t.key ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
              <t.icon className="h-4 w-4" />{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-6">
        {tab === "vitals" && <VitalsTab admission={admission} onSaved={load} notify={notify} />}
        {tab === "consultation" && <ConsultationTab admission={admission} onSaved={load} notify={notify} />}
        {tab === "treatments" && <TreatmentsTab admission={admission} onSaved={load} notify={notify} isActive={isActive} />}
        {tab === "procedures" && <ProceduresTab admission={admission} onSaved={load} notify={notify} isActive={isActive} />}
        {tab === "discharge-advice" && <DischargeAdviceTab admission={admission} onSaved={load} notify={notify} isActive={isActive} />}
        {tab === "discharge-summary" && <DischargeSummaryTab admission={admission} onSaved={load} notify={notify} isActive={isActive} />}
      </div>
    </div>
  );
}

// ─── Vitals Tab ───────────────────────────────────────────────────────────────
function VitalsTab({ admission, onSaved, notify }: any) {
  const empty = { bpSystolic: "", bpDiastolic: "", pulseRate: "", temperature: "", weightKg: "", heightCm: "", spo2: "", rbsMgDl: "", respiratoryRate: "", notes: "" };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const bmi = form.weightKg && form.heightCm
    ? (Number(form.weightKg) / Math.pow(Number(form.heightCm) / 100, 2)).toFixed(1)
    : null;

  const F = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  async function save() {
    setSaving(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== "").map(([k, v]) => [k, k === "notes" ? v : Number(v)]));
      await appointmentApi.post(`/ipd/admissions/${admission.id}/vitals`, payload);
      setForm(empty); onSaved(); notify("success", "Vitals recorded");
    } catch { notify("error", "Failed to save vitals"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      {/* Record new vitals */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Activity className="h-4 w-4 text-blue-600" />Record Vitals</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { k: "bpSystolic", label: "BP Systolic", unit: "mmHg", min: 60, max: 250 },
            { k: "bpDiastolic", label: "BP Diastolic", unit: "mmHg", min: 40, max: 160 },
            { k: "pulseRate", label: "Pulse Rate", unit: "bpm", min: 30, max: 250 },
            { k: "temperature", label: "Temperature", unit: "°C", min: 34, max: 42, step: "0.1" },
            { k: "spo2", label: "SpO₂", unit: "%", min: 70, max: 100 },
            { k: "rbsMgDl", label: "RBS", unit: "mg/dL", min: 0, max: 600, step: "0.1" },
            { k: "weightKg", label: "Weight", unit: "kg", min: 1, max: 300, step: "0.1" },
            { k: "heightCm", label: "Height", unit: "cm", min: 30, max: 250, step: "0.1" },
            { k: "respiratoryRate", label: "Resp. Rate", unit: "/min", min: 5, max: 60 },
          ].map(f => (
            <div key={f.k}>
              <label className="text-xs font-medium text-gray-600 block mb-1">{f.label}</label>
              <div className="relative">
                <input type="number" min={f.min} max={f.max} step={f.step ?? "1"} value={(form as any)[f.k]} onChange={F(f.k)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">{f.unit}</span>
              </div>
            </div>
          ))}
        </div>
        {bmi && (
          <p className="mt-3 text-sm text-gray-600">BMI: <strong>{bmi}</strong> {Number(bmi) < 18.5 ? "— Underweight" : Number(bmi) < 25 ? "— Normal" : Number(bmi) < 30 ? "— Overweight" : "— Obese"}</p>
        )}
        <textarea className="mt-3 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} placeholder="Notes…" value={form.notes} onChange={F("notes")} />
        <button onClick={save} disabled={saving} className="mt-3 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? "Saving…" : "Record Vitals"}</button>
      </div>

      {/* History */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Vitals History</h3>
        {admission.vitalSnapshots?.length === 0 ? (
          <p className="text-gray-400 text-sm">No vitals recorded yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                <th className="text-left py-2 pr-4">Time</th><th className="pr-3">BP</th><th className="pr-3">Pulse</th><th className="pr-3">Temp</th><th className="pr-3">SpO₂</th><th className="pr-3">RBS</th><th className="pr-3">Wt</th><th className="pr-3">RR</th><th className="text-left pr-3">Recorded By</th>
              </tr></thead>
              <tbody>
                {admission.vitalSnapshots?.map((v: any) => (
                  <tr key={v.id} className="border-b border-gray-50">
                    <td className="py-2 pr-4 text-gray-500 text-xs">{fmt(v.recordedAt)}</td>
                    <td className="pr-3 text-center">{v.bpSystolic && v.bpDiastolic ? `${v.bpSystolic}/${v.bpDiastolic}` : "—"}</td>
                    <td className="pr-3 text-center">{v.pulseRate ?? "—"}</td>
                    <td className="pr-3 text-center">{v.temperature ? `${v.temperature}°` : "—"}</td>
                    <td className="pr-3 text-center">{v.spo2 ? `${v.spo2}%` : "—"}</td>
                    <td className="pr-3 text-center">{v.rbsMgDl ?? "—"}</td>
                    <td className="pr-3 text-center">{v.weightKg ? `${v.weightKg}kg` : "—"}</td>
                    <td className="pr-3 text-center">{v.respiratoryRate ?? "—"}</td>
                    <td className="pr-3 text-xs text-gray-500">{v.recordedBy?.firstName} {v.recordedBy?.lastName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Consultation Tab (reused from OPD — observations, diagnosis, notes) ─────
function ConsultationTab({ admission, onSaved, notify }: any) {
  const appt = admission.appointment;
  if (!appt) return (
    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
      <Stethoscope className="h-10 w-10 mx-auto mb-2" />
      <p>No OPD appointment linked to this admission.</p>
      <p className="text-sm mt-1">Consultation notes can be added when an appointment is linked.</p>
    </div>
  );
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500">Linked OPD Appointment: <strong>{appt.id}</strong></p>
      <a href={`/consultation/${appt.id}`} className="mt-3 inline-flex items-center gap-2 text-blue-600 text-sm font-medium hover:underline">
        Open Consultation Record →
      </a>
    </div>
  );
}

// ─── Treatments Tab ───────────────────────────────────────────────────────────
function TreatmentsTab({ admission, onSaved, notify, isActive }: any) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ treatmentName: "", instructions: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const F = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  async function save() {
    if (!form.treatmentName) { notify("error", "Treatment name is required"); return; }
    setSaving(true);
    try {
      await appointmentApi.post(`/ipd/admissions/${admission.id}/treatments`, form);
      setForm({ treatmentName: "", instructions: "", notes: "" }); setShowForm(false); onSaved(); notify("success", "Treatment added");
    } catch { notify("error", "Failed to add treatment"); }
    finally { setSaving(false); }
  }

  async function stopTreatment(id: string) {
    try { await appointmentApi.patch(`/ipd/treatments/${id}`, { isActive: false }); onSaved(); notify("success", "Treatment stopped"); }
    catch { notify("error", "Failed to update treatment"); }
  }

  return (
    <div className="space-y-4">
      {isActive && (
        <div className="flex justify-end">
          <button onClick={() => setShowForm(s => !s)} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"><Plus className="h-4 w-4" />Add Treatment</button>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl border border-blue-200 p-5 space-y-3">
          <h3 className="font-semibold text-gray-900">New Treatment</h3>
          <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Treatment name *" value={form.treatmentName} onChange={F("treatmentName")} />
          <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Instructions / dosage…" value={form.instructions} onChange={F("instructions")} />
          <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Notes…" value={form.notes} onChange={F("notes")} />
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm">Cancel</button>
            <button onClick={save} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">{saving ? "Saving…" : "Add Treatment"}</button>
          </div>
        </div>
      )}

      {admission.treatments?.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400"><Pill className="h-10 w-10 mx-auto mb-2" /><p>No treatments recorded yet</p></div>
      ) : (
        <div className="space-y-3">
          {admission.treatments?.map((t: any) => (
            <div key={t.id} className={`bg-white rounded-xl border p-4 ${t.isActive ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{t.treatmentName}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>{t.isActive ? "Active" : "Stopped"}</span>
                  </div>
                  {t.instructions && <p className="text-sm text-gray-600 mt-1">{t.instructions}</p>}
                  {t.notes && <p className="text-xs text-gray-400 mt-1">{t.notes}</p>}
                  <p className="text-xs text-gray-400 mt-2">By Dr. {t.orderedBy?.firstName} {t.orderedBy?.lastName} · {fmt(t.startedAt)}</p>
                  {t.endedAt && <p className="text-xs text-gray-400">Stopped: {fmt(t.endedAt)}</p>}
                </div>
                {isActive && t.isActive && (
                  <button onClick={() => stopTreatment(t.id)} className="text-xs text-red-600 hover:text-red-800 border border-red-200 px-2 py-1 rounded">Stop</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Procedures Tab ───────────────────────────────────────────────────────────
function ProceduresTab({ admission, onSaved, notify, isActive }: any) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ procedureName: "", notes: "", outcomes: "", complications: "", performedAt: "" });
  const [saving, setSaving] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const F = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  async function save() {
    if (!form.procedureName) { notify("error", "Procedure name is required"); return; }
    setSaving(true);
    try {
      await appointmentApi.post(`/ipd/admissions/${admission.id}/procedures`, { ...form, performedAt: form.performedAt || undefined });
      setForm({ procedureName: "", notes: "", outcomes: "", complications: "", performedAt: "" }); setShowForm(false); onSaved(); notify("success", "Procedure added");
    } catch { notify("error", "Failed to add procedure"); }
    finally { setSaving(false); }
  }

  async function uploadPhotos(procedureId: string, files: FileList) {
    setUploadingFor(procedureId);
    try {
      // In production: upload to S3 and get URLs back. For now, store as base64 data URLs for demo.
      const urls: string[] = await Promise.all(Array.from(files).map(f => new Promise<string>((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(f);
      })));
      await appointmentApi.patch(`/ipd/procedures/${procedureId}/photos`, { photoUrls: urls });
      onSaved(); notify("success", `${files.length} photo(s) uploaded`);
    } catch { notify("error", "Photo upload failed"); }
    finally { setUploadingFor(null); }
  }

  return (
    <div className="space-y-4">
      {isActive && (
        <div className="flex justify-end">
          <button onClick={() => setShowForm(s => !s)} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"><Plus className="h-4 w-4" />Add Procedure</button>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl border border-blue-200 p-5 space-y-3">
          <h3 className="font-semibold text-gray-900">New Procedure</h3>
          <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Procedure name *" value={form.procedureName} onChange={F("procedureName")} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Performed At</label>
              <input type="datetime-local" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.performedAt} onChange={F("performedAt")} />
            </div>
          </div>
          <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Notes / procedure description…" value={form.notes} onChange={F("notes")} />
          <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Outcomes…" value={form.outcomes} onChange={F("outcomes")} />
          <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Complications (if any)…" value={form.complications} onChange={F("complications")} />
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm">Cancel</button>
            <button onClick={save} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">{saving ? "Saving…" : "Add Procedure"}</button>
          </div>
        </div>
      )}

      {admission.procedures?.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400"><Scissors className="h-10 w-10 mx-auto mb-2" /><p>No procedures recorded yet</p></div>
      ) : (
        <div className="space-y-4">
          {admission.procedures?.map((p: any) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-lg">{p.procedureName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">By Dr. {p.performedBy?.firstName} {p.performedBy?.lastName} · {fmt(p.performedAt)}</p>
                  {p.notes && <p className="text-sm text-gray-700 mt-2"><strong>Notes:</strong> {p.notes}</p>}
                  {p.outcomes && <p className="text-sm text-gray-700 mt-1"><strong>Outcomes:</strong> {p.outcomes}</p>}
                  {p.complications && <p className="text-sm text-red-700 mt-1"><strong>Complications:</strong> {p.complications}</p>}
                </div>
                {isActive && (
                  <div>
                    <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => e.target.files && uploadPhotos(p.id, e.target.files)} />
                    <button
                      onClick={() => { setUploadingFor(p.id); fileRef.current?.click(); }}
                      disabled={uploadingFor === p.id}
                      className="flex items-center gap-1.5 text-sm border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 px-3 py-1.5 rounded-lg"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      {uploadingFor === p.id ? "Uploading…" : "Add Photos"}
                    </button>
                  </div>
                )}
              </div>

              {/* Photo gallery */}
              {p.photoUrls?.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-3">
                  {p.photoUrls.map((url: string, i: number) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt={`Procedure photo ${i + 1}`} className="h-24 w-24 object-cover rounded-lg border border-gray-200 hover:opacity-90 transition-opacity" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Discharge Advice Tab ─────────────────────────────────────────────────────
function DischargeAdviceTab({ admission, onSaved, notify, isActive }: any) {
  const existing = admission.dischargeAdvice;
  const [form, setForm] = useState({
    medications: existing?.medications ?? "",
    dietAdvice: existing?.dietAdvice ?? "",
    activityAdvice: existing?.activityAdvice ?? "",
    woundCare: existing?.woundCare ?? "",
    otherAdvice: existing?.otherAdvice ?? "",
    followUpDate: existing?.followUpDate ? existing.followUpDate.split("T")[0] : "",
    followUpNotes: existing?.followUpNotes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const F = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  async function save() {
    setSaving(true);
    try {
      await appointmentApi.post(`/ipd/admissions/${admission.id}/discharge-advice`, { ...form, followUpDate: form.followUpDate || undefined });
      onSaved(); notify("success", "Discharge advice saved");
    } catch { notify("error", "Failed to save discharge advice"); }
    finally { setSaving(false); }
  }

  const sections = [
    { k: "medications", label: "Medications to Continue", icon: Pill, placeholder: "List medications, dosage, frequency…" },
    { k: "dietAdvice", label: "Diet Advice", icon: Utensils, placeholder: "Dietary restrictions and recommendations…" },
    { k: "activityAdvice", label: "Activity / Exercise", icon: Dumbbell, placeholder: "Physical activity instructions…" },
    { k: "woundCare", label: "Wound Care", icon: Heart, placeholder: "Dressing, suture removal date, wound care instructions…" },
    { k: "otherAdvice", label: "Other Instructions", icon: ClipboardList, placeholder: "Any other important advice…" },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2"><ClipboardList className="h-5 w-5 text-blue-600" />Discharge Advice</h3>
      {sections.map(s => (
        <div key={s.k}>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5"><s.icon className="h-4 w-4 text-gray-400" />{s.label}</label>
          <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} placeholder={s.placeholder} value={(form as any)[s.k]} onChange={F(s.k)} disabled={!isActive} />
        </div>
      ))}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5"><CalendarCheck className="h-4 w-4 text-gray-400" />Follow-up Date</label>
          <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.followUpDate} onChange={F("followUpDate")} disabled={!isActive} min={new Date().toISOString().split("T")[0]} />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Follow-up Notes</label>
          <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} value={form.followUpNotes} onChange={F("followUpNotes")} disabled={!isActive} />
        </div>
      </div>
      {isActive && (
        <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "Saving…" : "Save Discharge Advice"}</button>
      )}
    </div>
  );
}

// ─── Discharge Summary Tab ────────────────────────────────────────────────────
function DischargeSummaryTab({ admission, onSaved, notify, isActive }: any) {
  const existing = admission.dischargeSummary;
  const [form, setForm] = useState({
    finalDiagnosis: existing?.finalDiagnosis ?? "",
    presentingComplaints: existing?.presentingComplaints ?? admission.admissionReason ?? "",
    treatmentSummary: existing?.treatmentSummary ?? "",
    proceduresDone: existing?.proceduresDone ?? "",
    investigationFindings: existing?.investigationFindings ?? "",
    conditionAtDischarge: existing?.conditionAtDischarge ?? "",
  });
  const [saving, setSaving] = useState(false);
  const F = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  async function save() {
    if (!form.finalDiagnosis || !form.treatmentSummary || !form.conditionAtDischarge) {
      notify("error", "Final diagnosis, treatment summary, and condition at discharge are required");
      return;
    }
    setSaving(true);
    try {
      await appointmentApi.post(`/ipd/admissions/${admission.id}/discharge-summary`, form);
      onSaved(); notify("success", "Discharge summary saved");
    } catch { notify("error", "Failed to save discharge summary"); }
    finally { setSaving(false); }
  }

  const fields = [
    { k: "presentingComplaints", label: "Presenting Complaints *", rows: 2 },
    { k: "finalDiagnosis", label: "Final Diagnosis *", rows: 3 },
    { k: "treatmentSummary", label: "Treatment Summary *", rows: 4 },
    { k: "proceduresDone", label: "Procedures Done", rows: 2 },
    { k: "investigationFindings", label: "Investigation Findings", rows: 3 },
    { k: "conditionAtDischarge", label: "Condition at Discharge *", rows: 2 },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2"><FileText className="h-5 w-5 text-blue-600" />Discharge Summary</h3>
        {existing && <p className="text-xs text-gray-400">Last updated by Dr. {existing.generatedBy?.firstName} {existing.generatedBy?.lastName}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 rounded-lg p-4">
        <div><span className="text-gray-500">Patient:</span> <strong>{admission.patient?.firstName} {admission.patient?.lastName}</strong></div>
        <div><span className="text-gray-500">UHID:</span> <strong>{admission.patient?.uhid}</strong></div>
        <div><span className="text-gray-500">Admitted:</span> <strong>{fmtDate(admission.admittedAt)}</strong></div>
        <div><span className="text-gray-500">Discharged:</span> <strong>{admission.dischargedAt ? fmtDate(admission.dischargedAt) : "—"}</strong></div>
        <div><span className="text-gray-500">Room:</span> <strong>{admission.room?.name} · Bed {admission.bed?.bedNumber}</strong></div>
        <div><span className="text-gray-500">Doctor:</span> <strong>Dr. {admission.attendingDoctor?.firstName} {admission.attendingDoctor?.lastName}</strong></div>
      </div>

      {fields.map(f => (
        <div key={f.k}>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">{f.label}</label>
          <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={f.rows} value={(form as any)[f.k]} onChange={F(f.k)} disabled={!isActive} />
        </div>
      ))}

      {isActive && (
        <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "Saving…" : "Save Discharge Summary"}</button>
      )}
    </div>
  );
}
