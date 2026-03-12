import { api } from "@/lib/api.ts";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => Promise<void>;
  syncFromServer: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: async (theme) => {
        set({ theme });
        try {
          await api.patch("/auth/me", { theme });
        } catch {
          // オフライン時はlocalStorageのみ保存
        }
      },
      syncFromServer: (theme) => set({ theme }),
    }),
    { name: "vulflare-theme" },
  ),
);
