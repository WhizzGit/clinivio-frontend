import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  pageTitle: string;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setPageTitle: (title: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  pageTitle: "Dashboard",

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setPageTitle: (title) => set({ pageTitle: title }),
}));
