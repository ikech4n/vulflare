import { useThemeStore } from "@/store/themeStore.ts";
import { Outlet } from "react-router-dom";

function useDarkMode(): boolean {
  const { theme } = useThemeStore();
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function AuthLayout() {
  const isDark = useDarkMode();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center">
      <div className="mb-8 text-center">
        <img
          src={isDark ? "/logo.webp" : "/logo_light.webp"}
          alt="Vulflare"
          className="h-12 mx-auto"
        />
        <p className="text-gray-500 dark:text-gray-400 mt-2">脆弱性管理プラットフォーム</p>
      </div>
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
    </div>
  );
}
