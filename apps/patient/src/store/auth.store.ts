"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PatientUser {
  id: string;
  uhid: string;
  firstName: string;
  lastName: string | null;
  phone: string;
  email: string | null;
  tenantId: string;
}

interface AuthState {
  token: string | null;
  tenantId: string | null;
  patient: PatientUser | null;
  isAuthenticated: boolean;
  setAuth: (token: string, patient: PatientUser) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      tenantId: null,
      patient: null,
      isAuthenticated: false,
      setAuth: (token, patient) =>
        set({ token, patient, tenantId: patient.tenantId, isAuthenticated: true }),
      clearAuth: () =>
        set({ token: null, patient: null, tenantId: null, isAuthenticated: false }),
    }),
    { name: "clinivio-patient-auth" },
  ),
);
