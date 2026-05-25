"use client";

import { useState, useEffect } from "react";
import { appointmentApi } from "@/lib/api";
import { Building2, Bed, Plus, Pencil, Settings, CheckCircle, AlertCircle, Wrench, RotateCcw } from "lucide-react";

const ROOM_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  ICU: { label: "ICU", color: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
  PRIVATE: { label: "Private", color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" },
  SEMI_PRIVATE: { label: "Semi-Private", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  GENERAL_WARD: { label: "General Ward", color: "text-green-700", bg: "bg-green-50", border: "border-green-200" },
};

const BED_STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  AVAILABLE: { label: "Available", dot: "bg-green-500" },
  OCCUPIED: { label: "Occupied", dot: "bg-red-500" },
  UNDER_MAINTENANCE: { label: "Maintenance", dot: "bg-yellow-500" },
};

export default function RoomsPage() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editRoom, setEditRoom] = useState<any>(null);
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
  const [roomDetail, setRoomDetail] = useState<any>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { const r = await appointmentApi.get("/rooms"); setRooms(r.data); }
    catch { setRooms([]); }
    finally { setLoading(false); }
  }

  async function loadRoomDetail(id: string) {
    try { const r = await appointmentApi.get(`/rooms/${id}`); setRoomDetail(r.data); }
    catch {}
  }

  function notify(type: "success" | "error", text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  }

  async function toggleBedMaintenance(bedId: string, currentStatus: string) {
    try {
      if (currentStatus === "UNDER_MAINTENANCE") {
        await appointmentApi.patch(`/rooms/beds/${bedId}/available`);
        notify("success", "Bed marked as available");
      } else {
        await appointmentApi.patch(`/rooms/beds/${bedId}/maintenance`, { notes: "Maintenance scheduled" });
        notify("success", "Bed marked under maintenance");
      }
      load();
      if (expandedRoom) loadRoomDetail(expandedRoom);
    } catch (e: any) { notify("error", e?.response?.data?.message ?? "Failed to update bed status"); }
  }

  const stats = {
    totalRooms: rooms.length,
    totalBeds: rooms.reduce((s, r) => s + r.totalBeds, 0),
    available: rooms.reduce((s, r) => s + (r.availableBeds ?? 0), 0),
    occupied: rooms.reduce((s, r) => s + (r.occupiedBeds ?? 0), 0),
  };

  return (
    <div className="p-6 space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border ${toast.type === "success" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
          {toast.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Room Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure ICU, Private, Semi-Private, and General Ward rooms</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="h-4 w-4" /> Add Room
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Rooms", value: stats.totalRooms, color: "blue" },
          { label: "Total Beds", value: stats.totalBeds, color: "gray" },
          { label: "Available", value: stats.available, color: "green" },
          { label: "Occupied", value: stats.occupied, color: "red" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 text-${s.color}-600`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Room cards */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400">Loading rooms…</div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3 bg-white rounded-xl border border-gray-200">
          <Building2 className="h-12 w-12" />
          <p className="font-medium">No rooms configured yet</p>
          <button onClick={() => setShowCreateModal(true)} className="text-blue-600 text-sm font-medium hover:underline">+ Add your first room</button>
        </div>
      ) : (
        <div className="space-y-4">
          {rooms.map(room => {
            const cfg = ROOM_TYPE_CONFIG[room.roomType] ?? ROOM_TYPE_CONFIG.GENERAL_WARD;
            const isExpanded = expandedRoom === room.id;
            return (
              <div key={room.id} className={`bg-white rounded-xl border ${cfg.border} overflow-hidden`}>
                {/* Room header */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => {
                    if (isExpanded) { setExpandedRoom(null); setRoomDetail(null); }
                    else { setExpandedRoom(room.id); loadRoomDetail(room.id); }
                  }}
                >
                  <div className={`p-3 rounded-xl ${cfg.bg}`}><Building2 className={`h-5 w-5 ${cfg.color}`} /></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-lg">{room.name}</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>{cfg.label}</span>
                      {room.floor && <span className="text-xs text-gray-400">Floor {room.floor}</span>}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">₹{Number(room.pricePerDay).toLocaleString()}/day{room.amenities?.length ? ` · ${room.amenities.join(", ")}` : ""}</p>
                  </div>
                  <div className="flex gap-6 text-center">
                    <div><p className="text-2xl font-bold text-gray-900">{room.totalBeds}</p><p className="text-xs text-gray-400">Total</p></div>
                    <div><p className="text-2xl font-bold text-green-600">{room.availableBeds ?? 0}</p><p className="text-xs text-gray-400">Free</p></div>
                    <div><p className="text-2xl font-bold text-red-500">{room.occupiedBeds ?? 0}</p><p className="text-xs text-gray-400">Occupied</p></div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setEditRoom(room); }} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>

                {/* Bed grid (expanded) */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50">
                    {!roomDetail ? (
                      <p className="text-gray-400 text-sm">Loading beds…</p>
                    ) : (
                      <div className="grid grid-cols-6 gap-3">
                        {roomDetail.beds?.map((bed: any) => {
                          const bst = BED_STATUS_CONFIG[bed.status] ?? BED_STATUS_CONFIG.AVAILABLE;
                          const occupant = bed.admissions?.[0]?.patient;
                          return (
                            <div key={bed.id} className={`rounded-xl border p-3 text-center ${bed.status === "AVAILABLE" ? "border-green-200 bg-green-50" : bed.status === "OCCUPIED" ? "border-red-200 bg-red-50" : "border-yellow-200 bg-yellow-50"}`}>
                              <div className="flex items-center justify-center gap-1.5 mb-2">
                                <span className={`h-2 w-2 rounded-full ${bst.dot}`} />
                                <Bed className="h-4 w-4 text-gray-500" />
                              </div>
                              <p className="font-bold text-gray-800 text-sm">{bed.bedNumber}</p>
                              <p className={`text-xs mt-0.5 ${bed.status === "AVAILABLE" ? "text-green-600" : bed.status === "OCCUPIED" ? "text-red-600" : "text-yellow-700"}`}>{bst.label}</p>
                              {occupant && <p className="text-xs text-gray-500 mt-1 truncate">{occupant.firstName} {occupant.lastName}</p>}
                              {bed.status !== "OCCUPIED" && (
                                <button
                                  onClick={() => toggleBedMaintenance(bed.id, bed.status)}
                                  className="mt-2 flex items-center gap-1 mx-auto text-xs text-gray-500 hover:text-gray-700"
                                  title={bed.status === "UNDER_MAINTENANCE" ? "Mark available" : "Mark under maintenance"}
                                >
                                  {bed.status === "UNDER_MAINTENANCE" ? <RotateCcw className="h-3 w-3" /> : <Wrench className="h-3 w-3" />}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <RoomFormModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => { setShowCreateModal(false); load(); }}
          notify={notify}
        />
      )}
      {editRoom && (
        <RoomFormModal
          room={editRoom}
          onClose={() => setEditRoom(null)}
          onSuccess={() => { setEditRoom(null); load(); }}
          notify={notify}
        />
      )}
    </div>
  );
}

// ─── Room Form Modal ──────────────────────────────────────────────────────────
function RoomFormModal({ room, onClose, onSuccess, notify }: { room?: any; onClose: () => void; onSuccess: () => void; notify: (t: "success"|"error", m: string) => void }) {
  const isEdit = !!room;
  const [form, setForm] = useState({
    name: room?.name ?? "",
    roomType: room?.roomType ?? "GENERAL_WARD",
    floor: room?.floor ?? "",
    totalBeds: room?.totalBeds ?? 1,
    pricePerDay: room?.pricePerDay ?? "",
    amenitiesStr: room?.amenities?.join(", ") ?? "",
    notes: room?.notes ?? "",
    isActive: room?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const F = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.pricePerDay) { notify("error", "Name and price per day are required"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        roomType: form.roomType,
        floor: form.floor || undefined,
        totalBeds: Number(form.totalBeds),
        pricePerDay: Number(form.pricePerDay),
        amenities: form.amenitiesStr ? form.amenitiesStr.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
        notes: form.notes || undefined,
        ...(isEdit ? { isActive: form.isActive } : {}),
      };
      if (isEdit) await appointmentApi.patch(`/rooms/${room.id}`, payload);
      else await appointmentApi.post("/rooms", payload);
      notify("success", isEdit ? "Room updated" : `Room created with ${form.totalBeds} bed(s)`);
      onSuccess();
    } catch (err: any) { notify("error", err?.response?.data?.message ?? "Failed to save room"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? "Edit Room" : "Add New Room"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Room Name *</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. ICU-A, Ward 2B, Room 301…" value={form.name} onChange={F("name")} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Room Type *</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.roomType} onChange={F("roomType")}>
                <option value="ICU">ICU</option>
                <option value="PRIVATE">Private Room</option>
                <option value="SEMI_PRIVATE">Semi-Private</option>
                <option value="GENERAL_WARD">General Ward</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Floor</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Ground, 1, 2…" value={form.floor} onChange={F("floor")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of Beds *</label>
              <input type="number" min={1} max={100} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.totalBeds} onChange={F("totalBeds")} disabled={isEdit} />
              {isEdit && <p className="text-xs text-gray-400 mt-1">Cannot change bed count after creation</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price per Day (₹) *</label>
              <input type="number" min={0} step="0.01" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" value={form.pricePerDay} onChange={F("pricePerDay")} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amenities (comma-separated)</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="AC, TV, Attached Bathroom, Visitor Sofa…" value={form.amenitiesStr} onChange={F("amenitiesStr")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} value={form.notes} onChange={F("notes")} />
          </div>
          {isEdit && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="rounded" />
              Room is active
            </label>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? "Saving…" : isEdit ? "Update Room" : "Create Room"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
