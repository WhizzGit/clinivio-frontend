"use client";
import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
}

interface ToastContextValue {
  toast: (item: Omit<ToastItem, "id">) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <Toaster>");
  return ctx;
}

export function Toaster({ children }: { children?: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const toast = React.useCallback((item: Omit<ToastItem, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...item, id }]);
  }, []);
  const remove = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitives.Provider swipeDirection="right">
        {children}
        {toasts.map((t) => (
          <ToastPrimitives.Root
            key={t.id}
            defaultOpen
            onOpenChange={(open) => !open && remove(t.id)}
            className={cn(
              "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-lg border p-4 shadow-lg transition-all",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-top-full",
              t.variant === "destructive" ? "border-red-200 bg-red-50 text-red-900"
                : t.variant === "success" ? "border-green-200 bg-green-50 text-green-900"
                : "border-gray-200 bg-white text-gray-900",
            )}
          >
            <div className="flex-1">
              {t.title && <ToastPrimitives.Title className="text-sm font-semibold">{t.title}</ToastPrimitives.Title>}
              {t.description && <ToastPrimitives.Description className="text-sm opacity-80 mt-0.5">{t.description}</ToastPrimitives.Description>}
            </div>
            <ToastPrimitives.Close onClick={() => remove(t.id)} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity">
              <X className="h-4 w-4" />
            </ToastPrimitives.Close>
          </ToastPrimitives.Root>
        ))}
        <ToastPrimitives.Viewport className="fixed top-4 right-4 z-[100] flex max-h-screen w-full max-w-[380px] flex-col gap-2 p-0" />
      </ToastPrimitives.Provider>
    </ToastContext.Provider>
  );
}
