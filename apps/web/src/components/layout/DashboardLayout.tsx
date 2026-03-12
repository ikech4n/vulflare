import { Menu } from "lucide-react";
import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar.tsx";

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* モバイルヘッダー */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-20 h-14 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 flex items-center px-4 gap-3">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
          aria-label="メニューを開く"
        >
          <Menu size={24} />
        </button>
        <span className="text-xl font-bold text-gray-900 dark:text-white">
          <span className="text-orange-500">V</span>ulflare
        </span>
      </header>

      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 overflow-auto dark:bg-gray-950 pt-14 md:pt-0">
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
