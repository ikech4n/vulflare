import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthUser {
  id: string;
  username: string;
  role: "admin" | "editor" | "viewer";
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  setAccessToken: (token: string) => void;
  setUser: (user: AuthUser) => void;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setAccessToken: (token) => set({ accessToken: token }),
      setUser: (user) => set({ user }),
      login: (token, user) => set({ accessToken: token, user }),
      logout: () => set({ accessToken: null, user: null }),
    }),
    {
      name: "vulflare-auth",
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
