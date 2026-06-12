"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Calendar, X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toaster";
import api from "@/lib/api";
import { formatDate, formatDateTime, statusColor } from "@/lib/utils";
import { useAppointmentSocket } from "@/hooks/useAppointmentSocket";
import type { Appointment, DoctorProfile, DoctorSlot } from "@/types";

const bookSchema = z.object({
  doctorId:      z.string().min(1, "Select a doctor"),
  slotId:        z.string().optional(),
  departmentId:  z.string().optional(),
  chiefComplaint: z.string().optional(),
  scheduledAt:   z.string().optional(),
});
type BookForm = z.infer<typeof bookSchema>;

function BookAppointmentPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<BookForm>({
    resolver: zodResolver(bookSchema),
  });

  const { data: doctors } = useQuery<DoctorProfile[]>({
    queryKey: ["portal-doctors"],
    queryFn: () => api.get("/patient-portal/doctors").then((r) => r.data),
  });

  const { data: slots } = useQuery<DoctorSlot[]>({
    queryKey: ["portal-slots", selectedDoctor, selectedDate],
    queryFn: () =>
      api.get(`/patient-portal/slots?doctorId=${selectedDoctor}&date=${selectedDate}`).then((r) => r.data),
    enabled: !!selectedDoctor && !!selectedDate,
  });

  const { mutate: book, isPending } = useMutation({
    mutationFn: (data: BookForm) => api.post("/patient-portal/appointments", data),
    onSuccess: () => {
      toast({ title: "Appointment booked!", variant: "success" });
      qc.invalidateQueries({ queryKey: ["appointments"] });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Booking failed", description: err?.response?.data?.message, variant: "destructive" });
    },
  });

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Book an Appointment</CardTitle>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((d) => book(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Doctor <span className="text-destructive">*</span></label>
            <select
              {...register("doctorId")}
              onChange={(e) => { setValue("doctorId", e.target.value); setSelectedDoctor(e.target.value); }}
              className="w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select a doctor...</option>
              {doctors?.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.user?.firstName} {d.user?.lastName} — {d.specialty ?? "General"}
                </option>
              ))}
            </select>
            {errors.doctorId && <p className="mt-1 text-xs text-destructive">{errors.doctorId.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input
              type="date"
              value={selectedDate}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {slots && slots.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1">Available Slots</label>
              <div className="grid grid-cols-3 gap-2">
                {slots.map((s) => {
                  const isFull = s.bookedCount >= s.maxPatients;
                  return (
                    <button
                      type="button"
                      key={s.id}
                      disabled={isFull}
                      onClick={() => setValue("slotId", s.id)}
                      className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                        watch("slotId") === s.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : isFull
                          ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "border-gray-200 bg-white hover:border-primary hover:text-primary"
                      }`}
                    >
                      {s.startTime} – {s.endTime}
                      {isFull && <span className="block text-[10px] opacity-70">Full</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedDoctor && selectedDate && slots?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">No available slots for this date.</p>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Chief Complaint</label>
            <textarea
              {...register("chiefComplaint")}
              rows={2}
              placeholder="Describe your symptoms..."
              className="w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Booking
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function AppointmentsPage() {
  const [showBook, setShowBook] = useState(false);
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const { toast } = useToast();

  // Live appointment status updates via WebSocket
  useAppointmentSocket();

  const { data, isLoading } = useQuery({
    queryKey: ["appointments", page],
    queryFn: () =>
      api.get<{ data: Appointment[]; total: number; totalPages: number }>(
        `/patient-portal/appointments?page=${page}&limit=10`,
      ).then((r) => r.data),
  });

  const { mutate: cancel } = useMutation({
    mutationFn: (id: string) => api.delete(`/patient-portal/appointments/${id}`),
    onSuccess: () => {
      toast({ title: "Appointment cancelled", variant: "success" });
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.response?.data?.message, variant: "destructive" });
    },
  });

  const cancellable = (status: string) =>
    !["COMPLETED", "CANCELLED", "IN_PROGRESS"].includes(status);

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">My Appointments</h1>
          <p className="text-sm text-muted-foreground">View and manage your appointments</p>
        </div>
        <Button onClick={() => setShowBook(!showBook)} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Book Appointment
        </Button>
      </div>

      {showBook && <BookAppointmentPanel onClose={() => setShowBook(false)} />}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !data?.data.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No appointments found.</p>
            <Button className="mt-4" size="sm" onClick={() => setShowBook(true)}>Book your first appointment</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.data.map((a) => (
            <Card key={a.id}>
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">
                        Dr. {a.doctor?.firstName} {a.doctor?.lastName}
                      </p>
                      {a.doctor?.doctorProfile?.specialty && (
                        <span className="text-xs text-muted-foreground">• {a.doctor?.doctorProfile?.specialty}</span>
                      )}
                    </div>
                    {a.department && (
                      <p className="text-xs text-muted-foreground">{a.department.name}</p>
                    )}
                    {a.chiefComplaint && (
                      <p className="text-xs text-gray-600 italic">&quot;{a.chiefComplaint}&quot;</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5">
                      <span>Token #{a.tokenNumber ?? "—"}</span>
                      <span>•</span>
                      <span>{formatDate(a.scheduledAt ?? a.createdAt)}</span>
                      {a.slot && <span>• {a.slot.startTime} – {a.slot.endTime}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor(a.status)}`}>
                      {a.status.replace(/_/g, " ")}
                    </span>
                    {cancellable(a.status) && (
                      <button
                        onClick={() => cancel(a.id)}
                        className="text-xs text-red-500 hover:text-red-700 hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {(data?.totalPages ?? 1) > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="px-3 py-1.5 text-sm text-muted-foreground">Page {page} of {data?.totalPages}</span>
              <Button variant="outline" size="sm" disabled={page === data?.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
