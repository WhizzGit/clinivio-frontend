"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Eye, EyeOff, Activity, AlertCircle,
  Building2, ChevronDown, ChevronUp,
} from "lucide-react";
import { iamApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { AuthResponse } from "@/types";
import { cn } from "@/lib/utils";

// ─── Schema ───────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email:    z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  tenantId: z
    .string()
    .uuid("Must be a valid UUID")
    .or(z.string().length(0))
    .optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// ─── Role → destination map ───────────────────────────────────────────────────

const ROLE_DEST: Record<string, string> = {
  SUPER_ADMIN:    "/hospitals",
  LAB_TECHNICIAN: "/lab",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router  = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [showPassword,  setShowPassword]  = useState(false);
  const [showTenantId,  setShowTenantId]  = useState(false);
  const [serverError,   setServerError]   = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", tenantId: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);
    try {
      const payload: Record<string, string> = {
        email:    values.email,
        password: values.password,
      };
      if (values.tenantId) payload.tenantId = values.tenantId;

      const { data } = await iamApi.post<AuthResponse>("/auth/login", payload);
      setAuth(data.user, data.accessToken, data.refreshToken);
      router.replace(ROLE_DEST[data.user.role] ?? "/dashboard");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(
        error?.response?.data?.message ?? "Invalid credentials. Please try again."
      );
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-blue-900 to-blue-800 flex items-center justify-center p-6">

      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-4xl flex flex-col lg:flex-row gap-8 items-center">

        {/* ── Left: Branding ─────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 lg:pr-4">

          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center ring-2 ring-white/20">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white font-extrabold text-2xl tracking-tight leading-none">Clinivio</p>
              <p className="text-blue-300 text-sm mt-0.5">by Whizzon.ai · Hospital Management</p>
            </div>
          </div>

          {/* Tagline */}
          <h1 className="text-white text-3xl font-bold leading-tight mb-3">
            Your Hospital.<br />Fully Managed.
          </h1>
          <p className="text-blue-200 text-base leading-relaxed mb-8 max-w-sm">
            A complete platform for managing patients, doctors, pharmacy, billing, and more — purpose-built for modern hospitals.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {[
              '🏥 Multi-tenant',
              '📋 Appointments',
              '💊 Pharmacy',
              '🧪 Lab',
              '💰 Billing',
              '📱 WhatsApp alerts',
            ].map(f => (
              <span key={f}
                className="text-xs px-3 py-1.5 bg-white/10 backdrop-blur text-blue-100 rounded-full border border-white/10">
                {f}
              </span>
            ))}
          </div>

          {/* Staff note */}
          <div className="mt-8 px-4 py-3 bg-white/5 rounded-xl border border-white/10">
            <p className="text-blue-200/80 text-xs leading-relaxed">
              <span className="font-semibold text-blue-200">ℹ️ Hospital staff</span> — doctors, nurses, and
              pharmacists log in using credentials created by their Hospital Admin.
              Platform admins can onboard new hospitals from the dashboard.
            </p>
          </div>
        </div>

        {/* ── Right: Login form ───────────────────────────────────────────── */}
        <div className="w-full lg:w-[360px] flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

            {/* Form header */}
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-5 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 opacity-80" />
                <span className="font-bold text-sm tracking-wide">Clinivio</span>
              </div>
              <p className="text-white font-semibold text-base">Sign in to your account</p>
              <p className="text-blue-200 text-xs mt-0.5">
                Platform Admin · Hospital Admin · Staff
              </p>
            </div>

            <div className="p-6 space-y-4">

              {serverError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{serverError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email / Username
                  </label>
                  <input
                    {...register("email")}
                    type="email"
                    autoComplete="email"
                    autoFocus
                    placeholder="you@example.com"
                    className={cn(
                      "w-full px-3 py-2.5 rounded-lg border text-sm bg-white transition-colors",
                      "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                      errors.email
                        ? "border-red-400 bg-red-50"
                        : "border-gray-300 hover:border-gray-400"
                    )}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>
                  )}
                </div>

                {/* Password */}
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
                        "w-full px-3 py-2.5 pr-10 rounded-lg border text-sm bg-white transition-colors",
                        "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                        errors.password
                          ? "border-red-400 bg-red-50"
                          : "border-gray-300 hover:border-gray-400"
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>
                  )}
                </div>

                {/* Collapsible Hospital ID */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowTenantId((v) => !v)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showTenantId
                      ? <ChevronUp className="w-3 h-3" />
                      : <ChevronDown className="w-3 h-3" />}
                    Hospital ID <span className="text-gray-300 ml-0.5">(advanced)</span>
                  </button>
                  {showTenantId && (
                    <div className="mt-2">
                      <input
                        {...register("tenantId")}
                        type="text"
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs bg-gray-50 font-mono text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-300 placeholder:text-gray-300"
                      />
                      <p className="text-xs text-gray-400 mt-1 flex items-start gap-1">
                        <Building2 className="w-3 h-3 mt-0.5 shrink-0" />
                        Required for Hospital staff. Leave blank for Platform Admin login.
                      </p>
                    </div>
                  )}
                </div>

                {/* Submit */}
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

              <p className="text-center text-xs text-gray-400 pt-1">
                Secured by Clinivio · All activity is logged
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
