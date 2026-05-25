"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Stethoscope, AlertCircle } from "lucide-react";
import { iamApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { AuthResponse } from "@/types";
import { cn } from "@/lib/utils";

const TENANT_ID = "7297d065-93f1-4487-b497-0551965cf607";

const PERSONAS = [
  {
    role: "SUPER_ADMIN",
    label: "Super Admin",
    emoji: "🌐",
    name: "MediFlow Admin",
    email: "superadmin@mediflow.io",
    password: "SuperAdmin@123",
    tenantId: null,
    color: "bg-slate-50 border-slate-300 hover:border-slate-500",
    badge: "bg-slate-800 text-white",
    desc: "Product owner — onboard hospitals, manage all tenants",
  },
  {
    role: "ADMIN",
    label: "Admin",
    emoji: "🏥",
    name: "Vijay Kumar",
    email: "admin@greenvalley.com",
    password: "Admin@123",
    tenantId: TENANT_ID,
    color: "bg-violet-50 border-violet-200 hover:border-violet-400",
    badge: "bg-violet-100 text-violet-700",
    desc: "Full access — staff, billing, settings",
  },
  {
    role: "DOCTOR",
    label: "Doctor",
    emoji: "🩺",
    name: "Dr. Rajesh Patel",
    email: "dr.patel@greenvalley.com",
    password: "Doctor@1234",
    tenantId: TENANT_ID,
    color: "bg-blue-50 border-blue-200 hover:border-blue-400",
    badge: "bg-blue-100 text-blue-700",
    desc: "Queue view, consultation, prescriptions",
  },
  {
    role: "RECEPTIONIST",
    label: "Receptionist",
    emoji: "🗂️",
    name: "Meena Sharma",
    email: "reception@greenvalley.com",
    password: "Reception@1234",
    tenantId: TENANT_ID,
    color: "bg-emerald-50 border-emerald-200 hover:border-emerald-400",
    badge: "bg-emerald-100 text-emerald-700",
    desc: "Register patients, book appointments, billing",
  },
  {
    role: "NURSE",
    label: "Nurse",
    emoji: "💉",
    name: "Kavitha Reddy",
    email: "nurse@greenvalley.com",
    password: "Nurse@1234",
    tenantId: TENANT_ID,
    color: "bg-pink-50 border-pink-200 hover:border-pink-400",
    badge: "bg-pink-100 text-pink-700",
    desc: "Vitals entry, doctor queue assistance",
  },
  {
    role: "PHARMACIST",
    label: "Pharmacist",
    emoji: "💊",
    name: "Ravi Shankar",
    email: "pharmacist@greenvalley.com",
    password: "Pharma@1234",
    tenantId: TENANT_ID,
    color: "bg-teal-50 border-teal-200 hover:border-teal-400",
    badge: "bg-teal-100 text-teal-700",
    desc: "Dispense prescriptions, manage inventory",
  },
  {
    role: "LAB_TECHNICIAN",
    label: "Lab Technician",
    emoji: "🔬",
    name: "Arjun Mehta",
    email: "lab@greenvalley.com",
    password: "Lab@1234",
    tenantId: TENANT_ID,
    color: "bg-cyan-50 border-cyan-200 hover:border-cyan-400",
    badge: "bg-cyan-100 text-cyan-700",
    desc: "Process lab orders, enter test results",
  },
];

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  tenantId: z
    .string()
    .uuid("Tenant ID must be a valid UUID")
    .or(z.string().length(0))
    .optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [quickLoading, setQuickLoading] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", tenantId: TENANT_ID },
  });

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);
    try {
      const payload: Record<string, string> = {
        email: values.email,
        password: values.password,
      };
      if (values.tenantId) payload.tenantId = values.tenantId;

      const { data } = await iamApi.post<AuthResponse>("/auth/login", payload);
      setAuth(data.user, data.accessToken, data.refreshToken);
      const roleDestMap: Record<string, string> = { SUPER_ADMIN: "/hospitals", LAB_TECHNICIAN: "/lab" };
      router.replace(roleDestMap[data.user.role] ?? "/dashboard");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(
        error?.response?.data?.message || "Invalid credentials. Please try again."
      );
    }
  }

  async function quickLogin(persona: (typeof PERSONAS)[0]) {
    setQuickLoading(persona.role);
    setServerError(null);
    try {
      const payload: Record<string, string> = { email: persona.email, password: persona.password };
      if (persona.tenantId) payload.tenantId = persona.tenantId;
      const { data } = await iamApi.post<AuthResponse>("/auth/login", payload);
      setAuth(data.user, data.accessToken, data.refreshToken);
      const dest = persona.role === "SUPER_ADMIN" ? "/hospitals" : persona.role === "LAB_TECHNICIAN" ? "/lab" : "/dashboard";
      router.replace(dest);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(
        error?.response?.data?.message || `Could not log in as ${persona.label}`
      );
    } finally {
      setQuickLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-blue-900 to-blue-800 flex items-center justify-center p-6">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-4xl flex flex-col lg:flex-row gap-6 items-start">

        {/* ── Persona picker ── */}
        <div className="flex-1 min-w-0">
          <div className="mb-4">
            <p className="text-white font-semibold text-sm uppercase tracking-widest opacity-60">
              Demo Personas
            </p>
            <p className="text-blue-200 text-sm mt-1">
              Click any card to log in instantly
            </p>
          </div>

          {serverError && (
            <div className="flex items-start gap-2 bg-red-500/20 border border-red-400/40 rounded-xl p-3 mb-4 text-sm text-red-100">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {PERSONAS.map((p) => (
              <button
                key={p.role}
                onClick={() => quickLogin(p)}
                disabled={!!quickLoading}
                className={cn(
                  "text-left rounded-xl border-2 p-4 transition-all duration-150",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  p.color
                )}
              >
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-2xl leading-none">{p.emoji}</span>
                  <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", p.badge)}>
                    {p.label}
                  </span>
                  {quickLoading === p.role && (
                    <span className="ml-auto w-3.5 h-3.5 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin" />
                  )}
                </div>
                <p className="font-semibold text-gray-900 text-sm leading-tight">{p.name}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">{p.desc}</p>
                <p className="text-xs text-gray-400 mt-2 font-mono truncate">{p.email}</p>
              </button>
            ))}
          </div>

          <div className="mt-4 p-3 bg-white/10 rounded-xl backdrop-blur">
            <p className="text-blue-100 text-xs font-semibold mb-1">
              🏥 Green Valley Hospital
            </p>
            <p className="text-blue-200/60 text-xs font-mono truncate">{TENANT_ID}</p>
          </div>
        </div>

        {/* ── Manual login form ── */}
        <div className="w-full lg:w-[340px] flex-shrink-0">
          <div className="text-center mb-5">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-white/10 backdrop-blur rounded-2xl mb-3 ring-2 ring-white/20">
              <Stethoscope className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">MediFlow</h1>
            <p className="text-blue-200 text-xs mt-0.5">Hospital Management System</p>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Sign in manually</h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  {...register("email")}
                  type="email"
                  autoComplete="email"
                  placeholder="you@hospital.com"
                  className={cn(
                    "w-full px-3 py-2 rounded-lg border text-sm bg-white transition-colors",
                    "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                    errors.email ? "border-red-400 bg-red-50" : "border-gray-300 hover:border-gray-400"
                  )}
                />
                {errors.email && (
                  <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    {...register("password")}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className={cn(
                      "w-full px-3 py-2 pr-9 rounded-lg border text-sm bg-white transition-colors",
                      "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                      errors.password ? "border-red-400 bg-red-50" : "border-gray-300 hover:border-gray-400"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tenant ID{" "}
                  <span className="text-gray-400 font-normal text-xs">(pre-filled)</span>
                </label>
                <input
                  {...register("tenantId")}
                  type="text"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-gray-50 font-mono text-gray-400 focus:outline-none"
                  readOnly
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={cn(
                  "w-full py-2 px-4 rounded-lg text-sm font-semibold text-white transition-all",
                  "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                  "disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                )}
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-4">
              Protected by MediFlow security. All activity is logged.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
