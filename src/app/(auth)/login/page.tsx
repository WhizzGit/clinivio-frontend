"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Activity, AlertCircle, Building2, ChevronDown, ChevronUp } from "lucide-react";
import { iamApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { AuthResponse } from "@/types";
import { cn } from "@/lib/utils";

const TENANT_ID = "7297d065-93f1-4487-b497-0551965cf607";
const TENANT_NAME = "HANSVL Healthcare";

// ─── Demo personas (only seeded accounts) ────────────────────────────────────
// Additional staff (doctors, nurses, etc.) are created by the tenant admin
// from the dashboard — they don't appear here until provisioned.
const PERSONAS = [
  {
    role: "SUPER_ADMIN",
    label: "Platform Admin",
    emoji: "🌐",
    name: "Whizzon Admin",
    email: "superadmin@whizzon.ai",
    password: "SuperAdmin@123",
    tenantId: null,
    hospital: "Clinivio Platform",
    color: "bg-slate-50 border-slate-300 hover:border-slate-500",
    badge: "bg-slate-800 text-white",
    desc: "Manage hospitals & tenants across the platform",
  },
  {
    role: "ADMIN",
    label: "Hospital Admin",
    emoji: "🏥",
    name: "HANSVL Admin",
    email: "admin@hansvl.com",
    password: "Admin@123",
    tenantId: TENANT_ID,
    hospital: TENANT_NAME,
    color: "bg-violet-50 border-violet-200 hover:border-violet-400",
    badge: "bg-violet-100 text-violet-700",
    desc: "Full access — create staff, billing, settings",
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
  const [showTenantId, setShowTenantId] = useState(false);
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

      <div className="relative w-full max-w-3xl flex flex-col lg:flex-row gap-6 items-start">

        {/* ── Left: Branding + Quick login ── */}
        <div className="flex-1 min-w-0">

          {/* Product branding */}
          <div className="mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 backdrop-blur rounded-xl flex items-center justify-center ring-2 ring-white/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-extrabold text-lg tracking-tight leading-none">Clinivio</p>
              <p className="text-blue-300 text-xs mt-0.5">by Whizzon.ai · Hospital Management</p>
            </div>
          </div>

          {/* Active hospital context */}
          <div className="mb-4 flex items-center gap-2 bg-white/10 backdrop-blur rounded-xl px-4 py-3 border border-white/10">
            <Building2 className="w-4 h-4 text-blue-200 shrink-0" />
            <div>
              <p className="text-white text-sm font-semibold leading-none">{TENANT_NAME}</p>
              <p className="text-blue-300 text-xs mt-0.5">Demo tenant · Tamil Nadu</p>
            </div>
          </div>

          {serverError && (
            <div className="flex items-start gap-2 bg-red-500/20 border border-red-400/40 rounded-xl p-3 mb-4 text-sm text-red-100">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Persona cards */}
          <p className="text-blue-200/70 text-xs font-semibold uppercase tracking-widest mb-2">
            Quick Access
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div className="mt-2.5 space-y-0.5">
                  <p className="text-xs text-gray-400 font-mono truncate">{p.email}</p>
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3 h-3 text-gray-300 shrink-0" />
                    <p className="text-xs text-gray-400 truncate">{p.hospital}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Note about additional staff */}
          <div className="mt-3 px-3 py-2.5 bg-white/5 rounded-xl border border-white/10">
            <p className="text-blue-200/70 text-xs">
              <span className="font-semibold text-blue-200">ℹ️  Staff accounts</span> — doctors, nurses, pharmacists are created by the Hospital Admin from the dashboard.
            </p>
          </div>
        </div>

        {/* ── Right: Manual login form ── */}
        <div className="w-full lg:w-[320px] flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

            {/* Form header with hospital name */}
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-5 text-white">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 opacity-80" />
                <span className="font-bold text-sm tracking-wide">Clinivio</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <Building2 className="w-3.5 h-3.5 opacity-70" />
                <p className="text-xs text-blue-100 font-medium">{TENANT_NAME}</p>
              </div>
              <p className="text-blue-200 text-xs mt-0.5">Sign in to your account</p>
            </div>

            <div className="p-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email / Username
                  </label>
                  <input
                    {...register("email")}
                    type="email"
                    autoComplete="email"
                    placeholder="you@hansvl.com"
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

                {/* Collapsible tenant ID */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowTenantId(v => !v)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showTenantId ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    Hospital ID (advanced)
                  </button>
                  {showTenantId && (
                    <div className="mt-1.5">
                      <input
                        {...register("tenantId")}
                        type="text"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs bg-gray-50 font-mono text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
                      />
                      <p className="text-xs text-gray-400 mt-1">Leave blank when logging in as Platform Admin</p>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={cn(
                    "w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-all",
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
                Secured by Clinivio · All activity is logged
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
