"use client";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, User, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Patient } from "@/types";

const schema = z.object({
  firstName:            z.string().min(1, "Required"),
  lastName:             z.string().optional(),
  email:                z.string().email().optional().or(z.literal("")),
  dob:                  z.string().optional(),
  gender:               z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).optional(),
  address:              z.string().optional(),
  emergencyContactName:  z.string().optional(),
  emergencyContactPhone: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function ProfilePage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: patient, isLoading } = useQuery<Patient>({
    queryKey: ["profile"],
    queryFn: () => api.get("/patient-portal/me").then((r) => r.data),
  });

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (patient) {
      reset({
        firstName:            patient.firstName,
        lastName:             patient.lastName ?? "",
        email:                patient.email ?? "",
        dob:                  patient.dob ?? "",
        gender:               patient.gender ?? undefined,
        address:              patient.address ?? "",
        emergencyContactName:  patient.emergencyContactName ?? "",
        emergencyContactPhone: patient.emergencyContactPhone ?? "",
      });
    }
  }, [patient, reset]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: (data: FormData) => api.patch("/patient-portal/me", {
      ...data,
      email: data.email || undefined,
    }),
    onSuccess: () => {
      toast({ title: "Profile updated", variant: "success" });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: () => {
      toast({ title: "Update failed", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold">My Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your personal information</p>
      </div>

      {/* Info chips */}
      <div className="flex flex-wrap gap-3">
        {patient?.uhid && (
          <div className="rounded-lg border bg-white px-4 py-2.5">
            <p className="text-xs text-muted-foreground">UHID</p>
            <p className="font-mono font-semibold text-sm">{patient.uhid}</p>
          </div>
        )}
        {patient?.bloodGroup && (
          <div className="rounded-lg border bg-white px-4 py-2.5">
            <p className="text-xs text-muted-foreground">Blood Group</p>
            <p className="font-semibold text-sm text-red-600">{patient.bloodGroup.replace("_", " ")}</p>
          </div>
        )}
        {patient?.abhaId && (
          <div className="rounded-lg border bg-white px-4 py-2.5">
            <p className="text-xs text-muted-foreground">ABHA ID</p>
            <p className="font-mono text-sm">{patient.abhaId}</p>
          </div>
        )}
        <div className="rounded-lg border bg-white px-4 py-2.5">
          <p className="text-xs text-muted-foreground">Member Since</p>
          <p className="text-sm">{formatDate(patient?.createdAt)}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" /> Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => save(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">First Name <span className="text-destructive">*</span></label>
                <input {...register("firstName")} className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                {errors.firstName && <p className="mt-1 text-xs text-destructive">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Last Name</label>
                <input {...register("lastName")} className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input {...register("email")} type="email" className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date of Birth</label>
                <input {...register("dob")} type="date" className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Gender</label>
              <select {...register("gender")} className="w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Select...</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Address</label>
              <textarea {...register("address")} rows={2} className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3 text-muted-foreground">Emergency Contact</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input {...register("emergencyContactName")} placeholder="Contact person" className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input {...register("emergencyContactPhone")} placeholder="+919876543210" className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
            </div>

            <Button type="submit" disabled={isPending || !isDirty} className="flex items-center gap-2">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
