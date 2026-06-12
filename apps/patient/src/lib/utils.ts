import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, isValid } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  return isValid(d) ? format(d, "dd MMM yyyy") : "—";
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  return isValid(d) ? format(d, "dd MMM yyyy, hh:mm a") : "—";
}

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount == null) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
  }).format(Number(amount));
}

export function getInitials(first?: string | null, last?: string | null): string {
  return [(first ?? "")[0], (last ?? "")[0]].filter(Boolean).join("").toUpperCase() || "?";
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    REGISTERED:       "bg-gray-100 text-gray-700",
    PENDING_PAYMENT:  "bg-orange-100 text-orange-700",
    CONFIRMED:        "bg-blue-100 text-blue-700",
    CHECKED_IN:       "bg-purple-100 text-purple-700",
    IN_PROGRESS:      "bg-yellow-100 text-yellow-700",
    COMPLETED:        "bg-green-100 text-green-700",
    SENT_TO_PHARMACY: "bg-teal-100 text-teal-700",
    CANCELLED:        "bg-red-100 text-red-700",
    NO_SHOW:          "bg-orange-100 text-orange-700",
    PENDING:          "bg-yellow-100 text-yellow-700",
    PAID:             "bg-green-100 text-green-700",
    REFUNDED:         "bg-blue-100 text-blue-700",
    FAILED:           "bg-red-100 text-red-700",
    NORMAL:           "bg-green-100 text-green-700",
    ABNORMAL:         "bg-yellow-100 text-yellow-700",
    CRITICAL:         "bg-red-100 text-red-700",
    SAMPLE_COLLECTED: "bg-blue-100 text-blue-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
}
