import { type ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api.ts";
import { useAuthStore } from "@/store/authStore.ts";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, accessToken, login } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !accessToken) {
      // user はあるが accessToken がない（リロード後）か、未ログインの場合にリフレッシュを試みる
      api
        .post<{ accessToken: string }>("/auth/refresh")
        .then(({ data }) => {
          return api
            .get<{
              id: string;
              email: string;
              username: string;
              role: "admin" | "editor" | "viewer";
            }>("/auth/me")
            .then(({ data: me }) => {
              login(data.accessToken, me);
            });
        })
        .catch(() => {
          void navigate("/login");
        });
    }
  }, [user, accessToken, navigate, login]);

  if (!user || !accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return <>{children}</>;
}
