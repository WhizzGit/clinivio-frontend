import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";

function getAuthState(): { token: string | null; tenantId: string | null } {
  if (typeof window === "undefined") return { token: null, tenantId: null };
  try {
    const raw = localStorage.getItem("clinivio-patient-auth");
    if (!raw) return { token: null, tenantId: null };
    const parsed = JSON.parse(raw);
    return {
      token:    parsed?.state?.token    ?? null,
      tenantId: parsed?.state?.tenantId ?? null,
    };
  } catch {
    return { token: null, tenantId: null };
  }
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://clinivio-backend.onrender.com";

function createApi(): AxiosInstance {
  const instance = axios.create({
    baseURL: API_BASE,
    timeout: 15_000,
    headers: { "Content-Type": "application/json" },
  });

  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const { token, tenantId } = getAuthState();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (tenantId && config.headers && !config.url?.startsWith("/patient-portal/auth/")) {
      config.headers["X-Tenant-Id"] = tenantId;
    }
    return config;
  });

  instance.interceptors.response.use(
    (r) => r,
    (error: AxiosError) => {
      if (error.response?.status === 401 && typeof window !== "undefined") {
        localStorage.removeItem("clinivio-patient-auth");
        window.location.href = "/login";
      }
      return Promise.reject(error);
    },
  );

  return instance;
}

export const api = createApi();
export default api;
