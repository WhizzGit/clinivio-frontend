"use client";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/store/auth.store";

const WS_URL =
  (process.env.NEXT_PUBLIC_API_URL ?? "https://clinivio-backend.onrender.com") + "/appointments";

/**
 * Connects to the appointment status WebSocket namespace.
 * Automatically subscribes to the patient's tenant room and invalidates
 * the "appointments" query when a status update arrives.
 */
export function useAppointmentSocket() {
  const { token, patient } = useAuthStore();
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token || !patient?.tenantId) return;

    const socket = io(WS_URL, {
      transports: ["websocket"],
      auth: { token },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("subscribe", { tenantId: patient.tenantId });
    });

    socket.on("appointment:statusUpdate", (payload: { id: string; status: string }) => {
      // Optimistically invalidate the appointments query to refetch with new status
      qc.invalidateQueries({ queryKey: ["appointments"] });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, patient?.tenantId, qc]);
}
