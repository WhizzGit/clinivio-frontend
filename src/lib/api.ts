import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";

// ─── Token helpers (client-side only) ────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("clinivio-auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

function redirectToLogin() {
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

function createApiInstance(baseURL: string): AxiosInstance {
  const instance = axios.create({
    baseURL,
    timeout: 15_000,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // Request interceptor — attach Bearer token
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = getToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor — handle 401 globally
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      if (error.response?.status === 401) {
        // Clear auth state and redirect
        if (typeof window !== "undefined") {
          localStorage.removeItem("clinivio-auth");
          redirectToLogin();
        }
      }
      return Promise.reject(error);
    }
  );

  return instance;
}

// ─── Single unified API base URL ──────────────────────────────────────────────
// All former microservices are now served from one endpoint.

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://clinivio-backend.onrender.com";

// Export four named instances so existing imports keep working.
// They all point to the same backend — no code changes needed in pages.
export const iamApi         = createApiInstance(API_BASE);
export const patientApi     = createApiInstance(API_BASE);
export const appointmentApi = createApiInstance(API_BASE);
export const billingApi     = createApiInstance(API_BASE);

// Default export (backwards compat)
export default iamApi;
