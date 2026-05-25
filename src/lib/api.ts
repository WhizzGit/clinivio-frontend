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

// ─── Service instances ────────────────────────────────────────────────────────

export const iamApi = createApiInstance(
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
);

export const patientApi = createApiInstance(
  process.env.NEXT_PUBLIC_PATIENT_API_URL || "http://localhost:3002"
);

export const appointmentApi = createApiInstance(
  process.env.NEXT_PUBLIC_APPOINTMENT_API_URL || "http://localhost:3003"
);

export const billingApi = createApiInstance(
  process.env.NEXT_PUBLIC_BILLING_API_URL || "http://localhost:3006"
);

// Default export (IAM / gateway)
export default iamApi;
