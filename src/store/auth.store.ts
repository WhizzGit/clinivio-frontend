import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { User } from "@/types";

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  tenantId: string | null;
  /** Slug entered at login — sent as X-Tenant-Slug on every API request */
  tenantSlug: string | null;
  setAuth: (user: User, token: string, refreshToken: string, tenantSlug?: string) => void;
  clearAuth: () => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
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
        }),

      logout: () =>
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          tenantId: null,
          tenantSlug: null,
        }),

      updateUser: (partial) => {
        const current = get().user;
        if (current) {
          set({ user: { ...current, ...partial } });
        }
      },
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
