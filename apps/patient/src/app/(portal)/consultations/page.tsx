"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, FileText, ChevronDown, ChevronUp, Pill } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Consultation } from "@/types";

function ConsultationCard({ c }: { c: Consultation }) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardContent className="py-4 px-5">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-start justify-between gap-4 text-left"
        >
          <div className="space-y-0.5">
            <p className="font-semibold text-sm">
              Dr. {c.doctor?.firstName} {c.doctor?.lastName}
            </p>
            <p className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</p>
            {c.diagnosis && (
              <p className="text-xs text-gray-700 mt-1">Diagnosis: <span className="font-medium">{c.diagnosis}</span></p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {c.prescriptions?.length > 0 && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                {c.prescriptions.length} Rx
              </span>
            )}
            {c.followUps?.some((f) => !f.isCompleted) && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                Follow-up
              </span>
            )}
            {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>

        {open && (
          <div className="mt-4 space-y-4 border-t pt-4">
            {/* Vitals */}
            {(c.bpSystolic || c.pulseRate || c.temperature) && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Vitals</p>
                <div className="flex flex-wrap gap-3">
                  {c.bpSystolic && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                      <p className="text-xs text-muted-foreground">BP</p>
                      <p className="text-sm font-semibold">{c.bpSystolic}/{c.bpDiastolic}</p>
                    </div>
                  )}
                  {c.pulseRate && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                      <p className="text-xs text-muted-foreground">Pulse</p>
                      <p className="text-sm font-semibold">{c.pulseRate} bpm</p>
                    </div>
                  )}
                  {c.temperature && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                      <p className="text-xs text-muted-foreground">Temp</p>
                      <p className="text-sm font-semibold">{c.temperature}°F</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Observations */}
            {c.observations && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Observations</p>
                <p className="text-sm text-gray-700">{c.observations}</p>
              </div>
            )}

            {/* Prescriptions */}
            {c.prescriptions?.map((rx) => (
              <div key={rx.id}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Pill className="h-3 w-3" /> Prescription
                </p>
                <div className="space-y-2">
                  {rx.items.map((item) => (
                    <div key={item.id} className="bg-green-50 rounded-lg px-3 py-2.5">
                      <p className="text-sm font-semibold text-green-900">{item.medicineName}</p>
                      <div className="flex flex-wrap gap-2 mt-0.5">
                        {item.dosage && <span className="text-xs text-green-700">{item.dosage}</span>}
                        {item.frequency && <span className="text-xs text-green-700">• {item.frequency}</span>}
                        {item.duration && <span className="text-xs text-green-700">• {item.duration}</span>}
                      </div>
                      {item.instructions && (
                        <p className="text-xs text-green-600 mt-0.5 italic">{item.instructions}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Follow-ups */}
            {c.followUps?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Follow-ups</p>
                {c.followUps.map((f) => (
                  <div key={f.id} className={`rounded-lg px-3 py-2 flex items-center justify-between ${f.isCompleted ? "bg-gray-50" : "bg-blue-50"}`}>
                    <div>
                      <p className="text-sm font-medium">{formatDate(f.followUpDate)}</p>
                      {f.notes && <p className="text-xs text-muted-foreground">{f.notes}</p>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${f.isCompleted ? "bg-gray-100 text-gray-600" : "bg-blue-100 text-blue-700"}`}>
                      {f.isCompleted ? "Done" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ConsultationsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["consultations", page],
    queryFn: () =>
      api.get<{ data: Consultation[]; totalPages: number }>(
        `/patient-portal/consultations?page=${page}&limit=10`,
      ).then((r) => r.data),
  });

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold">My Consultations</h1>
        <p className="text-sm text-muted-foreground">Medical history, diagnoses and prescriptions</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !data?.data.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No consultations found yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.data.map((c) => <ConsultationCard key={c.id} c={c} />)}
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
