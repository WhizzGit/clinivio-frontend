"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { appointmentApi } from "@/lib/api";
import {
  Bed, UserCheck, Clock, AlertCircle, Plus, Search,
  ChevronRight, Activity, Building2
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ADMITTED: { label: "Admitted", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  UNDER_TREATMENT: { label: "Under Treatment", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
  READY_FOR_DISCHARGE: { label: "Ready for Discharge", color: "text-green-700", bg: "bg-green-50 border-green-200" },
  DISCHARGED: { label: "Discharged", color: "text-gray-600", bg: "bg-gray-50 border-gray-200" },
};

const ROOM_TYPE_LABELS: Record<string, string> = {
  GENERAL_WARD: "General Ward",
  SEMI_PRIVATE: "Semi-Private",
  PRIVATE: "Private",
  ICU: "ICU",
};

function calcAge(dob?: string) {
  if (!dob) return "—";
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)) + "y";
}

export default function IPDPage() {
  const router = useRouter();
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [showAdmitModal, setShowAdmitModal] = useState(false);

  useEffect(() => {
    loadAdmissions();
  }, [statusFilter]);

  async function loadAdmissions() {
    setLoading(true);
    try {
      const params = statusFilter === "active" ? "" : `?status=${statusFilter}`;
      const res = await appointmentApi.get(`/ipd/admissions${params}`);
      // Backend returns { data: [...], pagination: {} } shape
      setAdmissions(Array.isArray(res.data) ? res.data : (res.data?.data ?? []));
    } catch { setAdmissions([]); }
    finally { setLoading(false); }
  }

  const filtered = admissions.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.patient?.firstName?.toLowerCase().includes(q) ||
      a.patient?.lastName?.toLowerCase().includes(q) ||
      a.patient?.uhid?.toLowerCase().includes(q) ||
      a.admissionNumber?.toLowerCase().includes(q)
    );
  });

  const stats = {
    total: admissions.length,
    admitted: admissions.filter(a => a.status === "ADMITTED").length,
    underTreatment: admissions.filter(a => a.status === "UNDER_TREATMENT").length,
    readyForDischarge: admissions.filter(a => a.status === "READY_FOR_DISCHARGE").length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">IPD Admissions</h1>
          <p className="text-sm text-gray-500 mt-0.5">In-Patient Department — active admissions</p>
        </div>
        <button
          onClick={() => setShowAdmitModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> Admit Patient
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Active", value: stats.total, icon: Bed, color: "blue" },
          { label: "Admitted", value: stats.admitted, icon: UserCheck, color: "indigo" },
          { label: "Under Treatment", value: stats.underTreatment, icon: Activity, color: "yellow" },
          { label: "Ready to Discharge", value: stats.readyForDischarge, icon: Clock, color: "green" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
              </div>
              <div className={`p-2.5 rounded-lg bg-${s.color}-50`}>
                <s.icon className={`h-5 w-5 text-${s.color}-600`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search by name, UHID, admission no..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {[
            { key: "active", label: "Active" },
            { key: "ADMITTED", label: "Admitted" },
            { key: "UNDER_TREATMENT", label: "Under Treatment" },
            { key: "READY_FOR_DISCHARGE", label: "Ready for Discharge" },
            { key: "DISCHARGED", label: "Discharged" },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                statusFilter === f.key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Admissions list */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400">Loading admissions…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
          <Bed className="h-10 w-10" />
          <p>No admissions found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => {
            const st = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.ADMITTED;
            return (
              <div
                key={a.id}
                onClick={() => router.push(`/ipd/${a.id}`)}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all flex items-center gap-4"
              >
                {/* Avatar */}
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-700 font-bold text-sm">
                    {a.patient?.firstName?.[0]}{a.patient?.lastName?.[0]}
                  </span>
                </div>

                {/* Patient info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 truncate">
                      {a.patient?.firstName} {a.patient?.lastName}
                    </p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${st.bg} ${st.color}`}>
                      {st.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>UHID: {a.patient?.uhid}</span>
                    <span>•</span>
                    <span>{a.admissionNumber}</span>
                    <span>•</span>
                    <span>{a.patient?.gender} {calcAge(a.patient?.dob)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{a.admissionReason}</p>
                </div>

                {/* Room / Bed */}
                <div className="text-right flex-shrink-0">
                  <div className="flex items-center gap-1 text-gray-600 text-sm font-medium justify-end">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{a.room?.name}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {ROOM_TYPE_LABELS[a.room?.roomType] ?? a.room?.roomType} · Bed {a.bed?.bedNumber}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Dr. {a.attendingDoctor?.firstName} {a.attendingDoctor?.lastName}
                  </p>
                </div>

                {/* Counts */}
                <div className="flex gap-3 flex-shrink-0 text-center border-l border-gray-100 pl-4">
                  {[
                    { label: "Vitals", val: a._count?.vitalSnapshots ?? 0 },
                    { label: "Treatments", val: a._count?.treatments ?? 0 },
                    { label: "Procedures", val: a._count?.procedures ?? 0 },
                  ].map(c => (
                    <div key={c.label}>
                      <p className="text-lg font-bold text-gray-800">{c.val}</p>
                      <p className="text-xs text-gray-400">{c.label}</p>
                    </div>
                  ))}
                </div>

                <ChevronRight className="h-5 w-5 text-gray-300 flex-shrink-0" />
              </div>
            );
          })}
        </div>
      )}

      {showAdmitModal && <AdmitPatientModal onClose={() => setShowAdmitModal(false)} onSuccess={() => { setShowAdmitModal(false); loadAdmissions(); }} />}
    </div>
  );
}

// ─── Admit Patient Modal ──────────────────────────────────────────────────────

function AdmitPatientModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ patientId: "", attendingDoctorId: "", roomId: "", bedId: "", admissionReason: "", referredBy: "", opinionObtainedBy: "", estimatedDischargeAt: "", notes: "" });
  const [patients, setPatients] = useState<any[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [doctors, setDoctors] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [availableBeds, setAvailableBeds] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { loadDoctors(); loadRooms(); }, []);
  useEffect(() => { if (form.roomId) loadBeds(form.roomId); }, [form.roomId]);

  async function loadDoctors() {
    try {
      const r = await appointmentApi.get("/users?role=DOCTOR&limit=100");
      setDoctors(r.data?.data ?? r.data ?? []);
    } catch { setDoctors([]); }
  }
  async function loadRooms() {
    try { const r = await appointmentApi.get("/rooms"); setRooms(r.data); } catch {}
  }
  async function loadBeds(roomId: string) {
    try {
      const r = await appointmentApi.get(`/rooms/beds?roomId=${roomId}&status=AVAILABLE`);
      setAvailableBeds(r.data?.data ?? r.data ?? []);
    } catch { setAvailableBeds([]); }
  }
  async function searchPatients(q: string) {
    if (q.length < 2) { setPatients([]); return; }
    try {
      const { appointmentApi: api } = await import("@/lib/api");
      const r = await api.get(`/patients?q=${encodeURIComponent(q)}&limit=10`);
      setPatients(r.data?.data ?? []);
    } catch {}
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patientId || !form.roomId || !form.bedId || !form.admissionReason) {
      setError("Patient, room, bed and admission reason are required");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await appointmentApi.post("/ipd/admissions", {
        patientId: form.patientId,
        attendingDoctorId: form.attendingDoctorId || undefined,
        roomId: form.roomId,
        bedId: form.bedId,
        admissionReason: form.admissionReason,
        referredBy: form.referredBy || undefined,
        opinionObtainedBy: form.opinionObtainedBy || undefined,
        estimatedDischargeAt: form.estimatedDischargeAt || undefined,
        notes: form.notes || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to admit patient");
    } finally { setSubmitting(false); }
  }

  const F = (field: string) => (e: any) => setForm(p => ({ ...p, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold text-gray-900">Admit Patient — IPD</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg"><AlertCircle className="h-4 w-4" />{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Patient *</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Name, phone, or UHID..."
              value={patientSearch}
              onChange={e => { setPatientSearch(e.target.value); searchPatients(e.target.value); }}
            />
            {patients.length > 0 && (
              <div className="border border-gray-200 rounded-lg mt-1 max-h-40 overflow-y-auto">
                {patients.map((p: any) => (
                  <div key={p.id} onClick={() => { setForm(f => ({ ...f, patientId: p.id })); setPatientSearch(`${p.firstName} ${p.lastName} (${p.uhid})`); setPatients([]); }}
                    className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm">
                    {p.firstName} {p.lastName} <span className="text-gray-400">· {p.uhid} · {p.phone}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admission Reason *</label>
            <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} value={form.admissionReason} onChange={F("admissionReason")} placeholder="Chief complaint / reason for admission..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Attending Doctor <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.attendingDoctorId} onChange={F("attendingDoctorId")}>
              <option value="">Select doctor</option>
              {doctors.map((d: any) => <option key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Referred By <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Dr. Name / Hospital / Clinic" value={form.referredBy} onChange={F("referredBy")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opinion Obtained By <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Specialist / Consultant" value={form.opinionObtainedBy} onChange={F("opinionObtainedBy")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Room *</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.roomId} onChange={F("roomId")}>
                <option value="">Select room</option>
                {rooms.map((r: any) => (
                  <option key={r.id} value={r.id}>{r.name} ({ROOM_TYPE_LABELS[r.roomType] ?? r.roomType}) — ₹{Number(r.pricePerDay).toLocaleString()}/day · {r.availableBeds} beds free</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bed *</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.bedId} onChange={F("bedId")} disabled={!form.roomId}>
                <option value="">Select bed</option>
                {availableBeds.map((b: any) => <option key={b.id} value={b.id}>Bed {b.bedNumber}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expected Discharge Date</label>
            <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.estimatedDischargeAt} onChange={F("estimatedDischargeAt")} min={new Date().toISOString().split("T")[0]} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} value={form.notes} onChange={F("notes")} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {submitting ? "Admitting…" : "Admit Patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
