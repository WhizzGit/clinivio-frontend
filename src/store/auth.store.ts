import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { User } from "@/types";
import { TenantProfile } from "@/lib/print";

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  tenantId: string | null;
  /** Slug entered at login — sent as X-Tenant-Slug on every API request */
  tenantSlug: string | null;
  /** Cached hospital profile — fetched once in DashboardLayout, used everywhere for printing */
  tenantProfile: TenantProfile | null;
  setAuth: (user: User, token: string, refreshToken: string, tenantSlug?: string) => void;
  clearAuth: () => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  setTenantProfile: (profile: TenantProfile) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      tenantId: null,
      tenantSlug: null,
      tenantProfile: null,

      setAuth: (user, token, refreshToken, tenantSlug) =>
        set({
          user,
          token,
          refreshToken,
          isAuthenticated: true,
          tenantId: user.tenantId,
          tenantSlug: tenantSlug ?? null,
        }),

      clearAuth: () =>
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          tenantId: null,
          tenantSlug: null,
          tenantProfile: null,
        }),

      logout: () =>
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          tenantId: null,
          tenantSlug: null,
          tenantProfile: null,
        }),

      updateUser: (partial) => {
        const current = get().user;
        if (current) {
          set({ user: { ...current, ...partial } });
        }
      },

      setTenantProfile: (profile) => set({ tenantProfile: profile }),
    }),
    {
      name: "clinivio-auth",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? localStorage
          : ({ getItem: () => null, setItem: () => {}, removeItem: () => {} } as unknown as Storage)
      ),
    }
  )
);
